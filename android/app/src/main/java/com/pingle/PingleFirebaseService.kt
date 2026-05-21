package com.pingle

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class PingleFirebaseService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        val prefs = getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE)
        val savedToken = prefs.getString(KEY_FCM_TOKEN, null)
        if (token != savedToken) {
            prefs.edit().putString(KEY_FCM_TOKEN, token).apply()
        }
        registerTokenWithBackend(applicationContext, token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        createNotificationChannels(applicationContext)

        val type = message.data["type"] ?: "message"
        val isUrgent = type == "urgent" || message.data["urgent"] == "true"
        val title = message.notification?.title ?: message.data["title"] ?: if (isUrgent) "Nova urgent alert" else "Nova"
        val body = message.notification?.body ?: message.data["body"] ?: if (isUrgent) "Open Nova now." else "New message"
        val conversationId = message.data["conversationId"] ?: ""
        val senderId = message.data["senderId"] ?: ""

        showNotification(title, body, conversationId, senderId, type, isUrgent)
    }

    private fun showNotification(
        title: String,
        body: String,
        conversationId: String,
        senderId: String,
        type: String,
        isUrgent: Boolean,
    ) {
        if (isUrgent) wakeScreenForUrgent()

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = when {
            isUrgent -> CHANNEL_URGENT
            type == "call" -> CHANNEL_CALLS
            else -> CHANNEL_MESSAGES
        }

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("conversationId", conversationId)
            putExtra("senderId", senderId)
            putExtra("notificationType", type)
        }

        val requestCode = (System.currentTimeMillis() % Int.MAX_VALUE).toInt()
        val pendingIntent = PendingIntent.getActivity(
            this,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val soundUri = if (isUrgent) {
            RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        } else {
            RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        }
        val vibration = if (isUrgent) {
            longArrayOf(0, 380, 120, 420, 140, 720, 180, 900)
        } else {
            longArrayOf(0, 160, 90, 160)
        }

        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.nova_icon)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setPriority(if (isUrgent) NotificationCompat.PRIORITY_MAX else NotificationCompat.PRIORITY_HIGH)
            .setCategory(if (isUrgent) NotificationCompat.CATEGORY_ALARM else if (type == "call") NotificationCompat.CATEGORY_CALL else NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setSound(soundUri)
            .setVibrate(vibration)
            .setContentIntent(pendingIntent)
            .setFullScreenIntent(pendingIntent, isUrgent || type == "call")
            .build()

        manager.notify(requestCode, notification)
    }

    @Suppress("DEPRECATION")
    private fun wakeScreenForUrgent() {
        try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            val wakeLock = powerManager.newWakeLock(
                PowerManager.FULL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
                "Pingle:urgent-alert",
            )
            wakeLock.acquire(10_000L)
        } catch (_: Exception) {
            // Wake locks are best-effort and can be restricted by the device.
        }
    }

    companion object {
        private const val PUSH_PREFS = "pingle_push"
        private const val AUTH_PREFS = "pingle_auth"
        private const val LEGACY_PREFS = "pingle_prefs"
        private const val KEY_FCM_TOKEN = "fcm_token"
        private const val CHANNEL_MESSAGES = "pingle_messages"
        private const val CHANNEL_CALLS = "pingle_calls"
        private const val CHANNEL_URGENT = "pingle_urgent"

        private var appContext: Context? = null

        fun init(context: Context) {
            appContext = context.applicationContext
            createNotificationChannels(context.applicationContext)
            syncPushToken(context.applicationContext)
        }

        fun syncPushToken(context: Context? = appContext) {
            val safeContext = context?.applicationContext ?: return
            appContext = safeContext
            FirebaseMessaging.getInstance().token
                .addOnSuccessListener { token ->
                    if (!token.isNullOrBlank()) {
                        safeContext.getSharedPreferences(PUSH_PREFS, Context.MODE_PRIVATE)
                            .edit()
                            .putString(KEY_FCM_TOKEN, token)
                            .apply()
                        registerTokenWithBackend(safeContext, token)
                    }
                }
        }

        fun registerTokenWithBackend(token: String) {
            val safeContext = appContext ?: return
            registerTokenWithBackend(safeContext, token)
        }

        fun registerTokenWithBackend(context: Context, token: String) {
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val authPrefs = context.getSharedPreferences(AUTH_PREFS, Context.MODE_PRIVATE)
                    val legacyPrefs = context.getSharedPreferences(LEGACY_PREFS, Context.MODE_PRIVATE)
                    val jwt = authPrefs.getString("jwt", null)
                        ?: legacyPrefs.getString("jwt_token", null)
                        ?: return@launch
                    val baseUrl = legacyPrefs.getString("backend_url", BuildConfig.BACKEND_URL) ?: BuildConfig.BACKEND_URL

                    val url = URL("$baseUrl/api/v1/notifications/fcm/register")
                    val conn = url.openConnection() as HttpURLConnection
                    conn.requestMethod = "POST"
                    conn.connectTimeout = 8000
                    conn.readTimeout = 8000
                    conn.setRequestProperty("Content-Type", "application/json")
                    conn.setRequestProperty("Authorization", "Bearer $jwt")
                    conn.doOutput = true
                    val payload = JSONObject()
                        .put("token", token)
                        .put("platform", "android")
                        .toString()
                    conn.outputStream.use { it.write(payload.toByteArray()) }
                    if (conn.responseCode !in 200..299) {
                        conn.errorStream?.close()
                    } else {
                        conn.inputStream?.close()
                    }
                    conn.disconnect()
                } catch (_: Exception) {
                    // Push registration should not block app login or chat.
                }
            }
        }

        fun createNotificationChannels(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val messageSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            val alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            val notificationAudio = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            val alarmAudio = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()

            val messages = NotificationChannel(CHANNEL_MESSAGES, "Nova messages", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Nova message notifications"
                enableVibration(true)
                setSound(messageSound, notificationAudio)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            val calls = NotificationChannel(CHANNEL_CALLS, "Nova calls", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Incoming Nova calls"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 220, 90, 220, 90, 320)
                setSound(messageSound, notificationAudio)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            val urgent = NotificationChannel(CHANNEL_URGENT, "Nova urgent alerts", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Emergency alerts from your Nova contact"
                enableLights(true)
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 380, 120, 420, 140, 720, 180, 900)
                setBypassDnd(true)
                setSound(alarmSound, alarmAudio)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }

            manager.createNotificationChannels(listOf(messages, calls, urgent))
        }
    }
}
