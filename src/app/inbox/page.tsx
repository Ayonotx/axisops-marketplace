import Link from "next/link";
import { getInboxThreads, getCurrentUser } from "@/lib/db";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Inbox — AxisOps Marketplace" };

export default function InboxPage() {
  const user = getCurrentUser();
  const threads = getInboxThreads(user.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-extrabold tracking-tight text-navy-900">💬 Inbox</h1>
      <p className="text-sm text-navy-800/70">
        Chats about your listings and listings you messaged. Open a listing to reply.
      </p>

      {threads.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-sand-200 bg-white p-12 text-center">
          <p className="text-4xl">📭</p>
          <h2 className="mt-3 font-bold text-navy-900">No messages yet</h2>
          <p className="mt-1 text-sm text-navy-800/70">
            Chat with a seller from any listing page — conversations collect here.
          </p>
          <Link
            href="/browse"
            className="mt-4 inline-block rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600"
          >
            Browse listings
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {threads.map((t) => (
            <li key={`${t.listing_id}-${t.other_user_id}`}>
              <Link
                href={`/listing/${t.listing_id}`}
                className="flex items-center gap-3 rounded-xl border border-sand-200 bg-white p-3 shadow-sm transition hover:border-brand-300 hover:shadow-md"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy-900 text-sm font-black text-white">
                  {t.other_name.charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-bold text-navy-900">
                      {t.other_name}
                      <span className="ml-2 text-xs font-medium text-navy-800/60">
                        re: {t.listing_title}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] text-navy-800/50">
                      {timeAgo(t.last_at)}
                    </span>
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-navy-800/70">{t.last_body}</span>
                    {t.unread > 0 && (
                      <span className="shrink-0 rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-bold text-white">
                        {t.unread} new
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
