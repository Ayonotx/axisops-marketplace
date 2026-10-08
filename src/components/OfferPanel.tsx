"use client";

import { useState, useTransition } from "react";
import { makeOffer } from "@/app/actions";
import { formatPrice } from "@/lib/format";

export default function OfferPanel({
  listingId,
  price,
  negotiable,
  isOwner,
}: {
  listingId: number;
  price: number;
  negotiable: boolean;
  isOwner: boolean;
}) {
  const [amount, setAmount] = useState(Math.round(price * 0.9));
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "error" | "sent">("idle");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [phoneRevealed, setPhoneRevealed] = useState(false);

  if (isOwner) return null;

  if (status === "sent") {
    return (
      <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm">
        <p className="font-bold text-brand-700">✅ Offer sent to the seller!</p>
        <p className="mt-1 text-navy-800/80">
          You offered <strong>{formatPrice(amount)}</strong>. Track responses in your{" "}
          <a href="/dashboard" className="font-semibold text-brand-700 underline">
            dashboard
          </a>
          . Keep negotiation inside AxisOps for your protection.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-sand-200 bg-white p-4 shadow-sm">
      <h3 className="font-bold text-navy-900">
        {negotiable ? "Make an offer" : "Buy at listed price"}
      </h3>
      <p className="text-xs text-navy-800/70">
        Listed at <strong>{formatPrice(price)}</strong>
        {negotiable ? " — price is negotiable." : " — fixed price."}
      </p>

      {negotiable && (
        <div className="mt-3">
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-navy-800/70">
            Your offer (GH₵)
          </label>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
      )}

      <label className="mb-1 mt-3 block text-xs font-bold uppercase tracking-wide text-navy-800/70">
        Message to seller
      </label>
      <textarea
        rows={3}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Hi, is this still available? I can pick up today…"
        className="w-full rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
      />

      {status === "error" && (
        <p className="mt-2 text-xs font-semibold text-rose-600">{error}</p>
      )}

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await makeOffer(listingId, amount, message);
            if (res.ok) setStatus("sent");
            else {
              setStatus("error");
              setError(res.error ?? "Something went wrong.");
            }
          })
        }
        className="mt-3 w-full rounded-lg bg-brand-500 py-2.5 text-sm font-bold text-white hover:bg-brand-600 transition disabled:opacity-60"
      >
        {pending ? "Sending…" : negotiable ? "Submit offer" : "Request to buy"}
      </button>

      <button
        type="button"
        onClick={() => setPhoneRevealed(true)}
        className="mt-2 w-full rounded-lg border border-navy-800/20 py-2.5 text-sm font-semibold text-navy-900 hover:bg-sand-100 transition"
      >
        {phoneRevealed ? "📞 Contact via in-app chat (demo)" : "Show seller contact"}
      </button>

      <p className="mt-3 text-[11px] leading-relaxed text-navy-800/60">
        🛡️ <strong>Safe deal tips:</strong> inspect items before paying, meet in safe public places,
        and keep communication and payment inside AxisOps.
      </p>
    </div>
  );
}
