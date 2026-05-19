export const REALTIME_EVENTS = {
  USER_ONLINE: "user:online",
  USER_OFFLINE: "user:offline",

  CONVERSATION_CREATE: "conversation:create",
  CONVERSATION_LIST: "conversation:list",
  CONVERSATION_JOIN: "conversation:join",
  CONVERSATION_LEAVE: "conversation:leave",
  CONVERSATION_UPDATED: "conversation:updated",

  MESSAGE_SEND: "message:send",
  MESSAGE_NEW: "message:new",
  MESSAGE_DELIVERED: "message:delivered",
  MESSAGE_READ: "message:read",
  MESSAGE_TYPING: "message:typing",
  MESSAGE_DELETE: "message:delete",
  MESSAGE_EDIT: "message:edit",

  CALL_START: "call:start",
  CALL_RINGING: "call:ringing",
  CALL_ACCEPT: "call:accept",
  CALL_REJECT: "call:reject",
  CALL_END: "call:end",
  WEBRTC_OFFER: "webrtc:offer",
  WEBRTC_ANSWER: "webrtc:answer",
  WEBRTC_ICE_CANDIDATE: "webrtc:ice-candidate",

  TRANSLATION_REQUEST: "translation:request",
  TRANSLATION_RESULT: "translation:result",
  STT_REQUEST: "stt:request",
  STT_RESULT: "stt:result",
  TTS_REQUEST: "tts:request",
  TTS_RESULT: "tts:result",
} as const;
