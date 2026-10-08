import Link from "next/link";
import { Suspense } from "react";
import {
  getCategories,
  getFeaturedListings,
  getRecentListings,
  getFavoriteIds,
  getCurrentUser,
  getPrimaryPhoto,
  getPhotoCounts,
} from "@/lib/db";
import ListingCard from "@/components/ListingCard";
import { ListingGridSkeleton } from "@/components/Skeletons";
import { categoryImage, heroImages } from "@/lib/pexels";

export default async function HomePage() {
  const categories = getCategories();
  const featured = getFeaturedListings();
  const recent = getRecentListings(8);
  const favs = new Set(getFavoriteIds(getCurrentUser().id));
  const ids = [...featured, ...recent].map((l) => l.id);
  const photos = getPrimaryPhoto(ids);
  const counts = getPhotoCounts(ids);
  const hero = await heroImages();
  const catImages = new Map(
    await Promise.all(categories.map(async (c) => [c.slug, await categoryImage(c.slug)] as const))
  );

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy-900 text-white">
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_80%_20%,#12a44c55,transparent_55%),radial-gradient(circle_at_10%_90%,#8cc63f44,transparent_50%)]" />
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:py-20 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-400/40 bg-brand-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-300 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />
              A Global Online Marketplace
            </p>
            <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Buy. Sell. Trade. <span className="text-accent-400">Grow.</span>
            </h1>
            <p className="mt-4 max-w-2xl text-base text-sand-100/80 sm:text-lg">
              Products, vehicles, property, professional services, jobs and businesses —
              all in one connected marketplace. From Accra to the world.
            </p>

            <form
              action="/browse"
              method="GET"
              className="mt-8 flex max-w-2xl gap-2 rounded-2xl border border-white/15 bg-white/10 p-1.5 backdrop-blur-md"
            >
              <input
                name="q"
                placeholder='Try "iPhone", "3-bedroom apartment", "electrician"…'
                className="w-full rounded-xl border-0 bg-white px-4 py-3 text-navy-900 placeholder:text-navy-700/50 focus:outline-none focus:ring-2 focus:ring-accent-400"
              />
              <button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-3 font-bold shadow-lg shadow-brand-900/40 transition hover:brightness-110 whitespace-nowrap"
              >
                Search
              </button>
            </form>

            <div className="mt-6 flex flex-wrap gap-2 text-xs">
              <span className="text-sand-100/60 py-1">Popular:</span>
              {["iPhone", "Toyota", "Apartment", "Sofa", "Tutor", "Land"].map((t) => (
                <Link
                  key={t}
                  href={`/browse?q=${encodeURIComponent(t)}`}
                  className="rounded-full border border-white/20 px-3 py-1 text-sand-100/90 backdrop-blur transition hover:border-brand-400 hover:bg-brand-500/20"
                >
                  {t}
                </Link>
              ))}
            </div>
          </div>

          {/* Photo collage */}
          {hero.length > 0 && (
            <div className="relative hidden h-[380px] lg:block" aria-hidden>
              <div className="absolute right-24 top-0 h-52 w-64 rotate-[-4deg] overflow-hidden rounded-2xl border-4 border-white/10 shadow-2xl shadow-navy-950/60 transition-transform duration-500 hover:rotate-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {hero[0] && <img src={hero[0]} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="absolute right-0 top-36 h-56 w-72 rotate-[3deg] overflow-hidden rounded-2xl border-4 border-white/10 shadow-2xl shadow-navy-950/60 transition-transform duration-500 hover:rotate-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {hero[1] && <img src={hero[1]} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="absolute right-44 bottom-0 h-44 w-60 rotate-[-2deg] overflow-hidden rounded-2xl border-4 border-white/10 shadow-2xl shadow-navy-950/60 transition-transform duration-500 hover:rotate-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {hero[2] && <img src={hero[2]} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="absolute left-0 top-1/2 flex -translate-y-1/2 items-center gap-2 rounded-2xl border border-white/15 bg-navy-900/80 px-4 py-3 shadow-xl backdrop-blur-md">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 text-lg shadow">🛡️</span>
                <div>
                  <p className="text-sm font-extrabold leading-tight">Escrow protected</p>
                  <p className="text-[11px] text-sand-100/70">Money held until you confirm</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-navy-900">
              Popular Categories
            </h2>
            <p className="text-sm text-navy-800/70">Find what you need — all in one place</p>
          </div>
          <Link href="/browse" className="text-sm font-semibold text-brand-600 hover:underline">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((c) => {
            const img = catImages.get(c.slug);
            return (
              <Link
                key={c.slug}
                href={`/browse?category=${c.slug}`}
                className="group relative h-28 overflow-hidden rounded-2xl shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img}
                    alt={c.name}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <span
                    className="absolute inset-0"
                    style={{ background: `linear-gradient(135deg, ${c.color}, ${c.color}88)` }}
                  />
                )}
                <span className="absolute inset-0 bg-gradient-to-t from-navy-950/80 via-navy-950/25 to-transparent" />
                <span className="absolute bottom-2.5 left-3 right-3 text-sm font-extrabold text-white drop-shadow">
                  {c.name}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Featured — animated rail */}
      <section className="mx-auto max-w-7xl px-4 pb-12">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-navy-900">
              Featured Listings
            </h2>
            <p className="text-sm text-navy-800/70">Promoted by sellers this week</p>
          </div>
        </div>
        <Suspense fallback={<ListingGridSkeleton count={4} />}>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {featured.map((l, i) => (
              <div key={l.id} className={`rise-in rise-in-${Math.min(i + 1, 8)}`}>
                <ListingCard listing={l} fav={favs.has(l.id)} photo={photos.get(l.id) ? `/api/photos/${photos.get(l.id)}` : null} photoCount={counts.get(l.id) ?? 0} />
              </div>
            ))}
          </div>
        </Suspense>
      </section>

      {/* Recent */}
      <section className="mx-auto max-w-7xl px-4 pb-12">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-navy-900">
              Fresh on the Market
            </h2>
            <p className="text-sm text-navy-800/70">Just posted by sellers near you</p>
          </div>
          <Link href="/browse?sort=newest" className="text-sm font-semibold text-brand-600 hover:underline">
            See more →
          </Link>
        </div>
        <Suspense fallback={<ListingGridSkeleton count={8} />}>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {recent.map((l) => (
              <ListingCard key={l.id} listing={l} fav={favs.has(l.id)} photo={photos.get(l.id) ? `/api/photos/${photos.get(l.id)}` : null} photoCount={counts.get(l.id) ?? 0} />
            ))}
          </div>
        </Suspense>
      </section>

      {/* How it works */}
      <section className="bg-navy-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-14">
          <h2 className="text-center text-2xl font-extrabold sm:text-3xl">
            Shop safely. Sell faster. <span className="text-accent-400">One ecosystem.</span>
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { n: "1", t: "Search & Discover", d: "Keyword, category and location search across products, services, property and jobs." },
              { n: "2", t: "Chat & Negotiate", d: "Message sellers directly, submit offers and counteroffers — all recorded in one place." },
              { n: "3", t: "Close the Deal", d: "Agree on price, choose delivery or pickup, and complete the deal with confidence." },
              { n: "4", t: "Rate & Review", d: "Rate the experience. Build reputation that makes the next deal easier." },
            ].map((s) => (
              <div key={s.n} className="rounded-xl border border-white/10 bg-navy-800/60 p-5">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500 font-black">
                  {s.n}
                </span>
                <h3 className="mt-3 font-bold">{s.t}</h3>
                <p className="mt-1 text-sm text-sand-100/70">{s.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              href="/sell"
              className="rounded-xl bg-brand-500 px-6 py-3 font-bold hover:bg-brand-600 transition"
            >
              Post a free ad
            </Link>
            <Link
              href="/browse"
              className="rounded-xl border border-white/30 px-6 py-3 font-bold hover:bg-white/10 transition"
            >
              Browse marketplace
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
