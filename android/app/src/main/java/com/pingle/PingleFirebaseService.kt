package com.pingle

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.net.HttpURLConnection
import java.net.URL

class PingleFirebaseService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        val prefs = getSharedPreferences("pingle_prefs", Context.MODE_PRIVATE)
        val savedToken = prefs.getString("fcm_token", null)
        if (token != savedToken) {
            prefs.edit().putString("fcm_token", token).apply()
            registerTokenWithBackend(token)
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val title = message.notification?.title ?: message.data["title"] ?: "Nova"
        val body = message.notification?.body ?: message.data["body"] ?: "New message"
        val conversationId = message.data["conversationId"] ?: ""
        val senderId = message.data["senderId"] ?: ""

        showNotification(title, body, conversationId, senderId)
    }

    private fun showNotification(title: String, body: String, conversationId: String, senderId: String) {
        val channelId = "pingle_messages"
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId, "Messages",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Nova message notifications"
                enableVibration(true)
            }
            manager.createNotificationChannel(channel)
        }

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("conversationId", conversationId)
            putExtra("senderId", senderId)
        }

        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .build()

        manager.notify(System.currentTimeMillis().toInt(), notification)
    }

    companion object {
        fun registerTokenWithBackend(token: String) {
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val prefs = getAppContext()?.getSharedPreferences("pingle_prefs", Context.MODE_PRIVATE)
                    val jwt = prefs?.getString("jwt_token", null) ?: return@launch
                    val baseUrl = prefs.getString("backend_url", "http://10.0.2.2:3000") ?: return@launch

                    val url = URL("$baseUrl/api/v1/notifications/fcm/register")
                    val conn = url.openConnection() as HttpURLConnection
                    conn.requestMethod = "POST"
                    conn.setRequestProperty("Content-Type", "application/json")
                    conn.setRequestProperty("Authorization", "Bearer $jwt")
                    conn.doOutput = true
                    conn.outputStream.write("{\"token\":\"$token\",\"platform\":\"android\"}".toByteArray())
                    conn.outputStream.flush()
                    conn.outputStream.close()
                    conn.responseCode
                    conn.disconnect()
                } catch (_: Exception) { }
            }
        }

        private var appContext: Context? = null
        fun init(context: Context) { appContext = context }
        fun getAppContext(): Context? = appContext
    }
}
