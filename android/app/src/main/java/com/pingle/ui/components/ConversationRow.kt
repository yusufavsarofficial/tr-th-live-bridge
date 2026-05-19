package com.pingle.ui.components

import com.pingle.data.models.ConversationUiModel

data class ConversationRowState(
    val id: String,
    val title: String,
    val avatarUrl: String? = null,
    val lastMessagePreview: String? = null,
    val lastMessageAt: String? = null,
    val unreadCount: Int = 0,
    val isPinned: Boolean = false,
    val isMuted: Boolean = false
)

object ConversationRow {
    // TODO: Render this as a native row when the root Android UI stack is finalized.
    fun state(conversation: ConversationUiModel): ConversationRowState {
        return ConversationRowState(
            id = conversation.id,
            title = conversation.title,
            avatarUrl = conversation.avatarUrl,
            lastMessagePreview = conversation.lastMessagePreview,
            lastMessageAt = conversation.lastMessageAt,
            unreadCount = conversation.unreadCount,
            isPinned = conversation.isPinned,
            isMuted = conversation.isMuted
        )
    }
}
