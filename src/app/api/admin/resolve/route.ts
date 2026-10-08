import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getSessionUser } from "@/lib/db";
import { resolveDealAdmin } from "@/lib/escrow";

/** Admin dispute resolution: release funds to the seller or refund the buyer. */
export async function POST(req: Request) {
  await requireSession();
  const user = getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admin only." }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    dealId?: number;
    resolution?: string;
  };
  const dealId = Number(body.dealId);
  const resolution = body.resolution === "release" || body.resolution === "refund" ? body.resolution : null;
  if (!Number.isFinite(dealId) || !resolution) {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const result = resolveDealAdmin(dealId, resolution);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
