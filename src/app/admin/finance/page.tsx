import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession, getSessionUser } from "@/lib/auth";
import {
  getFinanceStats,
  getAllDeals,
  getAllPayouts,
  getCommissionPercent,
  sweepAutoRelease,
  resolveDealAdmin,
  type DealStatus,
} from "@/lib/escrow";
import { formatPrice, timeAgo } from "@/lib/format";
import { PayoutActions, CommissionForm } from "@/components/AdminFinanceActions";

export const metadata = { title: "Finance — AxisOps Admin" };

const DEAL_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  paid: "bg-sky-100 text-sky-800",
  in_escrow: "bg-violet-100 text-violet-800",
  delivered: "bg-brand-100 text-brand-800",
  settled: "bg-emerald-100 text-emerald-800",
  reopened: "bg-red-100 text-red-800",
  refunded: "bg-stone-200 text-stone-700",
  cancelled: "bg-stone-200 text-stone-700",
};

export default async function AdminFinancePage() {
  await requireSession();
  const user = getSessionUser();
  if (!user || user.role !== "admin") redirect("/admin");

  // Opportunistic sweep: settle expired auto-releases and expire boosts.
  const swept = sweepAutoRelease();

  const stats = getFinanceStats();
  const deals = getAllDeals(50);
  const payouts = getAllPayouts(50);
  const commission = getCommissionPercent();
  const disputes = deals.filter((d) => d.status === "reopened");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/admin" className="text-sm font-semibold text-brand-700 hover:underline">← Admin console</Link>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-navy-900">💰 Finance</h1>
      <p className="text-sm text-navy-800/70">Escrow holds, revenue and payouts.{swept.dealsSettled > 0 && ` Auto-released ${swept.dealsSettled} deal(s) just now.`}</p>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Held in escrow", value: formatPrice(stats.escrowHeld), tone: "bg-violet-50 text-violet-900 border-violet-200" },
          { label: "Commission earned", value: formatPrice(stats.commission), tone: "bg-brand-50 text-brand-800 border-brand-200" },
          { label: "Boost revenue", value: formatPrice(stats.boostsRevenue), tone: "bg-amber-50 text-amber-900 border-amber-200" },
          { label: "Payouts pending", value: formatPrice(stats.payoutsPending), tone: "bg-sky-50 text-sky-900 border-sky-200" },
          { label: "Payouts paid", value: formatPrice(stats.payoutsPaid), tone: "bg-emerald-50 text-emerald-900 border-emerald-200" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.tone}`}>
            <p className="text-lg font-black">{s.value}</p>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide opacity-80">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Disputes first — admin's most urgent queue */}
      {disputes.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-extrabold text-navy-900">⚠️ Open disputes ({disputes.length})</h2>
          <ul className="mt-2 space-y-2">
            {disputes.map((d) => (
              <li key={d.id} className="rounded-xl border-2 border-red-300 bg-red-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/deals/${d.id}`} className="font-bold text-navy-900 hover:underline">Deal #{d.id} — {d.listing_title}</Link>
                  <span className="text-sm font-black text-navy-900">{formatPrice(d.amount)}</span>
                </div>
                <p className="mt-1 text-sm text-red-900"><b>{d.buyer_name}</b>: “{d.dispute_reason}”</p>
                <div className="mt-2 flex gap-2">
                  <form action={async () => { "use server"; await resolveServer(d.id, "release"); }}>
                    <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white">Release to seller</button>
                  </form>
                  <form action={async () => { "use server"; await resolveServer(d.id, "refund"); }}>
                    <button className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white">Refund buyer</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Payout queue */}
      <section className="mt-8">
        <h2 className="text-lg font-extrabold text-navy-900">🏦 Withdrawal requests</h2>
        {payouts.filter((p) => p.status === "pending").length === 0 ? (
          <p className="mt-2 text-sm text-navy-800/60">No pending withdrawals.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {payouts.filter((p) => p.status === "pending").map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sand-200 bg-white p-4">
                <span className="text-sm">
                  <b>{formatPrice(p.amount)}</b> → {p.network} {p.momo_number}
                  <span className="ml-2 text-xs text-navy-800/60">requested {timeAgo(p.created_at)}</span>
                </span>
                <PayoutActions payoutId={p.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Commission setting */}
      <section className="mt-8">
        <h2 className="text-lg font-extrabold text-navy-900">⚙️ Platform commission</h2>
        <CommissionForm current={commission} />
      </section>

      {/* Deal ledger */}
      <section className="mt-8">
        <h2 className="text-lg font-extrabold text-navy-900">📜 Recent deals</h2>
        {deals.length === 0 ? (
          <p className="mt-2 text-sm text-navy-800/60">No deals yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-xl border border-sand-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sand-200 text-left text-xs uppercase tracking-wide text-navy-800/60">
                  <th className="px-4 py-2.5">Deal</th>
                  <th className="px-4 py-2.5">Buyer → Seller</th>
                  <th className="px-4 py-2.5">Amount</th>
                  <th className="px-4 py-2.5">Commission</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => (
                  <tr key={d.id} className="border-b border-sand-100 last:border-0">
                    <td className="px-4 py-2.5">
                      <Link href={`/deals/${d.id}`} className="font-semibold text-brand-700 hover:underline">#{d.id}</Link>{" "}
                      <span className="text-navy-800/70 line-clamp-1">{d.listing_title}</span>
                    </td>
                    <td className="px-4 py-2.5 text-navy-800/80">{d.buyer_name} → {d.seller_name}</td>
                    <td className="px-4 py-2.5 font-bold">{formatPrice(d.amount)}</td>
                    <td className="px-4 py-2.5 text-navy-800/70">{formatPrice(d.commission_amount)} ({d.commission_percent}%)</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${DEAL_BADGE[d.status] ?? "bg-stone-100"}`}>
                        {(d.status as DealStatus).replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

async function resolveServer(dealId: number, resolution: "release" | "refund") {
  "use server";
  await resolveDealAdmin(dealId, resolution);
  revalidatePath("/admin/finance");
}
