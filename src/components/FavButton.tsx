"use client";

import { useTransition, useState } from "react";
import { toggleFavorite } from "@/app/actions";

export default function FavButton({
  listingId,
  initial,
}: {
  listingId: number;
  initial: boolean;
}) {
  const [fav, setFav] = useState(initial);
  const [, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-label={fav ? "Remove from favourites" : "Add to favourites"}
      onClick={(e) => {
        e.preventDefault();
        setFav(!fav);
        startTransition(() => {
          toggleFavorite(listingId).catch(() => setFav(initial));
        });
      }}
      className={`grid h-8 w-8 place-items-center rounded-full bg-white/90 shadow-sm text-lg transition hover:scale-110 ${
        fav ? "text-rose-500" : "text-navy-800/60 hover:text-rose-500"
      }`}
    >
      {fav ? "♥" : "♡"}
    </button>
  );
}
