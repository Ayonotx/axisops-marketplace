import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getSessionUser } from "@/lib/db";
import { getDealView } from "@/lib/escrow";
import { initializePayment, makeReference, requestOrigin } from "@/lib/paystack";

/** Buyer clicks "Pay now" on a pending deal → redirects to the checkout
 *  (Paystack hosted checkout in live mode, simulated page in demo mode). */
export async function GET(req: Request, { params }: { params: Promise<{ dealId: string }> }) {
  await requireSession();
  const user = getSessionUser();
  const { dealId: raw } = await params;
  if (!user) return NextResponse.redirect(new URL("/signin", req.url));

  const dealId = Number(raw);
  const deal = getDealView(dealId);
  if (!deal || deal.buyer_id !== user.id) {
    return NextResponse.redirect(new URL("/deals?error=not_found", req.url));
  }
  if (deal.status !== "pending") {
    return NextResponse.redirect(new URL(`/deals/${dealId}`, req.url));
  }

  const reference = makeReference();
  const init = await initializePayment(
    user.email || `${user.phone}@axisops.app`,
    deal.amount,
    reference,
    requestOrigin(req)
  );
  if (!init.ok) {
    return NextResponse.redirect(new URL(`/deals/${dealId}?error=${encodeURIComponent(init.error)}`, req.url));
  }

  const checkoutUrl = init.mode === "paystack" ? init.authorizationUrl : `${init.checkoutUrl}?dealId=${dealId}`;
  return NextResponse.redirect(checkoutUrl);
}
