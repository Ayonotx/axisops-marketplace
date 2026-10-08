import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getSessionUser } from "@/lib/db";
import { createDeal } from "@/lib/escrow";

/** Creates an escrow deal and hands back the checkout entry point, which
 *  initializes the payment (Paystack live / demo) and carries the dealId. */
export async function POST(req: Request) {
  await requireSession();
  const user = getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in to buy safely." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { listingId?: number };
  const listingId = Number(body.listingId);
  if (!Number.isFinite(listingId)) {
    return NextResponse.json({ ok: false, error: "Missing listing." }, { status: 400 });
  }

  const deal = createDeal(listingId, user.id);
  if (!deal.ok) return NextResponse.json(deal, { status: 400 });

  return NextResponse.json({
    ok: true,
    dealId: deal.dealId,
    checkoutUrl: `/api/pay/checkout/${deal.dealId}`,
  });
}
