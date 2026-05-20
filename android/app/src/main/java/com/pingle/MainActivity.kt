package com.pingle

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.CallEnd
import androidx.compose.material.icons.filled.Cameraswitch
import androidx.compose.material.icons.filled.EmojiEmotions
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material.icons.filled.VideocamOff
import androidx.compose.material.icons.filled.VolumeOff
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pingle.ui.theme.PingleBackground
import com.pingle.ui.theme.PingleDanger
import com.pingle.ui.theme.PingleGreen
import com.pingle.ui.theme.PingleGreenDeep
import com.pingle.ui.theme.PingleMine
import com.pingle.ui.theme.PingleMuted
import com.pingle.ui.theme.PingleSurface
import com.pingle.ui.theme.PingleSurfaceAlt
import com.pingle.ui.theme.PingleText
import com.pingle.ui.theme.PingleTheme
import io.socket.client.Ack
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject
import java.text.DateFormat
import java.util.Date
import java.util.Locale

private const val RENDER_BACKEND_URL = "https://tr-th-live-bridge.onrender.com"

class MainActivity : ComponentActivity() {
    private lateinit var appState: PingleAppState

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = android.graphics.Color.parseColor("#0B1014")
        window.navigationBarColor = android.graphics.Color.parseColor("#0B1014")
        requestMediaPermissions()

        appState = PingleAppState(this)
        setContent {
            PingleTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = PingleBackground
                ) {
                    PingleApp(appState)
                }
            }
        }
    }

    override fun onDestroy() {
        appState.disconnect()
        super.onDestroy()
    }

    private fun requestMediaPermissions() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
        val missing = listOf(
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.CAMERA
        ).filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isNotEmpty()) {
            requestPermissions(missing.toTypedArray(), 410)
        }
    }
}

private data class ChatMessage(
    val id: String,
    val from: String,
    val originalText: String,
    val translatedText: String,
    val sourceLang: String,
    val timestampText: String,
    val mine: Boolean,
    val pending: Boolean
)

private data class CallUiState(
    val visible: Boolean = false,
    val incoming: Boolean = false,
    val mode: String = "video",
    val status: String = "Ready",
    val peerName: String = "Pingle",
    val muted: Boolean = false,
    val cameraEnabled: Boolean = true,
    val speakerEnabled: Boolean = true
)

private class PingleAppState(private val activity: Activity) {
    var displayName by mutableStateOf("Android")
    var connected by mutableStateOf(false)
    var joined by mutableStateOf(false)
    var statusText by mutableStateOf("Connecting")
    var usersOnline by mutableStateOf(0)
    var draft by mutableStateOf("")
    var typingName by mutableStateOf("")
    var call by mutableStateOf(CallUiState())
    val messages = mutableStateListOf<ChatMessage>()

    private var socket: Socket? = null
    private val timeFormat = DateFormat.getTimeInstance(DateFormat.SHORT, Locale.getDefault())

