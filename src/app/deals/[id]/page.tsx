import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSession, getSessionUser } from "@/lib/auth";
import { getDealView, AUTO_RELEASE_HOURS, type DealStatus } from "@/lib/escrow";
import { hasReviewedDeal } from "@/lib/reviews";
import { formatPrice, timeAgo } from "@/lib/format";
import DealActions from "@/components/DealActions";
import DealReviewForm from "@/components/DealReviewForm";

export const metadata = { title: "Deal — AxisOps Marketplace" };

const STEPS: { key: DealStatus; label: string }[] = [
  { key: "paid", label: "Paid" },
  { key: "in_escrow", label: "In escrow" },
  { key: "delivered", label: "Delivered" },
  { key: "settled", label: "Released" },
];

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dealId = Number(id);
  if (!Number.isFinite(dealId)) notFound();

  await requireSession();
  const user = getSessionUser();
  if (!user) redirect("/signin");

  const deal = getDealView(dealId);
  if (!deal) notFound();
  if (deal.buyer_id !== user.id && deal.seller_id !== user.id) notFound();

  const role: "buyer" | "seller" = deal.buyer_id === user.id ? "buyer" : "seller";
  const stepIndex = STEPS.findIndex((s) => s.key === deal.status);
  const finished = ["settled", "refunded", "cancelled"].includes(deal.status);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/deals" className="text-sm font-semibold text-brand-700 hover:underline">← All deals</Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy-900">{deal.listing_title}</h1>
        <span className="rounded-full bg-navy-900 px-3 py-1 text-xs font-bold text-white">{role === "buyer" ? "You are the buyer" : "You are the seller"}</span>
      </div>

      {/* Escrow timeline */}
      {!finished && (
        <ol className="mt-6 flex items-center">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${
                  i <= stepIndex ? "bg-brand-600 text-white" : "bg-sand-200 text-navy-800/50"
                }`}>{i + 1}</span>
                <span className={`mt-1 text-[10px] font-bold uppercase tracking-wide ${i <= stepIndex ? "text-brand-700" : "text-navy-800/40"}`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`mx-1 h-1 flex-1 rounded ${i < stepIndex ? "bg-brand-500" : "bg-sand-200"}`} />}
            </li>
          ))}
        </ol>
      )}

      {/* Money box */}
      <div className="mt-6 rounded-xl border border-sand-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-800/60">Deal amount</p>
            <p className="text-xl font-black text-navy-900">{formatPrice(deal.amount)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-800/60">{role === "seller" ? "You receive" : "Seller receives"}</p>
            <p className="text-xl font-black text-brand-700">{formatPrice(deal.seller_amount)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-800/60">Buyer protection fee</p>
            <p className="text-xl font-black text-navy-800/60">{formatPrice(deal.commission_amount)}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-navy-800/60">
          Platform commission: {deal.commission_percent}% · Other party: {role === "buyer" ? deal.seller_name : deal.buyer_name}
        </p>
      </div>

      {/* Status-specific detail */}
      {deal.delivery_note && (
        <div className="mt-4 rounded-xl bg-sky-50 p-4 text-sm text-sky-900">
          <p className="font-bold">Delivery note</p>
          <p className="mt-1">{deal.delivery_note}</p>
        </div>
      )}
      {deal.dispute_reason && (
        <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-900">
          <p className="font-bold">Dispute reason</p>
          <p className="mt-1">{deal.dispute_reason}</p>
        </div>
      )}
      {deal.status === "delivered" && deal.auto_release_at && (
        <p className="mt-4 text-xs text-navy-800/60">
          ⏱️ Funds auto-release to the seller {AUTO_RELEASE_HOURS}h after delivery unless you confirm or dispute first.
        </p>
      )}

      <div className="mt-6">
        <DealActions dealId={deal.id} status={deal.status} role={role} />
      </div>

      {/* Review gate: only the buyer of a settled, not-yet-reviewed deal sees this */}
      {role === "buyer" && deal.status === "settled" && !hasReviewedDeal(deal.id) && (
        <DealReviewForm dealId={deal.id} />
      )}
      {role === "buyer" && deal.status === "settled" && hasReviewedDeal(deal.id) && (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
          ⭐ You reviewed this deal — thank you.
        </p>
      )}

      <p className="mt-8 text-xs text-navy-800/50">Deal #{deal.id} · opened {timeAgo(deal.created_at)}</p>
    </div>
  );
}
