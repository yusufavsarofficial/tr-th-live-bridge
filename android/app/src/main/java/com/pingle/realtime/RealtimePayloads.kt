package com.pingle.realtime

data class JoinConversationPayload(
    val conversationId: String,
    val userId: String
)

data class LeaveConversationPayload(
    val conversationId: String
)

data class SendMessagePayload(
    val conversationId: String,
    val senderId: String,
    val type: String = "text",
    val body: String? = null,
    val mediaUrl: String? = null,
    val replyToMessageId: String? = null,
    val tempId: String? = null
)

data class TypingPayload(
    val conversationId: String,
    val userId: String,
    val isTyping: Boolean
)

data class ReadMessagePayload(
    val conversationId: String,
    val messageId: String,
    val userId: String
)

data class IncomingMessagePayload(
    val id: String? = null,
    val conversationId: String,
    val senderId: String,
    val type: String = "text",
    val body: String? = null,
    val mediaUrl: String? = null,
    val replyToMessageId: String? = null,
    val tempId: String? = null,
    val createdAt: String? = null
)
