"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function TopUpForm() {
  const router = useRouter();
  const [amount, setAmount] = useState(50);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function topUp() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; checkoutUrl?: string };
      if (!json.ok || !json.checkoutUrl) {
        setError(json.error ?? "Top-up failed.");
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
    <div className="rounded-xl border border-sand-200 bg-white p-5">
      <h2 className="font-extrabold text-navy-900">⬆️ Top up wallet</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {[20, 50, 100, 250, 500].map((a) => (
          <button key={a} onClick={() => setAmount(a)}
            className={`rounded-lg px-3.5 py-2 text-sm font-bold transition ${
              amount === a ? "bg-brand-600 text-white" : "bg-sand-100 text-navy-800 hover:bg-sand-200"
            }`}>
            GH₵ {a}
          </button>
        ))}
        <input
          type="number" min={5} max={10000} value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-24 rounded-lg border border-sand-300 px-3 py-2 text-sm font-bold"
        />
      </div>
      {error && <p className="mt-2 rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-800">{error}</p>}
      <button onClick={topUp} disabled={busy || amount < 5}
        className="mt-3 w-full rounded-lg bg-brand-600 px-4 py-3 font-extrabold text-white hover:bg-brand-700 disabled:opacity-60">
        {busy ? "Starting checkout…" : `💳 Top up GH₵ ${amount || 0}`}
      </button>
      <p className="mt-2 text-center text-[11px] text-navy-800/60">MTN MoMo · Telecel Cash · AirtelTigo · Cards</p>
    </div>
  );
}

export function WithdrawForm({ balance }: { balance: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [momo, setMomo] = useState("");
  const [network, setNetwork] = useState("MTN MoMo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function withdraw() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), momoNumber: momo, network }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) {
        setError(json.error ?? "Withdrawal failed.");
        setBusy(false);
        return;
      }
      setDone(true);
      setBusy(false);
      router.refresh();
    } catch {
      setError("Network problem — try again.");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full rounded-xl border-2 border-dashed border-brand-400 bg-brand-50 px-4 py-3 text-sm font-extrabold text-brand-800 hover:bg-brand-100">
        🏦 Withdraw to Mobile Money
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-sand-200 bg-white p-5">
      <h2 className="font-extrabold text-navy-900">🏦 Withdraw to MoMo</h2>
      {done ? (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          ✅ Withdrawal requested — funds leave your wallet now and arrive once admin sends them (usually same day).
        </p>
      ) : (
        <>
          <div className="mt-3 grid gap-2">
            <input type="number" min={20} placeholder={`Amount (min 20, you have ${balance.toFixed(2)})`}
              value={amount} onChange={(e) => setAmount(e.target.value)}
              className="rounded-lg border border-sand-300 px-3 py-2 text-sm" />
            <input placeholder="MoMo number e.g. 024 123 4567" value={momo} onChange={(e) => setMomo(e.target.value)}
              className="rounded-lg border border-sand-300 px-3 py-2 text-sm" />
            <select value={network} onChange={(e) => setNetwork(e.target.value)}
              className="rounded-lg border border-sand-300 px-3 py-2 text-sm">
              <option>MTN MoMo</option>
              <option>Telecel Cash</option>
              <option>AirtelTigo Money</option>
            </select>
          </div>
          {error && <p className="mt-2 rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-800">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button onClick={withdraw} disabled={busy || !amount || !momo}
              className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-extrabold text-white hover:bg-brand-700 disabled:opacity-60">
              {busy ? "Requesting…" : "Request withdrawal"}
            </button>
            <button onClick={() => setOpen(false)} className="rounded-lg border border-sand-300 px-4 py-2.5 text-sm font-semibold text-navy-800">Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}
