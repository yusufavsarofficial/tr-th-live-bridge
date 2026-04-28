const fs = require("fs");
const path = require("path");

const nextUrl = process.argv[2];

if (!nextUrl) {
  console.error("Kullanim: node scripts/set-backend-url.js https://senin-backend-url.onrender.com");
  process.exit(1);
}

try {
  const url = new URL(nextUrl);
  if (!["https:", "http:"].includes(url.protocol)) {
    throw new Error("URL http veya https ile baslamali.");
  }
} catch (error) {
  console.error(`Gecersiz backend URL: ${error.message}`);
  process.exit(1);
}

const targetFile = path.join(__dirname, "..", "android", "src", "config", "backend.ts");
const current = fs.readFileSync(targetFile, "utf8");
const escaped = JSON.stringify(nextUrl);
const updated = current.replace(/export const BACKEND_URL = .+;/, `export const BACKEND_URL = ${escaped};`);

if (updated === current) {
  console.error("BACKEND_URL satiri bulunamadi.");
  process.exit(1);
}

fs.writeFileSync(targetFile, updated, "utf8");
console.log(`Android BACKEND_URL guncellendi: ${nextUrl}`);