    fun connect() {
        if (socket != null) return
        val options = IO.Options().apply {
            reconnection = true
            timeout = 8000
        }
        socket = IO.socket(RENDER_BACKEND_URL, options).also { active ->
            active.on(Socket.EVENT_CONNECT) {
                onUi {
                    connected = true
                    statusText = "Online"
                }
                joinRoom()
            }
            active.on(Socket.EVENT_DISCONNECT) {
                onUi {
                    connected = false
                    joined = false
                    statusText = "Offline"
                }
            }
            active.on(Socket.EVENT_CONNECT_ERROR) {
                onUi {
                    connected = false
                    statusText = "Connection failed"
                }
            }
            active.on("users") { args ->
                val payload = args.firstJson() ?: return@on
                onUi { usersOnline = payload.optInt("onlineCount", 0) }
            }
            active.on("typing") { args ->
                val payload = args.firstJson() ?: return@on
                val name = payload.optString("name")
                val isTyping = payload.optBoolean("isTyping")
                onUi { typingName = if (isTyping && name != displayName) name else "" }
            }
            active.on("message") { args ->
                val payload = args.firstJson() ?: return@on
                onUi { upsertMessage(payload) }
            }
            active.on("message:update") { args ->
                val payload = args.firstJson() ?: return@on
                onUi { upsertMessage(payload) }
            }
            active.on("call:offer") { args ->
                val payload = args.firstJson() ?: return@on
                val from = payload.optJSONObject("from")?.optString("name").orEmpty().ifBlank { "Pingle" }
                onUi {
                    call = CallUiState(
                        visible = true,
                        incoming = true,
                        mode = payload.optString("mode", "video"),
                        status = "Incoming call",
                        peerName = from
                    )
                }
            }
            active.on("call:ringing") {
                onUi { call = call.copy(status = "Ringing") }
            }
            active.on("call:answer") {
                onUi { call = call.copy(visible = true, incoming = false, status = "Connected") }
            }
            active.on("call:end") { args ->
                val payload = args.firstJson()
                val reason = payload?.optString("reason", "ended") ?: "ended"
                onUi { call = CallUiState(status = "Ended: $reason") }
            }
            active.connect()
        }
    }

    fun disconnect() {
        socket?.off()
        socket?.disconnect()
        socket = null
    }

    fun joinRoom() {
        val active = socket ?: return
        val payload = JSONObject()
            .put("name", displayName.trim().ifBlank { "Android" })
            .put("avatarUrl", "")
        active.emit("join", payload, Ack { args ->
            val response = args.firstJson()
            onUi {
                if (response?.optBoolean("ok") == true) {
                    joined = true
                    statusText = "Joined"
                    usersOnline = response.optJSONArray("users")?.length() ?: usersOnline
                } else {
                    statusText = response?.optString("error").orEmpty().ifBlank { "Join failed" }
                }
            }
        })
    }

    fun sendMessage() {
        val text = draft.trim()
        if (text.isEmpty()) return
        val active = socket ?: return
        active.emit("message", JSONObject().put("text", text), Ack { args ->
            val response = args.firstJson()
            if (response?.optBoolean("ok") == true) {
                onUi { draft = "" }
            } else {
                onUi { statusText = response?.optString("error").orEmpty().ifBlank { "Send failed" } }
            }
        })
        active.emit("typing", false)
    }

    fun sendTyping() {
        socket?.emit("typing", draft.isNotBlank())
    }

    fun addEmoji() {
        draft += "🙂"
        sendTyping()
    }

    fun startCall(mode: String) {
        val active = socket ?: return
        activity.requestRuntimePermissions()
        call = CallUiState(
            visible = true,
            incoming = false,
            mode = mode,
            status = "Calling",
            peerName = otherUserName()
        )
        val sdp = JSONObject()
            .put("type", "offer")
            .put("sdp", "native-android-offer")
        active.emit("call:offer", JSONObject().put("mode", mode).put("sdp", sdp), Ack { args ->
            val response = args.firstJson()
            onUi {
                call = if (response?.optBoolean("ok") == true) {
                    call.copy(status = if (response.optBoolean("queued")) "Queued" else "Ringing")
                } else {
                    call.copy(status = response?.optString("error").orEmpty().ifBlank { "Call failed" })
                }
            }
        })
    }

    fun acceptCall() {
        val active = socket ?: return
        activity.requestRuntimePermissions()
        val answer = JSONObject()
            .put("type", "answer")
            .put("sdp", "native-android-answer")
        active.emit("call:answer", JSONObject().put("sdp", answer), Ack { })
        call = call.copy(incoming = false, status = "Connected")
    }

    fun rejectCall() {
        socket?.emit("call:end", JSONObject().put("reason", "rejected"))
        call = CallUiState(status = "Rejected")
    }

    fun endCall() {
        socket?.emit("call:end", JSONObject().put("reason", "ended"))
        call = CallUiState(status = "Ended")
    }

    fun toggleMute() {
        call = call.copy(muted = !call.muted)
    }

