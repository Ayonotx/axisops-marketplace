import "server-only";
import { getDatabase } from "./db";

/* Reviews — structurally gated by completed escrow deals.
   A review row can only exist for a deal whose status is 'settled' and whose
   reviewer is that deal's buyer. UNIQUE(deal_id) makes one-review-per-deal a
   database guarantee, and the buyer/seller/status checks in addReview() make
   fake reviews impossible without going through the escrow flow first. */

export type Review = {
  id: number;
  deal_id: number;
  listing_id: number;
  reviewer_id: number;
  seller_id: number;
  rating: number;
  comment: string;
  created_at: string;
};

const REVIEWS_SCHEMA = `
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id INTEGER NOT NULL UNIQUE REFERENCES deals(id),
  listing_id INTEGER NOT NULL REFERENCES listings(id),
  reviewer_id INTEGER NOT NULL REFERENCES users(id),
  seller_id INTEGER NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reviews_seller ON reviews(seller_id);
`;

let ensured = false;
function rdb() {
  const db = getDatabase();
  if (!ensured) {
    db.exec(REVIEWS_SCHEMA);
    ensured = true;
  }
  return db;
}

export type ReviewEligibility =
  | { eligible: true; deal: { id: number; listing_id: number; seller_id: number } }
  | { eligible: false; reason: string };

/** Structural gate: only the buyer of a settled deal can review it. */
export function checkReviewEligibility(dealId: number, reviewerId: number): ReviewEligibility {
  const deal = rdb()
    .prepare("SELECT id, listing_id, buyer_id, seller_id, status FROM deals WHERE id = ?")
    .get(dealId) as
    | { id: number; listing_id: number; buyer_id: number; seller_id: number; status: string }
    | undefined;
  if (!deal) return { eligible: false, reason: "Deal not found." };
  if (deal.buyer_id !== reviewerId)
    return { eligible: false, reason: "Only the buyer of a deal can review it." };
  if (deal.status !== "settled")
    return { eligible: false, reason: "Reviews unlock only after a completed escrow deal." };
  const existing = rdb()
    .prepare("SELECT 1 FROM reviews WHERE deal_id = ?")
    .get(dealId);
  if (existing)
    return { eligible: false, reason: "This deal has already been reviewed." };
  return { eligible: true, deal };
}

export function addReview(
  dealId: number,
  reviewerId: number,
  rating: number,
  comment: string
): { ok: true; reviewId: number } | { ok: false; error: string } {
  const eligibility = checkReviewEligibility(dealId, reviewerId);
  if (!eligibility.eligible) return { ok: false, error: eligibility.reason };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    return { ok: false, error: "Rating must be a whole number from 1 to 5." };
  const res = rdb()
    .prepare(
      "INSERT INTO reviews (deal_id, listing_id, reviewer_id, seller_id, rating, comment) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(
      dealId,
      eligibility.deal.listing_id,
      reviewerId,
      eligibility.deal.seller_id,
      rating,
      comment.slice(0, 500)
    );
  return { ok: true, reviewId: Number(res.lastInsertRowid) };
}

/** Trust stats shown on listing pages: real completed deals + real review average. */
export function getSellerTrustStats(sellerId: number): {
  completedDeals: number;
  avgRating: number;
  reviewCount: number;
} {
  const db = rdb();
  const deals = (db
    .prepare("SELECT COUNT(*) c FROM deals WHERE seller_id = ? AND status = 'settled'")
    .get(sellerId) as { c: number }).c;
  const agg = db
    .prepare("SELECT COALESCE(AVG(rating), 0) avg, COUNT(*) c FROM reviews WHERE seller_id = ?")
    .get(sellerId) as { avg: number; c: number };
  return {
    completedDeals: deals,
    avgRating: Math.round(agg.avg * 10) / 10,
    reviewCount: agg.c,
  };
}

export function hasReviewedDeal(dealId: number): boolean {
  return Boolean(rdb().prepare("SELECT 1 FROM reviews WHERE deal_id = ?").get(dealId));
}
