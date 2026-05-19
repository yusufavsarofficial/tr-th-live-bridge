require("dotenv").config();

const crypto = require("crypto");
const fs = require("fs");
const net = require("net");
const express = require("express");
const http = require("http");
const path = require("path");
const compression = require("compression");
const helmet = require("helmet");
const morgan = require("morgan");
const { Server } = require("socket.io");
const { translate } = require("@vitalets/google-translate-api");
const webPush = require("web-push");
const OpenAI = require("openai");

function createConfig(overrides = {}) {
  const defaultIceServers = [{ urls: "stun:stun.l.google.com:19302" }];
  let rtcIceServers = defaultIceServers;
  const rawIce = String(process.env.RTC_ICE_SERVERS_JSON || "").trim();
  if (rawIce) {
    try {
      const parsed = JSON.parse(rawIce);
      if (Array.isArray(parsed) && parsed.length > 0) {
        rtcIceServers = parsed;
      }
    } catch {
      rtcIceServers = defaultIceServers;
    }
  }

  return {
    port: Number(process.env.PORT) || 3000,
    maxUsers: Number(process.env.MAX_USERS) || 2,
    maxMessageLength: Number(process.env.MAX_MESSAGE_LENGTH) || 500,
    maxAttachmentBytes: Number(process.env.MAX_ATTACHMENT_BYTES) || 900_000,
    maxHistory: Number(process.env.MAX_HISTORY) || 120,
    roomId: "pingle-room",
    roomCode: String(process.env.ROOM_CODE || "").trim(),
    roomPin: String(process.env.ROOM_PIN || "").trim(),
    dataFile: String(process.env.DATA_FILE || path.join(__dirname, "data", "chat-history.json")),
    notificationFile: String(process.env.NOTIFICATION_FILE || path.join(__dirname, "data", "notification-state.json")),
    translateTimeoutMs: Number(process.env.TRANSLATE_TIMEOUT_MS) || 3500,
    openaiApiKey: String(process.env.OPENAI_API_KEY || "").trim(),
    openaiTranslateModel: String(process.env.OPENAI_TRANSLATE_MODEL || "gpt-4.1-mini").trim(),
    translationProvider: String(process.env.TRANSLATION_PROVIDER || "openai-first").trim(),
    vapidPublicKey: String(process.env.VAPID_PUBLIC_KEY || "").trim(),
    vapidPrivateKey: String(process.env.VAPID_PRIVATE_KEY || "").trim(),
    vapidSubject: String(process.env.VAPID_SUBJECT || "mailto:pingle@ayfsoft.com").trim(),
    host: String(process.env.HOST || "0.0.0.0").trim(),
    rtcIceServers,
    ...overrides,
  };
}

