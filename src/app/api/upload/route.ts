import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { requireSession } from "@/lib/auth";
import { getSessionUser, addListingPhoto, getDatabase } from "@/lib/db";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads");
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export async function POST(req: Request) {
  await requireSession();
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in to upload photos." }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const listingId = Number(form?.get("listingId"));
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "No file received." }, { status: 400 });
  }
  if (!Number.isFinite(listingId)) {
    return NextResponse.json({ ok: false, error: "Missing listing." }, { status: 400 });
  }
  const listing = getDatabase().prepare("SELECT user_id FROM listings WHERE id = ?").get(listingId) as
    | { user_id: number }
    | undefined;
  if (!listing) return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });
  if (listing.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Not your listing." }, { status: 403 });
  }
  const total = (getDatabase().prepare("SELECT COUNT(*) c FROM listing_photos WHERE listing_id = ?").get(listingId) as { c: number }).c;
  if (total >= 6) {
    return NextResponse.json({ ok: false, error: "Maximum 6 photos per listing." }, { status: 400 });
  }
  if (!ALLOWED[file.type]) {
    return NextResponse.json({ ok: false, error: "Use a JPG, PNG or WebP image." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ ok: false, error: "Image must be under 5 MB." }, { status: 400 });
  }

  const id = crypto.randomBytes(8).toString("hex");
  const filename = `${listingId}-${id}${ALLOWED[file.type]}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, filename), buf);
  addListingPhoto(listingId, filename);

  return NextResponse.json({ ok: true, filename, url: `/api/photos/${filename}` });
}
