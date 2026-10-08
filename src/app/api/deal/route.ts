import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getSessionUser } from "@/lib/db";
import { markDelivered, confirmDeal, disputeDeal, cancelDeal, getDealView } from "@/lib/escrow";
import { sendPushToUser } from "@/lib/push";

export async function POST(req: Request) {
  await requireSession();
  const user = getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    dealId?: number;
    action?: string;
    note?: string;
    reason?: string;
  };
  const dealId = Number(body.dealId);
  const action = String(body.action ?? "");
  if (!Number.isFinite(dealId)) {
    return NextResponse.json({ ok: false, error: "Missing deal." }, { status: 400 });
  }

  const deal = getDealView(dealId);
  if (!deal) return NextResponse.json({ ok: false, error: "Deal not found." }, { status: 404 });
  if (deal.buyer_id !== user.id && deal.seller_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Not your deal." }, { status: 403 });
  }

  let result: { ok: boolean; error?: string };
  switch (action) {
    case "deliver":
      result = markDelivered(dealId, user.id, String(body.note ?? ""));
      break;
    case "confirm":
      result = confirmDeal(dealId, user.id);
      break;
    case "dispute":
      result = disputeDeal(dealId, user.id, String(body.reason ?? ""));
      break;
    case "cancel":
      result = cancelDeal(dealId, user.id);
      break;
    default:
      result = { ok: false, error: "Unknown action." };
  }
  if (result.ok) {
    // Push the counterparty after successful transitions. Fire-and-forget.
    if (action === "deliver") {
      void sendPushToUser(deal.buyer_id, {
        title: "📦 Your order was delivered",
        body: `"${deal.listing_title}" — confirm receipt to release payment (72h auto-release).`,
        url: `/deals/${dealId}`,
        tag: `deal-${dealId}`,
      });
    } else if (action === "confirm") {
      void sendPushToUser(deal.seller_id, {
        title: "💰 Payment released!",
        body: `${deal.buyer_name} confirmed "${deal.listing_title}" — GH₵ ${deal.seller_amount.toFixed(2)} is in your wallet.`,
        url: `/wallet`,
        tag: `deal-${dealId}`,
      });
    } else if (action === "dispute") {
      void sendPushToUser(deal.seller_id, {
        title: `⚠️ Deal disputed`,
        body: `Buyer opened a dispute on "${deal.listing_title}" — admin will review.`,
        url: `/deals/${dealId}`,
        tag: `deal-${dealId}`,
      });
    }
  }
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