function createChatServer(overrides = {}) {
  const config = createConfig(overrides);
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);

  const usersBySocket = new Map();
  const history = [];
  const NAME_REGEX = /^[\p{L}0-9 ._-]{2,24}$/u;
  const THAI_REGEX = /[\u0E00-\u0E7F]/;
  const TURKISH_CHAR_REGEX = /[A-Za-zÇĞİÖŞÜçğıöşü]/;
  const THAI_GLOBAL_REGEX = /[\u0E00-\u0E7F]/g;
  const TURKISH_GLOBAL_REGEX = /[A-Za-zÇĞİÖŞÜçğıöşü]/g;
  const TRANSLATE_CACHE_MAX = 2000;
  const translationCache = new Map();
  const openaiClient = config.openaiApiKey ? new OpenAI({ apiKey: config.openaiApiKey }) : null;
  const lastSeenByName = new Map();
  const offlineEvents = [];
  const OFFLINE_EVENT_MAX = 40;
  const CALL_OFFER_TTL_MS = Number(process.env.CALL_OFFER_TTL_MS) || 90_000;
  const PUSH_TTL_SECONDS = Number(process.env.PUSH_TTL_SECONDS) || 60 * 60 * 24 * 7;
  const pushSubscriptions = new Map();
  let vapidKeys = null;
  let pendingCallOffer = null;

  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "script-src": ["'self'"],
          "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          "font-src": ["'self'", "https://fonts.gstatic.com"],
          "img-src": ["'self'", "data:", "blob:", "https:"],
          "media-src": ["'self'", "blob:", "data:"],
          "connect-src": ["'self'", "ws:", "wss:"],
          "worker-src": ["'self'"],
        },
      },
    }),
  );
  app.use(compression());
  app.use(morgan("tiny"));
  app.use(express.json({ limit: "50kb" }));
  app.use(express.static(path.join(__dirname, "public")));

  function normalizeName(rawName) {
    return String(rawName || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 24);
  }

  function normalizeAvatarUrl(rawValue) {
    const value = String(rawValue || "").trim();
    if (!value || value.length > 1_200_000) {
      return "";
    }

    if (/^data:image\/(?:png|jpe?g|webp);base64,/i.test(value)) {
      return value;
    }

    try {
      const parsed = new URL(value);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.toString();
      }
      return "";
    } catch {
      return "";
    }
  }

  function normalizeAttachment(rawAttachment) {
    if (!rawAttachment || typeof rawAttachment !== "object") {
      return null;
    }

    const name = repairMojibake(rawAttachment.name || "dosya").slice(0, 80);
    const mimeType = String(rawAttachment.mimeType || "").slice(0, 80);
    const dataUrl = String(rawAttachment.dataUrl || "");
    const size = Number(rawAttachment.size) || 0;
    const kind = ["image", "audio", "file"].includes(rawAttachment.kind) ? rawAttachment.kind : "file";

    if (!dataUrl.startsWith("data:") || size <= 0 || size > config.maxAttachmentBytes) {
      return null;
    }

    if (kind === "image" && !/^data:image\/(?:png|jpe?g|webp|gif)(?:;[^,]+)*;base64,/i.test(dataUrl)) {
      return null;
    }

    if (kind === "audio" && !/^data:audio\/(?:webm|ogg|mpeg|mp4|wav)(?:;[^,]+)*;base64,/i.test(dataUrl)) {
      return null;
    }

    if (dataUrl.length > Math.ceil(config.maxAttachmentBytes * 1.45) + 120) {
      return null;
    }

    return { name, mimeType, dataUrl, size, kind };
  }

  function verifyRoomPin(rawPin) {
    if (!config.roomPin) {
      return true;
    }
    return String(rawPin || "").trim() === config.roomPin;
  }

  function detectSourceLanguage(text) {
    const thaiCount = (String(text).match(THAI_GLOBAL_REGEX) || []).length;
    const turkishCount = (String(text).match(TURKISH_GLOBAL_REGEX) || []).length;

    if (thaiCount > 0 && turkishCount === 0) {
      return "th";
    }

    if (thaiCount > 0 && turkishCount > 0) {
      return thaiCount >= turkishCount ? "th" : "tr";
    }

    return "tr";
  }

  function normalizeTranslateInput(value) {
    return repairMojibake(value)
      .replace(/\s+/g, " ")
      .trim();
  }

  function decodeHtmlEntities(value) {
    return String(value || "")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }

  function scoreTextEncoding(value) {
    const text = String(value || "");
    const thaiCount = (text.match(THAI_GLOBAL_REGEX) || []).length;
    const mojibakeCount = (text.match(/[ÃÂ�]|à¸|à¹|Å|Ä/g) || []).length;
    const controlCount = (text.match(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g) || []).length;
    return thaiCount * 6 - mojibakeCount * 5 - controlCount * 10;
  }

  function repairMojibake(value) {
    let best = String(value || "");
    let current = best;
    let bestScore = scoreTextEncoding(best);

    for (let i = 0; i < 3; i += 1) {
      const repaired = Buffer.from(current, "latin1").toString("utf8");
      const score = scoreTextEncoding(repaired);
      if (score > bestScore) {
        best = repaired;
        bestScore = score;
      }
      if (repaired === current) {
        break;
      }
      current = repaired;
    }

    return best;
  }

  function hasMojibake(value) {
    return /[ÃÂ�]|à¸|à¹|Å|Ä/.test(String(value || ""));
  }

  function addTranslationCache(key, value) {
    translationCache.set(key, value);
    if (translationCache.size <= TRANSLATE_CACHE_MAX) {
      return;
    }

    const firstKey = translationCache.keys().next().value;
    if (firstKey) {
      translationCache.delete(firstKey);
    }
  }

  function containsThai(text) {
    return THAI_REGEX.test(text);
  }

  function containsTurkishLikeText(text) {
    return TURKISH_CHAR_REGEX.test(text);
  }

  function isLikelyUntranslated(sourceText, translatedText, targetLang) {
    const source = normalizeTranslateInput(sourceText);
    const translated = normalizeTranslateInput(translatedText);

    if (!translated) {
      return true;
    }

    if (hasMojibake(translated)) {
      return true;
    }

    if (targetLang === "th") {
      if (containsTurkishLikeText(source) && !containsThai(translated)) {
        return true;
      }
    }

    if (targetLang === "tr") {
      if (containsThai(source) && containsThai(translated)) {
        return true;
      }
    }

    if (source.length > 3 && translated.toLowerCase() === source.toLowerCase()) {
      return true;
    }

    return false;
  }

  async function withTimeout(promise, timeoutMs) {
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("translate-timeout")), timeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function translateWithGoogle(text, from, to) {
    const result = await translate(text, { from: from || "auto", to });
    return normalizeTranslateInput(result?.text || "");
  }

  async function translateWithOpenAI(text, from, to) {
    if (!openaiClient) {
      throw new Error("openai-not-configured");
    }

    const fromLabel = from && from !== "auto" ? from : "auto-detect";
    const prompt = [
      "You are a strict translation engine.",
      `Translate the user's text from ${fromLabel} to ${to}.`,
      "Rules:",
      "- Return only the translated text.",
      "- No explanations, no quotes, no prefixes.",
      "- Preserve meaning and tone naturally.",
      "",
      text,
    ].join("\n");

    const response = await openaiClient.responses.create({
      model: config.openaiTranslateModel,
      input: prompt,
      temperature: 0,
      max_output_tokens: Math.max(64, text.length * 4),
    });

    return normalizeTranslateInput(response?.output_text || "");
  }

  async function translateWithMyMemory(text, from, to) {
    const sourceLang = from && from !== "auto" ? from : detectSourceLanguage(text);
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", text);
    url.searchParams.set("langpair", `${sourceLang}|${to}`);

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`mymemory-http-${response.status}`);
    }

    const payload = await response.json();
    const responseText = normalizeTranslateInput(payload?.responseData?.translatedText || "");
    if (responseText) {
      return decodeHtmlEntities(responseText);
    }

    const fromMatches = Array.isArray(payload?.matches) ? payload.matches : [];
    const best = fromMatches.find((item) => normalizeTranslateInput(item?.translation));
    return decodeHtmlEntities(normalizeTranslateInput(best?.translation || ""));
  }

  async function safeTranslate(text, from, to) {
    const sourceText = normalizeTranslateInput(text);
    if (!sourceText || from === to) {
      return sourceText;
    }

    const cacheKey = `${from || "auto"}|${to}|${sourceText}`;
    if (translationCache.has(cacheKey)) {
      return translationCache.get(cacheKey);
    }

    const openAiFirst = config.translationProvider.toLowerCase() !== "legacy";
    const attempts = openAiFirst
      ? [
          () => translateWithOpenAI(sourceText, from, to),
          () => translateWithOpenAI(sourceText, "auto", to),
          () => translateWithGoogle(sourceText, from, to),
          () => translateWithGoogle(sourceText, "auto", to),
          () => translateWithMyMemory(sourceText, from, to),
        ]
      : [
          () => translateWithGoogle(sourceText, from, to),
          () => translateWithGoogle(sourceText, "auto", to),
          () => translateWithMyMemory(sourceText, from, to),
          () => translateWithOpenAI(sourceText, from, to),
        ];

    for (let i = 0; i < attempts.length; i += 1) {
      try {
        const translated = await withTimeout(attempts[i](), config.translateTimeoutMs);
        if (!translated) {
          continue;
        }

        if (isLikelyUntranslated(sourceText, translated, to) && i < attempts.length - 1) {
          continue;
        }

        addTranslationCache(cacheKey, translated);
        return translated;
      } catch {
        // Try next provider/strategy.
      }
    }

    addTranslationCache(cacheKey, sourceText);
    return sourceText;
  }

  async function makeBilingualText(text) {
    const normalizedText = normalizeTranslateInput(text);
    const hasTranslatableText = /[\p{L}\p{N}]/u.test(normalizedText);

    if (!hasTranslatableText) {
      return {
        sourceLang: "tr",
        trText: normalizedText,
        thText: normalizedText,
        primaryLang: "tr",
        primaryText: normalizedText,
        secondaryLang: "th",
        secondaryText: normalizedText,
      };
    }

    const sourceLang = detectSourceLanguage(normalizedText);

    if (sourceLang === "th") {
      const trText = await safeTranslate(normalizedText, "th", "tr");
      return {
        sourceLang,
        trText,
        thText: normalizedText,
        primaryLang: "th",
        primaryText: normalizedText,
        secondaryLang: "tr",
        secondaryText: trText,
      };
    }

    const thText = await safeTranslate(normalizedText, "tr", "th");
    return {
      sourceLang: "tr",
      trText: normalizedText,
      thText,
      primaryLang: "tr",
      primaryText: normalizedText,
      secondaryLang: "th",
      secondaryText: thText,
    };
  }

  function makeImmediateBilingualText(text) {
    const normalizedText = normalizeTranslateInput(text);
    const hasTranslatableText = /[\p{L}\p{N}]/u.test(normalizedText);

    if (!hasTranslatableText) {
      return {
        sourceLang: "tr",
        trText: normalizedText,
        thText: normalizedText,
        primaryLang: "tr",
        primaryText: normalizedText,
        secondaryLang: "th",
        secondaryText: normalizedText,
      };
    }

    const sourceLang = detectSourceLanguage(normalizedText);

    if (sourceLang === "th") {
      return {
        sourceLang,
        trText: "",
        thText: normalizedText,
        primaryLang: "th",
        primaryText: normalizedText,
        secondaryLang: "tr",
        secondaryText: "",
      };
    }

    return {
      sourceLang: "tr",
      trText: normalizedText,
      thText: "",
      primaryLang: "tr",
      primaryText: normalizedText,
      secondaryLang: "th",
      secondaryText: "",
    };
  }

  function readPersistedHistory() {
    try {
      if (!fs.existsSync(config.dataFile)) {
        return;
      }

      const raw = fs.readFileSync(config.dataFile, "utf8");
      if (!raw.trim()) {
        return;
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed?.history)) {
        return;
      }

      const normalized = parsed.history
        .map((item) => ({
          id: String(item.id || crypto.randomUUID()),
          from: repairMojibake(item.from || "unknown").slice(0, 24),
          fromAvatar: normalizeAvatarUrl(item.fromAvatar),
          text: repairMojibake(item.text || "").slice(0, config.maxMessageLength),
          trText: repairMojibake(item.trText || item.text || "").slice(0, config.maxMessageLength * 2),
          thText: repairMojibake(item.thText || item.text || "").slice(0, config.maxMessageLength * 2),
          sourceLang: item.sourceLang === "th" ? "th" : "tr",
          primaryLang:
            item.primaryLang === "th" || item.primaryLang === "tr"
              ? item.primaryLang
              : item.sourceLang === "th"
                ? "th"
                : "tr",
          primaryText: repairMojibake(item.primaryText || "").slice(0, config.maxMessageLength * 2),
          secondaryLang:
            item.secondaryLang === "th" || item.secondaryLang === "tr"
              ? item.secondaryLang
              : item.sourceLang === "th"
                ? "tr"
                : "th",
          secondaryText: repairMojibake(item.secondaryText || "").slice(0, config.maxMessageLength * 2),
          attachment: normalizeAttachment(item.attachment),
          timestamp: Number(item.timestamp) || Date.now(),
        }))
        .filter((item) => item.text.trim().length > 0 || item.attachment)
        .slice(-config.maxHistory);

      normalized.forEach((entry) => {
        if (!entry.primaryText) {
          entry.primaryText = entry.primaryLang === "th" ? entry.thText : entry.trText;
        }
        if (!entry.secondaryText) {
          entry.secondaryText = entry.secondaryLang === "th" ? entry.thText : entry.trText;
        }
      });

      history.push(...normalized);
    } catch (error) {
      console.error("Failed to read persisted history:", error.message);
    }
  }

  function persistHistory() {
    try {
      const dir = path.dirname(config.dataFile);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(config.dataFile, JSON.stringify({ history }, null, 2) + "\n", "utf8");
    } catch (error) {
      console.error("Failed to persist history:", error.message);
    }
  }

  function pushHistory(message) {
    history.push(message);
    if (history.length > config.maxHistory) {
      history.splice(0, history.length - config.maxHistory);
    }
    persistHistory();
  }

  function updateHistoryMessage(messageId, patch) {
    const index = history.findIndex((message) => message.id === messageId);
    if (index === -1) {
      return null;
    }

    history[index] = {
      ...history[index],
      ...patch,
    };
    persistHistory();
    return history[index];
  }

  function clearHistory() {
    history.splice(0, history.length);
    persistHistory();
  }

  function readNotificationState() {
    try {
      if (!fs.existsSync(config.notificationFile)) {
        return null;
      }
      const raw = fs.readFileSync(config.notificationFile, "utf8");
      return raw.trim() ? JSON.parse(raw) : null;
    } catch (error) {
      console.error("Failed to read notification state:", error.message);
      return null;
    }
  }

  function persistNotificationState() {
    try {
      const dir = path.dirname(config.notificationFile);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        config.notificationFile,
        JSON.stringify(
          {
            vapidKeys,
            subscriptions: Array.from(pushSubscriptions.values()),
          },
          null,
          2,
        ) + "\n",
        "utf8",
      );
    } catch (error) {
      console.error("Failed to persist notification state:", error.message);
    }
  }

  function initializePushNotifications() {
    const stored = readNotificationState();
    vapidKeys =
      config.vapidPublicKey && config.vapidPrivateKey
        ? { publicKey: config.vapidPublicKey, privateKey: config.vapidPrivateKey }
        : stored?.vapidKeys?.publicKey && stored?.vapidKeys?.privateKey
          ? stored.vapidKeys
          : webPush.generateVAPIDKeys();

    if (Array.isArray(stored?.subscriptions)) {
      stored.subscriptions.forEach((record) => {
        const endpoint = String(record?.subscription?.endpoint || "");
        if (endpoint) {
          pushSubscriptions.set(endpoint, {
            name: normalizeName(record.name),
            lang: record.lang === "th" ? "th" : "tr",
            subscription: record.subscription,
            updatedAt: Number(record.updatedAt) || Date.now(),
          });
        }
      });
    }

    webPush.setVapidDetails(config.vapidSubject, vapidKeys.publicKey, vapidKeys.privateKey);
    persistNotificationState();
  }

  function normalizePushSubscription(rawSubscription) {
    if (!rawSubscription || typeof rawSubscription !== "object") {
      return null;
    }
    const endpoint = String(rawSubscription.endpoint || "");
    const p256dh = String(rawSubscription.keys?.p256dh || "");
    const auth = String(rawSubscription.keys?.auth || "");
    if (!endpoint || !p256dh || !auth) {
      return null;
    }
    return {
      endpoint,
      expirationTime: rawSubscription.expirationTime || null,
      keys: { p256dh, auth },
    };
  }

  function pushText(lang, key) {
    const table = {
      tr: {
        messageTitle: "Yeni mesaj",
        mediaMessage: "Yeni medya mesajı",
        incomingVoice: "Sesli arama geliyor",
        incomingVideo: "Görüntülü arama geliyor",
      },
      th: {
        messageTitle: "ข้อความใหม่",
        mediaMessage: "ข้อความสื่อใหม่",
        incomingVoice: "มีสายเสียงเข้า",
        incomingVideo: "มีวิดีโอคอลเข้า",
      },
    };
    return (table[lang] || table.tr)[key] || table.tr[key] || key;
  }

  function messageTextForLang(message, lang) {
    if (lang === "th") {
      return message.thText || message.primaryText || message.text || pushText(lang, "mediaMessage");
    }
    return message.trText || message.primaryText || message.text || pushText(lang, "mediaMessage");
  }

  function sendPushToOfflineSubscribers(excludeName, payloadFactory) {
    const senderKey = userKey(excludeName);
    const targets = Array.from(pushSubscriptions.values()).filter((record) => {
      const recordKey = userKey(record.name);
      return !recordKey || recordKey !== senderKey;
    });

    targets.forEach((record) => {
      const payload = payloadFactory(record.lang === "th" ? "th" : "tr");
      webPush
        .sendNotification(record.subscription, JSON.stringify(payload), {
          TTL: PUSH_TTL_SECONDS,
          urgency: payload.type === "call" ? "high" : "normal",
        })
        .catch((error) => {
          if (error?.statusCode === 404 || error?.statusCode === 410) {
            pushSubscriptions.delete(record.subscription.endpoint);
            persistNotificationState();
          } else {
            console.error("Push notification failed:", error?.message || error);
          }
        });
    });
  }

  function sendPushForMessage(message) {
    sendPushToOfflineSubscribers(message.from, (lang) => ({
      type: "message",
      title: message.from || pushText(lang, "messageTitle"),
      body: messageTextForLang(message, lang).slice(0, 180),
      tag: `message-${message.id}`,
      url: "/",
      timestamp: Date.now(),
    }));
  }

  function sendPushForCall(offerPayload) {
    sendPushToOfflineSubscribers(offerPayload.from?.name, (lang) => ({
      type: "call",
      title: offerPayload.from?.name || "Pingle",
      body: offerPayload.mode === "voice" ? pushText(lang, "incomingVoice") : pushText(lang, "incomingVideo"),
      tag: `call-${offerPayload.timestamp}`,
      url: "/",
      mode: offerPayload.mode,
      timestamp: Date.now(),
    }));
  }

  function getPublicUsers() {
    return Array.from(usersBySocket.values()).map((user) => ({
      name: user.name,
      avatarUrl: user.avatarUrl,
    }));
  }

  function emitRoster() {
    const users = getPublicUsers();
    io.to(config.roomId).emit("users", {
      users,
      maxUsers: config.maxUsers,
      onlineCount: users.length,
    });
  }

  function emitSystem(text, key = "", vars = {}) {
    io.to(config.roomId).emit("system", {
      text,
      key,
      vars,
      timestamp: Date.now(),
    });
  }

  function findUserBySocketId(socketId) {
    const user = usersBySocket.get(socketId);
    if (!user) {
      return null;
    }
    return { name: user.name, avatarUrl: user.avatarUrl };
  }

  function userKey(name) {
    return String(name || "").trim().toLowerCase();
  }

  function hasOtherOnlineUser(socketId) {
    return Array.from(usersBySocket.keys()).some((otherSocketId) => otherSocketId !== socketId);
  }

  function rememberOfflineEvent(event) {
    offlineEvents.push({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      ...event,
    });
    if (offlineEvents.length > OFFLINE_EVENT_MAX) {
      offlineEvents.splice(0, offlineEvents.length - OFFLINE_EVENT_MAX);
    }
  }

  function clearPendingCallForSocket(socketId) {
    if (pendingCallOffer?.fromSocketId === socketId) {
      pendingCallOffer = null;
    }
  }

  function deliverOfflineEvents(socket, name) {
    const key = userKey(name);
    const since = lastSeenByName.has(key) ? lastSeenByName.get(key) : 0;
    const events = offlineEvents
      .filter((event) => event.timestamp > since && userKey(event.from?.name) !== key)
      .slice(-8);

    if (events.length) {
      socket.emit("offline:events", { events, timestamp: Date.now() });
    }

    if (
      pendingCallOffer &&
      pendingCallOffer.expiresAt > Date.now() &&
      pendingCallOffer.fromSocketId !== socket.id &&
      usersBySocket.has(pendingCallOffer.fromSocketId)
    ) {
      socket.emit("call:offer", pendingCallOffer.offer);
    } else if (pendingCallOffer && pendingCallOffer.expiresAt <= Date.now()) {
      pendingCallOffer = null;
    }
  }

  app.get("/health", (_req, res) => {
    res.status(200).json({
      ok: true,
      app: "Pingle",
      now: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      usersOnline: getPublicUsers().length,
      maxUsers: config.maxUsers,
      messageCount: history.length,
    });
  });

  app.get("/api/history", (_req, res) => {
    res.status(200).json({ ok: true, total: history.length, history });
  });

  app.get("/api/rtc-config", (_req, res) => {
    res.status(200).json({
      ok: true,
      iceServers: config.rtcIceServers,
    });
  });

  app.get("/api/notifications/config", (_req, res) => {
    res.status(200).json({
      ok: true,
      publicKey: vapidKeys?.publicKey || "",
    });
  });

  app.post("/api/notifications/subscribe", (req, res) => {
    const subscription = normalizePushSubscription(req.body?.subscription);
    if (!subscription) {
      res.status(400).json({ ok: false, error: "Invalid push subscription." });
      return;
    }

    pushSubscriptions.set(subscription.endpoint, {
      name: normalizeName(req.body?.name),
      lang: req.body?.lang === "th" ? "th" : "tr",
      subscription,
      updatedAt: Date.now(),
    });
    persistNotificationState();
    res.status(200).json({ ok: true });
  });

  app.post("/api/notifications/unsubscribe", (req, res) => {
    const endpoint = String(req.body?.endpoint || req.body?.subscription?.endpoint || "");
    if (endpoint) {
      pushSubscriptions.delete(endpoint);
      persistNotificationState();
    }
    res.status(200).json({ ok: true });
  });

  app.post("/api/history/clear", (req, res) => {
    const pin = req.body?.roomPin;
    if (!verifyRoomPin(pin)) {
      res.status(403).json({ ok: false, error: "Invalid room PIN." });
      return;
    }

    const previousTotal = history.length;
    clearHistory();
    emitSystem("Sohbet gecmisi temizlendi.", "systemHistoryCleared");
    res.status(200).json({ ok: true, cleared: previousTotal });
  });

  initializePushNotifications();
  readPersistedHistory();
  persistHistory();

  // Legacy Socket.IO contract kept for the current web demo.
  // Phase 2 standard replaces join/message/typing and call:* SDP events with
  // conversation:join, message:send/message:new/message:typing, and webrtc:*.
  io.on("connection", (socket) => {
    socket.emit("server:hello", {
      maxUsers: config.maxUsers,
      maxMessageLength: config.maxMessageLength,
      roomCodeRequired: Boolean(config.roomCode),
      roomPinRequired: Boolean(config.roomPin),
      iceServers: config.rtcIceServers,
    });

    socket.on("join", (payload, ack) => {
      const name = normalizeName(payload?.name);
      const roomCode = String(payload?.roomCode || "").trim();
      const roomPin = String(payload?.roomPin || "").trim();
      const avatarUrl = normalizeAvatarUrl(payload?.avatarUrl);

      if (!name) {
        ack?.({ ok: false, error: "Name is required." });
        return;
      }

      if (!NAME_REGEX.test(name)) {
        ack?.({
          ok: false,
          error: "Name must be 2-24 chars and can include letters, numbers, dot, underscore, dash.",
        });
        return;
      }

      if (config.roomCode && roomCode !== config.roomCode) {
        ack?.({ ok: false, error: "Invalid room code." });
        return;
      }

      if (config.roomPin && roomPin !== config.roomPin) {
        ack?.({ ok: false, error: "Invalid room PIN." });
        return;
      }

      if (usersBySocket.has(socket.id)) {
        ack?.({ ok: false, error: "Already joined." });
        return;
      }

      if (usersBySocket.size >= config.maxUsers) {
        ack?.({ ok: false, error: "Room is full. Only 2 users can join." });
        return;
      }

      const duplicate = getPublicUsers().some((existingUser) => existingUser.name.toLowerCase() === name.toLowerCase());
      if (duplicate) {
        ack?.({ ok: false, error: "This name is already in use." });
        return;
      }

      usersBySocket.set(socket.id, {
        name,
        avatarUrl,
        joinedAt: Date.now(),
      });

      socket.join(config.roomId);

      ack?.({
        ok: true,
        me: { name, avatarUrl },
        users: getPublicUsers(),
        maxUsers: config.maxUsers,
        maxMessageLength: config.maxMessageLength,
        history,
        roomCodeRequired: Boolean(config.roomCode),
        roomPinRequired: Boolean(config.roomPin),
      });

      emitSystem(`${name} odaya katıldı.`, "systemJoined", { name });
      emitRoster();
      deliverOfflineEvents(socket, name);
    });

    socket.on("message", async (rawPayload, ack) => {
      const user = usersBySocket.get(socket.id);
      if (!user) {
        ack?.({ ok: false, error: "Join first." });
        return;
      }

      const rawText =
        rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload) ? rawPayload.text : rawPayload;
      const rawAttachment =
        rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload) ? rawPayload.attachment : null;
      const text = normalizeTranslateInput(rawText || "").slice(0, config.maxMessageLength);
      const attachment = normalizeAttachment(rawAttachment);

      if (!text && !attachment) {
        ack?.({ ok: false, error: "Message cannot be empty." });
        return;
      }

      if (text.length > config.maxMessageLength) {
        ack?.({ ok: false, error: `Message too long. Max ${config.maxMessageLength} chars.` });
        return;
      }

      const bilingual = text
        ? makeImmediateBilingualText(text)
        : {
            trText: "",
            thText: "",
            sourceLang: "tr",
            primaryLang: "tr",
            primaryText: "",
            secondaryLang: "th",
            secondaryText: "",
          };

      const message = {
        id: crypto.randomUUID(),
        from: user.name,
        fromAvatar: user.avatarUrl,
        text,
        trText: bilingual.trText,
        thText: bilingual.thText,
        sourceLang: bilingual.sourceLang,
        primaryLang: bilingual.primaryLang,
        primaryText: bilingual.primaryText,
        secondaryLang: bilingual.secondaryLang,
        secondaryText: bilingual.secondaryText,
        translationPending: Boolean(text),
        translationError: false,
        attachment,
        timestamp: Date.now(),
      };

      const shouldNotifyOffline = !hasOtherOnlineUser(socket.id);
      pushHistory(message);
      io.to(config.roomId).emit("message", message);
      if (shouldNotifyOffline) {
        rememberOfflineEvent({
          type: "message",
          from: { name: user.name, avatarUrl: user.avatarUrl },
          messageId: message.id,
          body: text || attachment?.name || "Yeni medya mesajı",
        });
      }
      ack?.({ ok: true, id: message.id });

      if (text) {
        makeBilingualText(text)
          .then((translated) => {
            const updated = updateHistoryMessage(message.id, {
              trText: translated.trText,
              thText: translated.thText,
              sourceLang: translated.sourceLang,
              primaryLang: translated.primaryLang,
              primaryText: translated.primaryText,
              secondaryLang: translated.secondaryLang,
              secondaryText: translated.secondaryText,
              translationPending: false,
              translationError: false,
            });
            if (updated) {
              io.to(config.roomId).emit("message:update", updated);
              if (shouldNotifyOffline) {
                sendPushForMessage(updated);
              }
            }
          })
          .catch(() => {
            const updated = updateHistoryMessage(message.id, {
              translationPending: false,
              translationError: true,
            });
            if (updated) {
              io.to(config.roomId).emit("message:update", updated);
              if (shouldNotifyOffline) {
                sendPushForMessage(updated);
              }
            }
          });
      } else if (shouldNotifyOffline) {
        sendPushForMessage(message);
      }
    });

    socket.on("typing", (isTyping) => {
      const user = usersBySocket.get(socket.id);
      if (!user) {
        return;
      }

      socket.to(config.roomId).emit("typing", {
        name: user.name,
        isTyping: Boolean(isTyping),
        timestamp: Date.now(),
      });
    });

    socket.on("call:offer", (payload, ack) => {
      const user = findUserBySocketId(socket.id);
      if (!user) {
        ack?.({ ok: false, error: "Join first." });
        return;
      }

      const offerPayload = {
        from: user,
        mode: payload?.mode === "voice" ? "voice" : "video",
        sdp: payload?.sdp,
        timestamp: Date.now(),
      };

      const hasTarget = hasOtherOnlineUser(socket.id);
      if (hasTarget) {
        socket.to(config.roomId).emit("call:offer", offerPayload);
      } else {
        pendingCallOffer = {
          fromSocketId: socket.id,
          offer: offerPayload,
          expiresAt: Date.now() + CALL_OFFER_TTL_MS,
        };
        rememberOfflineEvent({
          type: "call",
          from: user,
          mode: offerPayload.mode,
          body: offerPayload.mode === "voice" ? "Sesli arama" : "Görüntülü arama",
        });
        sendPushForCall(offerPayload);
      }
      socket.emit("call:ringing", {
        mode: offerPayload.mode,
        queued: !hasTarget,
        timestamp: offerPayload.timestamp,
      });

      ack?.({ ok: true, queued: !hasTarget });
    });

    socket.on("call:answer", (payload, ack) => {
      const user = findUserBySocketId(socket.id);
      if (!user) {
        ack?.({ ok: false, error: "Join first." });
        return;
      }

      socket.to(config.roomId).emit("call:answer", {
        from: user,
        sdp: payload?.sdp,
        timestamp: Date.now(),
      });
      pendingCallOffer = null;

      ack?.({ ok: true });
    });

    socket.on("call:ice-candidate", (payload) => {
      const user = findUserBySocketId(socket.id);
      if (!user || !payload?.candidate) {
        return;
      }

      socket.to(config.roomId).emit("call:ice-candidate", {
        from: user,
        candidate: payload.candidate,
        timestamp: Date.now(),
      });
    });

    socket.on("call:end", (payload) => {
      const user = findUserBySocketId(socket.id);
      if (!user) {
        return;
      }

      socket.to(config.roomId).emit("call:end", {
        from: user,
        reason: String(payload?.reason || "ended"),
        timestamp: Date.now(),
      });
      clearPendingCallForSocket(socket.id);
    });

    socket.on("disconnect", () => {
      const user = usersBySocket.get(socket.id);
      if (!user) {
        return;
      }

      usersBySocket.delete(socket.id);
      lastSeenByName.set(userKey(user.name), Date.now());
      clearPendingCallForSocket(socket.id);
      socket.to(config.roomId).emit("typing", {
        name: user.name,
        isTyping: false,
        timestamp: Date.now(),
      });
      socket.to(config.roomId).emit("call:end", {
        from: { name: user.name, avatarUrl: user.avatarUrl },
        reason: "disconnect",
        timestamp: Date.now(),
      });
      emitSystem(`${user.name} odadan ayrıldı.`, "systemLeft", { name: user.name });
      emitRoster();
    });
  });

  function findAvailablePort(preferredPort, host = config.host) {
    return new Promise((resolve, reject) => {
      const tester = net.createServer();
      tester.unref();

      tester.once("error", (error) => {
        if (error.code === "EADDRINUSE") {
          findAvailablePort(preferredPort + 1, host).then(resolve).catch(reject);
          return;
        }
        reject(error);
      });

      tester.once("listening", () => {
        const address = tester.address();
        tester.close(() => resolve(address.port));
      });

      tester.listen(preferredPort, host);
    });
  }

  function start() {
    return new Promise((resolve, reject) => {
      findAvailablePort(config.port)
        .then((selectedPort) => {
          config.port = selectedPort;

          const onError = (error) => {
            server.off("listening", onListening);
            reject(error);
          };

          const onListening = () => {
            server.off("error", onError);
            console.log(`Pingle is running at http://localhost:${config.port}`);
            resolve();
          };

          server.once("error", onError);
          server.once("listening", onListening);
          server.listen(config.port, config.host);
        })
        .catch(reject);
    });
  }

  function stop() {
    return new Promise((resolve) => {
      io.close(() => {
        server.close(() => resolve());
      });
    });
  }

  return { config, app, server, io, start, stop };
}

if (require.main === module) {
  const instance = createChatServer();
  instance.start().catch((error) => {
    console.error("Failed to start Pingle:", error.message);
    process.exitCode = 1;
  });
}

module.exports = { createChatServer };
