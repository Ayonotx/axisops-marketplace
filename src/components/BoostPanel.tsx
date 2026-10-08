"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const BUNDLES = [
  { key: "boost3", label: "⚡ Boost", days: "3 days", price: 15 },
  { key: "feature7", label: "⭐ Featured", days: "7 days", price: 30 },
  { key: "premium30", label: "👑 Premium", days: "30 days", price: 80 },
] as const;

export default function BoostPanel({ listingId, balance }: { listingId: number; balance: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function buy(bundle: string) {
    setBusy(bundle);
    setMsg(null);
    const res = await fetch("/api/boost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, bundle }),
    });
    const json = (await res.json()) as { ok: boolean; error?: string; charged?: number };
    setBusy(null);
    if (json.ok) {
      setMsg({ ok: true, text: `🎉 Listing boosted! GH₵ ${json.charged} deducted from your wallet.` });
      router.refresh();
    } else {
      setMsg({ ok: false, text: json.error ?? "Boost failed." });
    }
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <h3 className="font-extrabold text-navy-900">🚀 Sell faster with a boost</h3>
      <p className="mt-1 text-sm text-navy-800/70">Featured listings get up to 5× more views. Paid from your wallet balance (GH₵ {balance.toFixed(2)}).</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {BUNDLES.map((b) => (
          <button key={b.key} onClick={() => buy(b.key)} disabled={busy !== null}
            className="rounded-lg border border-amber-300 bg-white px-3 py-2.5 text-center transition hover:border-amber-500 hover:shadow disabled:opacity-60">
            <span className="block text-sm font-extrabold text-navy-900">{b.label}</span>
            <span className="block text-[11px] text-navy-800/60">{b.days}</span>
            <span className="mt-1 block text-sm font-black text-amber-700">GH₵ {b.price}</span>
          </button>
        ))}
      </div>
      {msg && (
        <p className={`mt-2 rounded-lg px-3 py-2 text-sm font-semibold ${
          msg.ok ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
        }`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
