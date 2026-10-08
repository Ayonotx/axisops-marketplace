import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getSessionUser } from "@/lib/db";
import { pushConfigured, getVapidPublicKey, saveSubscription, removeSubscription, countSubscriptions } from "@/lib/push";

export async function GET() {
  return NextResponse.json({
    ok: true,
    configured: pushConfigured(),
    publicKey: getVapidPublicKey(),
    subscriptions: countSubscriptions(),
  });
}

export async function POST(req: Request) {
  await requireSession();
  const user = getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  if (!pushConfigured()) {
    return NextResponse.json({ ok: false, error: "Push is not configured on this server." }, { status: 501 });
  }
  const body = (await req.json().catch(() => null)) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  } | null;
  if (!body?.endpoint || !body.keys?.p256dh || !body.keys.auth) {
    return NextResponse.json({ ok: false, error: "Invalid subscription." }, { status: 400 });
  }
  const saved = saveSubscription(user.id, {
    endpoint: body.endpoint,
    keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
  });
  return NextResponse.json(saved, { status: saved.ok ? 200 : 400 });
}

export async function DELETE(req: Request) {
  await requireSession();
  const user = getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (!body.endpoint) {
    return NextResponse.json({ ok: false, error: "Missing endpoint." }, { status: 400 });
  }
  removeSubscription(body.endpoint);
  return NextResponse.json({ ok: true });
}
