import "server-only";
import webpush from "web-push";
import { getDatabase } from "./db";

/* Web Push (VAPID) — free, no provider account. Graceful demo mode when
   VAPID keys are absent: subscribe endpoints report configured:false, and
   every send helper becomes a no-op instead of throwing. */

type VapidConfig = { publicKey: string; privateKey: string; subject: string };

let configured: VapidConfig | null = null;
function vapidConfig(): VapidConfig | null {
  if (configured) return configured;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  configured = {
    publicKey,
    privateKey,
    subject: process.env.VAPID_SUBJECT || "mailto:admin@axisops.app",
  };
  webpush.setVapidDetails(configured.subject, publicKey, privateKey);
  return configured;
}

export function pushConfigured(): boolean {
  return vapidConfig() !== null;
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

const PUSH_SCHEMA = `
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
`;

let ensured = false;
function pdb() {
  const db = getDatabase();
  if (!ensured) {
    db.exec(PUSH_SCHEMA);
    ensured = true;
  }
  return db;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export type StoredSubscription = {
  id: number;
  user_id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export function saveSubscription(
  userId: number,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } }
): { ok: boolean; error?: string } {
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return { ok: false, error: "Invalid subscription payload." };
  }
  pdb()
    .prepare(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`
    )
    .run(userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth);
  return { ok: true };
}

export function removeSubscription(endpoint: string) {
  pdb().prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(endpoint);
}

export function getSubscriptionsForUser(userId: number): StoredSubscription[] {
  return pdb()
    .prepare("SELECT * FROM push_subscriptions WHERE user_id = ?")
    .all(userId) as unknown as StoredSubscription[];
}

export function countSubscriptions(): number {
  return (pdb().prepare("SELECT COUNT(*) c FROM push_subscriptions").get() as { c: number }).c;
}

/** Sends to every subscription of a user; silently drops endpoints the push
 *  service reports as gone (410). Never throws — push must not break a
 *  chat message or a deal transition. */
export async function sendPushToUser(userId: number, payload: PushPayload): Promise<number> {
  const vapid = vapidConfig();
  if (!vapid) return 0;
  const subs = getSubscriptionsForUser(userId);
  let delivered = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 24 }
      );
      delivered++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        removeSubscription(s.endpoint);
      }
      // Other errors (network etc.) are logged but tolerated.
      console.error(`[push] send failed (${status ?? "?"}):`, e instanceof Error ? e.message : e);
    }
  }
  return delivered;
}

export async function sendBroadcast(payload: PushPayload): Promise<number> {
  const db = pdb();
  const users = db.prepare("SELECT DISTINCT user_id FROM push_subscriptions").all() as {
    user_id: number;
  }[];
  let delivered = 0;
  for (const u of users) delivered += await sendPushToUser(u.user_id, payload);
  return delivered;
}
