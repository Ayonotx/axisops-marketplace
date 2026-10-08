import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getSessionUser } from "@/lib/db";
import { markDealPaid, getDealView } from "@/lib/escrow";
import { verifyPayment } from "@/lib/paystack";
import { sendPushToUser } from "@/lib/push";

/** Form-post confirmation from the simulated checkout page (demo mode).
 *  Verifies then redirects back to the deal or wallet, like a Paystack
 *  callback would. GET requests redirect straight to the deal (pending). */
export async function POST(req: Request) {
  await requireSession();
  const user = getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/signin", req.url));

  const url = new URL(req.url);
  const reference = String(url.searchParams.get("reference") ?? "");
  const dealId = Number(url.searchParams.get("dealId") ?? 0);

  const verified = await verifyPayment(reference);
  if (!verified.ok || verified.status !== "success") {
    return NextResponse.redirect(new URL(`/pay/${reference}?error=not_completed`, req.url));
  }

  if (dealId > 0) {
    const paid = markDealPaid(dealId, reference, "demo");
    if (!paid.ok) {
      return NextResponse.redirect(new URL(`/deals/${dealId}?error=${encodeURIComponent(paid.error ?? "failed")}`, req.url));
    }
    const updated = getDealView(dealId);
    if (updated) {
      void sendPushToUser(updated.seller_id, {
        title: "🔒 Payment received in escrow",
        body: `${updated.buyer_name} paid GH₵ ${updated.amount.toFixed(2)} for "${updated.listing_title}" — safe to deliver.`,
        url: `/deals/${dealId}`,
        tag: `deal-${dealId}`,
      });
    }
    return NextResponse.redirect(new URL(`/deals/${dealId}?paid=1`, req.url));
  }

  // Top-up references were already credited when /api/wallet issued them.
  return NextResponse.redirect(new URL(`/wallet?topup=${encodeURIComponent(reference)}`, req.url));
}
