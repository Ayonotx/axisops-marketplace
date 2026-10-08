import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { getSessionUser, getDatabase } from "@/lib/db";

export async function POST(req: Request) {
  await requireSession();
  const user = getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admin only." }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    listingId?: number;
    action?: "approve" | "reject" | "feature" | "unfeature";
  };
  const listingId = Number(body.listingId);
  const action = body.action;
  if (!Number.isFinite(listingId) || !action) {
    return NextResponse.json({ ok: false, error: "Missing listingId or action." }, { status: 400 });
  }
  const db = getDatabase();
  const listing = db.prepare("SELECT id, status FROM listings WHERE id = ?").get(listingId) as
    | { id: number; status: string }
    | undefined;
  if (!listing) return NextResponse.json({ ok: false, error: "Listing not found." }, { status: 404 });

  if (action === "approve") {
    db.prepare("UPDATE listings SET status = 'active' WHERE id = ?").run(listingId);
  } else if (action === "reject") {
    db.prepare("UPDATE listings SET status = 'expired' WHERE id = ?").run(listingId);
  } else if (action === "feature") {
    db.prepare("UPDATE listings SET featured = 1, status = 'active' WHERE id = ?").run(listingId);
  } else if (action === "unfeature") {
    db.prepare("UPDATE listings SET featured = 0 WHERE id = ?").run(listingId);
  } else {
    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  }
  for (const p of ["/", "/browse", "/admin", "/dashboard"]) revalidatePath(p);
  return NextResponse.json({ ok: true });
}
