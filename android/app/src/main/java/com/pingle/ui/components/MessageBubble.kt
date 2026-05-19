package com.pingle.ui.components

import com.pingle.data.models.MessageUiModel

data class MessageBubbleState(
    val id: String,
    val body: String? = null,
    val mediaUrl: String? = null,
    val status: String,
    val createdAt: String,
    val alignment: MessageBubbleAlignment
)

enum class MessageBubbleAlignment {
    Start,
    End
}

object MessageBubble {
    // TODO: Render left/right bubble alignment in the chosen Android UI toolkit.
    fun state(message: MessageUiModel): MessageBubbleState {
        return MessageBubbleState(
            id = message.id,
            body = message.body,
            mediaUrl = message.mediaUrl,
            status = message.status,
            createdAt = message.createdAt,
            alignment = if (message.isMine) MessageBubbleAlignment.End else MessageBubbleAlignment.Start
        )
    }
}
