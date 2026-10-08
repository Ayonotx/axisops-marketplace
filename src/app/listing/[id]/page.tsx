import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getListing,
  getFavoriteIds,
  getCurrentUser,
  searchListings,
  getListingPhotos,
  getPrimaryPhoto,
  getPhotoCounts,
} from "@/lib/db";
import { formatPrice, timeAgo, LISTING_TYPE_LABEL } from "@/lib/format";
import ListingCard from "@/components/ListingCard";
import FavButton from "@/components/FavButton";
import OfferPanel from "@/components/OfferPanel";
import ChatPanel from "@/components/ChatPanel";
import PhotoUploader from "@/components/PhotoUploader";
import Gallery from "@/components/Gallery";
import EscrowPanel from "@/components/EscrowPanel";
import BoostPanel from "@/components/BoostPanel";
import TrustBadges from "@/components/TrustBadges";
import { getWalletBalance } from "@/lib/escrow";
import { getSellerTrustStats } from "@/lib/reviews";

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  product: { label: "Product", cls: "bg-brand-100 text-brand-800" },
  service: { label: "Professional Service", cls: "bg-sky-100 text-sky-800" },
  property: { label: "Property", cls: "bg-violet-100 text-violet-800" },
  vehicle: { label: "Vehicle", cls: "bg-rose-100 text-rose-800" },
  job: { label: "Job", cls: "bg-indigo-100 text-indigo-800" },
};

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listingId = Number(id);
  if (!Number.isFinite(listingId)) notFound();

  const listing = getListing(listingId);
  if (!listing) notFound();
  const trustStats = getSellerTrustStats(listing.user_id);
  const memberSince = new Date(listing.seller_joined_at.replace(" ", "T") + "Z").toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });

  const user = getCurrentUser();
  const favs = new Set(getFavoriteIds(user.id));
  const isOwner = listing.user_id === user.id;
  const badge = TYPE_BADGE[listing.listing_type] ?? TYPE_BADGE.product;

  const photos = getListingPhotos(listing.id);
  const similar = searchListings({ category: listing.category }).filter(
    (l) => l.id !== listing.id
  ).slice(0, 4);
  const similarIds = similar.map((l) => l.id);
  const similarPhotos = getPrimaryPhoto(similarIds);
  const similarCounts = getPhotoCounts(similarIds);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-navy-800/70">
        <Link href="/" className="hover:text-brand-600">Home</Link>
        <span>›</span>
        <Link href={`/browse?category=${listing.category}`} className="hover:text-brand-600 capitalize">
          {listing.category}
        </Link>
        <span>›</span>
        <span className="text-navy-900 font-medium line-clamp-1">{listing.title}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main */}
        <div className="lg:col-span-2 space-y-5">
          <div className="overflow-hidden rounded-xl border border-sand-200 bg-white shadow-sm">
            <Gallery photos={photos.map((p) => `/api/photos/${p.filename}`)} emoji={listing.emoji} color={listing.color} />

            <div className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${badge.cls}`}>
                      {badge.label}
                    </span>
                    <span className="rounded-full bg-sand-100 px-2.5 py-0.5 text-[11px] font-semibold text-navy-800">
                      {listing.subcategory}
                    </span>
                    {listing.featured === 1 && (
                      <span className="rounded-full bg-accent-500 px-2.5 py-0.5 text-[11px] font-bold uppercase text-navy-950">
                        ⭐ Featured
                      </span>
                    )}
                    {listing.status === "active" && (
                      <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-bold text-brand-800" title="Buy this with AxisOps Escrow — money is held until you confirm delivery">
                        🛡️ Escrow available
                      </span>
                    )}
                  </div>
                  <h1 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight text-navy-900">
                    {listing.title}
                  </h1>
                </div>
                <div className="shrink-0">
                  <FavButton listingId={listing.id} initial={favs.has(listing.id)} />
                </div>
              </div>

              <p className="mt-3 text-3xl font-black text-brand-600">
                {formatPrice(listing.price)}
                <span className="ml-2 align-middle text-sm font-semibold text-navy-800/70">
                  {listing.negotiable ? "Negotiable" : "Fixed price"}
                </span>
              </p>

              <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
                <div className="rounded-lg bg-sand-50 p-3">
                  <dt className="text-[11px] uppercase tracking-wide text-navy-800/60">Condition</dt>
                  <dd className="font-semibold text-navy-900">{listing.condition}</dd>
                </div>
                <div className="rounded-lg bg-sand-50 p-3">
                  <dt className="text-[11px] uppercase tracking-wide text-navy-800/60">Location</dt>
                  <dd className="font-semibold text-navy-900">{listing.location}</dd>
                </div>
                <div className="rounded-lg bg-sand-50 p-3">
                  <dt className="text-[11px] uppercase tracking-wide text-navy-800/60">Posted</dt>
                  <dd className="font-semibold text-navy-900">{timeAgo(listing.created_at)}</dd>
                </div>
                <div className="rounded-lg bg-sand-50 p-3">
                  <dt className="text-[11px] uppercase tracking-wide text-navy-800/60">Views</dt>
                  <dd className="font-semibold text-navy-900">{listing.views}</dd>
                </div>
              </dl>

              <h2 className="mt-5 font-bold text-navy-900">Description</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-navy-800/90">
                {listing.description}
              </p>

              <div className="mt-5 flex flex-wrap gap-2 text-xs">
                <span className="rounded-lg bg-sand-100 px-3 py-1.5 font-semibold text-navy-800">
                  📦 Type: {LISTING_TYPE_LABEL[listing.listing_type]}
                </span>
                <span className="rounded-lg bg-sand-100 px-3 py-1.5 font-semibold text-navy-800">
                  📍 {listing.region || "Ghana"}
                </span>
                <span className="rounded-lg bg-sand-100 px-3 py-1.5 font-semibold text-navy-800">
                  🆔 Listing #{listing.id}
                </span>
              </div>
            </div>
          </div>

          {/* Safety */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
            <h3 className="font-bold text-amber-900">🛡️ Safe deal guidance</h3>
            <ul className="mt-2 list-inside list-disc space-y-1 text-amber-900/80">
              <li>Inspect expensive items before payment where appropriate.</li>
              <li>Meet in safe, public locations and verify seller identity.</li>
              <li>Avoid suspicious payment requests outside AxisOps.</li>
              <li>Keep communication inside the platform for your protection.</li>
            </ul>
          </div>        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          {isOwner ? (
            <BoostPanel listingId={listing.id} balance={getWalletBalance(user.id)} />
          ) : (
            listing.status === "active" && <EscrowPanel listingId={listing.id} />
          )}

          <OfferPanel
            listingId={listing.id}
            price={listing.price}
            negotiable={listing.negotiable === 1}
            isOwner={isOwner}
          />

          <ChatPanel listingId={listing.id} meId={user.id} sellerName={listing.seller_name} isOwner={isOwner} />

          {isOwner && (
            <PhotoUploader listingId={listing.id} initialPhotos={photos.map((p) => `/api/photos/${p.filename}`)} />
          )}
          {isOwner && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm">
              <p className="font-bold text-sky-900">This is your listing</p>
              <a href="/dashboard" className="mt-1 inline-block font-semibold text-sky-700 underline">
                Manage it in your dashboard →
              </a>
            </div>
          )}

          {/* Seller card — trust-first */}
          <div className="rounded-xl border border-sand-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-navy-800/70">
              Seller
            </h3>
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-navy-900 text-lg font-black text-white">
                {listing.seller_name.charAt(0)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-bold text-navy-900">{listing.seller_name}</p>
                <p className="text-xs capitalize text-navy-800/70">{listing.seller_type}</p>
                <div className="mt-1">
                  <TrustBadges
                    size="xs"
                    idVerified={listing.seller_id_verified === 1}
                    businessVerified={listing.seller_business_verified === 1}
                  />
                </div>
              </div>
            </div>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-navy-800/70">Completed deals</dt>
                <dd className="font-semibold text-brand-700">🤝 {trustStats.completedDeals}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-navy-800/70">Reviews</dt>
                <dd className="font-semibold text-navy-900">
                  {trustStats.reviewCount > 0
                    ? `⭐ ${trustStats.avgRating.toFixed(1)} (${trustStats.reviewCount})`
                    : "New seller"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-navy-800/70">Member since</dt>
                <dd className="font-semibold text-navy-900">{memberSince}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-navy-800/70">Location</dt>
                <dd className="font-semibold text-navy-900">{listing.seller_location}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-navy-800/70">💬 Chat &amp; offers stay inside AxisOps</p>
          </div>
        </aside>
      </div>

      {/* Similar */}
      {similar.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-extrabold text-navy-900">Similar listings</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {similar.map((l) => (
              <ListingCard key={l.id} listing={l} fav={favs.has(l.id)} photo={similarPhotos.get(l.id) ? `/api/photos/${similarPhotos.get(l.id)}` : null} photoCount={similarCounts.get(l.id) ?? 0} />
            ))}
          </div>          </section>
      )}
    </div>
  );
}
