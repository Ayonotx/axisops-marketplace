import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getSessionUser } from "@/lib/db";
import { adminProcessPayout } from "@/lib/escrow";

export async function POST(req: Request) {
  await requireSession();
  const user = getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admin only." }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { payoutId?: number; decision?: string };
  const payoutId = Number(body.payoutId);
  const decision = body.decision === "paid" ? "paid" : body.decision === "rejected" ? "rejected" : null;
  if (!Number.isFinite(payoutId) || !decision) {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const result = adminProcessPayout(payoutId, decision);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
