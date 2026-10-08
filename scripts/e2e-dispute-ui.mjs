// Browser-driven E2E of the escrow dispute path through the real UI:
//   buyer: deal page → "There's a problem" → reason → "Open dispute"
//   admin: /admin/finance dispute queue → "Refund buyer" (server action)
//   buyer: deal page shows the refunded banner
// Uses the on-screen demo devCode for sign-in, so the login UI is exercised too.
// Setup (listing, payment, delivery) goes through the same APIs the UI calls.
// Requires a dev server on $BASE (default: port grepped from dev-server.log).
import { chromium } from "playwright-core";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

const BASE = process.env.DISPUTE_BASE ?? `http://localhost:${grepPort()}`;
const BUYER = { phone: "0245550015", dbPhone: "+233245550015" };
const SELLER = { phone: "0245550016", dbPhone: "+233245550016" };
const ADMIN = { phone: "0240000001", dbPhone: "+233240000001" };

function fail(msg) {
  console.error(`❌ FAIL: ${msg}`);
  process.exit(1);
}
function grepPort() {
  const log = fs.readFileSync("dev-server.log", "utf8");
  const ports = [...log.matchAll(/localhost:(\d+)/g)].map((m) => m[1]);
  if (ports.length === 0) fail("no localhost port found in dev-server.log");
  return ports[ports.length - 1];
}
function db() {
  return new DatabaseSync("data/axisops.db");
}
const step = (t) => console.log(`\n== ${t} ==`);

// ---- setup: clear OTP windows, seed listing, drive deal to delivered ----
clearOtp();
const { buyerPage, sellerPage, adminPage, browser } = await launch();
const dealId = await setupDeal(seedListing());

// ---- UI: buyer opens the dispute from the deal page ----
step(`Buyer sees delivered deal ${dealId} and opens the dispute UI`);
await buyerPage.goto(`${BASE}/deals/${dealId}`);
await buyerPage.getByText("📦 Item delivered!").waitFor();
await buyerPage.getByRole("button", { name: /There's a problem/i }).click();
// empty reason must keep the submit disabled
const disputeBtn = buyerPage.getByRole("button", { name: /Open dispute/i });
if (await disputeBtn.isEnabled()) fail("dispute submit enabled with empty reason");
await buyerPage.getByPlaceholder(/Item never arrived/i).fill("UI E2E — item not as described");
await disputeBtn.click();
await buyerPage.getByText(/Dispute open — our team is reviewing/i).waitFor();
console.log("✅ buyer opened the dispute from the deal page");

step("Seller sees the dispute banner");
await sellerPage.goto(`${BASE}/deals/${dealId}`);
await sellerPage.getByText(/Buyer disputed this deal — admin will decide/i).waitFor();
console.log("✅ seller dispute banner shown");

// ---- UI: admin resolves via the finance page server action ----
step("Admin resolves the dispute (refund buyer) from /admin/finance");
await adminPage.goto(`${BASE}/admin/finance`);
const disputeCard = adminPage.locator("li", { hasText: `Deal #${dealId}` }).first();
await disputeCard.getByText("UI E2E — item not as described").waitFor();
await disputeCard.getByRole("button", { name: "Refund buyer" }).click();
await adminPage.locator("li", { hasText: `Deal #${dealId}` }).first().waitFor({ state: "detached", timeout: 15000 });
await buyerPage.goto(`${BASE}/deals/${dealId}`);
await buyerPage.getByText("💸 Refunded to your wallet.").waitFor();
console.log("✅ admin refunded via the finance UI; buyer sees the refunded banner");

const deal = db().prepare("SELECT status FROM deals WHERE id = ?").get(dealId);
if (deal.status !== "refunded") fail(`deal status is ${deal.status}, expected refunded`);
console.log("✅ deal persisted as refunded");

await browser.close();
console.log("\nALL DISPUTE-UI E2E CHECKS PASSED");

// ---- helpers ----
function clearOtp() {
  const d = db();
  d.prepare("DELETE FROM otps WHERE phone IN (?, ?, ?)").run(BUYER.dbPhone, SELLER.dbPhone, ADMIN.dbPhone);
}

function seedListing() {
  const d = db();
  const seller = d.prepare("SELECT id FROM users WHERE phone = '+233245550016'").get();
  const r = d
    .prepare(
      "INSERT INTO listings (user_id, category, subcategory, title, description, price, condition, location, region, status, listing_type, emoji, color) VALUES (?, 'electronics', 'Phones', 'E2E Dispute UI Phone', 'Listing created by the dispute-UI E2E to exercise the buyer/admin dispute surfaces.', 100, 'New', 'Accra', 'Greater Accra', 'active', 'product', '📱', '#2563EB')"
    )
    .run(seller.id);
  return Number(r.lastInsertRowid);
}

async function launch() {
  let browser;
  for (const channel of ["msedge", "chrome", "chromium"]) {
    try {
      browser = await chromium.launch({ channel });
      console.log(`browser: ${channel}`);
      break;
    } catch {
      /* try next channel */
    }
  }
  if (!browser) fail("no usable browser (tried msedge, chrome, chromium)");
  const buyerCtx = await browser.newContext();
  const sellerCtx = await browser.newContext();
  const adminCtx = await browser.newContext();
  return {
    browser,
    buyerPage: await buyerCtx.newPage(),
    sellerPage: await sellerCtx.newPage(),
    adminPage: await adminCtx.newPage(),
  };
}

// Sign in through the real /signin UI (reads the on-screen demo devCode),
// then create + pay + deliver the deal through the same APIs the UI calls.
async function setupDeal(listingId) {
  await uiSignin(buyerPage, BUYER.phone);
  await uiSignin(sellerPage, SELLER.phone);
  await uiSignin(adminPage, ADMIN.phone);
  console.log("✅ all three roles signed in through the /signin UI");

  const buyerReq = buyerPage.request;
  const pay = await buyerReq.post(`${BASE}/api/pay`, { data: { listingId } });
  const { dealId } = await pay.json();
  if (!dealId) fail(`pay init failed: ${await pay.text()}`);

  const checkout = await buyerReq.get(`${BASE}/api/pay/checkout/${dealId}`);
  const reference = checkout.url().match(/\/pay\/([^?]*)/)?.[1];
  if (!reference) fail(`no reference from checkout redirect: ${checkout.url()}`);
  const confirm = await buyerReq.post(`${BASE}/api/pay/demo-confirm`, {
    params: { reference, dealId: String(dealId) },
    maxRedirects: 0,
  });
  if (confirm.status() >= 400) fail(`demo-confirm failed: ${confirm.status()}`);

  const deliver = await sellerPage.request.post(`${BASE}/api/deal`, {
    data: { dealId, action: "deliver", note: "UI E2E handoff" },
  });
  if (!(await deliver.json()).ok) fail(`deliver failed: ${await deliver.text()}`);
  console.log(`✅ deal ${dealId} paid + delivered (setup via UI-equivalent APIs)`);
  return dealId;
}

async function uiSignin(page, phone) {
  await page.goto(`${BASE}/signin`);
  await page.getByPlaceholder(/024 123 4567/).fill(phone);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText(/Demo mode — your code is/i).waitFor();
  const code = (await page.locator(".font-mono.text-lg").first().textContent()).trim();
  await page.getByPlaceholder("6-digit code").fill(code);
  await page.getByRole("button", { name: "Verify & sign in" }).click();
  await page.waitForURL(`${BASE}/dashboard`);
}
