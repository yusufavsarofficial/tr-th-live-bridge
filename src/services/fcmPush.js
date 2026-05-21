/**
 * Firebase Cloud Messaging push notification service.
 * Gracefully handles missing Firebase config.
 */
let _fcmApp = null;
let _messaging = null;
let _ready = false;

function createFcmPushService(config) {
  function initialize() {
    try {
      const admin = require("firebase-admin");
      const serviceAccountPath = config.fcmServiceAccountPath || process.env.FCM_SERVICE_ACCOUNT_PATH || "";

      if (serviceAccountPath) {
        const serviceAccount = require(serviceAccountPath);
        _fcmApp = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      } else if (process.env.FCM_PROJECT_ID) {
        _fcmApp = admin.initializeApp({ projectId: process.env.FCM_PROJECT_ID });
      } else {
        console.warn("FCM: No Firebase config found. Push notifications disabled.");
        _ready = false;
        return;
      }

      _messaging = admin.messaging();
      _ready = true;
      console.log("FCM: Initialized with project", _fcmApp.options.projectId || "unknown");
    } catch (e) {
      console.warn("FCM: Failed to initialize:", e.message);
      _ready = false;
    }
  }

  function isReady() { return _ready; }

  async function sendPush(userId, title, body, data = {}) {
    if (!_ready) return { error: "FCM not initialized" };
    try {
      const type = String(data.type || "message");
      const isUrgent = type === "urgent" || data.urgent === "true";
      const message = {
        token: userId, // userId is actually the FCM token here
        notification: { title, body },
        data: {
          ...Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)])),
          type,
          title,
          body,
          click_action: "OPEN_CHAT",
        },
        android: {
          priority: "high",
          ttl: isUrgent ? 300000 : 86400000,
          notification: {
            channelId: isUrgent ? "pingle_urgent" : type === "call" ? "pingle_calls" : "pingle_messages",
            priority: "max",
            sound: "default",
            visibility: "public",
            defaultVibrateTimings: !isUrgent,
            eventTimestamp: new Date(),
          },
        },
      };
      const response = await _messaging.send(message);
      return { ok: true, messageId: response };
    } catch (e) {
      if (e.code === "messaging/registration-token-not-registered") return { error: "unregistered" };
      console.error("FCM send error:", e.message);
      return { error: e.message };
    }
  }

  async function sendToUser(fcmToken, title, body, data = {}) {
    return sendPush(fcmToken, title, body, data);
  }

  async function sendToMultiple(fcmTokens, title, body, data = {}) {
    if (!_ready || fcmTokens.length === 0) return { ok: false };
    const results = await Promise.allSettled(fcmTokens.map(t => sendPush(t, title, body, data)));
    const succeeded = results.filter(r => r.status === "fulfilled" && r.value.ok).length;
    const failed = results.filter(r => r.status === "fulfilled" && !r.value.ok).length;
    return { ok: succeeded > 0, succeeded, failed };
  }

  return { initialize, isReady, sendPush, sendToUser, sendToMultiple };
}

module.exports = { createFcmPushService };
