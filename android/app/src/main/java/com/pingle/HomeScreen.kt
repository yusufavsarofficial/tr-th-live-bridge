package com.pingle

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pingle.data.Conversation
import com.pingle.i18n.*
import com.pingle.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun HomeScreen(
    conversations: List<Conversation>,
    onChatClick: (Conversation) -> Unit,
    onAddContact: () -> Unit,
    onLogout: () -> Unit,
    currentLanguage: PingleLanguage = PingleLanguage.ENGLISH,
    onLanguageChange: ((PingleLanguage) -> Unit)? = null,
) {
    val s = LocalStrings.current
    var searchQuery by remember { mutableStateOf("") }
    var showLangMenu by remember { mutableStateOf(false) }
    val filteredConversations = remember(conversations, searchQuery) {
        if (searchQuery.isBlank()) conversations
        else conversations.filter { conv ->
            val name = conv.otherUser?.displayName ?: conv.otherUser?.phoneNumber ?: ""
            name.contains(searchQuery, ignoreCase = true)
        }
    }

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).statusBarsPadding()) {
        Surface(modifier = Modifier.fillMaxWidth(), color = MaterialTheme.colorScheme.secondary, shadowElevation = 0.dp) {
            Column {
                Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(s.appName, color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                    IconButton(onClick = { showLangMenu = !showLangMenu }) { Icon(Icons.Default.Language, contentDescription = "Language", tint = Color.White.copy(alpha = 0.8f)) }
                    IconButton(onClick = onLogout) { Icon(Icons.Default.ExitToApp, contentDescription = s.logout, tint = Color.White.copy(alpha = 0.8f)) }
                }
                Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Search, contentDescription = s.search, tint = Color.White.copy(alpha = 0.6f), modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(s.searchOrNew, color = Color.White.copy(alpha = 0.6f), fontSize = 14.sp)
                }
                Spacer(Modifier.height(6.dp))
            }
        }

        // Language switcher
        DropdownMenu(
            expanded = showLangMenu,
            onDismissRequest = { showLangMenu = false }
        ) {
            DropdownMenuItem(
                text = { Text("English") },
                onClick = { onLanguageChange?.invoke(PingleLanguage.ENGLISH); showLangMenu = false },
                leadingIcon = { if (currentLanguage == PingleLanguage.ENGLISH) Icon(Icons.Default.Check, contentDescription = null, tint = MaterialTheme.colorScheme.primary) else null }
            )
            DropdownMenuItem(
                text = { Text("Türkçe") },
                onClick = { onLanguageChange?.invoke(PingleLanguage.TURKISH); showLangMenu = false },
                leadingIcon = { if (currentLanguage == PingleLanguage.TURKISH) Icon(Icons.Default.Check, contentDescription = null, tint = MaterialTheme.colorScheme.primary) else null }
            )
            DropdownMenuItem(
                text = { Text("ไทย") },
                onClick = { onLanguageChange?.invoke(PingleLanguage.THAI); showLangMenu = false },
                leadingIcon = { if (currentLanguage == PingleLanguage.THAI) Icon(Icons.Default.Check, contentDescription = null, tint = MaterialTheme.colorScheme.primary) else null }
            )
            DropdownMenuItem(
                text = { Text("Русский") },
                onClick = { onLanguageChange?.invoke(PingleLanguage.RUSSIAN); showLangMenu = false },
                leadingIcon = { if (currentLanguage == PingleLanguage.RUSSIAN) Icon(Icons.Default.Check, contentDescription = null, tint = MaterialTheme.colorScheme.primary) else null }
            )
            DropdownMenuItem(
                text = { Text("中文") },
                onClick = { onLanguageChange?.invoke(PingleLanguage.CHINESE); showLangMenu = false },
                leadingIcon = { if (currentLanguage == PingleLanguage.CHINESE) Icon(Icons.Default.Check, contentDescription = null, tint = MaterialTheme.colorScheme.primary) else null }
            )
        }

        if (filteredConversations.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(32.dp)) {
                    Icon(Icons.Default.Chat, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f), modifier = Modifier.size(72.dp))
                    Spacer(Modifier.height(16.dp))
                    Text(if (searchQuery.isNotBlank()) "No conversations found" else s.noConversations, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 18.sp, fontWeight = FontWeight.Medium)
                    Spacer(Modifier.height(8.dp))
                    Text(if (searchQuery.isNotBlank()) "Try a different search" else s.tapToStart, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f), fontSize = 14.sp)
                }
            }
        } else {
            LazyColumn(modifier = Modifier.weight(1f)) {
                items(filteredConversations, key = { it.id }) { conv ->
                    ConversationRow(conv, onClick = { onChatClick(conv) })
                }
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        FloatingActionButton(
            onClick = onAddContact,
            modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp),
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = MaterialTheme.colorScheme.onPrimary,
            shape = CircleShape
        ) {
            Icon(Icons.Default.Add, contentDescription = s.newChat)
        }
    }
}

@Composable
private fun ConversationRow(conv: Conversation, onClick: () -> Unit) {
    val s = LocalStrings.current
    val name = conv.otherUser?.displayName ?: conv.otherUser?.phoneNumber ?: "Unknown"
    val initial = name.take(1).uppercase().ifBlank { "?" }
    val lastMessage = conv.lastMessage

    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(modifier = Modifier.size(52.dp).clip(CircleShape).background(Brush.linearGradient(listOf(MaterialTheme.colorScheme.secondary, MaterialTheme.colorScheme.primary))), contentAlignment = Alignment.Center) {
            Text(initial, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(name, color = MaterialTheme.colorScheme.onBackground, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                Spacer(Modifier.width(8.dp))
                if (conv.updatedAt != null) {
                    val dateText = remember(conv.updatedAt) { formatConversationDate(conv.updatedAt) }
                    Text(dateText, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
                }
            }
            Spacer(Modifier.height(4.dp))
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(lastMessage ?: s.tapToStart, color = if (lastMessage != null) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f), fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                if (conv.unreadCount > 0) {
                    Spacer(Modifier.width(8.dp))
                    Box(modifier = Modifier.height(20.dp).widthIn(min = 20.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primary).padding(horizontal = 6.dp), contentAlignment = Alignment.Center) {
                        Text(conv.unreadCount.toString(), color = MaterialTheme.colorScheme.onPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
    Divider(color = MaterialTheme.colorScheme.outlineVariant, thickness = 0.5.dp, modifier = Modifier.padding(start = 72.dp))
}

private fun formatConversationDate(isoDate: String): String {
    return try {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
        val date = sdf.parse(isoDate.substringBefore(".")) ?: return isoDate.take(10)
        val cal = Calendar.getInstance()
        val msgCal = Calendar.getInstance().apply { time = date }
        if (cal.get(Calendar.YEAR) == msgCal.get(Calendar.YEAR) && cal.get(Calendar.DAY_OF_YEAR) == msgCal.get(Calendar.DAY_OF_YEAR)) {
            SimpleDateFormat("HH:mm", Locale.getDefault()).format(date)
        } else {
            SimpleDateFormat("dd/MM", Locale.getDefault()).format(date)
        }
    } catch (e: Exception) { isoDate.take(10) }
}
