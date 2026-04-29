const { verifyToken } = require("../middleware/auth");
const { pool } = require("../db/pool");
const { encryptValue, serializeMessage } = require("../services/encryptionService");
const { translateMessage } = require("../services/translationService");
const { sendPushToPartner } = require("../services/pushService");
const { SOCKET_EVENTS } = require("./events");

const onlineUsers = new Map();
const MAX_TEXT_LENGTH = 4000;
const MAX_CALL_ID_LENGTH = 120;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CALL_ID_RE = /^[a-zA-Z0-9._:-]{1,120}$/;

function socketRateLimit(socket, key, limit, windowMs) {
  socket.data.rateLimits ||= {};
  const now = Date.now();
  const bucket = socket.data.rateLimits[key] || { count: 0, resetAt: now + windowMs };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }
  bucket.count += 1;
  socket.data.rateLimits[key] = bucket;
  return bucket.count <= limit;
}

function emitPresence(io) {
  io.emit(SOCKET_EVENTS.PRESENCE_UPDATE, { online: Array.from(onlineUsers.keys()) });
}

function registerSockets(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("AUTH_REQUIRED"));
    try {
      socket.user = verifyToken(token);
      return next();
    } catch {
      return next(new Error("INVALID_TOKEN"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.user;
    onlineUsers.set(user.username, socket.id);
    socket.join("private-room");
    socket.emit(SOCKET_EVENTS.AUTHENTICATED, { user });
    emitPresence(io);

    socket.on(SOCKET_EVENTS.MESSAGE_SEND, async (payload = {}, callback) => {
      try {
        if (!socketRateLimit(socket, "message", 40, 60 * 1000)) {
          if (callback) callback({ ok: false, error: "RATE_LIMITED" });
          return;
        }
        const messageType = payload.messageType === "audio" ? "audio" : "text";
        const originalText = String(payload.text || "").slice(0, MAX_TEXT_LENGTH);
        if (messageType === "text" && !originalText.trim()) {
          if (callback) callback({ ok: false, error: "EMPTY_MESSAGE" });
          return;
        }
        const targetLang = user.lang === "tr" ? "th" : "tr";
        let translatedText = String(payload.translatedText || "").slice(0, MAX_TEXT_LENGTH);

        if (messageType === "text") {
          try {
            translatedText = await translateMessage(originalText, user.lang, targetLang);
          } catch (error) {
            translatedText = "";
            socket.emit(SOCKET_EVENTS.ERROR, {
              error: error.code || "TRANSLATION_FAILED",
              recoverable: true
            });
          }
        }

        const result = await pool.query(
          `INSERT INTO messages
            (room_code, sender_username, sender_display_name, sender_lang, target_lang,
             original_text_encrypted, translated_text_encrypted, audio_url_encrypted, message_type)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id, sender_username, sender_display_name, sender_lang, target_lang,
             original_text, translated_text, audio_url,
             original_text_encrypted, translated_text_encrypted, audio_url_encrypted,
             message_type, read_by, created_at`,
          [
            "private-room",
            user.username,
            user.displayName,
            user.lang,
            targetLang,
            encryptValue(originalText),
            encryptValue(translatedText),
            payload.audioUrl ? encryptValue(payload.audioUrl) : null,
            messageType
          ]
        );
        const message = serializeMessage(result.rows[0]);
        io.to("private-room").emit(SOCKET_EVENTS.MESSAGE_NEW, message);
        sendPushToPartner(user.username, {
          title: user.displayName || user.username,
          body: messageType === "audio" ? "Sesli mesaj" : "Yeni mesaj",
          data: { type: "message", messageId: message.id }
        });
        if (callback) callback({ ok: true, message });
      } catch (error) {
        const code = error.code || "MESSAGE_SEND_FAILED";
        if (callback) callback({ ok: false, error: code });
        socket.emit(SOCKET_EVENTS.ERROR, { error: code });
      }
    });

    socket.on(SOCKET_EVENTS.TYPING_START, () => {
      if (socketRateLimit(socket, "typing", 120, 60 * 1000)) socket.to("private-room").emit(SOCKET_EVENTS.TYPING_START, { username: user.username });
    });
    socket.on(SOCKET_EVENTS.TYPING_STOP, () => {
      if (socketRateLimit(socket, "typing", 120, 60 * 1000)) socket.to("private-room").emit(SOCKET_EVENTS.TYPING_STOP, { username: user.username });
    });
    socket.on(SOCKET_EVENTS.MESSAGE_READ, async ({ messageId }) => {
      if (!UUID_RE.test(String(messageId || ""))) return;
      await pool.query("UPDATE messages SET read_by = array_append(read_by, $1) WHERE id = $2 AND NOT ($1 = ANY(read_by))", [user.username, messageId]);
      socket.to("private-room").emit(SOCKET_EVENTS.MESSAGE_READ_RECEIPT, { messageId, readBy: user.username });
    });
    socket.on(SOCKET_EVENTS.MESSAGE_DELETE, async ({ messageId } = {}, callback) => {
      try {
        if (user.username !== "Yusuf" || !UUID_RE.test(String(messageId || ""))) {
          if (callback) callback({ ok: false, error: "DELETE_NOT_ALLOWED" });
          return;
        }
        const result = await pool.query("DELETE FROM messages WHERE id = $1 RETURNING id", [messageId]);
        if (!result.rowCount) {
          if (callback) callback({ ok: false, error: "MESSAGE_NOT_FOUND" });
          return;
        }
        io.to("private-room").emit(SOCKET_EVENTS.MESSAGE_DELETED, { messageId });
        if (callback) callback({ ok: true });
      } catch (error) {
        if (callback) callback({ ok: false, error: error.code || "MESSAGE_DELETE_FAILED" });
      }
    });

    const validCallId = (payload = {}) => typeof payload.callId === "string" && CALL_ID_RE.test(payload.callId) && payload.callId.length <= MAX_CALL_ID_LENGTH;
    const forwardCall = (event, outgoingEvent) => (payload = {}) => {
      if (!validCallId(payload)) return socket.emit(SOCKET_EVENTS.ERROR, { error: "INVALID_CALL_ID", recoverable: true });
      socket.to("private-room").emit(outgoingEvent, { ...payload, from: user.username });
    };
    socket.on(SOCKET_EVENTS.CALL_START, async (payload = {}) => {
      if (!socketRateLimit(socket, "call", 12, 60 * 1000)) return socket.emit(SOCKET_EVENTS.ERROR, { error: "RATE_LIMITED", recoverable: true });
      if (!validCallId(payload)) return socket.emit(SOCKET_EVENTS.ERROR, { error: "INVALID_CALL_ID", recoverable: true });
      await pool.query(`
        INSERT INTO call_events (room_code, call_id, caller_username, status)
        VALUES ($1, $2, $3, 'ringing')
        ON CONFLICT (call_id) DO NOTHING
      `, ["private-room", payload.callId, user.username]);
      socket.to("private-room").emit(SOCKET_EVENTS.CALL_INCOMING, { ...payload, from: user.username });
      sendPushToPartner(user.username, {
        title: user.displayName || user.username,
        body: "Goruntulu arama",
        data: { type: "call", callId: payload.callId }
      });
    });
    socket.on(SOCKET_EVENTS.CALL_ACCEPT, async (payload = {}) => {
      if (!validCallId(payload)) return socket.emit(SOCKET_EVENTS.ERROR, { error: "INVALID_CALL_ID", recoverable: true });
      await pool.query("UPDATE call_events SET status = 'answered', answered_at = NOW() WHERE call_id = $1", [payload.callId]);
      socket.to("private-room").emit(SOCKET_EVENTS.CALL_ACCEPTED, { ...payload, from: user.username });
    });
    socket.on(SOCKET_EVENTS.CALL_REJECT, async (payload = {}) => {
      if (!validCallId(payload)) return socket.emit(SOCKET_EVENTS.ERROR, { error: "INVALID_CALL_ID", recoverable: true });
      await pool.query("UPDATE call_events SET status = 'rejected', ended_at = NOW() WHERE call_id = $1", [payload.callId]);
      socket.to("private-room").emit(SOCKET_EVENTS.CALL_REJECTED, { ...payload, from: user.username });
    });
    socket.on(SOCKET_EVENTS.CALL_END, async (payload = {}) => {
      if (!validCallId(payload)) return socket.emit(SOCKET_EVENTS.ERROR, { error: "INVALID_CALL_ID", recoverable: true });
      await pool.query("UPDATE call_events SET status = 'ended', ended_at = NOW() WHERE call_id = $1", [payload.callId]);
      socket.to("private-room").emit(SOCKET_EVENTS.CALL_ENDED, { ...payload, from: user.username });
    });
    socket.on(SOCKET_EVENTS.WEBRTC_OFFER, forwardCall(SOCKET_EVENTS.WEBRTC_OFFER, SOCKET_EVENTS.WEBRTC_OFFER));
    socket.on(SOCKET_EVENTS.WEBRTC_ANSWER, forwardCall(SOCKET_EVENTS.WEBRTC_ANSWER, SOCKET_EVENTS.WEBRTC_ANSWER));
    socket.on(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, forwardCall(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE));
    socket.on(SOCKET_EVENTS.CALL_VOICE_TRANSLATION, (payload = {}) => {
      if (user.username !== "Neeja" || !validCallId(payload)) return;
      socket.to("private-room").emit(SOCKET_EVENTS.CALL_VOICE_TRANSLATION, {
        callId: payload.callId,
        from: user.username,
        originalText: String(payload.originalText || "").slice(0, MAX_TEXT_LENGTH),
        translatedText: String(payload.translatedText || "").slice(0, MAX_TEXT_LENGTH)
      });
    });

    socket.on("disconnect", () => {
      if (onlineUsers.get(user.username) === socket.id) onlineUsers.delete(user.username);
      emitPresence(io);
    });
  });
}

module.exports = { registerSockets, SOCKET_EVENTS };
