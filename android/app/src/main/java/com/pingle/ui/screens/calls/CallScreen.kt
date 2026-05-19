package com.pingle.ui.screens.calls

import com.pingle.data.models.CallUiModel

data class CallScreenState(
    val activeCall: CallUiModel? = sampleCall,
    val isMuted: Boolean = false,
    val isCameraEnabled: Boolean = false
)

object CallScreen {
    // TODO: Wire to CallViewModel after call lifecycle is separated from WebRTC media.
    fun title(state: CallScreenState): String {
        return state.activeCall?.title ?: "No active call"
    }
}

private val sampleCall = CallUiModel(
    id = "call-demo-1",
    conversationId = "conversation-demo-direct",
    title = "Ayse",
    type = "audio",
    status = "ringing",
    startedAt = "09:42"
)
