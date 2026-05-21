const crypto = require("crypto");

function createConversationHandlers(io, storage, fcmPushService) {

  function setup(socket) {
    socket.on("join:conversation", (payload, ack) => handleJoinConversation(socket, payload, ack));
    socket.on("leave:conversation", (payload) => handleLeaveConversation(socket, payload));
    socket.on("conversation:message", (payload, ack) => handleConversationMessage(socket, payload, ack));
    socket.on("conversation:typing", (payload) => handleConversationTyping(socket, payload));
    socket.on("conversation:read", (payload) => handleConversationRead(socket, payload));
    socket.on("call:offer", (payload, ack) => handleCallOffer(socket, payload, ack));
    socket.on("call:answer", (payload, ack) => handleCallAnswer(socket, payload, ack));
    socket.on("call:end", (payload) => handleCallEnd(socket, payload));
    socket.on("call:frame", (payload) => handleCallFrame(socket, payload));
    socket.on("call:audio", (payload) => handleCallAudio(socket, payload));
  }

  function handleJoinConversation(socket, payload, ack) {
    const convId = String(payload?.conversationId || "").trim();
    if (!convId) return ack?.({ ok: false, error: "conversationId required" });

    const userId = socket.data?.user?.sub;
    if (!userId) return ack?.({ ok: false, error: "Not authenticated" });

    storage.getConversationById(convId).then(conv => {
      if (!conv) return ack?.({ ok: false, error: "Conversation not found" });
      if (!conv.participants.includes(userId)) return ack?.({ ok: false, error: "Not a participant" });

      const room = `conv:${convId}`;
      socket.join(room);
      socket.data.currentRooms = socket.data.currentRooms || [];
      if (!socket.data.currentRooms.includes(room)) socket.data.currentRooms.push(room);

      ack?.({ ok: true, conversationId: convId });
    });
  }

  function handleConversationMessage(socket, payload, ack) {
    const userId = socket.data?.user?.sub;
    if (!userId) return ack?.({ ok: false, error: "Not authenticated" });

    const convId = String(payload?.conversationId || "").trim();
    if (!convId) return ack?.({ ok: false, error: "conversationId required" });

    storage.getConversationById(convId).then(conv => {
      if (!conv || !conv.participants.includes(userId)) return ack?.({ ok: false, error: "Not a participant" });

      storage.findUserById(userId).then(user => {
        const rawText = String(payload?.text || "").trim();
        const imageData = String(payload?.imageData || "").trim();

        if (!rawText && !imageData) return ack?.({ ok: false, error: "Message text or image required" });
        if (imageData && !imageData.startsWith("data:image/")) return ack?.({ ok: false, error: "Invalid image data" });

        const message = {
          id: crypto.randomUUID(),
          conversationId: convId,
          from: userId,
          fromName: user?.displayName || user?.phoneNumber || "Unknown",
          text: rawText.slice(0, 4000),
          imageData: imageData || null,
          timestamp: Date.now(),
          status: "sent",
        };

        Promise.all([
          storage.saveMessage(convId, message),
          storage.updateConversation(convId, {
            lastMessage: rawText.slice(0, 100) || (imageData ? "📷 Photo" : ""),
            lastMessageSender: userId,
            unreadCount: buildUnreadCount(conv, userId),
          }),
        ]).then(() => {
          const room = `conv:${convId}`;
          io.to(room).emit("conversation:message", message);
          ack?.({ ok: true, id: message.id, timestamp: message.timestamp });

          // Send FCM push notification to other participants
          if (fcmPushService?.isReady()) {
            const otherUserId = conv.participants.find(id => id !== userId);
            if (otherUserId) {
              storage.getFcmTokens(otherUserId).then(tokens => {
                if (tokens.length > 0) {
                  const title = message.fromName || "Nova";
                  const body = message.text?.slice(0, 200) || (message.imageData ? "📷 Photo" : "New message");
                  fcmPushService.sendToMultiple(tokens, title, body, {
                    conversationId: convId,
                    messageId: message.id,
                    senderId: userId,
                  });
                }
              });
            }
          }
        });
      });
    });
  }

  function handleConversationRead(socket, payload) {
    const userId = socket.data?.user?.sub;
    if (!userId) return;

    const convId = String(payload?.conversationId || "").trim();
    if (!convId) return;

    storage.getConversationById(convId).then(conv => {
      if (!conv) return;

      const unreadCount = { ...(conv.unreadCount || {}) };
      unreadCount[userId] = 0;
      storage.updateConversation(convId, { unreadCount }).then(() => {
        io.to(`conv:${convId}`).emit("conversation:read", {
          conversationId: convId,
          userId,
          timestamp: Date.now(),
        });
      });
    });
  }

  function handleCallOffer(socket, payload, ack) {
    const userId = socket.data?.user?.sub;
    if (!userId) return ack?.({ ok: false, error: "Not authenticated" });
    const convId = String(payload?.conversationId || "").trim();
    if (!convId) return ack?.({ ok: false, error: "conversationId required" });
    storage.findUserById(userId).then(user => {
      const room = `conv:${convId}`;
      socket.to(room).emit("call:offer", {
        conversationId: convId,
        from: userId,
        fromName: user?.displayName || user?.phoneNumber || "Unknown",
        mode: payload?.mode || "video",
        timestamp: Date.now(),
      });
      ack?.({ ok: true });
    });
  }

  function handleLeaveConversation(socket, payload) {
    const convId = String(payload?.conversationId || "").trim();
    if (!convId) return;
    const room = `conv:${convId}`;
    socket.leave(room);
    if (socket.data.currentRooms) {
      socket.data.currentRooms = socket.data.currentRooms.filter(r => r !== room);
    }
  }

  function handleConversationTyping(socket, payload) {
    const userId = socket.data?.user?.sub;
    if (!userId) return;

    const convId = String(payload?.conversationId || "").trim();
    if (!convId) return;

    const isTyping = Boolean(payload?.isTyping);
    const room = `conv:${convId}`;
    socket.to(room).emit("conversation:typing", {
      conversationId: convId,
      userId,
      isTyping,
      timestamp: Date.now(),
    });
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

  function handleCallAnswer(socket, payload, ack) {
    const userId = socket.data?.user?.sub;
    if (!userId) return ack?.({ ok: false, error: "Not authenticated" });
    const convId = String(payload?.conversationId || "").trim();
    if (!convId) return;
    socket.to(`conv:${convId}`).emit("call:answer", {
      conversationId: convId,
      from: userId,
      timestamp: Date.now(),
    });
    ack?.({ ok: true });
  }

  function handleCallEnd(socket, payload) {
    const userId = socket.data?.user?.sub;
    if (!userId) return;
    const convId = String(payload?.conversationId || "").trim();
    if (!convId) return;
    socket.to(`conv:${convId}`).emit("call:end", {
      conversationId: convId,
      from: userId,
      reason: String(payload?.reason || "ended"),
      timestamp: Date.now(),
    });
  }

  function handleCallFrame(socket, payload) {
    const userId = socket.data?.user?.sub;
    if (!userId) return;
    const convId = String(payload?.conversationId || "").trim();
    if (!convId) return;
    socket.to(`conv:${convId}`).emit("call:frame", {
      conversationId: convId,
      from: userId,
      imageData: payload?.imageData,
      timestamp: Date.now(),
    });
  }

  function handleCallAudio(socket, payload) {
    const userId = socket.data?.user?.sub;
    if (!userId) return;
    const convId = String(payload?.conversationId || "").trim();
    if (!convId) return;
    socket.to(`conv:${convId}`).emit("call:audio", {
      conversationId: convId,
      from: userId,
      audioData: payload?.audioData,
      timestamp: Date.now(),
    });
  }

  return { setup };
}

module.exports = { createConversationHandlers };
