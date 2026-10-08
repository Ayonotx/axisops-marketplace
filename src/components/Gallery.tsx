"use client";

import { useState } from "react";

export default function Gallery({
  photos,
  emoji,
  color,
}: {
  photos: string[];
  emoji: string;
  color: string;
}) {
  const [active, setActive] = useState(0);
  const main = photos[active];

  return (
    <div>
      <div
        className="relative flex h-64 items-center justify-center overflow-hidden sm:h-80"
        style={{ "--tile-color": color } as React.CSSProperties}
      >
        {main ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={main} alt="Listing photo" className="absolute inset-0 h-full w-full cursor-zoom-in object-cover transition group-hover:scale-[1.02]" />
        ) : (
          <div className="listing-tile absolute inset-0 grid place-items-center">
            <span className="text-8xl drop-shadow-lg">{emoji}</span>
          </div>
        )}
        {photos.length > 1 && (
          <span className="absolute bottom-3 right-3 rounded-md bg-navy-950/70 px-2 py-1 text-xs font-bold text-white">
            📷 {active + 1}/{photos.length}
          </span>
        )}
      </div>

      {photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto p-2">
          {photos.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => setActive(i)}
              className={`relative h-16 w-20 shrink-0 overflow-hidden rounded-md border-2 transition ${
                i === active ? "border-brand-500" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
