// Mock Arkesel OTP provider for integration tests (not part of the app).
// Records each request body to arkesel-mock.log so tests can read the code
// exactly as an SMS would have delivered it.
const http = require("node:http");
const fs = require("node:fs");

const PORT = 63998;
http
  .createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      fs.appendFileSync(__dirname + "/arkesel-mock.log", body + "\n");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "success", code: "200", data: { otp_id: "mock1" } }));
    });
  })
  .listen(PORT, () => console.log(`mock arkesel on ${PORT}`));
