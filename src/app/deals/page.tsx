import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getSessionUser } from "@/lib/db";
import { getDealsForUser, type DealStatus } from "@/lib/escrow";
import { formatPrice, timeAgo } from "@/lib/format";

export const metadata = { title: "My Deals — AxisOps Marketplace" };

const STATUS_BADGE: Record<DealStatus, { label: string; cls: string }> = {
  pending: { label: "Awaiting payment", cls: "bg-amber-100 text-amber-800" },
  paid: { label: "Processing", cls: "bg-sky-100 text-sky-800" },
  in_escrow: { label: "In escrow", cls: "bg-violet-100 text-violet-800" },
  delivered: { label: "Delivered — confirm it", cls: "bg-brand-100 text-brand-800" },
  settled: { label: "Completed ✅", cls: "bg-emerald-100 text-emerald-800" },
  reopened: { label: "Disputed", cls: "bg-red-100 text-red-800" },
  refunded: { label: "Refunded", cls: "bg-stone-200 text-stone-700" },
  cancelled: { label: "Cancelled", cls: "bg-stone-200 text-stone-700" },
};

export default async function DealsPage() {
  await requireSession();
  const user = getSessionUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-4xl">🤝</p>
        <h1 className="mt-3 text-2xl font-extrabold text-navy-900">Sign in to see your deals</h1>
        <Link href="/signin" className="mt-5 inline-block rounded-lg bg-brand-600 px-6 py-3 font-bold text-white">Sign in</Link>
      </div>
    );
  }

  const { buying, selling } = getDealsForUser(user.id);

  function DealRow({ d, role }: { d: (typeof buying)[number]; role: "buying" | "selling" }) {
    const badge = STATUS_BADGE[d.status] ?? STATUS_BADGE.pending;
    return (
      <Link href={`/deals/${d.id}`} className="block rounded-xl border border-sand-200 bg-white p-4 shadow-sm transition hover:border-brand-400 hover:shadow">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${badge.cls}`}>{badge.label}</span>
          <span className="text-xs text-navy-800/60">{timeAgo(d.created_at)}</span>
        </div>
        <p className="mt-2 font-bold text-navy-900 line-clamp-1">{d.listing_title}</p>
        <p className="mt-0.5 text-sm text-navy-800/70">
          {role === "buying" ? `Seller: ${d.seller_name}` : `Buyer: ${d.buyer_name}`} ·{" "}
          <span className="font-extrabold text-brand-700">{formatPrice(d.amount)}</span>
          {role === "selling" && d.status === "settled" && (
            <span className="ml-1 text-xs">→ you received {formatPrice(d.seller_amount)}</span>
          )}
        </p>
      </Link>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-extrabold tracking-tight text-navy-900">🤝 Escrow Deals</h1>
      <p className="text-sm text-navy-800/70">Protected purchases and sales — money moves only when both sides are happy.</p>

      {buying.length === 0 && selling.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-sand-200 bg-white p-10 text-center">
          <p className="text-4xl">🛒</p>
          <p className="mt-2 font-bold text-navy-900">No deals yet</p>
          <p className="text-sm text-navy-800/70">Tap “Buy with Escrow” on any listing to start a protected deal.</p>
          <Link href="/browse" className="mt-4 inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-bold text-white">Browse listings</Link>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {buying.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-navy-800/70">Buying ({buying.length})</h2>
              <div className="space-y-2">{buying.map((d) => <DealRow key={d.id} d={d} role="buying" />)}</div>
            </section>
          )}
          {selling.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-navy-800/70">Selling ({selling.length})</h2>
              <div className="space-y-2">{selling.map((d) => <DealRow key={d.id} d={d} role="selling" />)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
