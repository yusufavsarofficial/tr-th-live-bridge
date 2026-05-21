const { Router } = require("express");
const crypto = require("crypto");
const { requireAuth } = require("../middleware/auth");
const { detectSourceLanguage } = require("../services/translate");

function createConversationRouter(storage, fcmPushService) {
  const router = Router();
  router.use(requireAuth);

  router.get("/", async (req, res) => {
    const conversations = await storage.getConversations(req.user.sub);
    res.json({ ok: true, conversations });
  });

  router.post("/", async (req, res) => {
    const { participantId } = req.body || {};
    if (!participantId) return res.status(400).json({ ok: false, error: "participantId is required." });
    if (participantId === req.user.sub) return res.status(400).json({ ok: false, error: "Cannot chat with yourself." });
    const conv = await storage.createConversation([req.user.sub, participantId]);
    res.json({ ok: true, conversation: conv });
  });

  router.post("/:conversationId/messages", async (req, res) => {
    const conv = await storage.getConversationById(req.params.conversationId);
    if (!conv) return res.status(404).json({ ok: false, error: "Conversation not found" });
    if (!conv.participants.includes(req.user.sub)) return res.status(403).json({ ok: false, error: "Not a participant" });

    const rawText = String(req.body?.text || "").trim();
    const imageData = String(req.body?.imageData || "").trim();
    if (!rawText && !imageData) return res.status(400).json({ ok: false, error: "Message text or image required" });
    if (imageData && !imageData.startsWith("data:image/")) return res.status(400).json({ ok: false, error: "Invalid image data" });

    const user = await storage.findUserById(req.user.sub);
    const sourceLang = rawText ? detectSourceLanguage(rawText) : null;
    const message = {
      id: crypto.randomUUID(),
      conversationId: req.params.conversationId,
      from: req.user.sub,
      fromName: user?.displayName || user?.phoneNumber || "Unknown",
      text: rawText.slice(0, 4000),
      translatedText: null,
      sourceLang,
      imageData: imageData || null,
      timestamp: Date.now(),
      status: "sent",
    };

    await storage.saveMessage(req.params.conversationId, message);
    await storage.updateConversation(req.params.conversationId, {
      lastMessage: rawText.slice(0, 100) || (imageData ? "Photo" : ""),
      lastMessageSender: req.user.sub,
      unreadCount: buildUnreadCount(conv, req.user.sub),
    });

    res.json({ ok: true, message });
  });

  router.get("/:conversationId/messages", async (req, res) => {
    const conv = await storage.getConversationById(req.params.conversationId);
    if (!conv) return res.status(404).json({ ok: false, error: "Conversation not found" });
    if (!conv.participants.includes(req.user.sub)) return res.status(403).json({ ok: false, error: "Not a participant" });

    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
    const before = req.query.before ? parseInt(req.query.before) : null;

    let messages = await storage.getMessages(req.params.conversationId);
    if (before) messages = messages.filter(m => m.timestamp < before);
    messages.sort((a, b) => a.timestamp - b.timestamp);
    messages = messages.slice(-limit);

    res.json({ ok: true, messages });
  });

  router.post("/:conversationId/read", async (req, res) => {
    const conv = await storage.getConversationById(req.params.conversationId);
    if (!conv) return res.status(404).json({ ok: false, error: "Conversation not found" });

    const unreadCount = { ...(conv.unreadCount || {}) };
    unreadCount[req.user.sub] = 0;
    await storage.updateConversation(req.params.conversationId, { unreadCount });

    res.json({ ok: true });
  });

  router.post("/:conversationId/urgent-alert", async (req, res) => {
    const conv = await storage.getConversationById(req.params.conversationId);
    if (!conv) return res.status(404).json({ ok: false, error: "Conversation not found" });
    if (!conv.participants.includes(req.user.sub)) return res.status(403).json({ ok: false, error: "Not a participant" });

    const targetUserId = conv.participants.find((id) => id !== req.user.sub);
    if (!targetUserId) return res.status(400).json({ ok: false, error: "No recipient in this conversation." });

    const sender = await storage.findUserById(req.user.sub);
    const tokens = await storage.getFcmTokens(targetUserId);
    if (!fcmPushService?.isReady() || tokens.length === 0) {
      return res.json({ ok: true, delivered: 0, warning: "Recipient has no active push token." });
    }

    const title = "Nova acil uyari";
    const body = `${sender?.displayName || sender?.phoneNumber || "Nova"} sizi acil olarak ariyor.`;
    const result = await fcmPushService.sendToMultiple(tokens, title, body, {
      type: "urgent",
      urgent: "true",
      conversationId: req.params.conversationId,
      senderId: req.user.sub,
      title,
      body,
    });

    res.json({ ok: true, delivered: result.succeeded || 0, failed: result.failed || 0 });
  });

  return router;
}

function buildUnreadCount(conv, senderId) {
  const current = { ...(conv.unreadCount || {}) };
  for (const pid of conv.participants) {
    if (pid !== senderId) {
      current[pid] = (current[pid] || 0) + 1;
    }
  }
  return current;
}

module.exports = { createConversationRouter };
