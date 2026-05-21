require("dotenv").config();

const crypto = require("crypto");

const config = {
  port: Number(process.env.PORT) || 3000,
  host: String(process.env.HOST || "0.0.0.0").trim(),
  maxUsers: Number(process.env.MAX_USERS) || 2,
  maxMessageLength: Number(process.env.MAX_MESSAGE_LENGTH) || 500,
  maxAttachmentBytes: Number(process.env.MAX_ATTACHMENT_BYTES) || 4_500_000,
  maxHistory: Number(process.env.MAX_HISTORY) || 120,
  dataFile: String(process.env.DATA_FILE || "").trim() || require("path").join(__dirname, "..", "..", "data", "chat-history.json"),
  notificationFile: String(process.env.NOTIFICATION_FILE || "").trim() || require("path").join(__dirname, "..", "..", "data", "notification-state.json"),
  roomCode: String(process.env.ROOM_CODE || "").trim(),
  roomPin: String(process.env.ROOM_PIN || "").trim(),
  translateTimeoutMs: Number(process.env.TRANSLATE_TIMEOUT_MS) || 3500,
  openaiApiKey: String(process.env.OPENAI_API_KEY || "").trim(),
  openaiTranslateModel: String(process.env.OPENAI_TRANSLATE_MODEL || "gpt-4.1-mini").trim(),
  translationProvider: String(process.env.TRANSLATION_PROVIDER || "google-first").trim(),
  vapidPublicKey: String(process.env.VAPID_PUBLIC_KEY || "").trim(),
  vapidPrivateKey: String(process.env.VAPID_PRIVATE_KEY || "").trim(),
  vapidSubject: String(process.env.VAPID_SUBJECT || "mailto:pingle@ayfsoft.com").trim(),
  rtcIceServers: parseIceServers(),
  callOfferTtlMs: Number(process.env.CALL_OFFER_TTL_MS) || 90_000,
  pushTtlSeconds: Number(process.env.PUSH_TTL_SECONDS) || 604800,
  jwtSecret: String(process.env.JWT_SECRET || "dev-jwt-secret-change-in-production").trim(),
  corsOrigin: String(process.env.CORS_ORIGIN || "*").trim(),
  nodeEnv: String(process.env.NODE_ENV || "development").trim(),
  fcmServiceAccountPath: String(process.env.FCM_SERVICE_ACCOUNT_PATH || "").trim(),
};

function parseIceServers() {
  const defaultServers = [{ urls: "stun:stun.l.google.com:19302" }];
  const raw = String(process.env.RTC_ICE_SERVERS_JSON || "").trim();
  if (!raw) return defaultServers;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaultServers;
  } catch {
    return defaultServers;
  }
}

function isProduction() {
  return config.nodeEnv === "production";
}

module.exports = { config, isProduction };
