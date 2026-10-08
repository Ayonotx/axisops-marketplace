import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getWalletBalance, getDealView } from "@/lib/escrow";
import { requireSession, getSessionUser } from "@/lib/auth";
import { paystackEnabled } from "@/lib/paystack";

export const metadata = { title: "Checkout — AxisOps Marketplace" };

/** Simulated hosted checkout (demo mode only). Mirrors the Paystack flow:
 *  buyer sees amount → confirms → server verifies → deal moves to escrow. */
export default async function DemoCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ dealId?: string }>;
}) {
  const { reference } = await params;
  const { dealId: dealIdRaw } = await searchParams;

  await requireSession();
  const user = getSessionUser();
  if (!user) redirect("/signin");

  // Live Paystack mode never lands here — it has its own hosted checkout.
  if (paystackEnabled()) redirect("/wallet");

  const dealId = Number(dealIdRaw ?? 0);
  const deal = Number.isFinite(dealId) && dealId > 0 ? getDealView(dealId) : undefined;
  if (deal && deal.buyer_id !== user.id) notFound();

  const balance = getWalletBalance(user.id);
  const amount = deal ? deal.amount : 0;

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-sand-200 bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-black text-navy-900">AxisOps Pay</span>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">
            DEMO MODE
          </span>
        </div>
        <p className="mt-1 text-xs text-navy-800/60">
          Simulated secure checkout — no real money moves until Paystack keys are added in .env.local.
        </p>

        <div className="mt-5 rounded-xl bg-sand-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-800/60">Paying for</p>
          <p className="mt-1 font-bold text-navy-900">{deal ? deal.listing_title : "Wallet top-up"}</p>
          <p className="mt-3 text-3xl font-black text-brand-700">GH₵ {amount.toLocaleString()}</p>
          {deal && (
            <p className="mt-1 text-xs text-navy-800/70">
              Held in escrow · released to {deal.seller_name} only after you confirm delivery
            </p>
          )}
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-navy-800/70">Payment method</span><span className="font-semibold">MTN MoMo / Card</span></div>
          <div className="flex justify-between"><span className="text-navy-800/70">Reference</span><span className="font-mono text-xs">{reference}</span></div>
          <div className="flex justify-between"><span className="text-navy-800/70">Wallet balance</span><span className="font-semibold">GH₵ {balance.toFixed(2)}</span></div>
        </div>

        <form action={`/api/pay/demo-confirm?reference=${encodeURIComponent(reference)}&dealId=${deal?.id ?? 0}`} method="post" className="mt-5">
          <button className="w-full rounded-lg bg-brand-600 px-4 py-3 font-extrabold text-white hover:bg-brand-700">
            ✅ Simulate successful payment
          </button>
        </form>
        <Link href={deal ? `/deals/${deal.id}` : "/wallet"} className="mt-2 block rounded-lg border border-sand-200 px-4 py-2.5 text-center text-sm font-semibold text-navy-800">
          Cancel
        </Link>
      </div>
    </div>
  );
}
