"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DealReviewForm({ dealId }: { dealId: number }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId, rating, comment }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (json.ok) {
        setMsg({ ok: true, text: "🎉 Thanks — your review is live and counts toward the seller's trust score." });
        router.refresh();
      } else {
        setMsg({ ok: false, text: json.error ?? "Could not post the review." });
      }
    } catch {
      setMsg({ ok: false, text: "Network problem — try again." });
    }
    setBusy(false);
  }

  return (
    <div className="mt-4 rounded-xl border-2 border-accent-400 bg-accent-50 p-4">
      <h3 className="font-extrabold text-navy-900">⭐ Rate this deal</h3>
      <p className="mt-0.5 text-sm text-navy-800/70">
        Only buyers of completed escrow deals can review — that&apos;s what keeps AxisOps ratings real.
      </p>
      <div className="mt-3 flex items-center gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={busy}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className={`text-3xl transition-transform hover:scale-110 ${
              n <= (hover || rating) ? "text-amber-400" : "text-sand-300"
            }`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        rows={2}
        value={comment}
        onChange={(e) => setComment(e.target.value.slice(0, 500))}
        placeholder="How was the item and the seller? (optional)"
        className="mt-2 w-full rounded-lg border border-sand-300 p-2 text-sm"
      />
      {msg && (
        <p className={`mt-2 rounded-lg px-3 py-2 text-sm font-semibold ${
          msg.ok ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
        }`}>
          {msg.text}
        </p>
      )}
      <button
        onClick={submit}
        disabled={busy || rating < 1}
        className="mt-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {busy ? "Posting…" : rating < 1 ? "Pick a star rating" : "Post review"}
      </button>
    </div>
  );
}
