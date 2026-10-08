import Link from "next/link";
import type { Listing } from "@/lib/db";
import { formatPrice, timeAgo, LISTING_TYPE_LABEL } from "@/lib/format";
import { listingImage } from "@/lib/pexels";
import { getDatabase } from "@/lib/db";
import FavButton from "./FavButton";

export default async function ListingCard({
  listing,
  fav = false,
  photo,
  photoCount = 0,
}: {
  listing: Listing;
  fav?: boolean;
  photo?: string | null;
  photoCount?: number;
}) {
  let image = photo ?? null;
  if (!image && listing.image_url) image = listing.image_url;
  if (!image && !photo) {
    image = await listingImage(listing.category, listing.id);
    // Persist so future renders are pure DB reads (skip rows already sold/etc.).
    if (image) {
      try {
        getDatabase()
          .prepare("UPDATE listings SET image_url = ? WHERE id = ? AND image_url IS NULL")
          .run(image, listing.id);
      } catch {
        /* render must never fail on a cache write */
      }
    }
  }

  return (
    <Link
      href={`/listing/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-sand-200/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-300/60 hover:shadow-xl hover:shadow-brand-900/5"
    >
      <div className="relative h-44 overflow-hidden">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={listing.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className="grid h-full place-items-center"
            style={{ background: `linear-gradient(135deg, ${listing.color}22, ${listing.color}44)` }}
          >
            <span className="text-5xl drop-shadow-sm transition group-hover:scale-110">{listing.emoji}</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-navy-950/30 to-transparent" />
        {photoCount > 1 && (
          <span className="absolute bottom-2 right-2 rounded-md bg-navy-950/70 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur">
            {photoCount} photos
          </span>
        )}
        <div className="absolute right-2 top-2">
          <FavButton listingId={listing.id} initial={fav} />
        </div>
        {listing.featured === 1 && (
          <span className="absolute left-2 top-2 rounded-full bg-gradient-to-r from-accent-400 to-accent-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-navy-950 shadow">
            ★ Featured
          </span>
        )}
        {listing.status === "sold" && (
          <span className="absolute inset-0 grid place-items-center bg-navy-950/60 text-sm font-bold uppercase tracking-widest text-white backdrop-blur-sm">
            Sold
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-navy-900 group-hover:text-brand-700">
          {listing.title}
        </h3>
        <p className="text-lg font-extrabold text-brand-600">
          {formatPrice(listing.price)}
          {listing.listing_type === "job" && (
            <span className="text-xs font-medium text-navy-700/70"> /month</span>
          )}
          {listing.category === "property" && listing.subcategory.includes("Short") && (
            <span className="text-xs font-medium text-navy-700/70"> /night</span>
          )}
        </p>
        <p className="text-xs text-navy-800/70">
          {LISTING_TYPE_LABEL[listing.listing_type]} · {listing.subcategory} · {listing.condition}
        </p>
        <div className="mt-auto flex items-center justify-between pt-2 text-[11px] text-navy-800/60">
          <span className="truncate">{listing.location}</span>
          <span className="shrink-0">{timeAgo(listing.created_at)}</span>
        </div>
      </div>
    </Link>
  );
}
