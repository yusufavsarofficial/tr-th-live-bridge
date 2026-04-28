const fs = require("fs");
const https = require("https");
const path = require("path");

const serviceId = "srv-d7ojn5m7r5hc73deote0";
const apiKey = process.env.RENDER_API_KEY;

if (!apiKey) {
  console.error("RENDER_API_KEY environment variable eksik.");
  process.exit(1);
}

const envPath = path.join(__dirname, "..", "backend", ".env");
if (!fs.existsSync(envPath)) {
  console.error("backend/.env bulunamadi.");
  process.exit(1);
}

const raw = fs.readFileSync(envPath, "utf8");
const env = {};
for (const line of raw.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const index = trimmed.indexOf("=");
  if (index === -1) continue;
  const key = trimmed.slice(0, index);
  const value = trimmed.slice(index + 1);
  env[key] = value;
}

env.NODE_ENV = "production";
env.PUBLIC_BASE_URL = "https://sevgilim-chat.onrender.com";
env.CORS_ORIGIN = "*";

const keys = [
  "NODE_ENV",
  "PORT",
  "DATABASE_URL",
  "JWT_SECRET",
  "MESSAGE_ENCRYPTION_KEY",
  "PRIVATE_ROOM_CODE",
  "USER_A_USERNAME",
  "USER_A_DISPLAY_NAME",
  "USER_A_PASSWORD",
  "USER_A_LANG",
  "USER_B_USERNAME",
  "USER_B_DISPLAY_NAME",
  "USER_B_PASSWORD",
  "USER_B_LANG",
  "TRANSLATION_PROVIDER",
  "OPENAI_API_KEY",
  "PUBLIC_BASE_URL",
  "CORS_ORIGIN",
  "TURN_URL",
  "TURN_USERNAME",
  "TURN_PASSWORD"
];

const payload = keys.map((key) => ({ key, value: env[key] || "" }));

function request(method, requestPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req = https.request({
      hostname: "api.render.com",
      path: requestPath,
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {})
      }
    }, (res) => {
      let text = "";
      res.on("data", (chunk) => text += chunk);
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(text ? JSON.parse(text) : {});
        } else {
          reject(new Error(`${method} ${requestPath} failed: ${res.statusCode} ${text}`));
        }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  await request("PUT", `/v1/services/${serviceId}/env-vars`, payload);
  console.log("Render environment variables guncellendi.");
  await request("POST", `/v1/services/${serviceId}/deploys`, { clearCache: "clear" });
  console.log("Clear cache deploy baslatildi.");
})();