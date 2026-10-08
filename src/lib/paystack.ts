import "server-only";
import crypto from "node:crypto";

/* Paystack integration with a demo fallback. When PAYSTACK_SECRET_KEY is
   absent from the environment the checkout is simulated so the whole escrow
   flow is testable with zero external accounts. */

const PAYSTACK_API = "https://api.paystack.co";

export function paystackEnabled(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

export type InitResult =
  | { ok: true; mode: "paystack"; authorizationUrl: string; reference: string }
  | { ok: true; mode: "demo"; reference: string; checkoutUrl: string }
  | { ok: false; error: string };

/** Request origin that works behind 0.0.0.0 binds and proxies —
 *  prefers the Host header over the literal request URL. */
export function requestOrigin(req: Request): string {
  const host = req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") || host.startsWith("192.168.") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return new URL(req.url).origin;
}

/** Create a checkout. Paystack: hosted checkout URL. Demo: a local simulated
 *  checkout page that calls the verify endpoint, as the real callback would. */
export async function initializePayment(
  email: string,
  amountGhs: number,
  reference: string,
  origin: string
): Promise<InitResult> {
  if (!paystackEnabled()) {
    return {
      ok: true,
      mode: "demo",
      reference,
      checkoutUrl: `${origin}/pay/${reference}`,
    };
  }
  try {
    const res = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amountGhs * 100), // pesewas
        reference,
        currency: "GHS",
        channels: ["mobile_money", "card"],
      }),
    });
    const json = (await res.json()) as {
      status: boolean;
      message?: string;
      data?: { authorization_url?: string };
    };
    if (!json.status || !json.data?.authorization_url) {
      return { ok: false, error: json.message ?? "Paystack rejected the payment." };
    }
    return { ok: true, mode: "paystack", authorizationUrl: json.data.authorization_url, reference };
  } catch {
    return { ok: false, error: "Could not reach Paystack. Try again." };
  }
}

export type VerifyResult =
  | { ok: true; status: "success" | "pending" | "failed"; amountGhs: number; paidAt?: string }
  | { ok: false; error: string };

/** Verify a transaction server-side. In demo mode any reference we issued is
 *  "successful" — the simulated checkout page calls this, like the real
 *  Paystack callback + verify flow would. */
export async function verifyPayment(reference: string): Promise<VerifyResult> {
  if (!paystackEnabled()) {
    // Only accept references this app issued for demo simulation.
    if (!reference.startsWith("AX-")) {
      return { ok: false, error: "Unknown payment reference." };
    }
    return { ok: true, status: "success", amountGhs: 0, paidAt: new Date().toISOString() };
  }
  try {
    const res = await fetch(`${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });
    const json = (await res.json()) as {
      status: boolean;
      message?: string;
      data?: { status: string; amount: number; paid_at?: string };
    };
    if (!json.status || !json.data) {
      return { ok: false, error: json.message ?? "Verification failed." };
    }
    const s = json.data.status;
    return {
      ok: true,
      status: s === "success" ? "success" : s === "abandoned" || s === "ongoing" ? "pending" : "failed",
      amountGhs: json.data.amount / 100,
      paidAt: json.data.paid_at,
    };
  } catch {
    return { ok: false, error: "Could not reach Paystack. Try again." };
  }
}

/** HMAC-SHA512 signature check for Paystack webhooks (x-paystack-signature). */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!paystackEnabled() || !signature) return false;
  const expected = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY as string)
    .update(rawBody)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/** Generate a unique payment reference (also used as the demo marker). */
export function makeReference(): string {
  return `AX-${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`;
}
