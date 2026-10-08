import "server-only";
import { cookies } from "next/headers";
import { setSessionTokenProvider, getDatabase, normalizePhone, getSessionUser } from "./db";
import crypto from "node:crypto";

/* Register the token provider so db.ts's sync getSessionUser() can read the
   token stashed here at request time — without db.ts importing next/headers
   directly (avoids circular imports). */
setSessionTokenProvider(() => currentToken);

let currentToken: string | undefined;

const SESSION_COOKIE = "axisops_session";
const SESSION_DAYS = 30;

export { normalizePhone };
export { getSessionUser };

/** Step 1 of OTP flow: create a code. In dev/demo we return it so it can be
 *  displayed on screen; a real deployment would send via SMS gateway. */
export function createOtp(phone: string): { code: string; expiresAt: string } {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const db = getDatabase();
  db.prepare(
    `INSERT INTO otps (phone, code, purpose, expires_at) VALUES (?, ?, 'signin', datetime('now', '+10 minutes'))`
  ).run(phone, code);
  return { code, expiresAt: new Date(Date.now() + 10 * 60_000).toISOString() };
}

export function verifyOtp(phone: string, code: string): { ok: boolean; error?: string } {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT id, code, attempts, expires_at FROM otps
       WHERE phone = ? AND consumed = 0 ORDER BY id DESC LIMIT 1`
    )
    .get(phone) as { id: number; code: string; attempts: number; expires_at: string } | undefined;
  if (!row) return { ok: false, error: "Request a new code — none is pending." };
  if (row.attempts >= 5) return { ok: false, error: "Too many attempts. Request a new code." };
  // SQLite datetime('now') format is 'YYYY-MM-DD HH:MM:SS' — compare as strings
  if (row.expires_at <= new Date().toISOString().slice(0, 19).replace("T", " "))
    return { ok: false, error: "Code expired. Request a new one." };
  if (row.code !== code.trim()) {
    db.prepare("UPDATE otps SET attempts = attempts + 1 WHERE id = ?").run(row.id);
    return { ok: false, error: "Incorrect code. Please try again." };
  }
  db.prepare("UPDATE otps SET consumed = 1 WHERE id = ?").run(row.id);
  return { ok: true };
}

/** Step 2: consume OTP, find-or-create the user, start a session. */
export function signInWithOtp(
  phone: string,
  code: string
): { ok: boolean; userId?: number; token?: string; error?: string } {
  const v = verifyOtp(phone, code);
  if (!v.ok) return v;

  const db = getDatabase();
  let user = db.prepare("SELECT id FROM users WHERE phone = ?").get(phone) as
    | { id: number }
    | undefined;
  if (!user) {
    const name = "Member " + phone.slice(-4);
    const res = db
      .prepare(
        `INSERT INTO users (name, username, account_type, location, phone, email, bio)
         VALUES (?, ?, 'individual', 'Ghana', ?, '', 'Welcome to AxisOps Marketplace.')`
      )
      .run(name, `user${phone.replace(/\D/g, "").slice(-9) || Date.now()}`, phone);
    user = { id: Number(res.lastInsertRowid) };
  }
  const token = startSession(user.id);
  return { ok: true, userId: user.id, token };
}

function startSession(userId: number): string {
  const token = crypto.randomBytes(32).toString("hex");
  getDatabase()
    .prepare(
      `INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, datetime('now', '+${SESSION_DAYS} days'))`
    )
    .run(token, userId);
  return token;
}

/** Sets the session cookie. Falls back to false outside a request scope. */
export async function setSessionCookie(token: string): Promise<boolean> {
  try {
    (await cookies()).set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DAYS * 24 * 60 * 60,
    });
    return true;
  } catch {
    return false;
  }
}

/** Reads the session cookie for the current request and caches the token so
   db.ts's sync getSessionUser() can pick it up — must be awaited before any
   getCurrentUser() call in this request. */
export async function requireSession(): Promise<string | undefined> {
  currentToken = (await cookies()).get(SESSION_COOKIE)?.value;
  return currentToken;
}

export async function signOut(): Promise<void> {
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (token) {
      getDatabase().prepare("DELETE FROM sessions WHERE id = ?").run(token);
    }
    jar.delete(SESSION_COOKIE);
  } catch {}
  currentToken = undefined;
}
