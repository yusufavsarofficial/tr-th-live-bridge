package com.pingle.viewmodel

import com.pingle.data.models.ConversationUiModel

data class ChatListUiState(
    val conversations: List<ConversationUiModel> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null
)

class ChatListViewModel {
    // TODO: Convert to AndroidX ViewModel when dependency and Gradle boundary exist.
    var state: ChatListUiState = ChatListUiState(conversations = sampleConversations())
        private set

    fun refresh() {
        // TODO: Load conversations from repository/backend after auth exists.
        state = state.copy(isLoading = false, errorMessage = null)
    }

    private fun sampleConversations() = listOf(
        ConversationUiModel(
            id = "conversation-demo-direct",
            type = "direct",
            title = "Ayse",
            lastMessagePreview = "See you soon",
            lastMessageAt = "09:41",
            unreadCount = 2
        )
    )
}
