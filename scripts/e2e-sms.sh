#!/usr/bin/env bash
# E2E for the SMS OTP system, DEMO mode, against the main dev server.
# Live-mode checks live in scripts/e2e-sms-live.sh (run against a dev server
# started with ARKEL_API_KEY + ARKEL_API_URL pointing at scripts/mock-arkesel.js).
set -u
BASE="http://localhost:63893"
fail() { echo "❌ FAIL: $1"; exit 1; }
step() { echo; echo "== $1 =="; }

step "Demo OTP flow: request → devCode → verify → me"
PHONE="+233240770010"
R=$(curl -s -X POST "$BASE/api/auth/request" -H 'Content-Type: application/json' -d "{\"phone\":\"$PHONE\"}")
echo "$R" | grep -q '"mode":"demo"' || fail "demo mode not reported: $R"
CODE=$(echo "$R" | grep -o '"devCode":"[0-9]*"' | grep -o '[0-9]*')
[ -n "$CODE" ] || fail "no devCode in demo mode: $R"
echo "demo code: $CODE"
R=$(curl -s -c /tmp/sms-e2e.jar -X POST "$BASE/api/auth/verify" -H 'Content-Type: application/json' -d "{\"phone\":\"$PHONE\",\"code\":\"$CODE\"}")
echo "$R" | grep -q '"ok":true' || fail "verify failed: $R"
echo "✅ demo sign-in works"

step "Careless: invalid phone formats rejected"
for bad in '"abc"' '"123"' '""'; do
  R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/auth/request" -H 'Content-Type: application/json' -d "{\"phone\":$bad}")
  [ "$R" = "400" ] || fail "bad phone $bad accepted ($R)"
done
echo "✅ all rejected with 400"

step "Rate limit: second request inside 30s window rejected"
PHONE="+233240770011"
curl -s -X POST "$BASE/api/auth/request" -H 'Content-Type: application/json' -d "{\"phone\":\"$PHONE\"}" > /dev/null
R=$(curl -s -w "|%{http_code}" -X POST "$BASE/api/auth/request" -H 'Content-Type: application/json' -d "{\"phone\":\"$PHONE\"}")
echo "$R" | grep -q '|429' || fail "min-gap limit not enforced: $R"
echo "$R" | grep -q 'wait' || fail "no wait message: $R"
echo "✅ 429 + wait message"

step "Rate limit: 5-per-hour cap enforced"
# Simulate 5 earlier requests from this hour directly in the OTP table, then try.
PHONE="+233240770012"
node -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/axisops.db');
const ins = db.prepare(\"INSERT INTO otps (phone, code, purpose, created_at, expires_at) VALUES (?, '000000', 'signin', datetime('now', '-1 hour'), datetime('now', '-50 minutes'))\");
for (let i = 0; i < 5; i++) ins.run('$PHONE');
"
R=$(curl -s -w "|%{http_code}" -X POST "$BASE/api/auth/request" -H 'Content-Type: application/json' -d "{\"phone\":\"$PHONE\"}")
echo "$R" | grep -q '|429' || fail "hourly cap not enforced: $R"
echo "$R" | grep -q 'Too many codes' || fail "wrong cap message: $R"
echo "✅ hourly cap 429"

echo
echo "ALL DEMO-MODE SMS CHECKS PASSED"
