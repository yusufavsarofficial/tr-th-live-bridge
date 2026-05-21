package com.pingle

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pingle.i18n.LocalStrings
import com.pingle.ui.theme.*
import java.io.ByteArrayOutputStream
import java.text.SimpleDateFormat
import java.util.*

private val EMOJIS = listOf(
    "😀", "😂", "❤️", "🔥", "👍", "😍", "😢", "🎉",
    "🙏", "💯", "⭐", "👏", "😎", "🤔", "😴", "🥳",
    "💪", "🤝", "✨", "🌈", "🍕", "🎶", "📱", "💡",
)

@Composable
fun PingleApp(appState: PingleAppState) {
    if (appState.call.visible) {
        VideoCallScreen(appState)
    } else {
        ChatScreen(appState)
    }
}

@Composable
private fun ChatScreen(appState: PingleAppState) {
    val s = LocalStrings.current
    var showEmoji by remember { mutableStateOf(false) }
    var pendingImageBase64 by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    val listState = rememberLazyListState()

    val imagePickerLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        uri?.let {
            try {
                val inputStream = context.contentResolver.openInputStream(it)
                val bytes = inputStream?.readBytes() ?: return@let
                inputStream.close()
                val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                val maxDimension = 1200f
                val scale = minOf(maxDimension / maxOf(bitmap.width, bitmap.height).toFloat(), 1f)
                val scaled = Bitmap.createScaledBitmap(bitmap, (bitmap.width * scale).toInt(), (bitmap.height * scale).toInt(), true)
                val stream = ByteArrayOutputStream()
                scaled.compress(android.graphics.Bitmap.CompressFormat.JPEG, 80, stream)
                val imageBytes = stream.toByteArray()
                val base64 = Base64.encodeToString(imageBytes, Base64.NO_WRAP)
                pendingImageBase64 = "data:image/jpeg;base64,$base64"
                stream.close()
                if (bitmap != scaled) scaled.recycle()
                bitmap.recycle()
            } catch (e: Exception) { pendingImageBase64 = null }
        }
    }

    LaunchedEffect(appState.messages.size) {
        if (appState.messages.isNotEmpty()) listState.animateScrollToItem(appState.messages.lastIndex)
    }

    LaunchedEffect(pendingImageBase64) {
        pendingImageBase64?.let { base64 ->
            appState.sendMessage(base64)
            pendingImageBase64 = null
        }
    }

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).statusBarsPadding().imePadding()) {
        if (appState.loading) {
            Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
            }
        } else {
            LazyColumn(
                state = listState,
                modifier = Modifier.weight(1f).fillMaxWidth().background(Brush.verticalGradient(listOf(Color(0xFF0A151A), Color(0xFF081115)))),
                contentPadding = PaddingValues(10.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                if (appState.messages.isEmpty()) item { EmptyConversation() }
                items(appState.messages, key = { it.id }) { MessageBubble(it) }
            }
        }
        AnimatedVisibility(visible = appState.typingName.isNotBlank()) {
            Row(modifier = Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.background).padding(horizontal = 16.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(appState.typingName, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                Spacer(Modifier.width(4.dp))
                Text("·", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
                Spacer(Modifier.width(4.dp))
                Text(s.typing, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f), fontSize = 13.sp)
            }
        }
        AnimatedVisibility(visible = showEmoji) {
            EmojiPicker(
                onEmojiClick = { emoji ->
                    appState.draft += emoji
                    appState.sendTyping(true)
                },
                onDismiss = { showEmoji = false }
            )
        }
        Composer(appState, showEmoji, onEmojiToggle = { showEmoji = !showEmoji }, onImagePick = { imagePickerLauncher.launch("image/*") })
    }
}

@Composable
private fun EmptyConversation() {
    val s = LocalStrings.current
    Column(modifier = Modifier.fillMaxWidth().padding(top = 80.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(Icons.Default.Chat, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f), modifier = Modifier.size(56.dp))
        Spacer(Modifier.height(12.dp))
        Text(s.sendMessagePrompt, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 15.sp)
    }
}

