# AxisOps Suite — Global Online Marketplace

Ghana-first multi-vendor marketplace: escrow-protected deals, mobile-money-style wallet,
SMS OTP sign-in, web push, and an Android TWA package. Phone-number accounts, no passwords.

## Delivered phases

1. **Wallet + escrow + revenue** — buyers pay into escrow; sellers deliver; confirmation
   (or 72h auto-release) settles with a configurable platform commission (default 7%,
   settable in `/admin/finance`). Wallet ledger in `wallet_transactions`; withdrawal
   requests flow through an admin payout queue. Boosts (3/7-day features) bill the wallet.
2. **Arkesel SMS OTP** — sign-in by phone. Live mode uses Arkesel when `ARKEL_API_KEY`
   is set; demo mode returns the code on-screen (`devCode`) for development.
3. **Web push** — VAPID-based notifications for chat, escrow events, and admin broadcasts.
4. **Android TWA** — signed APK/AAB in `android/`; full recipe in `PACKAGING-ANDROID.md`.
5. **Trust & reviews** — the single rating source of truth is `getSellerTrustStats()`
   (escrow-gated reviews in `reviews.ts`): only buyers of completed escrow deals can
   review, once. The legacy seeded `users.rating`/`reviews`/`response_rate`/`verified`
   columns are dropped. Admin verification grants a ✓ badge on listings.

## Architecture

- **Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4**, Turbopack.
- **SQLite via `node:sqlite`** at `data/axisops.db`; schema + additive migrations in
  `src/lib/db.ts`. Domain logic in `src/lib/escrow.ts` (deals, wallet, payouts, boosts),
  `src/lib/reviews.ts` (trust), `src/lib/sms.ts` (OTP), `src/lib/paystack.ts` (checkout).
- Server Components render pages; small client components handle chat/deal/review actions.
- Admin console under `/admin` (disputes, payouts, commission, broadcasts, SMS).

## E2E suites (`scripts/`)

Shared helpers live in `scripts/e2e-common.sh` (sourced, not executed). Each script
targets the dev server via a `*_BASE` env var; defaults are stale — pass the current
`http://localhost:<port>` (port changes on every dev-server restart).

| Script | Covers | Run |
|---|---|---|
| `e2e-escrow.sh` | full deal lifecycle, commission split, dispute/refund, payout, boost, replay guards | `ESCROW_BASE=http://localhost:PORT bash scripts/e2e-escrow.sh` |
| `e2e-reviews.sh` | anti-fake-review constraints, trust stats, verification badge | `REVIEW_BASE=… bash scripts/e2e-reviews.sh` |
| `e2e-dispute-ui.mjs` | browser-driven: buyer opens dispute in UI, admin refunds via `/admin/finance` server action, buyer sees refund banner | `DISPUTE_BASE=… node scripts/e2e-dispute-ui.mjs` |
| `e2e-push.sh` | web push end-to-end with decryptable payloads (needs mock service) | start `node scripts/mock-push.js`, then `PUSH_BASE=… bash scripts/e2e-push.sh` |
| `e2e-sms.sh` / `e2e-sms-live.sh` | OTP demo + live modes | `SMS_BASE=…` |

**Push prerequisite:** the dev server must trust the mock push service's self-signed
certificate — start it with `NODE_EXTRA_CA_CERTS=scripts/mock-cert.pem`. Otherwise the
web-push sends fail with `self-signed certificate`.

Quality gates: `npx tsc --noEmit`, `npx eslint .`, `npx next build` — all expected clean.

## Demo vs live modes

Without provider keys everything runs in demo mode: OTP codes appear on-screen, Paystack
checkout is simulated (deal top-ups credit instantly and are recorded in the wallet
ledger), push goes to the local mock. Live keys switch behavior without code changes.

## Remaining manual steps

1. **Deployment** — host the app (see `PACKAGING-ANDROID.md` deployment section).
2. **Provider keys** — set `ARKEL_API_KEY` (SMS) and Paystack keys in `.env.local` to
   leave demo mode; rotate the VAPID keys for production.
3. **Play Console** — publish the TWA (keystore password in `android/KEYSTORE-SECRET.txt`
   — keep it out of any repository or artifact you share).
