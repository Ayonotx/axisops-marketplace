import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getSessionUser } from "@/lib/db";
import { addReview } from "@/lib/reviews";

/** Post a deal review. Structurally gated: the caller must be the buyer of a
 *  settled escrow deal — see checkReviewEligibility in src/lib/reviews.ts. */
export async function POST(req: Request) {
  await requireSession();
  const user = getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in to review." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    dealId?: number;
    rating?: number;
    comment?: string;
  };
  const dealId = Number(body.dealId);
  const rating = Number(body.rating);
  if (!Number.isFinite(dealId)) {
    return NextResponse.json({ ok: false, error: "Missing deal." }, { status: 400 });
  }
  const result = addReview(dealId, user.id, rating, String(body.comment ?? "").trim());
  if (!result.ok) {
    // 403 for the not-your-deal/locked cases, 400 for validation problems
    const status = result.error.includes("buyer of a deal") ? 403 : 400;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json({ ok: true, reviewId: result.reviewId });
}
