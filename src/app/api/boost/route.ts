import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getSessionUser } from "@/lib/db";
import { purchaseBoost, BOOST_BUNDLES, type BoostBundleKey } from "@/lib/escrow";

/** Buy a visibility bundle (boost/feature/premium) from the seller's wallet. */
export async function POST(req: Request) {
  await requireSession();
  const user = getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    listingId?: number;
    bundle?: string;
  };
  const listingId = Number(body.listingId);
  const bundle = String(body.bundle ?? "") as BoostBundleKey;
  if (!Number.isFinite(listingId) || !(bundle in BOOST_BUNDLES)) {
    return NextResponse.json({ ok: false, error: "Pick a boost bundle." }, { status: 400 });
  }

  const result = purchaseBoost(user.id, listingId, bundle);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({ ok: true, charged: result.charged });
}
