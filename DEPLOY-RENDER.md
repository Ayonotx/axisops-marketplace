# Deploying to Render

The app needs a **persistent disk** (SQLite file DB + uploaded photos), so the free
tier is not enough — the **Starter plan (~$7/mo)** is required. A 1 GB disk adds
~$0.25/mo. Region **Frankfurt** is the closest with disk support.

## Your manual steps (10 minutes)

1. **Create the account & service**
   - Sign up at <https://dashboard.render.com/register> (GitHub or email).
   - Add a payment card under **Settings → Billing** (required for the Starter plan + disk).
   - Push this project to a GitHub repo (the workspace is not a git repo yet — ask me
     to do it), then in Render: **New + → Web Service → Connect the repo**.
   - If you prefer no Git: **New + → Web Service → "Deploy without a repo"** is not
     offered on all plans; Git is the reliable path.
2. **Configure the service** (or use `render.yaml` via Blueprint):
   - Runtime **Node**, Build `npm ci && npm run build`, Start `npm run start`.
   - Plan **Starter**, Region **Frankfurt**.
   - **Disks → Add disk**: mount path `/var/data`, size 1 GB.
   - Environment variables:
     | Key | Value |
     |---|---|
     | `DB_PATH` | `/var/data/axisops.db` |
     | `UPLOAD_DIR` | `/var/data/uploads` |
     | `PEXELS_API_KEY` | *(paste from `.env.local` — never commit it)* |
     | `NODE_VERSION` | `24` |
3. **Deploy.** First build takes ~3–5 minutes. Your URL will be
   `https://axisops-marketplace.onrender.com` (rename the service to get a nicer one).

## Why these settings

- `DB_PATH`/`UPLOAD_DIR` point at the mounted disk so the wallet/escrow ledger and
  uploaded photos survive redeploys (the free tier wipes local files).
- The app is a long-running Node server (`next start`), not serverless — that's why
  Vercel/Netlify were rejected.

## After the first deploy (I'll do these)

- Verify the live URL renders, sign-in works, and the DB seeded.
- Rebuild the TWA APK against the live URL and publish `/.well-known/assetlinks.json`
  from the app so the Android TWA opens fullscreen without a browser bar.
- Rotate the demo-mode env: set live Paystack/Arkesel keys when you have them.

## Cold starts

The Starter plan spins down after ~15 min idle; the first request afterwards takes
~30–60 s to boot. Upgrade to a plan without spin-down if that bothers users.
