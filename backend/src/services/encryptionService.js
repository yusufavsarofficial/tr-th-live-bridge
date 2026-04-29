const crypto = require("crypto");
const { env } = require("../config/env");

const PREFIX = "v1";

function getKey() {
  return crypto.createHash("sha256").update(env.messageEncryptionKey).digest();
}

function encode(buffer) {
  return buffer.toString("base64url");
}

function decode(value) {
  return Buffer.from(value, "base64url");
}

function encryptValue(value) {
  if (value === null || value === undefined || value === "") return value || "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}:${encode(iv)}:${encode(tag)}:${encode(encrypted)}`;
}

function decryptValue(value) {
  if (value === null || value === undefined || value === "") return value || "";
  const text = String(value);
  if (!text.startsWith(`${PREFIX}:`)) return text;
  const [, ivText, tagText, encryptedText] = text.split(":");
  if (!ivText || !tagText || !encryptedText) return "";

  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), decode(ivText));
    decipher.setAuthTag(decode(tagText));
    return Buffer.concat([decipher.update(decode(encryptedText)), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

function serializeMessage(row) {
  return {
    id: row.id,
    clientId: row.client_id || undefined,
    client_id: row.client_id || undefined,
    sender: row.sender_username,
    receiver: row.receiver_username,
    sender_username: row.sender_username,
    receiver_username: row.receiver_username,
    sender_display_name: row.sender_display_name,
    sender_lang: row.sender_lang,
    target_lang: row.target_lang,
    senderLang: row.sender_lang,
    targetLang: row.target_lang,
    originalText: decryptValue(row.original_text_encrypted || row.original_text || ""),
    translatedText: decryptValue(row.translated_text_encrypted || row.translated_text || ""),
    original_text: decryptValue(row.original_text_encrypted || row.original_text || ""),
    translated_text: decryptValue(row.translated_text_encrypted || row.translated_text || ""),
    audio_url: decryptValue(row.audio_url_encrypted || row.audio_url || "") || null,
    audioUrl: decryptValue(row.audio_url_encrypted || row.audio_url || "") || null,
    message_type: row.message_type,
    type: row.message_type,
    status: row.status || "sent",
    read_by: row.read_by || [],
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at
  };
}

module.exports = { encryptValue, decryptValue, serializeMessage };
