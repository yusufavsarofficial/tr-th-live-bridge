const crypto = require("crypto");

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%+-_";

function randomSecret(bytes = 48) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function randomPassword(length = 20) {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

console.log("Sevgilim Chat secret onerileri");
console.log("");
console.log(`JWT_SECRET=${randomSecret(48)}`);
console.log(`MESSAGE_ENCRYPTION_KEY=${crypto.randomBytes(32).toString("base64url").slice(0, 32)}`);
console.log(`Yusuf icin ornek guclu sifre=${randomPassword(22)}`);
console.log(`Neeja icin ornek guclu sifre=${randomPassword(22)}`);
console.log("");
console.log("Not: Bu script hicbir dosyaya yazmaz. Degerleri sadece terminalde gosterir.");
console.log("Kullanici sifrelerini backend env icin bcrypt hash mantigina gore hazirlamalisin.");