#!/usr/bin/env bash
# E2E proof of the anti-fake-review constraint.
set -u
BASE="${REVIEW_BASE:-http://localhost:62664}"
. "$(dirname "$0")/e2e-common.sh"

step "Cleanup: reset OTP windows for test phones, clear test reviews"
clear_otp
node -e "
const { DatabaseSync } = require('node:sqlite');
new DatabaseSync('data/axisops.db').prepare('DELETE FROM reviews').run(); // test artifacts — re-created below
console.log('reviews cleared');
"

step "Find a settled deal + its buyer/seller"
read -r DEAL BUYER SELLER <<< "$(node -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/axisops.db');
const d = db.prepare(\"SELECT id, buyer_id, seller_id FROM deals WHERE status='settled' ORDER BY id DESC LIMIT 1\").get();
console.log(d.id, d.buyer_id, d.seller_id);
")"
[ -n "$DEAL" ] || fail "no settled deal available"
echo "settled deal $DEAL (buyer $BUYER, seller $SELLER)"

step "Anonymous review → 401"
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/reviews" -H 'Content-Type: application/json' -d "{\"dealId\":$DEAL,\"rating\":5}")
[ "$R" = "401" ] || fail "anon review allowed ($R)"
echo "✅ 401"

step "CARELESS: user with NO completed deal cannot review (structurally)"
# fresh user, never in any deal
signin "0245550018" freshuser.jar
R=$(curl -s -w "|%{http_code}" -b freshuser.jar -X POST "$BASE/api/reviews" -H 'Content-Type: application/json' -d "{\"dealId\":$DEAL,\"rating\":5}")
echo "$R" | grep -q '|403' || fail "deal-less user could review: $R"
echo "$R"
echo "✅ rejected — no completed deal, no review"

step "CARELESS: non-buyer participant (seller of the deal) cannot review own sale"
node -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/axisops.db');
const u = db.prepare('SELECT phone FROM users WHERE id=?').get($SELLER);
console.log(u.phone.replace('+233',''));
" > sellerphone.txt
SP="0$(cat sellerphone.txt)"
signin "$SP" seller.jar
R=$(curl -s -w "|%{http_code}" -b seller.jar -X POST "$BASE/api/reviews" -H 'Content-Type: application/json' -d "{\"dealId\":$DEAL,\"rating\":5}")
echo "$R" | grep -q '|403' || fail "seller reviewed own sale: $R"
echo "✅ 403"

step "CARELESS: bad ratings rejected (0, 6, 3.5)"
signin "0245550015" buyer.jar
for BAD in 0 6 3.5; do
  R=$(curl -s -b buyer.jar -X POST "$BASE/api/reviews" -H 'Content-Type: application/json' -d "{\"dealId\":$DEAL,\"rating\":$BAD}")
  echo "$R" | grep -q '"ok":false' || fail "rating $BAD accepted: $R"
done
echo "✅ all invalid ratings rejected"

step "HAPPY PATH: buyer of the settled deal CAN review"
BEFORE=$(node -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('data/axisops.db');console.log(JSON.stringify(db.prepare('SELECT COUNT(*) c FROM reviews WHERE deal_id=?').get($DEAL)))")
echo "existing review rows for deal: $BEFORE"
R=$(curl -s -b buyer.jar -X POST "$BASE/api/reviews" -H 'Content-Type: application/json' -d "{\"dealId\":$DEAL,\"rating\":5,\"comment\":\"E2E review — smooth escrow deal, item as described\"}")
echo "$R" | grep -q '"ok":true' || fail "legit buyer review rejected: $R"
echo "✅ review accepted"

step "DOUBLE REVIEW: same deal cannot be reviewed twice"
R=$(curl -s -w "|%{http_code}" -b buyer.jar -X POST "$BASE/api/reviews" -H 'Content-Type: application/json' -d "{\"dealId\":$DEAL,\"rating\":1}")
echo "$R" | grep -q '|400' || fail "double review allowed: $R"
echo "✅ rejected"

step "Seller trust stats updated on the listing page"
node -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/axisops.db');
const s = db.prepare('SELECT COUNT(*) c, COALESCE(AVG(rating),0) a FROM reviews WHERE seller_id=?').get($SELLER);
console.log('seller reviews:', s.c, 'avg:', s.a);
process.exit(s.c >= 1 ? 0 : 1);
" || fail "review not counted in seller stats"
curl -s "$BASE/listing/45" | grep -q "Completed deals" || fail "listing page missing trust section"
echo "✅ trust stats live on listing page"

step "Verification tiers: admin grant + badge appears on listing page"
# grant business verification to the seller via admin
JARA=adminv.jar; rm -f $JARA
signin "0240000001" "$JARA"
R=$(curl -s -b "$JARA" -X POST "$BASE/api/admin/verification" -H 'Content-Type: application/json' -d "{\"userId\":$SELLER,\"tier\":\"business\",\"value\":true}")
echo "$R" | grep -q '"ok":true' || fail "admin grant failed: $R"
curl -s "$BASE/listing/45" | grep -q "Business ✓" || fail "business badge not on listing page"
echo "✅ Business ✓ badge visible"
# non-admin cannot grant
R=$(curl -s -b buyer.jar -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin/verification" -H 'Content-Type: application/json' -d "{\"userId\":$SELLER,\"tier\":\"id\",\"value\":true}")
[ "$R" = "403" ] || fail "non-admin granted verification ($R)"
echo "✅ 403 for non-admin"

rm -f freshuser.jar seller.jar buyer.jar adminv.jar sellerphone.txt
echo
echo "ALL REVIEW/TRUST E2E CHECKS PASSED"