@Composable
private fun MessageBubble(message: ChatMessage) {
    val isMine = message.mine
    val displayText = if (isMine) message.text else (message.translatedText ?: message.text)
    val timeText = remember(message.timestamp) {
        val sdf = if (isToday(message.timestamp)) SimpleDateFormat("HH:mm", Locale.getDefault())
        else SimpleDateFormat("dd MMM HH:mm", Locale.getDefault())
        sdf.format(Date(message.timestamp))
    }

    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = if (isMine) Arrangement.End else Arrangement.Start) {
        if (!isMine) Spacer(Modifier.width(8.dp))

        Column(
            modifier = Modifier
                .widthIn(max = 280.dp)
                .clip(if (isMine) RoundedCornerShape(12.dp, 4.dp, 12.dp, 12.dp) else RoundedCornerShape(4.dp, 12.dp, 12.dp, 12.dp))
                .background(if (isMine) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant)
                .padding(if (message.imageData != null) PaddingValues(0.dp) else PaddingValues(horizontal = 12.dp, vertical = 8.dp))
        ) {
            if (message.imageData != null) {
                val bitmap = remember(message.imageData) {
                    try {
                        val base64 = message.imageData.substringAfter("base64,")
                        val bytes = Base64.decode(base64, Base64.NO_WRAP)
                        BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                    } catch (e: Exception) { null }
                }
                if (bitmap != null) {
                    androidx.compose.foundation.Image(
                        bitmap = bitmap.asImageBitmap(),
                        contentDescription = "Image",
                        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(if (isMine) 12.dp else 4.dp, if (isMine) 4.dp else 12.dp, 0.dp, 0.dp)),
                        contentScale = ContentScale.FillWidth
                    )
                }
                if (message.text.isNotBlank()) {
                    Text(
                        message.text,
                        color = MaterialTheme.colorScheme.onBackground,
                        fontSize = 15.sp,
                        lineHeight = 20.sp,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                    )
                }
                Row(
                    modifier = Modifier.align(Alignment.End).padding(horizontal = 8.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(timeText, color = if (isMine) MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f) else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f), fontSize = 11.sp)
                    if (isMine) {
                        Spacer(Modifier.width(4.dp))
                        val (icon, color) = when (message.status) {
                            "read" -> Icons.Default.DoneAll to MaterialTheme.colorScheme.primary
                            "delivered" -> Icons.Default.DoneAll to MaterialTheme.colorScheme.onSurfaceVariant
                            else -> Icons.Default.Check to MaterialTheme.colorScheme.onSurfaceVariant
                        }
                        Icon(icon, contentDescription = message.status, tint = color, modifier = Modifier.size(14.dp))
                    }
                }
            } else {
                Text(displayText, color = MaterialTheme.colorScheme.onBackground, fontSize = 15.sp, lineHeight = 20.sp)
                if (!isMine && message.translatedText != null && message.text != message.translatedText) {
                    Spacer(Modifier.height(4.dp))
                    Text(message.text, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f), fontSize = 12.sp)
                }
                Spacer(Modifier.height(3.dp))
                Row(modifier = Modifier.align(Alignment.End), verticalAlignment = Alignment.CenterVertically) {
                    Text(timeText, color = if (isMine) MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f) else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f), fontSize = 11.sp)
                    if (isMine) {
                        Spacer(Modifier.width(4.dp))
                        val (icon, color) = when (message.status) {
                            "read" -> Icons.Default.DoneAll to MaterialTheme.colorScheme.primary
                            "delivered" -> Icons.Default.DoneAll to MaterialTheme.colorScheme.onSurfaceVariant
                            else -> Icons.Default.Check to MaterialTheme.colorScheme.onSurfaceVariant
                        }
                        Icon(icon, contentDescription = message.status, tint = color, modifier = Modifier.size(14.dp))
                    }
                }
            }
        }

        if (isMine) Spacer(Modifier.width(8.dp))
    }
}

