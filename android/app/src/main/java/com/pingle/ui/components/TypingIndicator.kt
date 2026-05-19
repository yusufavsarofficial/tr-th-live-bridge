package com.pingle.ui.components

data class TypingIndicatorState(
    val conversationId: String,
    val userId: String,
    val text: String = "typing..."
)

object TypingIndicator {
    // TODO: Replace with real animated dots after screen migration.
    fun state(conversationId: String, userId: String): TypingIndicatorState {
        return TypingIndicatorState(
            conversationId = conversationId,
            userId = userId
        )
    }
}
