import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { markDealPaid } from "@/lib/escrow";
import { verifyWebhookSignature } from "@/lib/paystack";

/** Paystack calls this on payment success/failure. The raw body is required
 *  for the HMAC-SHA512 signature check, so we read text before parsing. */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-paystack-signature");
  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ ok: false, error: "Invalid signature." }, { status: 401 });
  }

  const event = JSON.parse(raw) as {
    event: string;
    data?: { reference?: string; status?: string };
  };
  if (event.event !== "charge.success" || !event.data?.reference) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const reference = event.data.reference;
  const deal = getDatabase()
    .prepare("SELECT id FROM deals WHERE payment_ref = ?")
    .get(reference) as { id: number } | undefined;

  if (!deal) {
    // Reference may belong to a wallet top-up instead of an escrow deal.
    return NextResponse.json({ ok: true, ignored: true });
  }
  const result = markDealPaid(deal.id, reference, "paystack");
  return NextResponse.json({ ok: result.ok, error: result.error });
}
