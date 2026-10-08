import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getSessionUser, getPendingListings, getAdminStats, getListingPhotos, getUsers } from "@/lib/db";
import AdminListingActions from "@/components/AdminListingActions";
import AdminVerificationButtons from "@/components/AdminVerificationButtons";
import { formatPrice, timeAgo } from "@/lib/format";

export const metadata = { title: "Admin — AxisOps Marketplace" };

export default async function AdminPage() {
  await requireSession();
  const sessionUser = getSessionUser();
  if (!sessionUser || sessionUser.role !== "admin") redirect("/");
  const user = sessionUser;

  const stats = getAdminStats();
  const pending = getPendingListings();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-navy-900">🛡️ Admin Console</h1>
          <p className="text-sm text-navy-800/70">
            Review pending ads, approve the good ones and feature the best.
          </p>
        </div>
        <span className="rounded-full bg-navy-900 px-3 py-1 text-xs font-bold text-white">
          {user.name} · admin
        </span>
      </div>

      <div className="mt-3 flex gap-2">
        <Link href="/admin/finance" className="rounded-lg border border-sand-300 bg-white px-3 py-1.5 text-sm font-bold text-navy-800 hover:border-brand-400">💰 Finance</Link>
        <Link href="/admin/sms" className="rounded-lg border border-sand-300 bg-white px-3 py-1.5 text-sm font-bold text-navy-800 hover:border-brand-400">📨 SMS log</Link>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Pending review", value: stats.pending, tone: "bg-amber-50 text-amber-900 border-amber-200" },
          { label: "Active listings", value: stats.active, tone: "bg-brand-50 text-brand-800 border-brand-200" },
          { label: "Registered users", value: stats.users, tone: "bg-sky-50 text-sky-900 border-sky-200" },
          { label: "Total views", value: stats.views.toLocaleString(), tone: "bg-violet-50 text-violet-900 border-violet-200" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.tone}`}>
            <p className="text-2xl font-black">{s.value}</p>
            <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide opacity-80">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Moderation queue */}
      <h2 className="mt-8 text-lg font-extrabold text-navy-900">
        Pending queue {pending.length > 0 && <span className="ml-1 rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">{pending.length}</span>}
      </h2>

      {pending.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-sand-200 bg-white p-10 text-center">
          <p className="text-4xl">✅</p>
          <p className="mt-2 font-bold text-navy-900">Queue clear</p>
          <p className="text-sm text-navy-800/70">No listings waiting for review right now.</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {pending.map((l) => {
            const photos = getListingPhotos(l.id);
            return (
              <li key={l.id} className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-white p-4 shadow-sm sm:flex-row">
                <div className="listing-tile relative flex h-28 w-full shrink-0 items-center justify-center rounded-lg sm:w-40" style={{ "--tile-color": l.color } as React.CSSProperties}>
                  {photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/photos/${photos[0].filename}`} alt={l.title} className="absolute inset-0 h-full w-full rounded-lg object-cover" loading="lazy" />
                  ) : (
                    <span className="text-4xl">{l.emoji}</span>
                  )}
                  {photos.length > 1 && (
                    <span className="absolute bottom-1 right-1 rounded bg-navy-950/70 px-1.5 text-[10px] font-bold text-white">📷 {photos.length}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">Pending</span>
                    <span className="text-xs text-navy-800/60">#{l.id} · by {l.seller_name} · {timeAgo(l.created_at)}</span>
                  </div>
                  <h3 className="mt-1 font-bold text-navy-900">{l.title}</h3>
                  <p className="mt-0.5 text-lg font-extrabold text-brand-600">{formatPrice(l.price)}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-navy-800/70">{l.description}</p>
                  <div className="mt-3">
                    <AdminListingActions listingId={l.id} status={l.status} featured={l.featured === 1} />
                  </div>
                </div>
                <div className="shrink-0 self-start">
                  <Link href={`/listing/${l.id}`} className="text-xs font-semibold text-brand-700 underline">
                    View listing →
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Verification tiers */}
      <h2 className="mt-10 text-lg font-extrabold text-navy-900">🪪 Verification tiers</h2>
      <p className="text-sm text-navy-800/70">
        Phone ✓ is automatic for every OTP account. Grant ID ✓ and Business ✓ after checking documents.
      </p>
      <ul className="mt-3 divide-y divide-sand-200 rounded-xl border border-sand-200 bg-white">
        {getUsers().map((u) => (
          <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
            <span className="min-w-0 text-sm">
              <b className="text-navy-900">{u.name}</b>
              <span className="ml-2 text-xs text-navy-800/60">{u.phone} · {u.account_type}</span>
            </span>
            <AdminVerificationButtons
              userId={u.id}
              idVerified={(u as unknown as { id_verified?: number }).id_verified === 1}
              businessVerified={(u as unknown as { business_verified?: number }).business_verified === 1}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
