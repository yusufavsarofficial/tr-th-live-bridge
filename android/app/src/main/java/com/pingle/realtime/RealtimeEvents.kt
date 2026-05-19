package com.pingle.realtime

object RealtimeEvents {
    const val USER_ONLINE = "user:online"
    const val USER_OFFLINE = "user:offline"

    const val CONVERSATION_CREATE = "conversation:create"
    const val CONVERSATION_LIST = "conversation:list"
    const val CONVERSATION_JOIN = "conversation:join"
    const val CONVERSATION_LEAVE = "conversation:leave"
    const val CONVERSATION_UPDATED = "conversation:updated"

    const val MESSAGE_SEND = "message:send"
    const val MESSAGE_NEW = "message:new"
    const val MESSAGE_DELIVERED = "message:delivered"
    const val MESSAGE_READ = "message:read"
    const val MESSAGE_TYPING = "message:typing"
    const val MESSAGE_DELETE = "message:delete"
    const val MESSAGE_EDIT = "message:edit"

    const val CALL_START = "call:start"
    const val CALL_RINGING = "call:ringing"
    const val CALL_ACCEPT = "call:accept"
    const val CALL_REJECT = "call:reject"
    const val CALL_END = "call:end"

    const val WEBRTC_OFFER = "webrtc:offer"
    const val WEBRTC_ANSWER = "webrtc:answer"
    const val WEBRTC_ICE_CANDIDATE = "webrtc:ice-candidate"

    const val TRANSLATION_REQUEST = "translation:request"
    const val TRANSLATION_RESULT = "translation:result"
    const val STT_REQUEST = "stt:request"
    const val STT_RESULT = "stt:result"
    const val TTS_REQUEST = "tts:request"
    const val TTS_RESULT = "tts:result"
}
