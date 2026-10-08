import { NextResponse } from "next/server";
import { createOtp, normalizePhone } from "@/lib/auth";
import { sendOtp, checkOtpRateLimit } from "@/lib/sms";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { phone?: string };
  const phone = normalizePhone(String(body.phone ?? ""));
  if (!/^\+\d{9,15}$/.test(phone)) {
    return NextResponse.json({ ok: false, error: "Enter a valid phone number (e.g. 024 123 4567)." }, { status: 400 });
  }

  const limited = checkOtpRateLimit(phone);
  if (!limited.ok) {
    return NextResponse.json({ ok: false, error: limited.error }, { status: 429 });
  }

  // Demo mode: createOtp generates the code and it is echoed to the screen.
  // Live mode: the same code is generated and stored, but sent by SMS only —
  // devCode is never returned so on-screen codes cannot be abused in prod.
  const { code } = createOtp(phone);
  const sent = await sendOtp(phone, code);
  if (!sent.ok) {
    return NextResponse.json(
      { ok: false, error: `${sent.error} Your code was not sent — try again shortly.` },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    phone,
    mode: sent.mode,
    // demo only: lets testers sign in without a phone
    ...(sent.mode === "demo" ? { devCode: code } : {}),
  });
}