@Composable
private fun EmojiPicker(onEmojiClick: (String) -> Unit, onDismiss: () -> Unit) {
    Column(modifier = Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface).padding(8.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            IconButton(onClick = onDismiss, modifier = Modifier.size(32.dp)) {
                Icon(Icons.Default.Close, contentDescription = "Close", tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(18.dp))
            }
        }
        LazyVerticalGrid(
            columns = GridCells.Fixed(8),
            modifier = Modifier.height(160.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            items(EMOJIS) { emoji ->
                Text(
                    text = emoji,
                    fontSize = 28.sp,
                    modifier = Modifier.size(40.dp).clickable { onEmojiClick(emoji) },
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}

@Composable
private fun Composer(appState: PingleAppState, showEmoji: Boolean, onEmojiToggle: () -> Unit, onImagePick: () -> Unit) {
    val s = LocalStrings.current
    Row(modifier = Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface).padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
        Row(modifier = Modifier.weight(1f).clip(RoundedCornerShape(26.dp)).background(MaterialTheme.colorScheme.surfaceVariant).padding(start = 4.dp, end = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onEmojiToggle) {
                Icon(if (showEmoji) Icons.Default.Keyboard else Icons.Default.EmojiEmotions, contentDescription = "Emoji", tint = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            IconButton(onClick = onImagePick) {
                Icon(Icons.Default.Image, contentDescription = s.image, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            TextField(
                value = appState.draft, onValueChange = { appState.draft = it; appState.sendTyping(it.isNotBlank()) },
                modifier = Modifier.weight(1f), placeholder = { Text(s.message, color = MaterialTheme.colorScheme.onSurfaceVariant) },
                singleLine = false, maxLines = 4,
                colors = TextFieldDefaults.colors(focusedContainerColor = Color.Transparent, unfocusedContainerColor = Color.Transparent, disabledContainerColor = Color.Transparent, focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent, cursorColor = MaterialTheme.colorScheme.primary)
            )
        }
        Spacer(Modifier.width(8.dp))
        Box(modifier = Modifier.size(48.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primary), contentAlignment = Alignment.Center) {
            IconButton(onClick = { appState.sendMessage() }, modifier = Modifier.size(48.dp)) {
                Icon(Icons.Default.Send, contentDescription = "Send", tint = MaterialTheme.colorScheme.onPrimary)
            }
        }
    }
}

private fun isToday(timestamp: Long): Boolean {
    val cal = Calendar.getInstance()
    val today = Calendar.getInstance()
    cal.timeInMillis = timestamp
    return cal.get(Calendar.YEAR) == today.get(Calendar.YEAR) && cal.get(Calendar.DAY_OF_YEAR) == today.get(Calendar.DAY_OF_YEAR)
}

@Composable
private fun VideoCallScreen(appState: PingleAppState) {
    val s = LocalStrings.current
    val call = appState.call
    val bgColor = Color(0xFF0B1014)

    Column(modifier = Modifier.fillMaxSize().background(bgColor).statusBarsPadding()) {
        // Remote video (main area)
        Box(
            modifier = Modifier.weight(1f).fillMaxWidth().background(Color(0xFF1a1a1a)),
            contentAlignment = Alignment.Center
        ) {
            val remoteFrame = appState.remoteFrameBitmap
            if (remoteFrame != null) {
                val bitmap = remember(remoteFrame) {
                    try {
                        val base64 = remoteFrame.substringAfter("base64,")
                        val bytes = Base64.decode(base64, Base64.NO_WRAP)
                        BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                    } catch (e: Exception) { null }
                }
                if (bitmap != null) {
                    androidx.compose.foundation.Image(
                        bitmap = bitmap.asImageBitmap(),
                        contentDescription = "Remote video",
                        modifier = Modifier.fillMaxSize(),
                        contentScale = androidx.compose.ui.layout.ContentScale.Fit
                    )
                }
            } else {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(if (call.mode == "video") Icons.Default.Videocam else Icons.Default.Call, contentDescription = null, tint = Color.White.copy(alpha = 0.4f), modifier = Modifier.size(64.dp))
                    Spacer(Modifier.height(12.dp))
                    Text(call.peerName, color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                    Text(call.status, color = Color.White.copy(alpha = 0.6f), fontSize = 16.sp)
                }
            }

            // Local PiP preview
            if (call.mode == "video" && call.cameraEnabled && !call.incoming) {
                Box(
                    modifier = Modifier.align(Alignment.TopEnd).padding(12.dp).size(120.dp, 160.dp).background(Color(0xFF2a2a2a), RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Videocam, contentDescription = "Camera", tint = Color.White.copy(alpha = 0.3f), modifier = Modifier.size(32.dp))
                }
            }
        }

        // Call controls
        Column(modifier = Modifier.fillMaxWidth().background(Color.Black.copy(alpha = 0.6f)).padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            if (call.incoming) {
                Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                    Button(onClick = appState::rejectCall, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE53935))) { Text(s.reject, color = Color.White) }
                    Button(onClick = appState::acceptCall, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF25D366))) { Text(s.accept, color = Color.White) }
                }
                Spacer(Modifier.height(16.dp))
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                ToggleButton(active = call.muted, icon = if (call.muted) Icons.Default.MicOff else Icons.Default.Mic, label = s.mute, onClick = appState::toggleMute)
                if (call.mode == "video") {
                    ToggleButton(active = !call.cameraEnabled, icon = if (call.cameraEnabled) Icons.Default.Videocam else Icons.Default.VideocamOff, label = s.camera, onClick = appState::toggleCamera)
                }
                ToggleButton(active = false, icon = Icons.Default.VolumeUp, label = s.speaker, onClick = appState::toggleSpeaker)
                Box(
                    modifier = Modifier.size(56.dp).clip(CircleShape).background(Color(0xFFE53935)),
                    contentAlignment = Alignment.Center
                ) {
                    IconButton(onClick = appState::endCall) { Icon(Icons.Default.CallEnd, contentDescription = s.endCall, tint = Color.White) }
                }
            }
            TextButton(onClick = { appState.call = CallUiState() }) { Text(s.minimize, color = Color.White.copy(alpha = 0.6f)) }
        }
    }
}

@Composable
private fun ToggleButton(active: Boolean, icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, onClick: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            modifier = Modifier.size(48.dp).clip(CircleShape).background(if (active) Color(0xFF25D366).copy(alpha = 0.3f) else Color.White.copy(alpha = 0.1f)),
            contentAlignment = Alignment.Center
        ) {
            IconButton(onClick = onClick) { Icon(icon, contentDescription = label, tint = Color.White) }
        }
        Spacer(Modifier.height(4.dp))
        Text(label, color = Color.White.copy(alpha = 0.7f), fontSize = 11.sp)
    }
}
