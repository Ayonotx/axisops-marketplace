import "server-only";
import { getDatabase } from "./db";

/* SMS provider abstraction with two modes:
   - Live: Arkesel (arkesel.com) when ARKEL_API_KEY is set. Real SMS, no devCode.
   - Demo: no key configured — the OTP is returned on screen for testing.
   Every send attempt (live or demo) is logged to sms_log for diagnostics. */

// Base URLs default to the real Arkesel API. ARKEL_API_URL may override the
// base for staging environments and integration tests against a mock provider.
const ARKESEL_BASE = process.env.ARKEL_API_URL || "https://sms.arkesel.com";
const ARKESEL_OTP_URL = `${ARKESEL_BASE}/api/v2/otp/send`;

export function smsLive(): boolean {
  return Boolean(process.env.ARKEL_API_KEY);
}

/* ---------------- Rate limiting ----------------
   Max 5 OTP requests per phone per hour, min 30s between requests. */
const MAX_PER_HOUR = 5;
const MIN_GAP_SECONDS = 30;

export function checkOtpRateLimit(phone: string): { ok: boolean; error?: string } {
  const db = getDatabase();
  const recent = db
    .prepare(
      `SELECT COUNT(*) c FROM otps
       WHERE phone = ? AND created_at >= datetime('now', '-1 hour')`
    )
    .get(phone) as { c: number };
  if (recent.c >= MAX_PER_HOUR) {
    return { ok: false, error: "Too many codes requested. Try again in an hour." };
  }
  const last = db
    .prepare(
      `SELECT created_at FROM otps WHERE phone = ? ORDER BY id DESC LIMIT 1`
    )
    .get(phone) as { created_at: string } | undefined;
  if (last) {
    const elapsed = db
      .prepare(`SELECT (julianday('now') - julianday(?)) * 86400 AS gap`)
      .get(last.created_at) as { gap: number };
    if (elapsed.gap < MIN_GAP_SECONDS) {
      return {
        ok: false,
        error: `Please wait ${Math.ceil(MIN_GAP_SECONDS - elapsed.gap)}s before requesting another code.`,
      };
    }
  }
  return { ok: true };
}

/* ---------------- Delivery log ---------------- */

export type SmsLog = {
  id: number;
  phone: string;
  provider: string;
  status: "sent" | "failed" | "demo";
  message: string;
  error: string;
  created_at: string;
};

export function logSms(phone: string, provider: string, status: SmsLog["status"], message: string, error = "") {
  getDatabase()
    .prepare("INSERT INTO sms_log (phone, provider, status, message, error) VALUES (?, ?, ?, ?, ?)")
    .run(phone, provider, status, message.slice(0, 200), error.slice(0, 300));
}

export function getSmsLogs(limit = 50): SmsLog[] {
  return getDatabase()
    .prepare("SELECT * FROM sms_log ORDER BY id DESC LIMIT ?")
    .all(limit) as unknown as SmsLog[];
}

const SMS_SCHEMA = `
CREATE TABLE IF NOT EXISTS sms_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sms_log_phone ON sms_log(phone);
`;

let ensured = false;
function sdb() {
  const db = getDatabase();
  if (!ensured) {
    db.exec(SMS_SCHEMA);
    ensured = true;
  }
  return db;
}

/* ---------------- Arkesel senders ---------------- */

type ArkeselOtpResponse = {
  status: "success" | "error";
  code?: string | number;
  sms_id?: string[];
  message?: string;
  data?: { otp_id?: string; message?: string };
};

/** Send the sign-in OTP via Arkesel's OTP endpoint (handles code + text). */
async function sendArkeselOtp(phone: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const senderId = process.env.ARKESEL_SENDER_ID || "AxisOps";
  const apiKey = process.env.ARKEL_API_KEY as string;
  const body = {
    sender_id: senderId,
    message: `Your AxisOps verification code is ${code}. It expires in 10 minutes.`,
    mobile_number: phone.replace("+", ""), // Arkesel wants local/intl without +
    // Alternative: let Arkesel generate the code — but we already generate
    // and store ours, so we send our own in the message body.
  };
  try {
    const res = await fetch(ARKESEL_OTP_URL, {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as ArkeselOtpResponse;
    if (res.ok && (json.status === "success" || res.status === 200)) {
      return { ok: true };
    }
    const err = json.message ?? `Arkesel HTTP ${res.status}`;
    logSms(phone, "arkesel", "failed", `OTP send attempt: ${err}`, err);
    return { ok: false, error: `SMS provider error: ${err}` };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    logSms(phone, "arkesel", "failed", "OTP send attempt: network error", err);
    return { ok: false, error: "Could not reach the SMS provider." };
  }
}

export type SendOtpResult =
  | { ok: true; mode: "live" | "demo" }
  | { ok: false; error: string };

/** Entry point used by /api/auth/request. Stores the OTP first (auth.ts owns
 *  generation), then delivers. Demo mode never fails. */
export async function sendOtp(phone: string, code: string): Promise<SendOtpResult> {
  sdb();
  if (!smsLive()) {
    logSms(phone, "demo", "demo", `Demo OTP ${code} shown on screen`);
    return { ok: true, mode: "demo" };
  }
  const result: { ok: boolean; error?: string } = await sendArkeselOtp(phone, code);
  if (result.ok) {
    logSms(phone, "arkesel", "sent", `OTP sent via Arkesel (sender ${process.env.ARKESEL_SENDER_ID || "AxisOps"})`);
    return { ok: true, mode: "live" };
  }
  return { ok: false, error: result.error ?? "SMS send failed." };
}
