import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getSessionUser } from "@/lib/db";
import { sendBroadcast, pushConfigured } from "@/lib/push";

/** Admin broadcast: one push to every subscribed user. */
export async function POST(req: Request) {
  await requireSession();
  const user = getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Admin only." }, { status: 403 });
  }
  if (!pushConfigured()) {
    return NextResponse.json({ ok: false, error: "Push is not configured on this server." }, { status: 501 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    body?: string;
    url?: string;
  };
  const title = String(body.title ?? "").trim();
  const text = String(body.body ?? "").trim();
  if (!title || !text) {
    return NextResponse.json({ ok: false, error: "Title and body are required." }, { status: 400 });
  }
  const delivered = await sendBroadcast({
    title: `📢 ${title.slice(0, 80)}`,
    body: text.slice(0, 200),
    url: body.url ?? "/browse",
    tag: "broadcast",
  });
  return NextResponse.json({ ok: true, delivered });
}
