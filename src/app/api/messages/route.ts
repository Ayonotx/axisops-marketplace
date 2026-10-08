import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import {
  getSessionUser,
  getMessagesForListing,
  insertMessage,
  getDatabase,
  markThreadRead,
} from "@/lib/db";
import { sendPushToUser } from "@/lib/push";

export async function GET(req: Request) {
  await requireSession();
  const user = getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in to chat." }, { status: 401 });

  const url = new URL(req.url);
  const listingId = Number(url.searchParams.get("listingId"));
  if (!Number.isFinite(listingId)) {
    return NextResponse.json({ ok: false, error: "Missing listingId." }, { status: 400 });
  }
  const listing = getDatabase().prepare("SELECT user_id FROM listings WHERE id = ?").get(listingId) as
    | { user_id: number }
    | undefined;
  if (!listing) return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
  // Only the seller and the buyer-of-record participants may read the thread
  const participant =
    listing.user_id === user.id ||
    getDatabase()
      .prepare(
        "SELECT 1 FROM messages WHERE listing_id = ? AND (from_user_id = ? OR to_user_id = ?)"
      )
      .get(listingId, user.id, user.id);
  if (!participant) {
    return NextResponse.json({ ok: true, messages: [] });
  }
  markThreadRead(listingId, user.id);
  return NextResponse.json({ ok: true, messages: getMessagesForListing(listingId, user.id) });
}

export async function POST(req: Request) {
  await requireSession();
  const user = getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in to chat." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { listingId?: number; body?: string };
  const listingId = Number(body.listingId);
  const text = String(body.body ?? "").trim();
  if (!Number.isFinite(listingId) || !text) {
    return NextResponse.json({ ok: false, error: "Type a message first." }, { status: 400 });
  }
  if (text.length > 1000) {
    return NextResponse.json({ ok: false, error: "Message too long." }, { status: 400 });
  }
  const listing = getDatabase().prepare("SELECT user_id, status FROM listings WHERE id = ?").get(listingId) as
    | { user_id: number; status: string }
    | undefined;
  if (!listing) return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
  if (listing.user_id === user.id) {
    return NextResponse.json({ ok: false, error: "You can't chat with yourself on your own listing." }, { status: 400 });
  }
  insertMessage(listingId, user.id, listing.user_id, text.slice(0, 1000));
  // Fire-and-forget push so the recipient hears about the message without
  // waiting for their 3s poll. Never blocks or fails the chat send.
  void sendPushToUser(listing.user_id, {
    title: `💬 ${user.name}`,
    body: text.slice(0, 120),
    url: `/listing/${listingId}`,
    tag: `chat-${listingId}-${user.id}`,
  });
  return NextResponse.json({ ok: true });
}
