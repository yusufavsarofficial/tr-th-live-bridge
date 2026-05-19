package com.pingle.ui.screens.chatroom

import com.pingle.data.models.MessageUiModel
import com.pingle.ui.components.MessageBubble
import com.pingle.ui.components.MessageBubbleState
import com.pingle.ui.components.TypingIndicator
import com.pingle.ui.components.TypingIndicatorState

data class ChatRoomScreenState(
    val conversationId: String,
    val title: String,
    val messages: List<MessageUiModel> = sampleMessages,
    val typingUserId: String? = null
)

data class ChatRoomRenderState(
    val title: String,
    val bubbles: List<MessageBubbleState>,
    val typingIndicator: TypingIndicatorState? = null
)

object ChatRoomScreen {
    // TODO: Connect send/read/typing actions through ChatRoomViewModel and SocketManager.
    fun renderState(state: ChatRoomScreenState): ChatRoomRenderState {
        return ChatRoomRenderState(
            title = state.title,
            bubbles = state.messages.map { MessageBubble.state(it) },
            typingIndicator = state.typingUserId?.let {
                TypingIndicator.state(state.conversationId, it)
            }
        )
    }
}

private val sampleMessages = listOf(
    MessageUiModel(
        id = "message-demo-1",
        conversationId = "conversation-demo-direct",
        senderId = "user-demo-other",
        senderName = "Ayse",
        type = "text",
        body = "Merhaba",
        status = "read",
        createdAt = "09:40"
    ),
    MessageUiModel(
        id = "message-demo-2",
        conversationId = "conversation-demo-direct",
        senderId = "user-demo-me",
        senderName = "Me",
        type = "text",
        body = "Hi",
        status = "sent",
        createdAt = "09:41",
        isMine = true,
        tempId = "tmp-demo-2"
    )
)
