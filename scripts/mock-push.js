// Mock Web Push service (not part of the app) — the push-endpoint half of an
// E2E proof. Receives web-push POSTs (aes128gcm), decrypts them with the
// receiver private key(s) from push-receiver.json (+ push-receiver-b.json),
// and appends results to push-mock.log so the test can assert on real
// notification payloads.
const https = require("node:https");
const crypto = require("node:crypto");
const fs = require("node:fs");

const PORT = 63997;
// Re-read per request: the E2E regenerates the receiver keys after startup.
function currentReceivers() {
  const files = ["push-receiver.json", "push-receiver-b.json"];
  return files
    .map((f) => __dirname + "/" + f)
    .filter((p) => fs.existsSync(p))
    .map((p) => JSON.parse(fs.readFileSync(p, "utf8")));
}

function b64urlToBuf(s) {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

async function decryptAes128gcm(payloadBuf) {
  // RFC 8188: salt(16) | rs(4) | idlen(1) | keyid | ciphertext+tag(16)
  const salt = payloadBuf.subarray(0, 16);
  const idlen = payloadBuf.readUInt8(20);
  const keyid = payloadBuf.subarray(21, 21 + idlen);
  const ct = payloadBuf.subarray(21 + idlen);

  // web-push (http_ece) writes the RAW uncompressed P-256 point as keyid
  // (http_ece.js line 471: privateKey.getPublicKey()), not SPKI DER.
  const SPKI_P256_PREFIX = Buffer.from("3059301306072a8648ce3d020106082a8648ce3d030107034200", "hex");
  const senderPub = crypto.createPublicKey({
    key: Buffer.concat([SPKI_P256_PREFIX, keyid]),
    format: "der",
    type: "spki",
  });
  let lastErr = null;
  for (const receiver of currentReceivers()) {
    try {
      const receiverPriv = crypto.createPrivateKey({
        key: Buffer.from(receiver.privateKeyJwk, "base64"),
        format: "der",
        type: "pkcs8",
      });
      const shared = crypto.diffieHellman({ privateKey: receiverPriv, publicKey: senderPub });
      const receiverPubRaw = b64urlToBuf(receiver.p256dh);
      const authSecret = b64urlToBuf(receiver.auth);

      const ikm = crypto.hkdfSync(
        "sha256",
        shared,
        authSecret,
        Buffer.concat([Buffer.from("WebPush: info\u0000"), receiverPubRaw, keyid]),
        32
      );
      const key = crypto.hkdfSync("sha256", Buffer.from(ikm), salt, Buffer.from("Content-Encoding: aes128gcm\u0000"), 16);
      const nonce = crypto.hkdfSync("sha256", Buffer.from(ikm), salt, Buffer.from("Content-Encoding: nonce\u0000"), 12);
      const cipher = crypto.createDecipheriv("aes-128-gcm", Buffer.from(key), Buffer.from(nonce));
      cipher.setAuthTag(ct.subarray(ct.length - 16));
      const plain = Buffer.concat([cipher.update(ct.subarray(0, ct.length - 16)), cipher.final()]);
      // RFC 8188 padding: last byte 0x02 marks end of padding-delimited content
      let end = plain.length;
      while (end > 0 && plain[end - 1] === 0) end--;
      if (plain[end - 1] === 0x02) end--;
      return plain.subarray(0, end).toString("utf8");
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("no receiver keys available");
}

const server = https.createServer(
  {
    key: fs.readFileSync(__dirname + "/mock-key.pem"),
    cert: fs.readFileSync(__dirname + "/mock-cert.pem"),
  },
  (req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", async () => {
      const body = Buffer.concat(chunks);
      let entry = { t: new Date().toISOString(), ttl: req.headers.ttl, encoding: req.headers["content-encoding"], decrypted: null, raw_length: body.length };
      try {
        entry.decrypted = JSON.parse(await decryptAes128gcm(body));
      } catch (e) {
        entry.decrypted = null;
        entry.decrypt_error = e.message;
        // Behave like a real push service: a subscription whose key we can't
        // decrypt for is gone -> 410 so the app prunes it.
        fs.appendFileSync(__dirname + "/push-mock.log", JSON.stringify(entry) + "\n");
        res.writeHead(410);
        res.end("{}");
        return;
      }
      fs.appendFileSync(__dirname + "/push-mock.log", JSON.stringify(entry) + "\n");
      res.writeHead(201);
      res.end("{}");
    });
  }
);
server.listen(PORT, () => console.log(`mock push service (https) on ${PORT}`));
