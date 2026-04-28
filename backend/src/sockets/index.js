const { verifyToken } = require("../middleware/auth");
const { pool } = require("../db/pool");
const { translateMessage } = require("../services/translationService");
const { SOCKET_EVENTS } = require("./events");

const onlineUsers = new Map();

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
        const targetLang = user.lang === "tr" ? "th" : "tr";
        const translatedText = payload.messageType === "audio" ? "" : await translateMessage(payload.text || "", user.lang, targetLang);
        const result = await pool.query(
          `INSERT INTO messages
            (room_code, sender_username, sender_display_name, sender_lang, target_lang, original_text, translated_text, audio_url, message_type)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id, sender_username, sender_display_name, sender_lang, target_lang, original_text, translated_text, audio_url, message_type, read_by, created_at`,
          ["private-room", user.username, user.displayName, user.lang, targetLang, payload.text || "", translatedText, payload.audioUrl || null, payload.messageType || "text"]
        );
        const message = result.rows[0];
        io.to("private-room").emit(SOCKET_EVENTS.MESSAGE_NEW, message);
        if (callback) callback({ ok: true, message });
      } catch (error) {
        const code = error.code || "MESSAGE_SEND_FAILED";
        if (callback) callback({ ok: false, error: code });
        socket.emit(SOCKET_EVENTS.ERROR, { error: code });
      }
    });

    socket.on(SOCKET_EVENTS.TYPING_START, () => socket.to("private-room").emit(SOCKET_EVENTS.TYPING_START, { username: user.username }));
    socket.on(SOCKET_EVENTS.TYPING_STOP, () => socket.to("private-room").emit(SOCKET_EVENTS.TYPING_STOP, { username: user.username }));
    socket.on(SOCKET_EVENTS.MESSAGE_READ, async ({ messageId }) => {
      await pool.query("UPDATE messages SET read_by = array_append(read_by, $1) WHERE id = $2 AND NOT ($1 = ANY(read_by))", [user.username, messageId]);
      socket.to("private-room").emit(SOCKET_EVENTS.MESSAGE_READ_RECEIPT, { messageId, readBy: user.username });
    });

    socket.on(SOCKET_EVENTS.CALL_START, (payload) => socket.to("private-room").emit(SOCKET_EVENTS.CALL_INCOMING, { from: user.username, callId: payload.callId }));
    socket.on(SOCKET_EVENTS.CALL_ACCEPT, (payload) => socket.to("private-room").emit(SOCKET_EVENTS.CALL_ACCEPTED, { from: user.username, callId: payload.callId }));
    socket.on(SOCKET_EVENTS.CALL_REJECT, (payload) => socket.to("private-room").emit(SOCKET_EVENTS.CALL_REJECTED, { from: user.username, callId: payload.callId }));
    socket.on(SOCKET_EVENTS.CALL_END, (payload) => socket.to("private-room").emit(SOCKET_EVENTS.CALL_ENDED, { from: user.username, callId: payload.callId }));
    socket.on(SOCKET_EVENTS.WEBRTC_OFFER, (payload) => socket.to("private-room").emit(SOCKET_EVENTS.WEBRTC_OFFER, { ...payload, from: user.username }));
    socket.on(SOCKET_EVENTS.WEBRTC_ANSWER, (payload) => socket.to("private-room").emit(SOCKET_EVENTS.WEBRTC_ANSWER, { ...payload, from: user.username }));
    socket.on(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, (payload) => socket.to("private-room").emit(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, { ...payload, from: user.username }));

    socket.on("disconnect", () => {
      if (onlineUsers.get(user.username) === socket.id) onlineUsers.delete(user.username);
      emitPresence(io);
    });
  });
}

module.exports = { registerSockets, SOCKET_EVENTS };
