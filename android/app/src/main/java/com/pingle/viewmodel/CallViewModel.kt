package com.pingle.viewmodel

import com.pingle.data.models.CallUiModel

data class CallUiState(
    val activeCall: CallUiModel? = null,
    val isMuted: Boolean = false,
    val isCameraEnabled: Boolean = false
)

class CallViewModel {
    // TODO: Convert to AndroidX ViewModel after call signaling and WebRTC phases.
    var state: CallUiState = CallUiState()
        private set

    fun setActiveCall(call: CallUiModel?) {
        state = state.copy(activeCall = call)
    }

    fun setMuted(isMuted: Boolean) {
        state = state.copy(isMuted = isMuted)
    }

    fun setCameraEnabled(isEnabled: Boolean) {
        state = state.copy(isCameraEnabled = isEnabled)
    }
}
