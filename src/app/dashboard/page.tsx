import Link from "next/link";
import {
  getCurrentUser,
  getListingsByUser,
  getDashboardStats,
  getOffersForSeller,
  getOffersByBuyer,
} from "@/lib/db";
import { formatPrice, timeAgo } from "@/lib/format";
import { getSellerTrustStats } from "@/lib/reviews";
import OfferActions from "@/components/OfferActions";
import ListingStatusButton from "@/components/ListingStatusButton";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-brand-100 text-brand-800",
  pending: "bg-amber-100 text-amber-800",
  sold: "bg-navy-800 text-white",
  reserved: "bg-sky-100 text-sky-800",
  expired: "bg-sand-200 text-navy-800",
};

export const metadata = { title: "Seller Dashboard — AxisOps Marketplace" };

export default function DashboardPage() {
  const user = getCurrentUser();
  const stats = getDashboardStats(user.id);
  const myListings = getListingsByUser(user.id);
  const incoming = getOffersForSeller(user.id);
  const outgoing = getOffersByBuyer(user.id);
  const trust = getSellerTrustStats(user.id);

  const statCards = [
    { label: "My listings", value: stats.listings },
    { label: "Total views", value: stats.views.toLocaleString() },
    { label: "Favourites earned", value: stats.favorites },
    { label: "Offers received", value: stats.offers },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Welcome */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-navy-900 p-6 text-white">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-400">
            Seller Dashboard
          </p>
          <h1 className="mt-1 text-2xl font-extrabold">Welcome back, {user.name.split(" ")[0]} 👋</h1>
          <p className="mt-1 text-sm text-sand-100/70">
            {user.location} ·{" "}
            <span className="text-brand-300">
              {trust.completedDeals} completed deals ·{" "}
              {trust.reviewCount > 0
                ? `★ ${trust.avgRating.toFixed(1)} (${trust.reviewCount} escrow reviews)`
                : "No escrow reviews yet"}
            </span>
          </p>
        </div>
        <Link
          href="/sell"
          className="rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-3 font-bold shadow-lg shadow-brand-950/30 transition hover:brightness-110"
        >
          + Post new ad
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-sand-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="mt-1 bg-gradient-to-br from-navy-900 to-navy-700 bg-clip-text text-2xl font-black text-transparent">
              {s.value}
            </p>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-800/60">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* My listings */}
        <section className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-navy-900">My listings</h2>
            <Link href="/sell" className="text-sm font-semibold text-brand-600 hover:underline">
              + New listing
            </Link>
          </div>

          {myListings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-sand-200 bg-white p-10 text-center">
              <p className="text-3xl">🏷️</p>
              <p className="mt-2 font-bold text-navy-900">You haven&apos;t posted anything yet</p>
              <Link
                href="/sell"
                className="mt-3 inline-block rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600"
              >
                Post your first ad
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {myListings.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center gap-3 rounded-xl border border-sand-200 bg-white p-3 shadow-sm"
                >
                  {l.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={l.image_url}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-lg object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span
                      className="grid h-14 w-14 shrink-0 place-items-center rounded-lg text-2xl"
                      style={{ background: `linear-gradient(135deg, ${l.color}22, ${l.color}44)` }}
                    >
                      {l.emoji}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/listing/${l.id}`}
                      className="line-clamp-1 font-semibold text-navy-900 hover:text-brand-600"
                    >
                      {l.title}
                    </Link>
                    <p className="text-sm font-bold text-brand-600">{formatPrice(l.price)}</p>
                    <p className="text-xs text-navy-800/60">
                      {l.views} views · {timeAgo(l.created_at)} ·{" "}
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${STATUS_BADGE[l.status]}`}>
                        {l.status}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <ListingStatusButton listingId={l.id} status={l.status} />
                    <span className="text-[10px] text-navy-800/50">#{l.id}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Outgoing offers */}
          <h2 className="mb-4 mt-8 text-lg font-extrabold text-navy-900">Offers I&apos;ve made</h2>
          {outgoing.length === 0 ? (
            <p className="rounded-xl border border-dashed border-sand-200 bg-white p-6 text-center text-sm text-navy-800/70">
              No offers yet — find something you like in{" "}
              <Link href="/browse" className="font-semibold text-brand-600 underline">
                the marketplace
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-3">
              {outgoing.map((o) => (
                <li key={o.id} className="rounded-xl border border-sand-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={`/listing/${o.listing_id}`}
                      className="font-semibold text-navy-900 hover:text-brand-600"
                    >
                      {o.listing_title}
                    </Link>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                        o.status === "accepted"
                          ? "bg-brand-100 text-brand-800"
                          : o.status === "rejected"
                            ? "bg-rose-100 text-rose-700"
                            : o.status === "countered"
                              ? "bg-sky-100 text-sky-800"
                              : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {o.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-navy-800/80">
                    My offer: <strong>{formatPrice(o.amount)}</strong>
                    {o.counter_amount ? (
                      <>
                        {" "}· Seller countered:{" "}
                        <strong className="text-sky-700">{formatPrice(o.counter_amount)}</strong>
                      </>
                    ) : (
                      <> · to {o.seller_name}</>
                    )}
                    {o.message && <span className="block text-xs italic text-navy-800/60">“{o.message}”</span>}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Incoming offers */}
        <aside>
          <h2 className="mb-4 text-lg font-extrabold text-navy-900">
            Incoming offers{" "}
            {incoming.filter((o) => o.status === "pending").length > 0 && (
              <span className="inline-grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1.5 text-xs text-white">
                {incoming.filter((o) => o.status === "pending").length}
              </span>
            )}
          </h2>
          {incoming.length === 0 ? (
            <p className="rounded-xl border border-dashed border-sand-200 bg-white p-6 text-center text-sm text-navy-800/70">
              No offers yet. Share your listings to attract buyers!
            </p>
          ) : (
            <ul className="space-y-3">
              {incoming.map((o) => (
                <li key={o.id} className="rounded-xl border border-sand-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-navy-900">{o.buyer_name}</span>
                    <span className="text-[11px] text-navy-800/60">{timeAgo(o.created_at)}</span>
                  </div>
                  <p className="line-clamp-1 text-xs text-navy-800/70">on: {o.listing_title}</p>
                  <p className="mt-1.5 text-lg font-extrabold text-brand-600">
                    {formatPrice(o.amount)}
                  </p>
                  {o.message && (
                    <p className="mt-1 rounded-lg bg-sand-50 p-2 text-xs italic text-navy-800/80">
                      “{o.message}”
                    </p>
                  )}
                  <div className="mt-3">
                    {o.status === "pending" ? (
                      <OfferActions offerId={o.id} />
                    ) : (
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                          o.status === "accepted"
                            ? "bg-brand-100 text-brand-800"
                            : o.status === "rejected"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-sky-100 text-sky-800"
                        }`}
                      >
                        {o.status}
                        {o.counter_amount ? ` · countered at ${formatPrice(o.counter_amount)}` : ""}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
