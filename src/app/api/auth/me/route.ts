import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getSessionUser } from "@/lib/db";

export async function GET() {
  await requireSession();
  const user = getSessionUser();
  if (!user) return NextResponse.json({ ok: true, user: null });
  return NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name, phone: user.phone, isAdmin: user.role === "admin" },
  });
}
