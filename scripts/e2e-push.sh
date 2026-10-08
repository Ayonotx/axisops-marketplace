#!/usr/bin/env bash
# E2E web push proof. Requires:
#  - dev server running with VAPID keys in env (.env.local)
#  - scripts/mock-push.js listening on 63997
# Creates a real-looking push subscription (own ECDH keys), subscribes it via
# the real endpoint, then triggers events and asserts decrypted payloads.
set -u
BASE="${PUSH_BASE:-http://localhost:63893}"
. "$(dirname "$0")/e2e-common.sh"

clear_otp

step "Push config endpoint reports configured + public key"
R=$(curl -s "$BASE/api/push/subscribe")
echo "$R" | grep -q '"configured":true' || fail "push not configured: $R"
PUB=$(echo "$R" | sed -n 's/.*"publicKey":"\([^"]*\)".*/\1/p')
[ -n "$PUB" ] || fail "no public key: $R"
echo "public key: ${PUB:0:20}…"

step "Generate receiver ECDH keys + auth secret (client side of subscription)"
node -e "
const c = require('crypto');
(async () => {
  const pair = await c.webcrypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
  const raw = await c.webcrypto.subtle.exportKey('raw', pair.publicKey);
  const priv = await c.webcrypto.subtle.exportKey('pkcs8', pair.privateKey);
  const b64u = (b) => Buffer.from(b).toString('base64url');
  const auth = c.randomBytes(16);
  require('fs').writeFileSync('scripts/push-receiver.json', JSON.stringify({
    p256dh: b64u(raw),
    auth: auth.toString('base64url'),
    privateKeyJwk: Buffer.from(priv).toString('base64'),
  }));
  // subscription object as a browser would create it
  require('fs').writeFileSync('scripts/push-subscription.json', JSON.stringify({
    endpoint: 'http://localhost:63997/send/' + c.randomBytes(8).toString('hex'),
    keys: { p256dh: b64u(raw), auth: auth.toString('base64url') },
    expirationTime: null,
    options: { applicationServerKey: '$PUB', userVisibleOnly: true },
  }));
  console.log('receiver keys written');
})();
"
[ -f scripts/push-receiver.json ] || fail "key generation failed"

step "Sign in test seller (0245550016) — subscription owner"
JAR="$(pwd)/push-seller.jar"; rm -f "$JAR"
signin "0245550016" "$JAR"
echo "seller signed in"

step "Subscribe via the real endpoint (browser-equivalent POST)"
R=$(curl -s -b "$JAR" -X POST "$BASE/api/push/subscribe" -H 'Content-Type: application/json' -d @scripts/push-subscription.json)
echo "$R" | grep -q '"ok":true' || fail "subscribe failed: $R"
echo "✅ subscription saved"

step "Careless: anonymous subscribe rejected"
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/push/subscribe" -H 'Content-Type: application/json' -d @scripts/push-subscription.json)
[ "$R" = "401" ] || fail "anonymous subscribe allowed ($R)"
echo "✅ 401"

step "Careless: malformed subscription body rejected"
R=$(curl -s -b "$JAR" -o /dev/null -w "%{http_code}" -X POST "$BASE/api/push/subscribe" -H 'Content-Type: application/json' -d '{"endpoint":"x"}')
[ "$R" = "400" ] || fail "malformed sub accepted ($R)"
echo "✅ 400"

step "EVENT 1: chat message should push to the listing owner"
# buyer (0245550015) messages seller's listing; seller is subscribed
JARB="$(pwd)/push-buyer.jar"; rm -f "$JARB"
signin "0245550015" "$JARB"
MARK="pushchat-$(date +%s)"
R=$(curl -s -b "$JARB" -X POST "$BASE/api/messages" -H 'Content-Type: application/json' -d "{\"listingId\":45,\"body\":\"E2E $MARK — is this still available?\"}")
echo "$R" | grep -q '"ok":true' || fail "chat send failed: $R"
sleep 2
grep -q "$MARK" scripts/push-mock.log || fail "chat push never arrived at the push service"
echo "✅ chat notification received & decrypted:"
grep "$MARK" scripts/push-mock.log | tail -1 | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log('   ',JSON.stringify(JSON.parse(d).decrypted)))"

