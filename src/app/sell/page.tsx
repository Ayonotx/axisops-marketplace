import Link from "next/link";
import { getCategories, getSessionUser } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import SellForm from "@/components/SellForm";

const REGIONS = [
  "Greater Accra",
  "Ashanti",
  "Western",
  "Northern",
  "Volta",
  "Central",
  "Eastern",
];

export const metadata = { title: "Post a Free Ad — AxisOps Marketplace" };

export default async function SellPage() {
  await requireSession();
  const signedIn = getSessionUser() !== null;
  const categories = getCategories();

  if (!signedIn) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-4xl">🔐</p>
        <h1 className="mt-3 text-2xl font-extrabold text-navy-900">Sign in to post your ad</h1>
        <p className="mt-2 text-sm text-navy-800/70">
          Real accounts keep buyers and sellers safe. Verify your phone with a 6-digit code —
          it takes 10 seconds.
        </p>
        <Link
          href="/signin"
          className="mt-6 inline-block rounded-xl bg-brand-500 px-8 py-3 font-bold text-white hover:bg-brand-600"
        >
          Sign in with phone
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-navy-900">
          Post your ad — it&apos;s free
        </h1>
        <p className="mt-1 text-sm text-navy-800/70">
          Reach thousands of buyers across Ghana. Listing takes under 2 minutes.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {["✅ Free listing", "📱 Photos supported", "⭐ Boost ready", "🛡️ Moderated"].map((t) => (
            <span key={t} className="rounded-full bg-brand-50 px-3 py-1 font-semibold text-brand-700 border border-brand-100">
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
        <SellForm
          categories={categories.map((c) => ({
            slug: c.slug,
            name: c.name,
            emoji: c.emoji,
            subs: c.subs,
            type: c.type,
          }))}
          regions={REGIONS}
        />
      </div>

      <div className="mt-6 rounded-xl bg-navy-900 p-5 text-sm text-sand-100">
        <h2 className="font-bold text-accent-400">What happens next?</h2>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-sand-100/80">
          <li>Our moderation team reviews your ad (usually under 30 minutes).</li>
          <li>Once approved it appears in search and category pages.</li>
          <li>Offers and messages arrive in your dashboard.</li>
        </ol>
      </div>
    </div>
  );
}
