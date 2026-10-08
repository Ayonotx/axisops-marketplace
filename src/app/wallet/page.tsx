import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession, getSessionUser } from "@/lib/auth";
import {
  getWalletBalance,
  getWalletTransactions,
  getPayoutsForUser,
  getDealsForUser,
} from "@/lib/escrow";
import { timeAgo } from "@/lib/format";
import { TopUpForm, WithdrawForm } from "@/components/WalletForms";

export const metadata = { title: "Wallet — AxisOps Marketplace" };

const TX_ICON: Record<string, string> = {
  topup: "⬆️",
  escrow_payment: "🔒",
  escrow_release: "💰",
  commission: "🏷️",
  refund: "↩️",
  withdrawal: "🏦",
  withdrawal_refund: "↩️",
  boost_purchase: "⚡",
};

export default async function WalletPage() {
  await requireSession();
  const user = getSessionUser();
  if (!user) redirect("/signin");

  const balance = getWalletBalance(user.id);
  const transactions = getWalletTransactions(user.id);
  const payouts = getPayoutsForUser(user.id);
  const { selling } = getDealsForUser(user.id);
  const activeSales = selling.filter((d) => ["in_escrow", "delivered"].includes(d.status)).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-navy-900">👛 My Wallet</h1>
          <p className="text-sm text-navy-800/70">Pay for goods, receive escrow payouts and buy boosts.</p>
        </div>
        <Link href="/deals" className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-bold text-white">
          🤝 My deals {activeSales > 0 && <span className="ml-1 rounded-full bg-brand-500 px-1.5">{activeSales}</span>}
        </Link>
      </div>

      {/* Balance card */}
      <div className="mt-6 rounded-2xl bg-gradient-to-br from-navy-900 via-navy-800 to-brand-800 p-6 text-white shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/60">Available balance</p>
        <p className="mt-1 text-4xl font-black">GH₵ {balance.toFixed(2)}</p>
        <p className="mt-2 text-xs text-white/60">
          {activeSales > 0 ? `🔒 ${activeSales} sale${activeSales > 1 ? "s" : ""} in escrow right now` : "No funds currently held in escrow"}
        </p>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <TopUpForm />
        <WithdrawForm balance={balance} />
      </div>

      {/* Payout history */}
      {payouts.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-navy-800/70">Withdrawals</h2>
          <ul className="mt-2 divide-y divide-sand-200 rounded-xl border border-sand-200 bg-white">
            {payouts.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  <b className="text-navy-900">GH₵ {p.amount.toFixed(2)}</b> → {p.network} {p.momo_number}
                  <span className="ml-2 text-xs text-navy-800/60">{timeAgo(p.created_at)}</span>
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  p.status === "paid" ? "bg-emerald-100 text-emerald-800" :
                  p.status === "rejected" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                }`}>{p.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Transaction history */}
      <section className="mt-6">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-navy-800/70">Transaction history</h2>
        {transactions.length === 0 ? (
          <div className="mt-2 rounded-xl border border-dashed border-sand-200 bg-white p-8 text-center">
            <p className="text-3xl">🧾</p>
            <p className="mt-2 text-sm text-navy-800/70">No transactions yet — top up to get started.</p>
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-sand-200 rounded-xl border border-sand-200 bg-white">
            {transactions.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-lg">{TX_ICON[t.type] ?? "•"}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy-900">{t.description}</p>
                  <p className="text-xs text-navy-800/60">{timeAgo(t.created_at)}</p>
                </div>
                <span className={`text-sm font-black ${t.amount < 0 ? "text-red-700" : "text-emerald-700"}`}>
                  {t.amount < 0 ? "−" : "+"}GH₵ {Math.abs(t.amount).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
