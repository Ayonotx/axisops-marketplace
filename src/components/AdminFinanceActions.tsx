"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PayoutActions({ payoutId }: { payoutId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function decide(decision: "paid" | "rejected") {
    setBusy(true);
    await fetch("/api/admin/payout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payoutId, decision }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <span className="flex gap-2">
      <button disabled={busy} onClick={() => decide("paid")}
        className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700 disabled:opacity-60">
        ✅ Mark paid
      </button>
      <button disabled={busy} onClick={() => decide("rejected")}
        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60">
        ✖ Reject
      </button>
    </span>
  );
}

export function CommissionForm({ current }: { current: number }) {
  const router = useRouter();
  const [pct, setPct] = useState(String(current));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/commission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ percent: Number(pct) }),
    });
    const json = (await res.json()) as { ok: boolean; error?: string };
    setMsg(json.ok ? `Saved — new deals charge ${pct}%.` : json.error ?? "Failed.");
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input type="number" min={0} max={50} step="0.5" value={pct} onChange={(e) => setPct(e.target.value)}
        className="w-24 rounded-lg border border-sand-300 px-3 py-2 text-sm font-bold" />
      <span className="text-sm text-navy-800/70">% of each settled deal goes to the platform</span>
      <button onClick={save} disabled={busy}
        className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
        {busy ? "Saving…" : "Save"}
      </button>
      {msg && <span className="text-sm font-semibold text-brand-700">{msg}</span>}
    </div>
  );
}
