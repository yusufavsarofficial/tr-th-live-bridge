const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { config, isProduction } = require("../config");
const sms = require("./sms");

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_RATE_LIMIT_WINDOW = 60 * 1000;
const OTP_MAX_PER_WINDOW = 3;
const otpStore = new Map();
const rateLimitStore = new Map();

function generateOTP(phoneNumber) {
  const normalized = normalizePhone(phoneNumber);
  if (!normalized) return { error: "Invalid phone number." };

  const now = Date.now();
  const windowStart = now - OTP_RATE_LIMIT_WINDOW;
  const attempts = Array.from(rateLimitStore.values())
    .filter(e => e.phone === normalized && e.timestamp > windowStart).length;
  if (attempts >= OTP_MAX_PER_WINDOW) return { error: "Too many OTP requests. Try again later." };

  const otp = isProduction() ? String(100000 + Math.floor(Math.random() * 900000)) : "123456";
  otpStore.set(normalized, { otp, expiresAt: now + OTP_EXPIRY_MS, generatedAt: now });
  rateLimitStore.set(`${normalized}-${now}`, { phone: normalized, timestamp: now });

  if (!isProduction()) console.log(`[DEV] OTP for ${normalized}: ${otp}`);

  // Send via SMS in production if Twilio is configured
  if (isProduction() && sms.isConfigured()) {
    sms.sendOtp(phoneNumber, otp).catch(err => console.error("SMS send failed:", err));
  }

  return { ok: true, devOtp: isProduction() ? undefined : otp };
}

function verifyOTP(phoneNumber, otp) {
  const normalized = normalizePhone(phoneNumber);
  if (!normalized) return { error: "Invalid phone number." };
  if (!otp) return { error: "OTP is required." };

  const record = otpStore.get(normalized);
  if (!record) return { error: "No OTP requested for this number." };
  if (Date.now() > record.expiresAt) {
    otpStore.delete(normalized);
    return { error: "OTP expired. Request a new one." };
  }
  if (record.otp !== String(otp).trim()) return { error: "Invalid OTP." };

  otpStore.delete(normalized);
  return { ok: true };
}

function createToken(user) {
  return jwt.sign(
    { sub: user.id, phone: user.phoneNumber },
    config.jwtSecret,
    { expiresIn: "30d" }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 7 ? digits : null;
}

module.exports = { generateOTP, verifyOTP, createToken, verifyToken, normalizePhone };
