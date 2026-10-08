import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getSessionUser } from "@/lib/db";
import { setCommissionPercent } from "@/lib/escrow";

export async function POST(req: Request) {
  await requireSession();
  const user = getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admin only." }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { percent?: number };
  const result = setCommissionPercent(Number(body.percent));
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
