"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DealActions({
  dealId,
  status,
  role,
}: {
  dealId: number;
  status: string;
  role: "buyer" | "seller";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDispute, setShowDispute] = useState(false);
  const [reason, setReason] = useState("");

  async function act(action: string, extra: Record<string, string> = {}) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/deal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId, action, ...extra }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) {
        setError(json.error ?? "Action failed.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network problem — try again.");
    }
    setBusy(false);
  }

  const btn = "rounded-lg px-4 py-2.5 text-sm font-extrabold transition disabled:opacity-60";
  const err = error && <p className="mt-2 rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-800">{error}</p>;

  if (role === "buyer") {
    return (
      <div className="space-y-3">
        {status === "pending" && (
          <div className="flex flex-wrap gap-2">
            <a href={`/api/pay/checkout/${dealId}`} className={`${btn} bg-brand-600 text-white hover:bg-brand-700`}>💳 Pay now</a>
            <button disabled={busy} onClick={() => act("cancel")} className={`${btn} border border-sand-300 text-navy-800`}>Cancel</button>
          </div>
        )}
        {status === "delivered" && (
          <div className="rounded-xl border-2 border-brand-500 bg-brand-50 p-4">
            <p className="font-extrabold text-navy-900">📦 Item delivered!</p>
            <p className="mt-1 text-sm text-navy-800/80">Confirm only when you have it and it matches the ad. After 72 hours funds release automatically.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => act("confirm")} className={`${btn} bg-brand-600 text-white hover:bg-brand-700`}>✅ Confirm received — release {`GH₵`}</button>
              <button disabled={busy} onClick={() => setShowDispute((v) => !v)} className={`${btn} bg-red-600 text-white hover:bg-red-700`}>⚠️ There&apos;s a problem</button>
            </div>
          </div>
        )}
        {showDispute && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <label className="text-sm font-bold text-navy-900">What went wrong?</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
              className="mt-1 w-full rounded-lg border border-sand-300 p-2 text-sm" placeholder="e.g. Item never arrived / not as described…" />
            <button disabled={busy || !reason.trim()} onClick={() => act("dispute", { reason })} className={`${btn} mt-2 bg-red-600 text-white`}>
              Open dispute — admin will review
            </button>
          </div>
        )}
        {status === "in_escrow" && (
          <p className="rounded-xl bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-900">
            🔒 Money is safely held. Waiting for the seller to deliver.
          </p>
        )}
        {status === "settled" && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">🎉 Deal complete — the seller has been paid.</p>}
        {status === "reopened" && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-900">Dispute open — our team is reviewing. You&apos;ll get a refund if it goes your way.</p>}
        {status === "refunded" && <p className="rounded-xl bg-stone-100 px-4 py-3 text-sm font-semibold text-navy-800">💸 Refunded to your wallet.</p>}
        {err}
      </div>
    );
  }

  // Seller
  return (
    <div className="space-y-3">
      {status === "in_escrow" && (
        <div className="rounded-xl border-2 border-violet-300 bg-violet-50 p-4">
          <p className="font-extrabold text-violet-900">🔒 Buyer&apos;s money is held in escrow — safe to deliver.</p>
          <p className="mt-1 text-sm text-violet-900/80">Mark delivered once the buyer has the item. Payment releases when they confirm (or after 72h).</p>
          <textarea id={`note-${dealId}`} rows={2} className="mt-2 w-full rounded-lg border border-sand-300 p-2 text-sm" placeholder="Handoff note (optional) — e.g. delivered by courier XYZ" />
          <button
            disabled={busy}
            onClick={() => {
              const note = (document.getElementById(`note-${dealId}`) as HTMLTextAreaElement | null)?.value ?? "";
              act("deliver", { note });
            }}
            className={`${btn} mt-2 bg-violet-700 text-white hover:bg-violet-800`}
          >
            📦 Mark delivered
          </button>
        </div>
      )}
      {status === "pending" && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">⏳ Buyer hasn&apos;t paid yet.</p>}
      {status === "delivered" && <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900">🚚 Delivered — waiting for buyer confirmation (auto-releases after 72h).</p>}
      {status === "settled" && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">💰 Paid out to your wallet (minus platform commission).</p>}
      {status === "reopened" && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-900">⚠️ Buyer disputed this deal — admin will decide the outcome.</p>}
      {err}
    </div>
  );
}
