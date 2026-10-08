#!/usr/bin/env bash
# Live-mode OTP E2E. The dev server on $BASE must be running with live env
# (ARKEL_API_KEY set, ARKEL_API_URL pointing at scripts/mock-arkesel.js).
set -u
BASE="${LIVE_BASE:-http://localhost:63893}"
fail() { echo "❌ FAIL: $1"; exit 1; }
step() { echo; echo "== $1 =="; }

step "Live mode: request OTP — no devCode may be returned"
R=$(curl -s -X POST "$BASE/api/auth/request" -H 'Content-Type: application/json' -d '{"phone":"+233240770013"}')
echo "$R"
echo "$R" | grep -q '"mode":"live"' || fail "live mode not reported: $R"
echo "$R" | grep -q 'devCode' && fail "SECURITY: devCode leaked in live mode: $R"
echo "✅ no devCode in live response"

step "Live: code must have arrived through the provider path (mock log)"
sleep 1
SMS_CODE=$(grep -o 'Your AxisOps verification code is [0-9]*' "$(pwd)/scripts/arkesel-mock.log" | tail -1 | grep -o '[0-9]*$')
[ -n "$SMS_CODE" ] || fail "provider send never happened (no OTP in mock log)"
echo "code delivered via provider: $SMS_CODE"

step "Live: verify with the provider-delivered code"
R=$(curl -s -c /tmp/sms-live.jar -X POST "$BASE/api/auth/verify" -H 'Content-Type: application/json' -d "{\"phone\":\"+233240770013\",\"code\":\"$SMS_CODE\"}")
echo "$R" | grep -q '"ok":true' || fail "live verify failed: $R"
echo "✅ live request→send→verify complete"

step "Careless: wrong code rejected"
R=$(curl -s -X POST "$BASE/api/auth/verify" -H 'Content-Type: application/json' -d '{"phone":"+233240770014","code":"999999"}')
echo "$R" | grep -q '"ok":false' || fail "wrong code accepted: $R"
echo "✅ rejected"

step "Careless: invalid phone rejected in live mode too"
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/auth/request" -H 'Content-Type: application/json' -d '{"phone":"abc"}')
[ "$R" = "400" ] || fail "bad phone accepted ($R)"
echo "✅ 400"

rm -f /tmp/sms-live.jar
echo
echo "ALL LIVE-MODE SMS CHECKS PASSED"