    fun toggleCamera() {
        call = call.copy(cameraEnabled = !call.cameraEnabled)
    }

    fun toggleSpeaker() {
        val next = !call.speakerEnabled
        val audio = activity.getSystemService(Activity.AUDIO_SERVICE) as? AudioManager
        audio?.isSpeakerphoneOn = next
        call = call.copy(speakerEnabled = next)
    }

    private fun upsertMessage(payload: JSONObject) {
        val parsed = payload.toChatMessage(displayName, timeFormat)
        val index = messages.indexOfFirst { it.id == parsed.id }
        if (index >= 0) {
            messages[index] = parsed
        } else {
            messages.add(parsed)
        }
    }

    private fun otherUserName(): String {
        return messages.lastOrNull { !it.mine }?.from ?: "Pingle"
    }

    private fun onUi(block: () -> Unit) {
        activity.runOnUiThread(block)
    }
}

@Composable
private fun PingleApp(appState: PingleAppState) {
    DisposableEffect(Unit) {
        appState.connect()
        onDispose { appState.disconnect() }
    }

    if (appState.call.visible) {
        CallScreen(appState)
    } else {
        ChatScreen(appState)
    }
}

@Composable
private fun ChatScreen(appState: PingleAppState) {
    val listState = rememberLazyListState()
    LaunchedEffect(appState.messages.size) {
        if (appState.messages.isNotEmpty()) {
            listState.animateScrollToItem(appState.messages.lastIndex)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(PingleBackground)
            .statusBarsPadding()
            .imePadding()
    ) {
        ChatHeader(appState)
        LazyColumn(
            state = listState,
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .background(
                    Brush.verticalGradient(
                        listOf(Color(0xFF0A151A), Color(0xFF081115))
                    )
                ),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            if (appState.messages.isEmpty()) {
                item { EmptyThread() }
            }
            items(appState.messages, key = { it.id }) { message ->
                MessageBubble(message)
            }
        }
        AnimatedVisibility(visible = appState.typingName.isNotBlank()) {
            Text(
                text = "${appState.typingName} is typing",
                color = PingleMuted,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                fontSize = 13.sp
            )
        }
        Composer(appState)
    }
}

@Composable
private fun ChatHeader(appState: PingleAppState) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(PingleSurface)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Avatar(label = "P", online = appState.connected)
        Spacer(Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Pingle",
                color = PingleText,
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp
            )
            Text(
                text = "${appState.statusText} · ${appState.usersOnline} online",
                color = PingleMuted,
                fontSize = 12.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        IconButton(onClick = { appState.startCall("voice") }) {
            Icon(Icons.Default.Call, contentDescription = "Voice call", tint = PingleGreen)
        }
        IconButton(onClick = { appState.startCall("video") }) {
            Icon(Icons.Default.Videocam, contentDescription = "Video call", tint = PingleGreen)
        }
    }
}

@Composable
private fun EmptyThread() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 80.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("Connected to Render", color = PingleMuted, fontSize = 14.sp)
        Spacer(Modifier.height(8.dp))
        Text("Messages are translated Turkish ↔ Thai.", color = PingleMuted, fontSize = 14.sp)
    }
}

