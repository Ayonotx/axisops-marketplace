import "server-only";
import { getDatabase } from "./db";

/* ============================================================
   MONEY — wallets, escrow deals, payouts, platform revenue
   All mutations run through this module. The signed balance of
   every wallet is the SUM of its immutable ledger rows, so the
   ledger can never drift from the displayed balance.
   ============================================================ */

export type DealStatus =
  | "pending"      // created, awaiting buyer payment
  | "paid"         // payment verified, being allocated to escrow
  | "in_escrow"    // funds held — seller should deliver
  | "delivered"    // seller marked delivered — buyer must confirm
  | "settled"      // buyer confirmed / auto-released — seller paid out
  | "reopened"     // buyer disputed — admin must resolve
  | "refunded"     // admin refunded the buyer
  | "cancelled";   // buyer cancelled before paying

export type Deal = {
  id: number;
  listing_id: number;
  buyer_id: number;
  seller_id: number;
  amount: number;             // total paid by buyer
  commission_percent: number;
  commission_amount: number;  // platform cut, credited to platform ledger
  seller_amount: number;      // what the seller receives on settle
  status: DealStatus;
  delivery_note: string;
  dispute_reason: string;
  payment_ref: string | null;
  auto_release_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WalletTransaction = {
  id: number;
  user_id: number;
  amount: number; // signed: negative = money left the wallet
  type:
    | "topup" | "topup_demo"
    | "escrow_payment" | "escrow_release" | "commission" | "refund"
    | "withdrawal" | "withdrawal_refund"
    | "boost_purchase";
  ref: string;
  description: string;
  created_at: string;
};

export type Payout = {
  id: number;
  user_id: number;
  amount: number;
  method: string;
  momo_number: string;
  network: string;
  status: "pending" | "paid" | "rejected";
  note: string;
  created_at: string;
  processed_at: string | null;
};

export const BOOST_BUNDLES = {
  boost3: { label: "Boost — 3 days", days: 3, price: 15, emoji: "⚡" },
  feature7: { label: "Featured — 7 days", days: 7, price: 30, emoji: "⭐" },
  premium30: { label: "Premium — 30 days", days: 30, price: 80, emoji: "👑" },
} as const;
export type BoostBundleKey = keyof typeof BOOST_BUNDLES;

export const AUTO_RELEASE_HOURS = 72;

const MONEY_SCHEMA = `
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  type TEXT NOT NULL,
  ref TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_wtx_user ON wallet_transactions(user_id, id);

CREATE TABLE IF NOT EXISTS deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES listings(id),
  buyer_id INTEGER NOT NULL REFERENCES users(id),
  seller_id INTEGER NOT NULL REFERENCES users(id),
  amount REAL NOT NULL,
  commission_percent REAL NOT NULL,
  commission_amount REAL NOT NULL,
  seller_amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  delivery_note TEXT NOT NULL DEFAULT '',
  dispute_reason TEXT NOT NULL DEFAULT '',
  payment_ref TEXT,
  auto_release_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_deals_buyer ON deals(buyer_id);
CREATE INDEX IF NOT EXISTS idx_deals_seller ON deals(seller_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);

CREATE TABLE IF NOT EXISTS payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  amount REAL NOT NULL,
  method TEXT NOT NULL DEFAULT 'momo',
  momo_number TEXT NOT NULL,
  network TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_payouts_user ON payouts(user_id);

CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

let ensured = false;
/** Wallet/deals/payouts schema lives here so db.ts stays unchanged. */
function mdb() {
  const db = getDatabase();
  if (!ensured) {
    db.exec(MONEY_SCHEMA);
    try { db.exec("ALTER TABLE listings ADD COLUMN featured_until TEXT"); } catch { /* exists */ }
    ensured = true;
  }
  return db;
}

function nowPlus(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

/* ---------------- Platform settings (commission) ---------------- */

export function getCommissionPercent(): number {
  const row = mdb()
    .prepare("SELECT value FROM platform_settings WHERE key = 'commission_percent'")
    .get() as { value: string } | undefined;
  const pct = row ? Number(row.value) : 5;
  return Number.isFinite(pct) ? Math.min(50, Math.max(0, pct)) : 5;
}

export function setCommissionPercent(pct: number): { ok: boolean; error?: string } {
  if (!Number.isFinite(pct) || pct < 0 || pct > 50)
    return { ok: false, error: "Commission must be between 0 and 50 percent." };
  mdb()
    .prepare(
      `INSERT INTO platform_settings (key, value) VALUES ('commission_percent', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(String(pct));
  return { ok: true };
}

/* ---------------- Wallet ---------------- */

export function getWalletBalance(userId: number): number {
  const row = mdb()
    .prepare("SELECT COALESCE(SUM(amount), 0) AS bal FROM wallet_transactions WHERE user_id = ?")
    .get(userId) as { bal: number };
  return Math.round(row.bal * 100) / 100;
}

export function getWalletTransactions(userId: number, limit = 50): WalletTransaction[] {
  return mdb()
    .prepare(
      "SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY id DESC LIMIT ?"
    )
    .all(userId, limit) as unknown as WalletTransaction[];
}

function postLedger(
  userId: number,
  amount: number,
  type: WalletTransaction["type"],
  ref: string,
  description: string
) {
  mdb()
    .prepare(
      "INSERT INTO wallet_transactions (user_id, amount, type, ref, description) VALUES (?, ?, ?, ?, ?)"
    )
    .run(userId, Math.round(amount * 100) / 100, type, ref, description);
}

/** Credits a wallet top-up (demo mode credits instantly; live mode is called
 *  from the verify/webhook path after Paystack confirms). */
export function postTopup(userId: number, amount: number, reference: string) {
  postLedger(userId, amount, "topup", reference, `Wallet top-up`);
}

/* ---------------- Deals: creation ---------------- */

export function createDeal(
  listingId: number,
  buyerId: number
): { ok: true; dealId: number } | { ok: false; error: string } {
  const db = mdb();
  const listing = db
    .prepare("SELECT id, user_id, price, title, status FROM listings WHERE id = ?")
    .get(listingId) as
    | { id: number; user_id: number; price: number; title: string; status: string }
    | undefined;
  if (!listing) return { ok: false, error: "Listing not found." };
  if (listing.user_id === buyerId)
    return { ok: false, error: "You cannot buy your own listing." };
  if (listing.status !== "active")
    return { ok: false, error: "This listing is no longer available." };

  const open = db
    .prepare(
      `SELECT id FROM deals WHERE listing_id = ? AND buyer_id = ?
       AND status IN ('pending','paid','in_escrow','delivered','reopened')`
    )
    .get(listingId, buyerId) as { id: number } | undefined;
  if (open) return { ok: true, dealId: open.id };

  const pct = getCommissionPercent();
  const commission = Math.round(listing.price * pct) / 100;
  const res = db
    .prepare(
      `INSERT INTO deals (listing_id, buyer_id, seller_id, amount, commission_percent, commission_amount, seller_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      listingId,
      buyerId,
      listing.user_id,
      listing.price,
      pct,
      commission,
      Math.round((listing.price - commission) * 100) / 100
    );
  return { ok: true, dealId: Number(res.lastInsertRowid) };
}

export type DealView = Deal & {
  listing_title: string;
  buyer_name: string;
  seller_name: string;
};

function dealViewRow(id: number): DealView | undefined {
  return mdb()
    .prepare(
      `SELECT d.*, l.title as listing_title,
              b.name as buyer_name, s.name as seller_name
       FROM deals d
       JOIN listings l ON l.id = d.listing_id
       JOIN users b ON b.id = d.buyer_id
       JOIN users s ON s.id = d.seller_id
       WHERE d.id = ?`
    )
    .get(id) as DealView | undefined;
}

export function getDealView(id: number): DealView | undefined {
  return dealViewRow(id);
}

export function getDealsForUser(userId: number): { buying: DealView[]; selling: DealView[] } {
  const rows = mdb()
    .prepare(
      `SELECT d.*, l.title as listing_title,
              b.name as buyer_name, s.name as seller_name
       FROM deals d
       JOIN listings l ON l.id = d.listing_id
       JOIN users b ON b.id = d.buyer_id
       JOIN users s ON s.id = d.seller_id
       WHERE d.buyer_id = ? OR d.seller_id = ?
       ORDER BY d.id DESC LIMIT 100`
    )
    .all(userId, userId) as unknown as DealView[];
  return {
    buying: rows.filter((d) => d.buyer_id === userId),
    selling: rows.filter((d) => d.seller_id === userId),
  };
}

/* ---------------- Deals: state machine ----------------
   pending → paid → in_escrow → delivered → settled
                                  ↘ reopened → settled | refunded
   pending → cancelled (buyer, before payment)
------------------------------------------------------- */

const TRANSITIONS: Record<string, DealStatus[]> = {
  pending: ["paid", "cancelled"],
  paid: ["in_escrow"],
  in_escrow: ["delivered", "reopened", "refunded"],
  delivered: ["settled", "reopened"],
  reopened: ["settled", "refunded"],
  settled: [],
  refunded: [],
  cancelled: [],
};

function transition(dealId: number, from: DealStatus, to: DealStatus): boolean {
  const allowed = TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) return false;
  const res = mdb()
    .prepare(
      "UPDATE deals SET status = ?, updated_at = datetime('now') WHERE id = ? AND status = ?"
    )
    .run(to, dealId, from);
  return Number(res.changes) === 1;
}

/** Marks the deal paid and allocates the funds into escrow. The buyer's
 *  ledger shows the payment; the money is now held by the platform. */
export function markDealPaid(
  dealId: number,
  paymentRef: string,
  source: "paystack" | "demo"
): { ok: boolean; error?: string } {
  const deal = dealViewRow(dealId);
  if (!deal) return { ok: false, error: "Deal not found." };
  if (deal.status !== "pending")
    return { ok: false, error: "This deal was already paid or is no longer pending." };

  if (!transition(dealId, "pending", "paid"))
    return { ok: false, error: "Payment race detected — refresh and retry." };
  mdb()
    .prepare("UPDATE deals SET payment_ref = ?, updated_at = datetime('now') WHERE id = ?")
    .run(paymentRef, dealId);
  if (!transition(dealId, "paid", "in_escrow"))
    return { ok: false, error: "Could not allocate escrow." };

  postLedger(
    deal.buyer_id,
    -deal.amount,
    "escrow_payment",
    `deal:${dealId}`,
    `Escrow payment for "${deal.listing_title}" (${source})`
  );
  return { ok: true };
}

export function markDelivered(
  dealId: number,
  sellerId: number,
  note: string
): { ok: boolean; error?: string } {
  const deal = dealViewRow(dealId);
  if (!deal) return { ok: false, error: "Deal not found." };
  if (deal.seller_id !== sellerId) return { ok: false, error: "Only the seller can mark delivery." };
  if (!transition(dealId, "in_escrow", "delivered"))
    return { ok: false, error: `Cannot deliver a deal in "${deal.status}" state.` };
  mdb()
    .prepare(
      "UPDATE deals SET delivery_note = ?, auto_release_at = ?, updated_at = datetime('now') WHERE id = ?"
    )
    .run(note.slice(0, 500), nowPlus(AUTO_RELEASE_HOURS), dealId);
  return { ok: true };
}

/** Settles a delivered/reopened deal: seller credited, platform takes commission. */
export function settleDeal(dealId: number, via: "buyer_confirm" | "auto_release" | "admin_release"): { ok: boolean; error?: string } {
  const deal = dealViewRow(dealId);
  if (!deal) return { ok: false, error: "Deal not found." };
  if (deal.status !== "delivered" && deal.status !== "reopened")
    return { ok: false, error: `Cannot settle a deal in "${deal.status}" state.` };
  if (!transition(dealId, deal.status, "settled"))
    return { ok: false, error: "Settle race detected." };

  postLedger(
    deal.seller_id,
    deal.seller_amount,
    "escrow_release",
    `deal:${dealId}`,
    `Escrow released for "${deal.listing_title}" (${via})`
  );
  postLedger(
    0, // platform ledger
    deal.commission_amount,
    "commission",
    `deal:${dealId}`,
    `Commission (${deal.commission_percent}%) on "${deal.listing_title}"`
  );
  mdb().prepare("UPDATE listings SET status = 'sold' WHERE id = ?").run(deal.listing_id);
  return { ok: true };
}

export function confirmDeal(dealId: number, buyerId: number): { ok: boolean; error?: string } {
  const deal = dealViewRow(dealId);
  if (!deal) return { ok: false, error: "Deal not found." };
  if (deal.buyer_id !== buyerId) return { ok: false, error: "Only the buyer can confirm receipt." };
  if (deal.status !== "delivered")
    return { ok: false, error: `Cannot confirm a deal in "${deal.status}" state.` };
  return settleDeal(dealId, "buyer_confirm");
}

export function disputeDeal(dealId: number, buyerId: number, reason: string): { ok: boolean; error?: string } {
  const deal = dealViewRow(dealId);
  if (!deal) return { ok: false, error: "Deal not found." };
  if (deal.buyer_id !== buyerId) return { ok: false, error: "Only the buyer can open a dispute." };
  if (!reason.trim()) return { ok: false, error: "Describe the problem to open a dispute." };
  if (!transition(dealId, deal.status, "reopened"))
    return { ok: false, error: `Cannot dispute a deal in "${deal.status}" state.` };
  mdb()
    .prepare("UPDATE deals SET dispute_reason = ?, updated_at = datetime('now') WHERE id = ?")
    .run(reason.slice(0, 500), dealId);
  return { ok: true };
}

export function cancelDeal(dealId: number, buyerId: number): { ok: boolean; error?: string } {
  const deal = dealViewRow(dealId);
  if (!deal) return { ok: false, error: "Deal not found." };
  if (deal.buyer_id !== buyerId) return { ok: false, error: "Only the buyer can cancel." };
  if (!transition(dealId, "pending", "cancelled"))
    return { ok: false, error: "Only unpaid deals can be cancelled." };
  return { ok: true };
}

/** Admin resolves a dispute: money goes to the seller — or back to the buyer. */
export function resolveDealAdmin(
  dealId: number,
  resolution: "release" | "refund"
): { ok: boolean; error?: string } {
  const deal = dealViewRow(dealId);
  if (!deal) return { ok: false, error: "Deal not found." };
  if (resolution === "release") return settleDeal(dealId, "admin_release");
  if (deal.status !== "reopened" && deal.status !== "in_escrow")
    return { ok: false, error: `Cannot refund a deal in "${deal.status}" state.` };
  if (!transition(dealId, deal.status, "refunded"))
    return { ok: false, error: "Refund race detected." };
  postLedger(
    deal.buyer_id,
    deal.amount,
    "refund",
    `deal:${dealId}`,
    `Escrow refund for "${deal.listing_title}"`
  );
  return { ok: true };
}

/** 72h auto-release: delivered deals past their deadline settle automatically.
 *  Also un-features listings whose paid boost/feature window expired. */
export function sweepAutoRelease(): { dealsSettled: number; boostsExpired: number } {
  const db = mdb();
  const stale = db
    .prepare(
      `SELECT id FROM deals WHERE status = 'delivered'
       AND auto_release_at IS NOT NULL AND auto_release_at <= datetime('now')`
    )
    .all() as { id: number }[];
  let dealsSettled = 0;
  for (const d of stale) {
    if (settleDeal(d.id, "auto_release").ok) dealsSettled++;
  }
  const exp = db
    .prepare(
      `UPDATE listings SET featured = 0
       WHERE featured = 1 AND featured_until IS NOT NULL AND featured_until <= datetime('now')`
    )
    .run();
  return { dealsSettled, boostsExpired: Number(exp.changes) };
}

/* ---------------- Payouts (MoMo withdrawals) ---------------- */

export function createPayout(
  userId: number,
  amount: number,
  momoNumber: string,
  network: string
): { ok: true; payoutId: number } | { ok: false; error: string } {
  if (!Number.isFinite(amount) || amount < 20)
    return { ok: false, error: "Minimum withdrawal is GH₵ 20." };
  if (!/^0\d{9}$/.test(momoNumber.replace(/\s/g, "")))
    return { ok: false, error: "Enter a valid MoMo number (e.g. 024 123 4567)." };
  if (!network) return { ok: false, error: "Choose your mobile money network." };
  const balance = getWalletBalance(userId);
  if (amount > balance)
    return { ok: false, error: `Insufficient balance — you have GH₵ ${balance.toFixed(2)}.` };
  // Reserve the funds immediately; admin rejection credits them back.
  postLedger(userId, -amount, "withdrawal", "", `Withdrawal to ${network} ${momoNumber}`);
  const res = mdb()
    .prepare(
      "INSERT INTO payouts (user_id, amount, momo_number, network) VALUES (?, ?, ?, ?)"
    )
    .run(userId, amount, momoNumber.replace(/\s/g, ""), network);
  return { ok: true, payoutId: Number(res.lastInsertRowid) };
}

export function getPayoutsForUser(userId: number): Payout[] {
  return mdb()
    .prepare("SELECT * FROM payouts WHERE user_id = ? ORDER BY id DESC LIMIT 30")
    .all(userId) as unknown as Payout[];
}

export function adminProcessPayout(
  payoutId: number,
  decision: "paid" | "rejected"
): { ok: boolean; error?: string } {
  const db = mdb();
  const payout = db.prepare("SELECT * FROM payouts WHERE id = ?").get(payoutId) as
    | Payout
    | undefined;
  if (!payout) return { ok: false, error: "Payout not found." };
  if (payout.status !== "pending") return { ok: false, error: "Payout already processed." };
  if (decision === "rejected") {
    postLedger(
      payout.user_id,
      payout.amount,
      "withdrawal_refund",
      `payout:${payoutId}`,
      "Withdrawal rejected — funds returned to wallet"
    );
  }
  db.prepare("UPDATE payouts SET status = ?, processed_at = datetime('now') WHERE id = ?").run(
    decision,
    payoutId
  );
  return { ok: true };
}

/* ---------------- Boosts (paid visibility from wallet) ---------------- */

export function purchaseBoost(
  userId: number,
  listingId: number,
  bundleKey: BoostBundleKey
): { ok: true; charged: number } | { ok: false; error: string } {
  const bundle = BOOST_BUNDLES[bundleKey];
  if (!bundle) return { ok: false, error: "Unknown boost bundle." };
  const db = mdb();
  const listing = db
    .prepare("SELECT id, user_id, title, status FROM listings WHERE id = ?")
    .get(listingId) as { id: number; user_id: number; title: string; status: string } | undefined;
  if (!listing) return { ok: false, error: "Listing not found." };
  if (listing.user_id !== userId) return { ok: false, error: "Not your listing." };
  if (listing.status !== "active")
    return { ok: false, error: "Only active listings can be boosted." };
  if (getWalletBalance(userId) < bundle.price)
    return { ok: false, error: `Not enough wallet credit — this bundle costs GH₵ ${bundle.price}. Top up first.` };

  postLedger(userId, -bundle.price, "boost_purchase", `listing:${listingId}`, `${bundle.label} for "${listing.title}"`);
  db.prepare(
    "UPDATE listings SET featured = 1, featured_until = ? WHERE id = ?"
  ).run(nowPlus(bundle.days * 24), listingId);
  return { ok: true, charged: bundle.price };
}

/* ---------------- Admin finance stats ---------------- */

export function getFinanceStats() {
  const db = mdb();
  const escrowHeld = (db
    .prepare(
      `SELECT COALESCE(SUM(amount),0) c FROM deals
       WHERE status IN ('in_escrow','delivered','reopened')`
    )
    .get() as { c: number }).c;
  const commission = (db
    .prepare("SELECT COALESCE(SUM(amount),0) c FROM wallet_transactions WHERE type = 'commission'")
    .get() as { c: number }).c;
  const boostsRevenue = (db
    .prepare("SELECT COALESCE(SUM(amount),0) c FROM wallet_transactions WHERE type = 'boost_purchase'")
    .get() as { c: number }).c;
  const payoutsPending = (db
    .prepare("SELECT COALESCE(SUM(amount),0) c FROM payouts WHERE status = 'pending'")
    .get() as { c: number }).c;
  const payoutsPaid = (db
    .prepare("SELECT COALESCE(SUM(amount),0) c FROM payouts WHERE status = 'paid'")
    .get() as { c: number }).c;
  const dealsByStatus = (
    db.prepare("SELECT status, COUNT(*) c FROM deals GROUP BY status").all() as {
      status: string;
      c: number;
    }[]
  ).reduce<Record<string, number>>((acc, r) => ((acc[r.status] = r.c), acc), {});
  return { escrowHeld, commission, boostsRevenue, payoutsPending, payoutsPaid, dealsByStatus };
}

export function getAllDeals(limit = 100): DealView[] {
  return mdb()
    .prepare(
      `SELECT d.*, l.title as listing_title,
              b.name as buyer_name, s.name as seller_name
       FROM deals d
       JOIN listings l ON l.id = d.listing_id
       JOIN users b ON b.id = d.buyer_id
       JOIN users s ON s.id = d.seller_id
       ORDER BY d.id DESC LIMIT ?`
    )
    .all(limit) as unknown as DealView[];
}

export function getAllPayouts(limit = 100): Payout[] {
  return mdb()
    .prepare("SELECT * FROM payouts ORDER BY id DESC LIMIT ?").all(limit) as unknown as Payout[];
}
