const SOCKET_EVENTS = Object.freeze({
  CONNECT_ERROR: "connect_error",
  AUTHENTICATED: "auth:authenticated",
  MESSAGE_SEND: "message:send",
  MESSAGE_NEW: "message:new",
  MESSAGE_READ: "message:read",
  MESSAGE_READ_RECEIPT: "message:read-receipt",
  MESSAGE_DELETE: "message:delete",
  MESSAGE_DELETED: "message:deleted",
  TYPING_START: "typing:start",
  TYPING_STOP: "typing:stop",
  PRESENCE_UPDATE: "presence:update",
  CALL_START: "call:start",
  CALL_INCOMING: "call:incoming",
  CALL_ACCEPT: "call:accept",
  CALL_ACCEPTED: "call:accepted",
  CALL_REJECT: "call:reject",
  CALL_REJECTED: "call:rejected",
  CALL_END: "call:end",
  CALL_ENDED: "call:ended",
  WEBRTC_OFFER: "webrtc:offer",
  WEBRTC_ANSWER: "webrtc:answer",
  WEBRTC_ICE_CANDIDATE: "webrtc:ice-candidate",
  CALL_VOICE_TRANSLATION: "call:voice-translation",
  ERROR: "error"
});

module.exports = { SOCKET_EVENTS };
