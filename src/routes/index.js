const { Router } = require("express");
const { config } = require("../config");
const { createError } = require("../middleware/errorHandler");

function createApiRouter(io, history, pushSubscriptions, vapidKeys, persistNotificationState, pushSubscriptionsMap, getPublicUsers, clearHistory, emitSystem, storage) {
  const router = Router();

  router.get("/history", (_req, res) => {
    res.json({ ok: true, total: history.length, history });
  });

  router.get("/rtc-config", (_req, res) => {
    res.json({ ok: true, iceServers: config.rtcIceServers });
  });

  router.get("/notifications/config", (_req, res) => {
    res.json({ ok: true, publicKey: vapidKeys?.publicKey || "" });
  });

  // FCM token registration
  router.post("/notifications/fcm/register", (req, res) => {
    const { token, platform } = req.body || {};
    if (!token) return res.status(400).json({ ok: false, error: "FCM token is required." });
    storage.saveFcmToken(req.user.sub, token, platform || "android");
    res.json({ ok: true });
  });

  router.post("/notifications/fcm/unregister", (req, res) => {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ ok: false, error: "FCM token is required." });
    storage.removeFcmToken(token);
    res.json({ ok: true });
  });

  router.post("/notifications/subscribe", (req, res) => {
    const sub = req.body?.subscription;
    if (!sub || !sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      res.status(400).json({ ok: false, error: "Invalid push subscription." });
      return;
    }
    pushSubscriptions.set(sub.endpoint, {
      name: String(req.body?.name || "").trim().slice(0, 24),
      lang: req.body?.lang === "th" ? "th" : "tr",
      subscription: sub,
      updatedAt: Date.now(),
    });
    persistNotificationState();
    res.json({ ok: true });
  });

  router.post("/notifications/unsubscribe", (req, res) => {
    const endpoint = String(req.body?.endpoint || req.body?.subscription?.endpoint || "");
    if (endpoint) pushSubscriptions.delete(endpoint);
    persistNotificationState();
    res.json({ ok: true });
  });

  router.post("/history/clear", (req, res) => {
    const pin = String(req.body?.roomPin || "").trim();
    if (config.roomPin && pin !== config.roomPin) {
      throw createError(403, "Invalid room PIN.");
    }
    clearHistory();
    emitSystem("Sohbet gecmisi temizlendi.", "systemHistoryCleared");
    res.json({ ok: true, cleared: history.length });
  });

  return router;
}

function createHealthRouter(getPublicUsers) {
  const router = Router();
  router.get("/", (_req, res) => {
    res.json({
      ok: true,
      app: "Nova",
      now: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      usersOnline: getPublicUsers().length,
      maxUsers: config.maxUsers,
      messageCount: 0,
    });
  });
  return router;
}

module.exports = { createApiRouter, createHealthRouter };
