"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createListing } from "@/app/actions";

type Cat = { slug: string; name: string; emoji: string; subs: string[]; type: string };

export default function SellForm({ categories, regions }: { categories: Cat[]; regions: string[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [subOptions, setSubOptions] = useState<string[]>([]);
  const [created, setCreated] = useState<number | null>(null);

  if (created !== null) {
    return (
      <div className="rounded-xl border border-brand-200 bg-brand-50 p-6 text-center">
        <p className="text-4xl">🎉</p>
        <h2 className="mt-2 text-xl font-extrabold text-brand-800">Listing submitted for review!</h2>
        <p className="mt-1 text-sm text-navy-800/80">
          Your ad <strong>#{created}</strong> is pending moderation. Approved listings appear in
          search within minutes.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600 transition"
          >
            Go to dashboard
          </button>
          <button
            onClick={() => setCreated(null)}
            className="rounded-lg border border-brand-300 px-5 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-100 transition"
          >
            Post another
          </button>
        </div>
      </div>
    );
  }

  const input =
    "w-full rounded-lg border border-sand-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400";
  const label = "mb-1 block text-xs font-bold uppercase tracking-wide text-navy-800/70";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const cat = categories.find((c) => c.slug === formData.get("category"));
        if (cat) formData.set("listing_type", cat.type);
        setError("");
        startTransition(async () => {
          const res = await createListing(formData);
          if (res.ok && "id" in res && typeof res.id === "number") setCreated(res.id);
          else setError(res.error ?? "Something went wrong.");
        });
      }}
      className="space-y-4"
    >
      <div>
        <label className={label}>Title *</label>
        <input
          name="title"
          required
          minLength={5}
          maxLength={100}
          placeholder="e.g. iPhone 13 Pro 256GB — Space Graphite"
          className={input}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Category *</label>
          <select
            name="category"
            required
            defaultValue=""
            onChange={(e) => {
              const cat = categories.find((c) => c.slug === e.target.value);
              setSubOptions(cat?.subs ?? []);
            }}
            className={input}
          >
            <option value="" disabled>
              Choose category…
            </option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Subcategory</label>
          <select name="subcategory" className={input} disabled={subOptions.length === 0}>
            <option value="">Select…</option>
            {subOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={label}>Description *</label>
        <textarea
          name="description"
          required
          minLength={20}
          rows={5}
          placeholder="Describe condition, what's included, reason for selling, delivery options…"
          className={input}
        />
        <p className="mt-1 text-[11px] text-navy-800/60">
          💡 Tip: honest, detailed descriptions get 3× more messages.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={label}>Price (GH₵) *</label>
          <input name="price" type="number" min={1} required placeholder="500" className={input} />
        </div>
        <div>
          <label className={label}>Condition</label>
          <select name="condition" defaultValue="Used" className={input}>
            {["New", "Like new", "Used", "Furnished"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-sm font-semibold text-navy-900">
            <input
              type="checkbox"
              name="negotiable"
              defaultChecked
              className="h-4 w-4 rounded border-sand-200 text-brand-500 focus:ring-brand-400"
            />
            Price negotiable
          </label>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Town / City</label>
          <input name="location" placeholder="e.g. Madina, Accra" className={input} />
        </div>
        <div>
          <label className={label}>Region</label>
          <select name="region" defaultValue="Greater Accra" className={input}>
            {regions.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-brand-500 py-3.5 font-bold text-white hover:bg-brand-600 transition disabled:opacity-60 sm:w-auto sm:px-10"
      >
        {pending ? "Submitting…" : "Submit listing for review"}
      </button>
    </form>
  );
}
