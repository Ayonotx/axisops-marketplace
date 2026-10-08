import Link from "next/link";
import { getFavoriteListings, getCurrentUser, getPrimaryPhoto, getPhotoCounts } from "@/lib/db";
import ListingCard from "@/components/ListingCard";

export const metadata = { title: "Favourites — AxisOps Marketplace" };

export default function FavoritesPage() {
  const user = getCurrentUser();
  const favorites = getFavoriteListings(user.id);
  const ids = favorites.map((l) => l.id);
  const photos = getPrimaryPhoto(ids);
  const counts = getPhotoCounts(ids);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-extrabold tracking-tight text-navy-900">♥ Favourites</h1>
      <p className="text-sm text-navy-800/70">
        {favorites.length} saved listing{favorites.length === 1 ? "" : "s"}
      </p>

      {favorites.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-sand-200 bg-white p-12 text-center">
          <p className="text-4xl">♡</p>
          <h2 className="mt-3 font-bold text-navy-900">Nothing saved yet</h2>
          <p className="mt-1 text-sm text-navy-800/70">
            Tap the heart on any listing to save it here for later.
          </p>
          <Link
            href="/browse"
            className="mt-4 inline-block rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600"
          >
            Explore marketplace
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {favorites.map((l) => (
            <ListingCard key={l.id} listing={l} fav photo={photos.get(l.id) ? `/api/photos/${photos.get(l.id)}` : null} photoCount={counts.get(l.id) ?? 0} />
          ))}
        </div>
      )}
    </div>
  );
}
