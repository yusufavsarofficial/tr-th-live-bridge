package com.pingle

import android.app.Activity
import android.content.pm.PackageManager
import android.os.Build
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.pingle.data.*
import io.socket.client.Ack
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject

data class ChatMessage(
    val id: String,
    val conversationId: String,
    val from: String,
    val fromName: String,
    val text: String,
    val imageData: String?,
    val timestamp: Long,
    val status: String,
    val mine: Boolean,
    val pending: Boolean,
)

data class CallUiState(
    val visible: Boolean = false,
    val incoming: Boolean = false,
    val mode: String = "video",
    val status: String = "Ready",
    val peerName: String = "",
    val muted: Boolean = false,
    val cameraEnabled: Boolean = true,
    val speakerEnabled: Boolean = true,
    val remoteFrame: String? = null,
)

class PingleAppState(
    private val activity: Activity,
    private val token: String,
    private val userId: String,
    private val displayName: String,
    private val api: PingleApi,
    private val conversationId: String,
) {
    var connected by mutableStateOf(false)
    var loading by mutableStateOf(true)
    var joined by mutableStateOf(false)
    var statusText by mutableStateOf("Connecting")
    var draft by mutableStateOf("")
    var typingUserId by mutableStateOf("")
    var typingName by mutableStateOf("")
    var call by mutableStateOf(CallUiState())
    val messages = mutableStateListOf<ChatMessage>()
    var remoteFrameBitmap by mutableStateOf<String?>(null)

    private var socket: Socket? = null

    fun connect() {
        if (socket != null) return
        val options = IO.Options().apply {
            reconnection = true
            timeout = 8000
            auth = mapOf("token" to token)
        }
        socket = IO.socket(BuildConfig.BACKEND_URL, options).also { active ->
            active.on(Socket.EVENT_CONNECT) {
                onUi { connected = true; statusText = "Online" }
                joinConversationRoom()
            }
            active.on(Socket.EVENT_DISCONNECT) {
                onUi { connected = false; joined = false; statusText = "Offline" }
            }
            active.on(Socket.EVENT_CONNECT_ERROR) {
                onUi { connected = false; statusText = "Connection failed" }
            }
            active.on("conversation:message") { args ->
                val payload = args.firstJson() ?: return@on
                onUi { upsertMessage(payload) }
            }
            active.on("conversation:typing") { args ->
                val payload = args.firstJson() ?: return@on
                val uid = payload.optString("userId", "")
                val isTyping = payload.optBoolean("isTyping", false)
                onUi {
                    if (uid != userId) {
                        if (isTyping) {
                            typingUserId = uid
                            typingName = "Typing..."
                        } else if (typingUserId == uid) {
                            typingUserId = ""
                            typingName = ""
                        }
                    }
                }
            }
            active.on("call:offer") { args ->
                val payload = args.firstJson() ?: return@on
                val fromName = payload.optString("fromName", "Unknown")
                val mode = payload.optString("mode", "video")
                onUi {
                    call = CallUiState(visible = true, incoming = true, mode = mode, status = "Incoming call", peerName = fromName)
                }
            }
            active.on("call:answer") { onUi { call = call.copy(visible = true, incoming = false, status = "Connected") } }
            active.on("call:end") { args ->
                val payload = args.firstJson()
                val reason = payload?.optString("reason", "ended") ?: "ended"
                onUi { call = CallUiState(status = "Ended: $reason") }
            }
            active.on("call:frame") { args ->
                val payload = args.firstJson() ?: return@on
                val imageData = payload.optString("imageData", "")
                if (imageData.isNotBlank()) {
                    onUi { remoteFrameBitmap = imageData }
                }
            }
            active.connect()
        }
    }

    fun disconnect() {
        socket?.off()
        socket?.disconnect()
        socket = null
    }

    fun loadMessages() {
        activity.runOnUiThread { loading = true }
        Thread {
            try {
                val rawMessages = api.getMessages(token, conversationId)
                val parsed = rawMessages.map { obj -> obj.toChatMessage(userId) }
                activity.runOnUiThread {
                    messages.clear()
                    messages.addAll(parsed)
                    loading = false
                }
            } catch (e: Exception) {
                activity.runOnUiThread { loading = false }
            }
        }.start()
    }

    private fun joinConversationRoom() {
        val active = socket ?: return
        val payload = JSONObject().put("conversationId", conversationId)
        active.emit("join:conversation", payload, Ack { args ->
            val response = args.firstJson()
            onUi {
                if (response?.optBoolean("ok") == true) {
                    joined = true
                    statusText = "Joined"
                    loadMessages()
                } else {
                    statusText = response?.optString("error").orEmpty().ifBlank { "Join failed" }
                    loading = false
                }
            }
        })
    }

    fun sendMessage(imageData: String? = null) {
        val text = draft.trim()
        if (text.isEmpty() && imageData == null) return
        val active = socket ?: return
        val msgPayload = JSONObject()
            .put("conversationId", conversationId)
            .put("text", text)
        if (imageData != null) msgPayload.put("imageData", imageData)
        active.emit("conversation:message", msgPayload, Ack { args ->
            val response = args.firstJson()
            if (response?.optBoolean("ok") == true) onUi { draft = "" }
            else onUi { statusText = response?.optString("error").orEmpty().ifBlank { "Send failed" } }
        })
        active.emit("conversation:typing", JSONObject()
            .put("conversationId", conversationId)
            .put("isTyping", false))
    }

    fun sendTyping(isTyping: Boolean) {
        socket?.emit("conversation:typing", JSONObject()
            .put("conversationId", conversationId)
            .put("isTyping", isTyping))
    }

    fun markRead() {
        api.markConversationRead(token, conversationId)
    }

    fun startCall(mode: String) {
        val active = socket ?: return
        activity.requestCallPermissions()
        call = CallUiState(visible = true, incoming = false, mode = mode, status = "Calling", peerName = peerName())
        active.emit("call:offer", JSONObject()
            .put("conversationId", conversationId)
            .put("mode", mode), Ack { })
    }

    fun acceptCall() {
        val active = socket ?: return
        activity.requestCallPermissions()
        active.emit("call:answer", JSONObject()
            .put("conversationId", conversationId), Ack { })
        call = call.copy(incoming = false, status = "Connected")
    }

    fun rejectCall() {
        socket?.emit("call:end", JSONObject()
            .put("conversationId", conversationId)
            .put("reason", "rejected"))
        call = CallUiState(status = "Rejected")
    }

    fun endCall() {
        socket?.emit("call:end", JSONObject()
            .put("conversationId", conversationId)
            .put("reason", "ended"))
        call = CallUiState(status = "Ended")
        remoteFrameBitmap = null
    }

    fun toggleMute() { call = call.copy(muted = !call.muted) }
    fun toggleCamera() { call = call.copy(cameraEnabled = !call.cameraEnabled) }
    fun toggleSpeaker() { call = call.copy(speakerEnabled = !call.speakerEnabled) }

    fun sendCallFrame(imageData: String) {
        socket?.emit("call:frame", JSONObject()
            .put("conversationId", conversationId)
            .put("from", userId)
            .put("imageData", imageData))
    }

    fun sendCallAudio(audioBase64: String) {
        socket?.emit("call:audio", JSONObject()
            .put("conversationId", conversationId)
            .put("from", userId)
            .put("audioData", audioBase64))
    }

    private fun peerName(): String = messages.lastOrNull { !it.mine }?.fromName ?: "Nova"

    private fun upsertMessage(payload: JSONObject) {
        val parsed = payload.toChatMessage(userId)
        val index = messages.indexOfFirst { it.id == parsed.id }
        if (index >= 0) messages[index] = parsed else messages.add(parsed)
    }

    private fun onUi(block: () -> Unit) { activity.runOnUiThread(block) }
}

private fun JSONObject.toChatMessage(myId: String): ChatMessage {
    val id = optString("id")
    val convId = optString("conversationId", "")
    val from = optString("from", "")
    val fromName = optString("fromName", "Unknown")
    val text = optString("text", "")
    val imageData = if (has("imageData") && !isNull("imageData")) optString("imageData", "") else null
    val timestamp = optLong("timestamp", System.currentTimeMillis())
    val status = optString("status", "sent")
    val pending = optBoolean("translationPending", false)
    return ChatMessage(
        id = id, conversationId = convId, from = from, fromName = fromName,
        text = text, imageData = imageData, timestamp = timestamp, status = status,
        mine = from == myId, pending = pending,
    )
}

fun Array<Any>.firstJson(): JSONObject? = firstOrNull() as? JSONObject

fun Activity.requestCallPermissions() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
    val missing = listOf(
        android.Manifest.permission.RECORD_AUDIO,
        android.Manifest.permission.CAMERA
    ).filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
    if (missing.isNotEmpty()) requestPermissions(missing.toTypedArray(), 412)
}
