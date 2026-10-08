#!/usr/bin/env bash
# Shared helpers for the AxisOps e2e-*.sh scripts. Source, don't execute.
# Expects $BASE (the dev server origin) to be set by the sourcing script.

step() { echo; echo "== $1 =="; }
fail() { echo "❌ FAIL: $1"; exit 1; }

# Clear OTP rate-limit windows for the shared test phones (extra phones as args).
clear_otp() {
  node -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/axisops.db');
const phones = ['+233245550016', '+233245550015', '+233240000001', ...process.argv.slice(1)];
const qs = phones.map(() => '?').join(',');
db.prepare('DELETE FROM otps WHERE phone IN (' + qs + ')').run(...phones);
console.log('otp windows cleared');
" "$@"
}

# OTP sign-in via the demo devCode path. signin <phone> <jarfile>
signin() {
  local phone="$1" jar="$2" R C
  R=$(curl -s -X POST "$BASE/api/auth/request" -H 'Content-Type: application/json' -d "{\"phone\":\"$phone\"}")
  C=$(echo "$R" | grep -o '"devCode":"[0-9]*"' | grep -o '[0-9]*')
  [ -n "$C" ] || fail "no devCode for $phone: $R"
  R=$(curl -s -c "$jar" -X POST "$BASE/api/auth/verify" -H 'Content-Type: application/json' -d "{\"phone\":\"$phone\",\"code\":\"$C\"}")
  echo "$R" | grep -q '"ok":true' || fail "verify failed for $phone: $R"
}

# Follow the deal checkout redirect to learn the payment reference. resolve_ref <jar> <dealId>
resolve_ref() {
  local CU
  CU=$(curl -s -b "$1" -o /dev/null -w "%{redirect_url}" "$BASE/api/pay/checkout/$2")
  echo "$CU" | sed -n 's|.*/pay/\([^?]*\).*|\1|p'
}

# Seed a fresh active listing owned by the E2E seller (listing creation has no
# public API by design). seed_listing <title> <description> [price] -> echoes id
seed_listing() {
  node -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/axisops.db');
const seller = db.prepare(\"SELECT id FROM users WHERE phone = '+233245550016'\").get();
const r = db.prepare(\"INSERT INTO listings (user_id, category, subcategory, title, description, price, condition, location, region, status, listing_type, emoji, color) VALUES (?, 'electronics', 'Phones', ?, ?, ?, 'New', 'Accra', 'Greater Accra', 'active', 'product', '📱', '#2563EB')\").run(seller.id, process.argv[1], process.argv[2], Number(process.argv[3] || 100));
console.log(Number(r.lastInsertRowid));
" "$1" "$2" "${3:-100}"
}
