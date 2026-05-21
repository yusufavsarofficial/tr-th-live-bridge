package com.pingle

import android.app.Activity
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.IconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.Surface
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pingle.auth.OtpScreen
import com.pingle.auth.PhoneScreen
import com.pingle.auth.ProfileSetupScreen
import com.pingle.contacts.AddContactScreen
import com.pingle.data.*
import com.pingle.i18n.*
import com.pingle.ui.theme.PingleTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

enum class AppScreen { SPLASH, PHONE, OTP, PROFILE, MAIN, CHAT, ADD_CONTACT, LEGAL_INFO }

class MainActivity : ComponentActivity() {
    private lateinit var tokenStorage: TokenStorage
    private lateinit var api: PingleApi
    private val scope = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        tokenStorage = TokenStorage(this)
        api = PingleApi(BuildConfig.BACKEND_URL)

        setContent {
            PingleTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = androidx.compose.material3.MaterialTheme.colorScheme.background) {
                    AppNavigation(tokenStorage, api, this@MainActivity, scope)
                }
            }
        }
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}

@Composable
fun AppNavigation(tokenStorage: TokenStorage, api: PingleApi, activity: Activity, scope: kotlinx.coroutines.CoroutineScope) {
    val localeHelper = remember { LocaleHelper(activity) }
    var currentLang by remember { mutableStateOf(localeHelper.getLanguage()) }
    val strings = getStrings(currentLang)

    CompositionLocalProvider(LocalStrings provides strings) {
        AppNavigationContent(tokenStorage, api, activity, scope, currentLang, localeHelper) { lang ->
            localeHelper.setLanguage(lang); currentLang = lang
        }
    }
}

