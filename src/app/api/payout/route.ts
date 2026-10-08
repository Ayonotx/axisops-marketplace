import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getSessionUser } from "@/lib/db";
import { createPayout, getPayoutsForUser } from "@/lib/escrow";

export async function POST(req: Request) {
  await requireSession();
  const user = getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    amount?: number;
    momoNumber?: string;
    network?: string;
  };
  const result = createPayout(
    user.id,
    Number(body.amount),
    String(body.momoNumber ?? ""),
    String(body.network ?? "")
  );
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({ ok: true, payoutId: result.payoutId });
}

export async function GET() {
  await requireSession();
  const user = getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  return NextResponse.json({ ok: true, payouts: getPayoutsForUser(user.id) });
}
