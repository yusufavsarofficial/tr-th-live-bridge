const crypto = require("crypto");

function createSocketHandlers(io, config, history, pushSubscriptions, vapidKeys, storage, pushService) {
  const usersBySocket = new Map();
  const lastSeenByName = new Map();
  const offlineEvents = [];
  const OFFLINE_EVENT_MAX = 40;
  let pendingCallOffer = null;

  function setup() {
    io.on("connection", (socket) => {
      socket.emit("server:hello", {
        maxUsers: config.maxUsers,
        maxMessageLength: config.maxMessageLength,
        roomCodeRequired: Boolean(config.roomCode),
        roomPinRequired: Boolean(config.roomPin),
        iceServers: config.rtcIceServers,
      });

      socket.on("join", (payload, ack) => handleJoin(socket, payload, ack));
      socket.on("message", (payload, ack) => handleMessage(socket, payload, ack));
      socket.on("typing", (isTyping) => handleTyping(socket, isTyping));
      socket.on("call:offer", (payload, ack) => handleCallOffer(socket, payload, ack));
      socket.on("call:answer", (payload, ack) => handleCallAnswer(socket, payload, ack));
      socket.on("call:ice-candidate", (payload) => handleIceCandidate(socket, payload));
      socket.on("call:end", (payload) => handleCallEnd(socket, payload));
      socket.on("disconnect", () => handleDisconnect(socket));
    });
  }

  function handleJoin(socket, payload, ack) {
    const name = String(payload?.name || "").trim().replace(/\s+/g, " ").slice(0, 24);
    const NAME_REGEX = /^[\p{L}0-9 ._-]{2,24}$/u;
    if (!name) return ack?.({ ok: false, error: "Name is required." });
    if (!NAME_REGEX.test(name)) return ack?.({ ok: false, error: "Name must be 2-24 chars and can include letters, numbers, dot, underscore, dash." });
    if (config.roomCode && String(payload?.roomCode || "").trim() !== config.roomCode) return ack?.({ ok: false, error: "Invalid room code." });
    if (config.roomPin && String(payload?.roomPin || "").trim() !== config.roomPin) return ack?.({ ok: false, error: "Invalid room PIN." });
    if (usersBySocket.has(socket.id)) return ack?.({ ok: false, error: "Already joined." });
    if (usersBySocket.size >= config.maxUsers) return ack?.({ ok: false, error: "Room is full. Only 2 users can join." });

    const duplicate = Array.from(usersBySocket.values()).some(u => u.name.toLowerCase() === name.toLowerCase());
    if (duplicate) return ack?.({ ok: false, error: "This name is already in use." });

    const avatarUrl = String(payload?.avatarUrl || "").trim();
    usersBySocket.set(socket.id, { name, avatarUrl, joinedAt: Date.now() });
    socket.join("pingle-room");

    ack?.({ ok: true, me: { name, avatarUrl }, users: getPublicUsers(), maxUsers: config.maxUsers, maxMessageLength: config.maxMessageLength, history, roomCodeRequired: Boolean(config.roomCode), roomPinRequired: Boolean(config.roomPin) });

    emitRoster();
    deliverOfflineEvents(socket, name);
  }

  function handleMessage(socket, rawPayload, ack) {
    const user = usersBySocket.get(socket.id);
    if (!user) return ack?.({ ok: false, error: "Join first." });

    const { createTranslationService } = require("../services/translate");
    const translator = createTranslationService(config);

    const rawText = rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload) ? rawPayload.text : rawPayload;
    const rawAttachment = rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload) ? rawPayload.attachment : null;
    const text = String(rawText || "").replace(/\s+/g, " ").trim().slice(0, config.maxMessageLength);
    const attachment = normalizeAttachment(rawAttachment);

    if (!text && !attachment) return ack?.({ ok: false, error: "Message cannot be empty." });

    const bilingual = text ? translator.makeImmediateBilingualText(text) : { trText: "", thText: "", sourceLang: "tr", primaryLang: "tr", primaryText: "", secondaryLang: "th", secondaryText: "" };

    const message = {
      id: crypto.randomUUID(),
      from: user.name,
      fromAvatar: user.avatarUrl,
      text, trText: bilingual.trText, thText: bilingual.thText,
      sourceLang: bilingual.sourceLang, primaryLang: bilingual.primaryLang, primaryText: bilingual.primaryText,
      secondaryLang: bilingual.secondaryLang, secondaryText: bilingual.secondaryText,
      translationPending: Boolean(text), translationError: false,
      attachment, timestamp: Date.now(),
    };

    pushHistory(message);
    io.to("pingle-room").emit("message", message);

    const shouldNotifyOffline = !hasOtherOnlineUser(socket.id);
    if (shouldNotifyOffline) {
      rememberOfflineEvent({ type: "message", from: { name: user.name, avatarUrl: user.avatarUrl }, messageId: message.id, body: text || attachment?.name || "Yeni medya mesajı" });
    }
    ack?.({ ok: true, id: message.id });

    if (text) {
      translator.makeBilingualText(text).then((translated) => {
        const updated = updateHistoryMessage(message.id, { trText: translated.trText, thText: translated.thText, sourceLang: translated.sourceLang, primaryLang: translated.primaryLang, primaryText: translated.primaryText, secondaryLang: translated.secondaryLang, secondaryText: translated.secondaryText, translationPending: false, translationError: false });
        if (updated) {
          io.to("pingle-room").emit("message:update", updated);
          if (shouldNotifyOffline) sendPushForMessage(updated);
        }
      }).catch(() => {
        const updated = updateHistoryMessage(message.id, { translationPending: false, translationError: true });
        if (updated) {
          io.to("pingle-room").emit("message:update", updated);
          if (shouldNotifyOffline) sendPushForMessage(updated);
        }
      });
    } else if (shouldNotifyOffline) {
      sendPushForMessage(message);
    }
  }

  function handleTyping(socket, isTyping) {
    const user = usersBySocket.get(socket.id);
    if (!user) return;
    socket.to("pingle-room").emit("typing", { name: user.name, isTyping: Boolean(isTyping), timestamp: Date.now() });
  }

  function handleCallOffer(socket, payload, ack) {
    const user = findUserBySocketId(socket.id);
    if (!user) return ack?.({ ok: false, error: "Join first." });

    const offerPayload = { from: user, mode: payload?.mode === "voice" ? "voice" : "video", sdp: payload?.sdp, timestamp: Date.now() };
    const hasTarget = hasOtherOnlineUser(socket.id);
    if (hasTarget) {
      socket.to("pingle-room").emit("call:offer", offerPayload);
    } else {
      pendingCallOffer = { fromSocketId: socket.id, offer: offerPayload, expiresAt: Date.now() + config.callOfferTtlMs };
      rememberOfflineEvent({ type: "call", from: user, mode: offerPayload.mode, body: offerPayload.mode === "voice" ? "Sesli arama" : "Görüntülü arama" });
      sendPushForCall(offerPayload);
    }
    socket.emit("call:ringing", { mode: offerPayload.mode, queued: !hasTarget, timestamp: offerPayload.timestamp });
    ack?.({ ok: true, queued: !hasTarget });
  }

  function handleCallAnswer(socket, payload, ack) {
    const user = findUserBySocketId(socket.id);
    if (!user) return ack?.({ ok: false, error: "Join first." });
    socket.to("pingle-room").emit("call:answer", { from: user, sdp: payload?.sdp, timestamp: Date.now() });
    pendingCallOffer = null;
    ack?.({ ok: true });
  }

  function handleIceCandidate(socket, payload) {
    const user = findUserBySocketId(socket.id);
    if (!user || !payload?.candidate) return;
    socket.to("pingle-room").emit("call:ice-candidate", { from: user, candidate: payload.candidate, timestamp: Date.now() });
  }

  function handleCallEnd(socket, payload) {
    const user = findUserBySocketId(socket.id);
    if (!user) return;
    socket.to("pingle-room").emit("call:end", { from: user, reason: String(payload?.reason || "ended"), timestamp: Date.now() });
    clearPendingCallForSocket(socket.id);
  }

  function handleDisconnect(socket) {
    const user = usersBySocket.get(socket.id);
    if (!user) return;
    usersBySocket.delete(socket.id);
    lastSeenByName.set(user.name.toLowerCase(), Date.now());
    clearPendingCallForSocket(socket.id);
    socket.to("pingle-room").emit("typing", { name: user.name, isTyping: false, timestamp: Date.now() });
    socket.to("pingle-room").emit("call:end", { from: { name: user.name, avatarUrl: user.avatarUrl }, reason: "disconnect", timestamp: Date.now() });
    emitRoster();
  }

  function normalizeAttachment(raw) {
    if (!raw || typeof raw !== "object") return null;
    const dataUrl = String(raw.dataUrl || "");
    const size = Number(raw.size) || 0;
    if (!dataUrl.startsWith("data:") || size <= 0 || size > config.maxAttachmentBytes) return null;
    return { name: String(raw.name || "dosya").slice(0, 80), mimeType: String(raw.mimeType || "").slice(0, 80), dataUrl, size, kind: ["image", "audio", "file"].includes(raw.kind) ? raw.kind : "file" };
  }

  function getPublicUsers() {
    return Array.from(usersBySocket.values()).map(u => ({ name: u.name, avatarUrl: u.avatarUrl }));
  }

  function findUserBySocketId(socketId) {
    const user = usersBySocket.get(socketId);
    return user ? { name: user.name, avatarUrl: user.avatarUrl } : null;
  }

  function hasOtherOnlineUser(socketId) {
    return Array.from(usersBySocket.keys()).some(id => id !== socketId);
  }

  function emitRoster() {
    const users = getPublicUsers();
    io.to("pingle-room").emit("users", { users, maxUsers: config.maxUsers, onlineCount: users.length });
  }

  function emitSystem(text, key = "", vars = {}) {
    // Join/leave banners are intentionally suppressed for a cleaner daily chat UI.
  }

  function pushHistory(message) {
    history.push(message);
    if (history.length > config.maxHistory) history.splice(0, history.length - config.maxHistory);
    storage.persistHistory(history);
  }

  function updateHistoryMessage(messageId, patch) {
    const index = history.findIndex(m => m.id === messageId);
    if (index === -1) return null;
    history[index] = { ...history[index], ...patch };
    storage.persistHistory(history);
    return history[index];
  }

  function clearHistory() {
    history.splice(0, history.length);
    storage.persistHistory(history);
  }

  function rememberOfflineEvent(event) {
    offlineEvents.push({ id: crypto.randomUUID(), timestamp: Date.now(), ...event });
    if (offlineEvents.length > OFFLINE_EVENT_MAX) offlineEvents.splice(0, offlineEvents.length - OFFLINE_EVENT_MAX);
  }

  function clearPendingCallForSocket(socketId) {
    if (pendingCallOffer?.fromSocketId === socketId) pendingCallOffer = null;
  }

  function deliverOfflineEvents(socket, name) {
    const key = name.toLowerCase();
    const since = lastSeenByName.has(key) ? lastSeenByName.get(key) : 0;
    const events = offlineEvents.filter(e => e.timestamp > since && e.from?.name?.toLowerCase() !== key).slice(-8);
    if (events.length) socket.emit("offline:events", { events, timestamp: Date.now() });
    if (pendingCallOffer && pendingCallOffer.expiresAt > Date.now() && pendingCallOffer.fromSocketId !== socket.id && usersBySocket.has(pendingCallOffer.fromSocketId)) {
      socket.emit("call:offer", pendingCallOffer.offer);
    } else if (pendingCallOffer && pendingCallOffer.expiresAt <= Date.now()) {
      pendingCallOffer = null;
    }
  }

  function sendPushForMessage(message) { sendPushToOfflineSubscribers(message.from, (lang) => ({ type: "message", title: message.from || "Yeni mesaj", body: (lang === "th" ? message.thText : message.trText || message.primaryText || message.text || "Yeni medya mesajı").slice(0, 180), tag: `message-${message.id}`, url: "/", timestamp: Date.now() })); }

  function sendPushForCall(offerPayload) { sendPushToOfflineSubscribers(offerPayload.from?.name, (lang) => ({ type: "call", title: offerPayload.from?.name || "Nova", body: offerPayload.mode === "voice" ? "Sesli arama geliyor" : "Görüntülü arama geliyor", tag: `call-${offerPayload.timestamp}`, url: "/", mode: offerPayload.mode, timestamp: Date.now() })); }

  function sendPushToOfflineSubscribers(excludeName, factory) {
    const senderKey = String(excludeName || "").trim().toLowerCase();
    const targets = Array.from(pushSubscriptions.values()).filter(r => { const k = String(r.name || "").trim().toLowerCase(); return !k || k !== senderKey; });
    targets.forEach((record) => {
      pushService.sendPush(record.subscription, factory(record.lang === "th" ? "th" : "tr"), config.pushTtlSeconds);
    });
  }

  return { setup, getPublicUsers, findUserBySocketId, hasOtherOnlineUser, emitRoster, emitSystem, clearHistory, usersBySocket };
}

module.exports = { createSocketHandlers };
