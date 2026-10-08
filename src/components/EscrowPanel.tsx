"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function EscrowPanel({ listingId }: { listingId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; checkoutUrl?: string };
      if (!json.ok || !json.checkoutUrl) {
        setError(json.error ?? "Could not start the secure payment.");
        setBusy(false);
        return;
      }
      router.push(json.checkoutUrl);
    } catch {
      setError("Network problem — try again.");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border-2 border-brand-500 bg-brand-50 p-4">
      <div className="flex items-center gap-2">
        <span className="text-xl">🛡️</span>
        <h3 className="font-extrabold text-navy-900">Buy Safely with Escrow</h3>
      </div>
      <p className="mt-1.5 text-sm text-navy-800/80">
        Pay into secure escrow. The seller ships, you confirm, <b>then</b> they get paid.
        Full refund if it goes wrong.
      </p>
      {error && <p className="mt-2 rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-800">{error}</p>}
      <button
        onClick={buy}
        disabled={busy}
        className="mt-3 w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
      >
        {busy ? "Starting secure checkout…" : "🔒 Buy with Escrow"}
      </button>
      <p className="mt-2 text-center text-[11px] text-navy-800/60">
        Mobile Money & cards · funds held until you confirm
      </p>
    </div>
  );
}
