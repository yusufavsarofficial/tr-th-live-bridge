package com.pingle.ui.components

import com.pingle.data.models.UserUiModel

data class AvatarViewState(
    val initials: String,
    val avatarUrl: String? = null,
    val isOnline: Boolean = false,
    val contentDescription: String
)

object AvatarView {
    // TODO: Replace this state mapper with a real Compose/View implementation.
    fun state(user: UserUiModel): AvatarViewState {
        return AvatarViewState(
            initials = initialsFor(user.displayName),
            avatarUrl = user.avatarUrl,
            isOnline = user.isOnline,
            contentDescription = "${user.displayName} avatar"
        )
    }

    private fun initialsFor(displayName: String): String {
        return displayName
            .split(" ")
            .filter { it.isNotBlank() }
            .take(2)
            .joinToString("") { it.first().uppercase() }
            .ifBlank { "?" }
    }
}
