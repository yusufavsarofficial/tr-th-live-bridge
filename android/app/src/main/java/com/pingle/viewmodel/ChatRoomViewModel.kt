package com.pingle.viewmodel

import com.pingle.data.models.MessageUiModel

data class ChatRoomUiState(
    val conversationId: String,
    val title: String,
    val messages: List<MessageUiModel> = emptyList(),
    val typingUserId: String? = null,
    val draft: String = ""
)

class ChatRoomViewModel(
    conversationId: String = "conversation-demo-direct",
    title: String = "Chat"
) {
    // TODO: Convert to AndroidX ViewModel and inject SocketManager later.
    var state: ChatRoomUiState = ChatRoomUiState(
        conversationId = conversationId,
        title = title,
        messages = sampleMessages(conversationId)
    )
        private set

    fun updateDraft(value: String) {
        state = state.copy(draft = value)
    }

    fun clearDraft() {
        state = state.copy(draft = "")
    }

    private fun sampleMessages(conversationId: String) = listOf(
        MessageUiModel(
            id = "message-demo-1",
            conversationId = conversationId,
            senderId = "user-demo-other",
            senderName = "Ayse",
            type = "text",
            body = "Merhaba",
            status = "read",
            createdAt = "09:40"
        )
    )
}
