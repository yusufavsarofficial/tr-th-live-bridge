package com.pingle.realtime

import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject

class SocketManager(private val backendUrl: String) {
    private var socket: Socket? = null

    fun connect() {
        if (socket?.connected() == true) return

        socket = IO.socket(backendUrl).also { it.connect() }
    }

    fun disconnect() {
        socket?.disconnect()
        socket?.off()
        socket = null
    }

    fun joinConversation(conversationId: String, userId: String) {
        // TODO: replace temporary userId payload with authenticated session identity.
        socket?.emit(
            RealtimeEvents.CONVERSATION_JOIN,
            JoinConversationPayload(conversationId, userId).toJson()
        )
    }

    fun leaveConversation(conversationId: String) {
        socket?.emit(
            RealtimeEvents.CONVERSATION_LEAVE,
            LeaveConversationPayload(conversationId).toJson()
        )
    }

    fun sendMessage(payload: SendMessagePayload) {
        // TODO: senderId is temporary until Android auth is implemented.
        socket?.emit(RealtimeEvents.MESSAGE_SEND, payload.toJson())
    }

    fun sendTyping(payload: TypingPayload) {
        socket?.emit(RealtimeEvents.MESSAGE_TYPING, payload.toJson())
    }

    fun markMessageRead(payload: ReadMessagePayload) {
        socket?.emit(RealtimeEvents.MESSAGE_READ, payload.toJson())
    }

    fun onNewMessage(callback: (IncomingMessagePayload) -> Unit) {
        socket?.on(RealtimeEvents.MESSAGE_NEW) { args ->
            firstJson(args)?.let { callback(it.toIncomingMessagePayload()) }
        }
    }

    fun onTyping(callback: (TypingPayload) -> Unit) {
        socket?.on(RealtimeEvents.MESSAGE_TYPING) { args ->
            firstJson(args)?.let { json ->
                callback(
                    TypingPayload(
                        conversationId = json.optString("conversationId"),
                        userId = json.optString("userId"),
                        isTyping = json.optBoolean("isTyping")
                    )
                )
            }
        }
    }

    fun onMessageRead(callback: (ReadMessagePayload) -> Unit) {
        socket?.on(RealtimeEvents.MESSAGE_READ) { args ->
            firstJson(args)?.let { json ->
                callback(
                    ReadMessagePayload(
                        conversationId = json.optString("conversationId"),
                        messageId = json.optString("messageId"),
                        userId = json.optString("userId")
                    )
                )
            }
        }
    }

    private fun firstJson(args: Array<Any>) = args.firstOrNull() as? JSONObject
}

private fun JoinConversationPayload.toJson() = JSONObject()
    .put("conversationId", conversationId)
    .put("userId", userId)

private fun LeaveConversationPayload.toJson() = JSONObject()
    .put("conversationId", conversationId)

private fun SendMessagePayload.toJson() = JSONObject()
    .put("conversationId", conversationId)
    .put("senderId", senderId)
    .put("type", type)
    .putOptional("body", body)
    .putOptional("mediaUrl", mediaUrl)
    .putOptional("replyToMessageId", replyToMessageId)
    .putOptional("tempId", tempId)

private fun TypingPayload.toJson() = JSONObject()
    .put("conversationId", conversationId)
    .put("userId", userId)
    .put("isTyping", isTyping)

private fun ReadMessagePayload.toJson() = JSONObject()
    .put("conversationId", conversationId)
    .put("messageId", messageId)
    .put("userId", userId)

private fun JSONObject.toIncomingMessagePayload(): IncomingMessagePayload {
    val message = optJSONObject("message") ?: this
    return IncomingMessagePayload(
        id = message.optNullableString("id"),
        conversationId = message.optString(
            "conversationId",
            message.optString("conversation_id", optString("conversationId"))
        ),
        senderId = message.optString("senderId", message.optString("sender_id")),
        type = message.optString("type", "text"),
        body = message.optNullableString("body"),
        mediaUrl = message.optNullableString("mediaUrl") ?: message.optNullableString("media_url"),
        replyToMessageId = message.optNullableString("replyToMessageId")
            ?: message.optNullableString("reply_to_message_id"),
        tempId = optNullableString("tempId") ?: message.optNullableString("tempId"),
        createdAt = message.optNullableString("createdAt") ?: message.optNullableString("created_at")
    )
}

private fun JSONObject.putOptional(name: String, value: String?): JSONObject {
    if (value != null) put(name, value)
    return this
}

private fun JSONObject.optNullableString(name: String): String? {
    val value = optString(name)
    return value.ifBlank { null }
}
