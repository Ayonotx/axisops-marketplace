"use server";

import { revalidatePath } from "next/cache";
import { getDatabase, getCurrentUser, getSessionUser, CATEGORIES } from "@/lib/db";
import { requireSession } from "@/lib/auth";

function refresh() {
  revalidatePath("/");
  revalidatePath("/browse");
  revalidatePath("/sell");
  revalidatePath("/dashboard");
  revalidatePath("/favorites");
  revalidatePath("/admin");
}

async function adminGuard() {
  await requireSession();
  // Must be a real session — the signed-out demo fallback (id 1) is also the
  // admin account, so checking the fallback would open the console to everyone.
  const sessionUser = getSessionUser();
  return sessionUser?.role === "admin";
}

export async function toggleFavorite(listingId: number) {
  const db = getDatabase();
  const user = getCurrentUser();
  const existing = db
    .prepare("SELECT 1 FROM favorites WHERE user_id = ? AND listing_id = ?")
    .get(user.id, listingId);
  if (existing) {
    db.prepare("DELETE FROM favorites WHERE user_id = ? AND listing_id = ?").run(user.id, listingId);
  } else {
    db.prepare("INSERT INTO favorites (user_id, listing_id) VALUES (?, ?)").run(user.id, listingId);
  }
  refresh();
}

export async function makeOffer(listingId: number, amount: number, message: string) {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Enter a valid offer amount." };
  }
  const db = getDatabase();
  const user = getCurrentUser();
  const listing = db.prepare("SELECT user_id, status FROM listings WHERE id = ?").get(listingId) as
    | { user_id: number; status: string }
    | undefined;
  if (!listing) return { ok: false, error: "Listing not found." };
  if (listing.user_id === user.id) return { ok: false, error: "You cannot make an offer on your own listing." };
  if (listing.status !== "active") return { ok: false, error: "This listing is no longer available." };

  db.prepare(
    "INSERT INTO offers (listing_id, buyer_id, amount, message, status) VALUES (?, ?, ?, ?, 'pending')"
  ).run(listingId, user.id, amount, message.slice(0, 500));
  refresh();
  return { ok: true };
}

export async function respondToOffer(
  offerId: number,
  action: "accept" | "reject" | "counter",
  counterAmount?: number
) {
  const db = getDatabase();
  const user = getCurrentUser();
  const offer = db
    .prepare(
      `SELECT o.id, o.status, l.user_id as owner_id FROM offers o
       JOIN listings l ON l.id = o.listing_id WHERE o.id = ?`
    )
    .get(offerId) as { id: number; status: string; owner_id: number } | undefined;
  if (!offer) return { ok: false, error: "Offer not found." };
  if (offer.owner_id !== user.id) return { ok: false, error: "Not your offer." };
  if (offer.status !== "pending") return { ok: false, error: "This offer was already handled." };

  if (action === "accept") {
    db.prepare("UPDATE offers SET status = 'accepted' WHERE id = ?").run(offerId);
  } else if (action === "reject") {
    db.prepare("UPDATE offers SET status = 'rejected' WHERE id = ?").run(offerId);
  } else {
    if (!counterAmount || !Number.isFinite(counterAmount) || counterAmount <= 0) {
      return { ok: false, error: "Enter a valid counteroffer amount." };
    }
    db.prepare("UPDATE offers SET status = 'countered', counter_amount = ? WHERE id = ?").run(
      counterAmount,
      offerId
    );
  }
  refresh();
  return { ok: true };
}

export async function setListingStatus(listingId: number, status: "active" | "sold" | "reserved") {
  const db = getDatabase();
  const user = getCurrentUser();
  const listing = db.prepare("SELECT user_id FROM listings WHERE id = ?").get(listingId) as
    | { user_id: number }
    | undefined;
  if (!listing || listing.user_id !== user.id) return { ok: false, error: "Not your listing." };
  db.prepare("UPDATE listings SET status = ? WHERE id = ?").run(status, listingId);
  refresh();
  return { ok: true };
}

export async function createListing(formData: FormData) {
  await requireSession();
  const sessionUser = getSessionUser();
  if (!sessionUser) return { ok: false, error: "Sign in to post an ad." };
  const db = getDatabase();
  const user = sessionUser;

  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const subcategory = String(formData.get("subcategory") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const price = Number(formData.get("price"));
  const condition = String(formData.get("condition") ?? "Used");
  const location = String(formData.get("location") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();
  const negotiable = formData.get("negotiable") === "on" ? 1 : 0;
  const listingType = String(formData.get("listing_type") ?? "product");

  if (!title || title.length < 5) return { ok: false, error: "Title must be at least 5 characters." };
  const cat = CATEGORIES.find((c) => c.slug === category);
  if (!cat) return { ok: false, error: "Choose a category." };
  if (!Number.isFinite(price) || price <= 0) return { ok: false, error: "Enter a valid price." };
  if (!description || description.length < 20)
    return { ok: false, error: "Description must be at least 20 characters." };

  const res = db
    .prepare(
      `INSERT INTO listings (user_id, category, subcategory, title, description, price, negotiable, condition, location, region, status, featured, listing_type, emoji, color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)`
    )
    .run(
      user.id,
      cat.slug,
      subcategory || cat.subs[0] || "",
      title,
      description,
      price,
      negotiable,
      condition,
      location || user.location.split(",")[0],
      region || (user.location.split(",")[1] ?? "").trim(),
      listingType,
      cat.emoji,
      cat.color
    );

  refresh();
  return { ok: true, id: Number(res.lastInsertRowid) };
}

/* ---------------- Admin / moderation ---------------- */

export async function moderateListing(
  listingId: number,
  action: "approve" | "reject" | "feature" | "unfeature"
) {
  if (!(await adminGuard())) return { ok: false, error: "Admin only." };
  const db = getDatabase();
  const listing = db.prepare("SELECT id, status FROM listings WHERE id = ?").get(listingId) as
    | { id: number; status: string }
    | undefined;
  if (!listing) return { ok: false, error: "Listing not found." };

  if (action === "approve") {
    db.prepare("UPDATE listings SET status = 'active' WHERE id = ?").run(listingId);
  } else if (action === "reject") {
    db.prepare("UPDATE listings SET status = 'expired' WHERE id = ?").run(listingId);
  } else if (action === "feature") {
    db.prepare("UPDATE listings SET featured = 1, status = 'active' WHERE id = ?").run(listingId);
  } else {
    db.prepare("UPDATE listings SET featured = 0 WHERE id = ?").run(listingId);
  }
  refresh();
  return { ok: true };
}
