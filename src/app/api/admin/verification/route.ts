import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getSessionUser, getDatabase } from "@/lib/db";

/** Admin grants/revokes trust tiers. Phone verification is inherent to OTP
 *  sign-up and cannot be revoked here. */
export async function POST(req: Request) {
  await requireSession();
  const admin = getSessionUser();
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admin only." }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    userId?: number;
    tier?: string;
    value?: boolean;
  };
  const userId = Number(body.userId);
  const tier = body.tier;
  const value = body.value === true ? 1 : 0;
  if (!Number.isFinite(userId) || (tier !== "id" && tier !== "business")) {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const column = tier === "id" ? "id_verified" : "business_verified";
  const res = getDatabase()
    .prepare(`UPDATE users SET ${column} = ? WHERE id = ?`)
    .run(value, userId);
  if (Number(res.changes) === 0) {
    return NextResponse.json({ ok: false, error: "User not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