@Composable
private fun AppNavigationContent(
    tokenStorage: TokenStorage, api: PingleApi, activity: Activity, scope: kotlinx.coroutines.CoroutineScope,
    currentLang: PingleLanguage, localeHelper: LocaleHelper,
    onLanguageChanged: (PingleLanguage) -> Unit = {},
) {
    var currentScreen by remember { mutableStateOf(AppScreen.SPLASH) }
    var phoneNumber by remember { mutableStateOf(tokenStorage.getPhone() ?: "") }
    var isLoading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var token by remember { mutableStateOf(tokenStorage.getToken() ?: "") }
    var userId by remember { mutableStateOf(tokenStorage.getUserId() ?: "") }
    var displayName by remember { mutableStateOf(tokenStorage.getDisplayName() ?: "") }
    var conversations by remember { mutableStateOf<List<Conversation>>(emptyList()) }
    var searchResults by remember { mutableStateOf<List<ContactUser>>(emptyList()) }
    var activeConversation by remember { mutableStateOf<Conversation?>(null) }

    fun loadConversations() {
        if (token.isEmpty()) return
        scope.launch {
            val result = withContext(Dispatchers.IO) { api.getConversations(token) }
            conversations = result
        }
    }

    LaunchedEffect(currentScreen) {
        if (currentScreen == AppScreen.MAIN) { loadConversations() }
        if ((currentScreen == AppScreen.MAIN || currentScreen == AppScreen.CHAT) && token.isEmpty()) { currentScreen = AppScreen.PHONE }
    }

    when (currentScreen) {
        AppScreen.SPLASH -> SplashScreen(onSplashDone = {
            currentScreen = if (tokenStorage.hasToken()) AppScreen.MAIN else AppScreen.PHONE
        })

        AppScreen.PHONE -> PhoneScreen(
            onSendOtp = { phone ->
                if (phone.replace("\\D".toRegex(), "").length < 7) { error = "Enter a valid phone number"; return@PhoneScreen }
                isLoading = true; error = null
                scope.launch {
                    val result = withContext(Dispatchers.IO) { api.requestOtp(phone) }
                    isLoading = false
                    if (result.isOk()) {
                        phoneNumber = phone
                        // Set language from server response
                        val langStr = result.json.optString("lang", "en")
                        val lang = when (langStr) { "tr" -> PingleLanguage.TURKISH; "th" -> PingleLanguage.THAI; "ru" -> PingleLanguage.RUSSIAN; "zh" -> PingleLanguage.CHINESE; else -> PingleLanguage.ENGLISH }
                        onLanguageChanged(lang)
                        currentScreen = AppScreen.OTP
                    } else error = result.error()
                }
            },
            isLoading = isLoading, error = error,
            onLegalClick = { currentScreen = AppScreen.LEGAL_INFO }
        )

        AppScreen.OTP -> OtpScreen(
            phoneNumber = phoneNumber,
            onVerify = { otp ->
                if (otp.length != 6) { error = "Enter 6-digit code"; return@OtpScreen }
                isLoading = true; error = null
                scope.launch {
                    val result = withContext(Dispatchers.IO) { api.verifyOtp(phoneNumber, otp) }
                    isLoading = false
                    if (result.isOk()) {
                        token = result.json.optString("token", "")
                        userId = result.json.optJSONObject("user")?.optString("id", "") ?: ""
                        val name = result.json.optJSONObject("user")?.optString("displayName", "") ?: ""
                        tokenStorage.saveToken(token); tokenStorage.saveUserId(userId); tokenStorage.savePhone(phoneNumber)
                        val langStr = result.json.optString("lang", "en")
                        val lang = when (langStr) { "tr" -> PingleLanguage.TURKISH; "th" -> PingleLanguage.THAI; "ru" -> PingleLanguage.RUSSIAN; "zh" -> PingleLanguage.CHINESE; else -> PingleLanguage.ENGLISH }
                        onLanguageChanged(lang)
                        if (name.isNotBlank()) { displayName = name; currentScreen = AppScreen.MAIN }
                        else currentScreen = AppScreen.PROFILE
                    } else error = result.error()
                }
            },
            onResend = {
                isLoading = true; error = null
                scope.launch {
                    val result = withContext(Dispatchers.IO) { api.requestOtp(phoneNumber) }
                    isLoading = false; if (!result.isOk()) error = result.error()
                }
            },
            isLoading = isLoading, error = error
        )

        AppScreen.PROFILE -> ProfileSetupScreen(
            onSave = { name, about ->
                if (name.trim().length < 2) { error = "Name must be at least 2 characters"; return@ProfileSetupScreen }
                isLoading = true; error = null
                scope.launch {
                    val result = withContext(Dispatchers.IO) { api.updateProfile(token, name, about) }
                    isLoading = false
                    if (result.isOk()) { displayName = name; tokenStorage.saveDisplayName(name); currentScreen = AppScreen.MAIN }
                    else error = result.error()
                }
            },
            isLoading = isLoading, error = error
        )

        AppScreen.MAIN -> HomeScreen(
            conversations = conversations,
            onChatClick = { conv -> activeConversation = conv; currentScreen = AppScreen.CHAT },
            onAddContact = { currentScreen = AppScreen.ADD_CONTACT },
            onLogout = { token = ""; tokenStorage.clear(); conversations = emptyList(); currentScreen = AppScreen.PHONE },
            currentLanguage = currentLang,
            onLanguageChange = onLanguageChanged
        )

        AppScreen.ADD_CONTACT -> AddContactScreen(
            searchResults = searchResults,
            onSearch = { query ->
                if (query.length < 3) { searchResults = emptyList(); return@AddContactScreen }
                scope.launch {
                    val result = withContext(Dispatchers.IO) { api.searchUsers(token, query) }
                    searchResults = result
                }
            },
            onAddContact = { user ->
                scope.launch {
                    withContext(Dispatchers.IO) { api.addContact(token, user.id) }
                    val conv = withContext(Dispatchers.IO) { api.createConversation(token, user.id) }
                    if (conv != null) { activeConversation = conv; currentScreen = AppScreen.CHAT; loadConversations() }
                }
            },
            onBack = { searchResults = emptyList(); currentScreen = AppScreen.MAIN },
            isLoading = false, error = null
        )

        AppScreen.CHAT -> {
            val convId = activeConversation?.id ?: ""
            val appState = remember(convId) { PingleAppState(activity, token, userId, displayName, api, convId) }
            DisposableEffect(convId) {
                appState.connect()
                onDispose { appState.disconnect() }
            }
            LaunchedEffect(convId) { appState.markRead() }
            Column {
                Surface(modifier = Modifier.fillMaxWidth(), color = androidx.compose.material3.MaterialTheme.colorScheme.surface) {
                    Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = { currentScreen = AppScreen.MAIN }) {
                            Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = androidx.compose.material3.MaterialTheme.colorScheme.onSurface)
                        }
                        Text(activeConversation?.otherUser?.displayName ?: activeConversation?.otherUser?.phoneNumber ?: "Chat", color = androidx.compose.material3.MaterialTheme.colorScheme.onSurface, fontSize = 18.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                        IconButton(onClick = { appState.startCall("voice") }) {
                            Icon(Icons.Default.Call, contentDescription = "Voice call", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        IconButton(onClick = { appState.startCall("video") }) {
                            Icon(Icons.Default.Videocam, contentDescription = "Video call", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
                PingleApp(appState)
            }
        }

        AppScreen.LEGAL_INFO -> LegalInfoScreen(onBack = { currentScreen = AppScreen.PHONE })
    }
}
