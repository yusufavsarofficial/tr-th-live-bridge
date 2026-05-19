package com.pingle.ui.screens.chatlist

import com.pingle.data.models.ConversationUiModel
import com.pingle.ui.components.ConversationRow
import com.pingle.ui.components.ConversationRowState

data class ChatListScreenState(
    val conversations: List<ConversationUiModel> = sampleConversations
)

object ChatListScreen {
    // TODO: Connect this state to ChatListViewModel when Android UI stack is finalized.
    fun rows(state: ChatListScreenState = ChatListScreenState()): List<ConversationRowState> {
        return state.conversations.map { ConversationRow.state(it) }
    }
}

private val sampleConversations = listOf(
    ConversationUiModel(
        id = "conversation-demo-direct",
        type = "direct",
        title = "Ayse",
        lastMessagePreview = "See you soon",
        lastMessageAt = "09:41",
        unreadCount = 2,
        isPinned = true
    ),
    ConversationUiModel(
        id = "conversation-demo-group",
        type = "group",
        title = "Pingle Team",
        lastMessagePreview = "Architecture phase is ready",
        lastMessageAt = "Yesterday",
        isMuted = true
    )
)
