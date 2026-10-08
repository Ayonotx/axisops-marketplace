"use client";

import { useState, useTransition } from "react";
import { respondToOffer } from "@/app/actions";

export default function OfferActions({ offerId }: { offerId: number }) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"idle" | "counter">("idle");
  const [counter, setCounter] = useState("");
  const [error, setError] = useState("");

  const run = (action: "accept" | "reject" | "counter", amount?: number) => {
    setError("");
    startTransition(async () => {
      const res = await respondToOffer(offerId, action, amount);
      if (!res.ok) setError(res.error ?? "Failed.");
      else setMode("idle");
    });
  };

  if (mode === "counter") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={1}
          value={counter}
          onChange={(e) => setCounter(e.target.value)}
          placeholder="Your price"
          className="w-32 rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <button
          disabled={pending || !counter}
          onClick={() => run("counter", Number(counter))}
          className="rounded-lg bg-navy-900 px-3 py-2 text-xs font-bold text-white hover:bg-navy-800 disabled:opacity-50"
        >
          Send counter
        </button>
        <button
          onClick={() => setMode("idle")}
          className="text-xs text-navy-800/60 hover:underline"
        >
          Cancel
        </button>
        {error && <p className="w-full text-xs font-semibold text-rose-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        disabled={pending}
        onClick={() => run("accept")}
        className="rounded-lg bg-brand-500 px-3 py-2 text-xs font-bold text-white hover:bg-brand-600 disabled:opacity-50"
      >
        Accept
      </button>
      <button
        disabled={pending}
        onClick={() => setMode("counter")}
        className="rounded-lg border border-navy-800/25 px-3 py-2 text-xs font-bold text-navy-900 hover:bg-sand-100 disabled:opacity-50"
      >
        Counter
      </button>
      <button
        disabled={pending}
        onClick={() => run("reject")}
        className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
      >
        Reject
      </button>
      {error && <p className="w-full text-xs font-semibold text-rose-600">{error}</p>}
    </div>
  );
}
