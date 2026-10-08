import { NextResponse } from "next/server";
import { signInWithOtp, setSessionCookie, requireSession, normalizePhone } from "@/lib/auth";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { phone?: string; code?: string };
  const phone = normalizePhone(String(body.phone ?? ""));
  const code = String(body.code ?? "").trim();
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ ok: false, error: "Enter the 6-digit code." }, { status: 400 });
  }
  const res = signInWithOtp(phone, code);
  if (!res.ok || !res.token) {
    return NextResponse.json({ ok: false, error: res.error ?? "Sign-in failed." }, { status: 400 });
  }
  await setSessionCookie(res.token);
  // Prime the in-memory token for any same-request reads that follow
  await requireSession();
  return NextResponse.json({ ok: true, userId: res.userId });
}
