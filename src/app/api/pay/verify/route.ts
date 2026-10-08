import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getSessionUser } from "@/lib/db";
import { markDealPaid, getDealView } from "@/lib/escrow";
import { verifyPayment } from "@/lib/paystack";
import { sendPushToUser } from "@/lib/push";

/** Confirms payment for a deal and allocates funds into escrow. The amount
 *  is always re-read from the deal row — never trusted from the client. */
export async function POST(req: Request) {
  await requireSession();
  const user = getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { dealId?: number; reference?: string };
  const dealId = Number(body.dealId);
  const reference = String(body.reference ?? "");
  if (!Number.isFinite(dealId) || !reference) {
    return NextResponse.json({ ok: false, error: "Missing deal or reference." }, { status: 400 });
  }

  const deal = getDealView(dealId);
  if (!deal) return NextResponse.json({ ok: false, error: "Deal not found." }, { status: 404 });
  if (deal.buyer_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Not your deal." }, { status: 403 });
  }

  const verified = await verifyPayment(reference);
  if (!verified.ok || verified.status !== "success") {
    return NextResponse.json(
      { ok: false, error: verified.ok ? "Payment not completed yet." : verified.error },
      { status: 402 }
    );
  }

  const paid = markDealPaid(dealId, reference, verified.amountGhs === 0 ? "demo" : "paystack");
  if (!paid.ok) return NextResponse.json(paid, { status: 409 });
  const updated = getDealView(dealId);
  // Tell the seller their money is now safely held in escrow.
  if (updated) {
    void sendPushToUser(updated.seller_id, {
      title: "🔒 Payment received in escrow",
      body: `${updated.buyer_name} paid GH₵ ${updated.amount.toFixed(2)} for "${updated.listing_title}" — safe to deliver.`,
      url: `/deals/${dealId}`,
      tag: `deal-${dealId}`,
    });
  }
  return NextResponse.json({ ok: true, status: updated?.status });
}
