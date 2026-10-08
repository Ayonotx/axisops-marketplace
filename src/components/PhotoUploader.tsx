"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function PhotoUploader({
  listingId,
  initialPhotos,
}: {
  listingId: number;
  initialPhotos: string[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<string[]>(initialPhotos);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const upload = async (files: FileList) => {
    setError("");
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.set("file", file);
        form.set("listingId", String(listingId));
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = (await res.json()) as { ok: boolean; url?: string; error?: string };
        if (!data.ok) {
          setError(data.error ?? "Upload failed.");
          break;
        }
        if (data.url) setPhotos((p) => [...p, data.url!]);
      }
      router.refresh();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="rounded-xl border border-sand-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-navy-800/70">
        📷 Listing photos
      </h3>
      {photos.length > 0 && (
        <div className="mb-3 flex gap-2 overflow-x-auto">
          {photos.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src + i}
              src={src}
              alt={`Photo ${i + 1}`}
              className="h-20 w-24 rounded-md border border-sand-200 object-cover"
              loading="lazy"
            />
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && void upload(e.target.files)}
      />
      <button
        type="button"
        disabled={busy || photos.length >= 6}
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-lg border-2 border-dashed border-sand-200 py-4 text-sm font-semibold text-navy-800/80 hover:border-brand-400 hover:text-brand-700 transition disabled:opacity-50"
      >
        {busy
          ? "Uploading…"
          : photos.length >= 6
            ? "Photo limit reached (6)"
            : `+ Add photos${photos.length > 0 ? ` (${photos.length}/6)` : ""}`}
      </button>
      <p className="mt-2 text-[11px] text-navy-800/60">
        JPG / PNG / WebP up to 5 MB each. Photos show on your listing instantly.
      </p>
      {error && <p className="mt-2 text-sm font-semibold text-rose-700">{error}</p>}
    </div>
  );
}