step "Subscribe the buyer too (second receiver) so delivery events are provable"
node -e "
const c = require('crypto');
(async () => {
  const pair = await c.webcrypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
  const raw = await c.webcrypto.subtle.exportKey('raw', pair.publicKey);
  const priv = await c.webcrypto.subtle.exportKey('pkcs8', pair.privateKey);
  const b64u = (b) => Buffer.from(b).toString('base64url');
  const auth = c.randomBytes(16);
  require('fs').writeFileSync('scripts/push-receiver-b.json', JSON.stringify({
    p256dh: b64u(raw), auth: auth.toString('base64url'), privateKeyJwk: Buffer.from(priv).toString('base64'),
  }));
  require('fs').writeFileSync('scripts/push-subscription-b.json', JSON.stringify({
    endpoint: 'http://localhost:63997/send/' + c.randomBytes(8).toString('hex'),
    keys: { p256dh: b64u(raw), auth: auth.toString('base64url') },
  }));
  console.log('buyer receiver keys written');
})();
"
R=$(curl -s -b "$JARB" -X POST "$BASE/api/push/subscribe" -H 'Content-Type: application/json' -d @scripts/push-subscription-b.json)
echo "$R" | grep -q '"ok":true' || fail "buyer subscribe failed: $R"
echo "✅ buyer subscribed"

step "EVENT 2: escrow confirm releases payment → push to seller"
# buyer pays seller listing then confirms; seller subscribed.
# Fresh listing every run so a previous run's sold state can't interfere.
seed_listing "E2E Push Deal Phone" "Listing created by the push E2E to exercise escrow event notifications." 75 > push-listing.txt
LISTING=$(cat push-listing.txt)
R=$(curl -s -b "$JARB" -X POST "$BASE/api/pay" -H 'Content-Type: application/json' -d "{\"listingId\":$LISTING}")
echo "$R" | grep -q '"dealId"' || fail "pay init failed: $R"
DEAL=$(echo "$R" | sed -n 's/.*"dealId":\([0-9]*\).*/\1/p')
REF=$(resolve_ref "$JARB" "$DEAL")
curl -s -b "$JARB" -o /dev/null -X POST "$BASE/api/pay/demo-confirm?reference=$REF&dealId=$DEAL"
echo "paid deal $DEAL (escrow push check follows)"
curl -s -b "$JAR" -o /dev/null -X POST "$BASE/api/deal" -H 'Content-Type: application/json' -d "{\"dealId\":$DEAL,\"action\":\"deliver\"}"
curl -s -b "$JARB" -o /dev/null -X POST "$BASE/api/deal" -H 'Content-Type: application/json' -d "{\"dealId\":$DEAL,\"action\":\"confirm\"}"
node -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('data/axisops.db');const d=db.prepare('SELECT status FROM deals WHERE id=?').get($DEAL);if(d.status!=='settled')process.exit(1);console.log('deal settled')" || fail "deal did not settle"
sleep 2
echo "escrow push events received:"
grep -o '"title":"[^"]*"' scripts/push-mock.log | tail -4
grep -q "Payment released" scripts/push-mock.log || fail "no escrow-release push"
grep -q "Payment received in escrow" scripts/push-mock.log || fail "no escrow-paid push"
grep -q "Your order was delivered" scripts/push-mock.log || fail "no delivered push"
echo "✅ paid / delivered / released pushes all arrived"

step "EVENT 3: admin broadcast reaches the subscription"
JARA="$(pwd)/push-admin.jar"; rm -f "$JARA"
signin "0240000001" "$JARA"
BB="Broadcast-$(date +%s)"
R=$(curl -s -b "$JARA" -X POST "$BASE/api/admin/broadcast" -H 'Content-Type: application/json' -d "{\"title\":\"Flash Sale\",\"body\":\"E2E $BB — 50% off all boosts today!\"}")
echo "$R" | grep -q '"ok":true' || fail "broadcast failed: $R"
sleep 2
grep -q "$BB" scripts/push-mock.log || fail "broadcast never arrived"
echo "✅ broadcast received & decrypted"

step "Careless: non-admin broadcast blocked"
R=$(curl -s -b "$JARB" -o /dev/null -w "%{http_code}" -X POST "$BASE/api/admin/broadcast" -H 'Content-Type: application/json' -d '{"title":"x","body":"y"}')
[ "$R" = "403" ] || fail "non-admin broadcast allowed ($R)"
echo "✅ 403"

step "Unsubscribe endpoint removes the subscription"
node -e "
const s = require('./scripts/push-subscription.json');
console.log(JSON.stringify({ endpoint: s.endpoint }));
" > scripts/push-unsub.json
R=$(curl -s -b "$JAR" -X DELETE "$BASE/api/push/subscribe" -H 'Content-Type: application/json' -d @scripts/push-unsub.json)
echo "$R" | grep -q '"ok":true' || fail "unsubscribe failed: $R"
C=$(node -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('data/axisops.db');console.log(db.prepare('SELECT COUNT(*) c FROM push_subscriptions WHERE endpoint=?').get(require('./scripts/push-subscription.json').endpoint).c)")
[ "$C" = "0" ] || fail "subscription still in DB"
echo "✅ removed from DB"

rm -f "$JAR" "$JARB" "$JARA" scripts/push-receiver.json scripts/push-receiver-b.json scripts/push-subscription.json scripts/push-subscription-b.json scripts/push-unsub.json scripts/push-listing.txt
echo
echo "ALL PUSH E2E CHECKS PASSED"
