import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getCurrentUser, getFavoriteIds, getDatabase, getSessionUser, CATEGORIES } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { sweepAutoRelease } from "@/lib/escrow";
import PushPrompt from "@/components/PushPrompt";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: "AxisOps Marketplace — Buy. Sell. Trade. Grow.",
  description:
    "AxisOps Suite Marketplace: products, vehicles, property, professional services, jobs and businesses — one connected digital marketplace.",
  applicationName: "AxisOps Suite",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AxisOps",
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

// Always render at request time: layout reads live SQLite data (favourites, user)
export const dynamic = "force-dynamic";
/** Client component that registers the PWA service worker once, on load. */
function RegisterSW() {
  const code = `if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{})})}`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 shrink-0">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-white font-black text-lg shadow-sm">
        A
      </span>
      <span className="leading-tight hidden sm:block">
        <span className="block font-extrabold text-white tracking-tight">AxisOps Suite</span>
        <span className="block text-[10px] uppercase tracking-[0.18em] text-accent-400">
          Marketplace
        </span>
      </span>
    </Link>
  );
}

const icon = "h-5 w-5";
const ChatIcon = () => (
  <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
);
const WalletIcon = () => (
  <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M16 12h4" /><circle cx="16.5" cy="12" r="0.5" fill="currentColor" /></svg>
);
const HeartIcon = () => (
  <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
);
const ShieldIcon = () => (
  <svg className={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
);

export default async function RootLayout({ children }: LayoutProps<"/">) {
  await requireSession();
  // Opportunistic sweep on every request: settles delivered deals whose 72h
  // auto-release window passed and expires paid boosts. Idempotent and cheap.
  try { sweepAutoRelease(); } catch { /* never block a page render on the sweep */ }
  const user = getCurrentUser();
  const favCount = getFavoriteIds(user.id).length;
  // Session user (or demo user id=1 fallback) — unread chat badge
  const unread = getDatabase()
    .prepare("SELECT COUNT(*) c FROM messages WHERE to_user_id = ? AND read_at IS NULL")
    .get(user.id) as { c: number };
  const isAdmin = (user as { role?: string }).role === "admin";
  // The demo fallback user (no cookie) is id=1; a real session means signed-in
  const sessionActive = getSessionUser() !== null;

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <meta name="theme-color" content="#04121c" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <RegisterSW />
      </head>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-40 bg-navy-900 text-white shadow-md">
          <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
            <Logo />
            <nav className="hidden items-center gap-1 lg:flex">
              {CATEGORIES.slice(0, 6).map((c, i) => (
                <Link
                  key={c.slug}
                  href={`/browse?category=${c.slug}`}
                  className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm text-sand-100 hover:bg-navy-800 hover:text-white transition ${i < 3 ? "" : i < 5 ? "hidden xl:block" : "hidden 2xl:block"}`}
                >
                  {c.name}
                </Link>
              ))}
              <Link
                href="/browse"
                className="rounded-md px-2.5 py-1.5 text-sm text-sand-100 hover:bg-navy-800 hover:text-white transition"
              >
                All
              </Link>
            </nav>

            <form action="/browse" method="GET" className="ml-auto flex min-w-[118px] flex-1 max-w-[290px] 2xl:max-w-md">
              <input
                name="q"
                placeholder="Search phones, cars, property…"
                className="w-full rounded-l-lg border-0 bg-white px-3 py-2 text-sm text-navy-900 placeholder:text-navy-700/60 focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
              <button
                type="submit"
                className="rounded-r-lg bg-brand-500 px-3 py-2 text-sm font-semibold hover:bg-brand-600 transition"
              >
                Search
              </button>
            </form>

            <div className="flex items-center gap-2">
              <Link
                href="/inbox"
                className="relative shrink-0 rounded-md px-2 py-1.5 text-sm hover:bg-navy-800 transition"
                title="Inbox"
              >
                <span className="grid h-8 w-8 place-items-center"><ChatIcon /></span>
                {unread.c > 0 && (
                  <span className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
                    {unread.c}
                  </span>
                )}
              </Link>
              <Link
                href="/wallet"
                className="relative shrink-0 rounded-md px-2 py-1.5 text-sm hover:bg-navy-800 transition"
                title="Wallet"
              >
                <span className="grid h-8 w-8 place-items-center"><WalletIcon /></span>
              </Link>
              <Link
                href="/favorites"
                className="relative shrink-0 rounded-md px-2 py-1.5 text-sm hover:bg-navy-800 transition"
                title="Favourites"
              >
                <span className="relative grid h-8 w-8 place-items-center"><HeartIcon /></span>
                {favCount > 0 && (
                  <span className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-navy-950">
                    {favCount}
                  </span>
                )}
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="hidden rounded-md px-2.5 py-1.5 text-sm text-accent-300 hover:bg-navy-800 hover:text-accent-200 transition sm:block"
                >
                  <ShieldIcon />
                  <span className="hidden lg:inline">Admin</span>
                </Link>
              )}
              <Link
                href="/dashboard"
                className="hidden whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm text-sand-100 hover:bg-navy-800 hover:text-white transition sm:block"
              >
                Dashboard
              </Link>
              {sessionActive ? (
                <form action="/api/auth/signout" method="POST">
                  <button
                    type="submit"
                    title={`Signed in as ${user.phone}`}
                    className="hidden whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm text-sand-100 hover:bg-navy-800 hover:text-white transition sm:block"
                  >
                    Sign out
                  </button>
                </form>
              ) : (
                <Link
                  href="/signin"
                  className="hidden rounded-md px-2.5 py-1.5 text-sm text-sand-100 hover:bg-navy-800 hover:text-white transition sm:block"
                >
                  Sign in
                </Link>
              )}
              <Link
                href="/sell"
                className="rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-sm font-bold shadow-md shadow-brand-950/40 transition hover:brightness-110 whitespace-nowrap"
              >
                + Post Ad
              </Link>
            </div>
          </div>

          {/* Category strip */}
          <div className="border-t border-white/10 bg-navy-950/60">
            <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-1.5 text-xs">
              {CATEGORIES.map((c) => (
                <Link
                  key={c.slug}
                  href={`/browse?category=${c.slug}`}
                  className="whitespace-nowrap rounded-full px-2.5 py-1 text-sand-100/80 transition hover:bg-brand-600 hover:text-white"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>
        <PushPrompt />

        <footer className="mt-16 bg-navy-900 text-sand-100">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2 font-extrabold text-white">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-white">
                  A
                </span>
                AxisOps Suite
              </div>
              <p className="mt-2 text-sm text-sand-100/70">
                Smarter Operations. Bigger Possibilities. Buy • Sell • Trade • Hire • Grow.
              </p>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-accent-400">Marketplace</h4>
              <ul className="space-y-1.5 text-sm text-sand-100/80">
                <li><Link href="/browse" className="hover:text-white">Browse listings</Link></li>
                <li><Link href="/sell" className="hover:text-white">Post an ad</Link></li>
                <li><Link href="/favorites" className="hover:text-white">Favourites</Link></li>
                <li><Link href="/dashboard" className="hover:text-white">Seller dashboard</Link></li>
                <li><Link href="/wallet" className="hover:text-white">Wallet &amp; escrow</Link></li>
                <li><Link href="/deals" className="hover:text-white">My deals</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-accent-400">Categories</h4>
              <ul className="space-y-1.5 text-sm text-sand-100/80">
                {CATEGORIES.slice(0, 5).map((c) => (
                  <li key={c.slug}>
                    <Link href={`/browse?category=${c.slug}`} className="hover:text-white">
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-accent-400">Trust &amp; Safety</h4>
              <ul className="space-y-1.5 text-sm text-sand-100/80">
                <li>Verified accounts</li>
                <li>Keep deals inside AxisOps</li>
                <li>Meet in safe public places</li>
                <li>Report suspicious listings</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 py-4 text-center text-xs text-sand-100/60">
            © {new Date().getFullYear()} AxisOps Suite — Marketplace MVP demo. Ghana 🇬🇭 first, going global.
          </div>
        </footer>
      </body>
    </html>
  );
}