@Composable
private fun MessageBubble(message: ChatMessage) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (message.mine) Arrangement.End else Arrangement.Start,
        verticalAlignment = Alignment.Bottom
    ) {
        if (!message.mine) {
            Avatar(label = message.from.take(1).ifBlank { "P" }, online = true, small = true)
            Spacer(Modifier.width(6.dp))
        }

        val bubbleColor by animateColorAsState(
            targetValue = if (message.mine) PingleMine else PingleSurfaceAlt
        )
        Column(
            modifier = Modifier
                .clip(RoundedCornerShape(8.dp))
                .background(bubbleColor)
                .padding(horizontal = 10.dp, vertical = 7.dp)
                .fillMaxWidth(0.78f)
        ) {
            if (!message.mine) {
                Text(message.from, color = Color(0xFF79D9FF), fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
            Text(message.originalText, color = PingleText, fontSize = 16.sp, lineHeight = 21.sp)
            val translation = message.translatedText.ifBlank {
                if (message.pending) "Translating..." else ""
            }
            if (translation.isNotBlank()) {
                Spacer(Modifier.height(6.dp))
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(1.dp)
                        .background(Color.White.copy(alpha = 0.10f))
                )
                Spacer(Modifier.height(5.dp))
                Text(
                    text = translation,
                    color = if (message.pending) PingleMuted else Color(0xFFD2DDE2),
                    fontSize = 14.sp,
                    lineHeight = 19.sp
                )
            }
            Text(
                text = message.timestampText,
                color = Color(0xFFB8C5CA),
                fontSize = 11.sp,
                modifier = Modifier.align(Alignment.End)
            )
        }
    }
}

@Composable
private fun Composer(appState: PingleAppState) {
    val context = LocalContext.current
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(PingleSurface)
            .padding(8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            modifier = Modifier
                .weight(1f)
                .clip(RoundedCornerShape(26.dp))
                .background(PingleSurfaceAlt)
                .padding(start = 4.dp, end = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = appState::addEmoji) {
                Icon(Icons.Default.EmojiEmotions, contentDescription = "Emoji", tint = PingleMuted)
            }
            TextField(
                value = appState.draft,
                onValueChange = {
                    appState.draft = it
                    appState.sendTyping()
                },
                modifier = Modifier.weight(1f),
                placeholder = { Text("Message", color = PingleMuted) },
                singleLine = false,
                maxLines = 4,
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = Color.Transparent,
                    unfocusedContainerColor = Color.Transparent,
                    disabledContainerColor = Color.Transparent,
                    focusedIndicatorColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent,
                    cursorColor = PingleGreen
                )
            )
        }
        Spacer(Modifier.width(8.dp))
        RoundActionButton(
            color = PingleGreen,
            onClick = {
                if (appState.draft.isBlank()) {
                    (context as? Activity)?.requestRuntimePermissions()
                } else {
                    appState.sendMessage()
                }
            }
        ) {
            Icon(
                imageVector = if (appState.draft.isBlank()) Icons.Default.Mic else Icons.Default.Send,
                contentDescription = if (appState.draft.isBlank()) "Microphone" else "Send",
                tint = PingleBackground
            )
        }
    }
}

@Composable
private fun CallScreen(appState: PingleAppState) {
    val call = appState.call
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(PingleBackground)
            .statusBarsPadding()
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        listOf(Color(0xFF16282F), Color(0xFF071217))
                    )
                ),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Avatar(label = call.peerName.take(1).ifBlank { "P" }, online = true, large = true)
                Spacer(Modifier.height(18.dp))
                Text(call.peerName, color = PingleText, fontSize = 26.sp, fontWeight = FontWeight.Bold)
                Text(call.status, color = PingleMuted, fontSize = 15.sp)
                Spacer(Modifier.height(22.dp))
                Text(
                    text = if (call.mode == "video") "Remote video" else "Voice call",
                    color = PingleMuted,
                    fontSize = 14.sp
                )
            }
        }

        if (call.mode == "video") {
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(18.dp)
                    .size(width = 112.dp, height = 158.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(PingleSurfaceAlt),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        imageVector = if (call.cameraEnabled) Icons.Default.Videocam else Icons.Default.VideocamOff,
                        contentDescription = "Local preview",
                        tint = PingleGreen
                    )
                    Spacer(Modifier.height(8.dp))
                    Text("Local", color = PingleMuted, fontSize = 12.sp)
                }
            }
        }

        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .background(Color.Black.copy(alpha = 0.24f))
                .padding(18.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            if (call.incoming) {
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    Button(
                        onClick = appState::rejectCall,
                        colors = ButtonDefaults.buttonColors(containerColor = PingleDanger)
                    ) { Text("Reject") }
                    Button(
                        onClick = appState::acceptCall,
                        colors = ButtonDefaults.buttonColors(containerColor = PingleGreen, contentColor = PingleBackground)
                    ) { Text("Accept") }
                }
                Spacer(Modifier.height(18.dp))
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                CallControl(
                    active = call.muted,
                    onClick = appState::toggleMute
                ) {
                    Icon(if (call.muted) Icons.Default.MicOff else Icons.Default.Mic, "Mute", tint = PingleText)
                }
                CallControl(
                    active = !call.cameraEnabled,
                    onClick = appState::toggleCamera
                ) {
                    Icon(
                        if (call.cameraEnabled) Icons.Default.Cameraswitch else Icons.Default.VideocamOff,
                        "Camera",
                        tint = PingleText
                    )
                }
                CallControl(
                    active = !call.speakerEnabled,
                    onClick = appState::toggleSpeaker
                ) {
                    Icon(if (call.speakerEnabled) Icons.Default.VolumeUp else Icons.Default.VolumeOff, "Speaker", tint = PingleText)
                }
                RoundActionButton(color = PingleDanger, size = 62, onClick = appState::endCall) {
                    Icon(Icons.Default.CallEnd, contentDescription = "End call", tint = Color.White)
                }
            }
            TextButton(onClick = { appState.call = CallUiState() }) {
                Text("Back to chat", color = PingleMuted)
            }
        }
    }
}

