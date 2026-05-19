package com.pingle.ui.screens.profile

import com.pingle.data.models.UserUiModel
import com.pingle.ui.components.AvatarView
import com.pingle.ui.components.AvatarViewState

data class ProfileScreenState(
    val user: UserUiModel = sampleUser
)

data class ProfileRenderState(
    val displayName: String,
    val about: String? = null,
    val avatar: AvatarViewState
)

object ProfileScreen {
    // TODO: Connect profile edits through an authenticated user ViewModel later.
    fun renderState(state: ProfileScreenState = ProfileScreenState()): ProfileRenderState {
        return ProfileRenderState(
            displayName = state.user.displayName,
            about = state.user.about,
            avatar = AvatarView.state(state.user)
        )
    }
}

private val sampleUser = UserUiModel(
    id = "user-demo-me",
    displayName = "Pingle User",
    about = "Available",
    isOnline = true
)
