import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getSessionUser } from "@/lib/db";
import { getWalletBalance, getWalletTransactions, postTopup } from "@/lib/escrow";
import { initializePayment, makeReference, requestOrigin } from "@/lib/paystack";

export async function GET() {
  await requireSession();
  const user = getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  return NextResponse.json({
    ok: true,
    balance: getWalletBalance(user.id),
    transactions: getWalletTransactions(user.id),
  });
}

/** Top up the wallet. Live mode returns a Paystack checkout URL; demo mode
 *  credits the wallet instantly and reports a simulated checkout page. */
export async function POST(req: Request) {
  await requireSession();
  const user = getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { amount?: number };
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 5 || amount > 10000) {
    return NextResponse.json({ ok: false, error: "Enter an amount between GH₵ 5 and GH₵ 10,000." }, { status: 400 });
  }

  const reference = makeReference();
  const init = await initializePayment(
    user.email || `${user.phone}@axisops.app`,
    amount,
    reference,
    requestOrigin(req)
  );
  if (!init.ok) return NextResponse.json({ ok: false, error: init.error }, { status: 502 });

  if (init.mode === "paystack") {
    return NextResponse.json({ ok: true, mode: "paystack", checkoutUrl: init.authorizationUrl, reference });
  }
  // Demo mode: credit immediately, then hand back the simulated checkout URL
  // so the user still walks the same flow as a real payment.
  postTopup(user.id, amount, reference);
  return NextResponse.json({ ok: true, mode: "demo", checkoutUrl: init.checkoutUrl, reference });
}