@Composable
private fun Avatar(
    label: String,
    online: Boolean,
    small: Boolean = false,
    large: Boolean = false
) {
    val size = when {
        large -> 96.dp
        small -> 34.dp
        else -> 46.dp
    }
    Box(
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .background(Brush.linearGradient(listOf(PingleGreenDeep, PingleGreen))),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label.uppercase(Locale.getDefault()),
            color = Color.White,
            fontSize = if (large) 34.sp else 16.sp,
            fontWeight = FontWeight.Bold
        )
        if (online && !large) {
            Box(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .size(if (small) 9.dp else 12.dp)
                    .clip(CircleShape)
                    .background(PingleGreen)
            )
        }
    }
}

@Composable
private fun RoundActionButton(
    color: Color,
    size: Int = 52,
    onClick: () -> Unit,
    content: @Composable () -> Unit
) {
    Box(
        modifier = Modifier
            .size(size.dp)
            .clip(CircleShape)
            .background(color)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        content()
    }
}

@Composable
private fun CallControl(
    active: Boolean,
    onClick: () -> Unit,
    content: @Composable () -> Unit
) {
    Box(
        modifier = Modifier
            .size(52.dp)
            .clip(CircleShape)
            .background(if (active) PingleGreenDeep else PingleSurfaceAlt)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        content()
    }
}

private fun JSONObject.toChatMessage(myName: String, formatter: DateFormat): ChatMessage {
    val id = optString("id").ifBlank { optLong("timestamp", System.currentTimeMillis()).toString() }
    val from = optString("from", "Pingle")
    val source = optString("sourceLang", "tr")
    val text = optString("text")
    val tr = optString("trText")
    val th = optString("thText")
    val original = when (source) {
        "th" -> th.ifBlank { text }
        else -> tr.ifBlank { text }
    }
    val translated = when (source) {
        "th" -> tr
        else -> th
    }
    return ChatMessage(
        id = id,
        from = from,
        originalText = original,
        translatedText = translated,
        sourceLang = source,
        timestampText = formatter.format(Date(optLong("timestamp", System.currentTimeMillis()))),
        mine = from.equals(myName, ignoreCase = true),
        pending = optBoolean("translationPending", false)
    )
}

private fun Array<Any>.firstJson(): JSONObject? = firstOrNull() as? JSONObject

private fun Activity.requestRuntimePermissions() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
    val missing = listOf(
        Manifest.permission.RECORD_AUDIO,
        Manifest.permission.CAMERA
    ).filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
    if (missing.isNotEmpty()) {
        requestPermissions(missing.toTypedArray(), 411)
    }
}
