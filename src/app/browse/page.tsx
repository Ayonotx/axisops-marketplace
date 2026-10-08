import Link from "next/link";
import { searchListings, getCategories, getFavoriteIds, getCurrentUser, getPrimaryPhoto, getPhotoCounts } from "@/lib/db";
import ListingCard from "@/components/ListingCard";

const REGIONS = [
  "Greater Accra",
  "Ashanti",
  "Western",
  "Northern",
  "Volta",
  "Central",
  "Eastern",
];

const CONDITIONS = ["New", "Like new", "Used", "Furnished"];

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

  const q = str(sp.q);
  const category = str(sp.category);
  const region = str(sp.region);
  const condition = str(sp.condition);
  const sort = (str(sp.sort) || "newest") as "newest" | "price_asc" | "price_desc" | "popular";
  const minRaw = str(sp.min);
  const maxRaw = str(sp.max);

  const results = searchListings({
    q: q || undefined,
    category: category || undefined,
    region: region || undefined,
    condition: condition || undefined,
    min: minRaw ? Number(minRaw) : undefined,
    max: maxRaw ? Number(maxRaw) : undefined,
    sort,
  });

  const categories = getCategories();
  const activeCat = categories.find((c) => c.slug === category);
  const favs = new Set(getFavoriteIds(getCurrentUser().id));
  const ids = results.map((l) => l.id);
  const photos = getPrimaryPhoto(ids);
  const counts = getPhotoCounts(ids);

  const chip = (label: string, href: string) => (
    <Link
      key={href}
      href={href}
      className="rounded-full border border-brand-300 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100 transition"
    >
      {label} ✕
    </Link>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy-900">
          {activeCat ? activeCat.name : q ? `Search: “${q}”` : "Browse Marketplace"}
        </h1>
        <p className="text-sm text-navy-800/70">
          {results.length} listing{results.length === 1 ? "" : "s"} found
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Filters sidebar */}
        <aside className="w-full shrink-0 lg:w-64">
          <form method="GET" action="/browse" className="rounded-xl border border-sand-200 bg-white p-4 shadow-sm space-y-4">
            <input type="hidden" name="q" value={q} />
            <input type="hidden" name="category" value={category} />

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-navy-800/70">
                Location
              </label>
              <select
                name="region"
                defaultValue={region}
                className="w-full rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                <option value="">All regions</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-navy-800/70">
                  Min ₵
                </label>
                <input
                  name="min"
                  defaultValue={minRaw}
                  type="number"
                  min={0}
                  placeholder="0"
                  className="w-full rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-navy-800/70">
                  Max ₵
                </label>
                <input
                  name="max"
                  defaultValue={maxRaw}
                  type="number"
                  min={0}
                  placeholder="Any"
                  className="w-full rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-navy-800/70">
                Condition
              </label>
              <select
                name="condition"
                defaultValue={condition}
                className="w-full rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                <option value="">Any condition</option>
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-navy-800/70">
                Sort by
              </label>
              <select
                name="sort"
                defaultValue={sort}
                className="w-full rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                <option value="newest">Newest first</option>
                <option value="popular">Most viewed</option>
                <option value="price_asc">Price: low → high</option>
                <option value="price_desc">Price: high → low</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-brand-500 py-2.5 text-sm font-bold text-white hover:bg-brand-600 transition"
            >
              Apply filters
            </button>
            <a href="/browse" className="block text-center text-xs text-navy-800/60 hover:underline">
              Clear all
            </a>
          </form>

          {/* Categories list */}
          <div className="mt-4 rounded-xl border border-sand-200 bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-navy-800/70">
              Categories
            </h3>
            <ul className="space-y-1 text-sm">
              <li>
                <Link
                  href={`/browse${q ? `?q=${encodeURIComponent(q)}` : ""}`}
                  className={`block rounded px-2 py-1.5 transition ${
                    !category ? "bg-brand-50 font-semibold text-brand-700" : "text-navy-800 hover:bg-sand-100"
                  }`}
                >
                  All categories
                </Link>
              </li>
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/browse?category=${c.slug}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                    className={`block rounded px-2 py-1.5 transition ${
                      category === c.slug
                        ? "bg-brand-50 font-semibold text-brand-700"
                        : "text-navy-800 hover:bg-sand-100"
                    }`}
                  >
                    {c.emoji} {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Results */}
        <section className="flex-1">
          {(q || region || condition || minRaw || maxRaw) && (
            <div className="mb-4 flex flex-wrap gap-2">
              {q && chip(`“${q}”`, `/browse${category ? `?category=${category}` : ""}`)}
              {region && chip(region, `/browse?${new URLSearchParams({ ...(q && { q }), ...(category && { category }) })}`)}
              {condition && chip(condition, `/browse?${new URLSearchParams({ ...(q && { q }), ...(category && { category }), ...(region && { region }) })}`)}
              {(minRaw || maxRaw) &&
                chip(`GH₵ ${minRaw || 0} – ${maxRaw || "∞"}`, `/browse?${new URLSearchParams({ ...(q && { q }), ...(category && { category }), ...(region && { region }), ...(condition && { condition }) })}`)}
            </div>
          )}

          {results.length === 0 ? (
            <div className="rounded-xl border border-dashed border-sand-200 bg-white p-12 text-center">
              <p className="text-4xl">🔍</p>
              <h2 className="mt-3 font-bold text-navy-900">No listings match your search</h2>
              <p className="mt-1 text-sm text-navy-800/70">
                Try different keywords, or widen your filters.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Link href="/browse" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
                  Clear filters
                </Link>
                <Link href="/sell" className="rounded-lg border border-brand-300 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
                  Post the first ad
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {results.map((l) => (
                <ListingCard key={l.id} listing={l} fav={favs.has(l.id)} photo={photos.get(l.id) ? `/api/photos/${photos.get(l.id)}` : null} photoCount={counts.get(l.id) ?? 0} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
