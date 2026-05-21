const express = require("express");
const http = require("http");
const path = require("path");
const compression = require("compression");
const helmet = require("helmet");
const morgan = require("morgan");
const { Server } = require("socket.io");
const webPush = require("web-push");

const { config } = require("./config");
const { createHealthRouter, createApiRouter } = require("./routes");
const { createAuthRouter } = require("./routes/auth");
const { createContactRouter } = require("./routes/contacts");
const { createConversationRouter } = require("./routes/conversations");
const { createSocketHandlers } = require("./sockets");
const { createConversationHandlers } = require("./sockets/conversationHandlers");
const { getStorage, getStorageAsync } = require("./storage");
const { createPushService } = require("./services/push");
const { createFcmPushService } = require("./services/fcmPush");
const { requireAuth, socketAuth } = require("./middleware/auth");

async function createApp() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: config.corsOrigin, methods: ["GET", "POST"] },
  });

  io.use(socketAuth);

  const storage = await getStorageAsync();
  const historyResult = await storage.readHistory();
  const history = historyResult?.history || [];
  const pushSubscriptions = new Map();
  const pushService = createPushService(config);
  const fcmPushService = createFcmPushService(config);
  fcmPushService.initialize();

  const vapidKeys = await initializeVapid();

  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: { useDefaults: true, directives: { "script-src": ["'self'"], "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"], "font-src": ["'self'", "https://fonts.gstatic.com"], "img-src": ["'self'", "data:", "blob:", "https:"], "media-src": ["'self'", "blob:", "data:"], "connect-src": ["'self'", "ws:", "wss:"], "worker-src": ["'self'"] } } }));
  app.use(compression());
  app.use(morgan("tiny"));
  app.use(express.json({ limit: "5mb" }));
  app.use(express.static(path.join(__dirname, "..", "public")));

  const handlers = createSocketHandlers(io, config, history, pushSubscriptions, vapidKeys, storage, pushService);
  handlers.setup();

  const convHandlers = createConversationHandlers(io, storage, fcmPushService);
  io.on("connection", (socket) => convHandlers.setup(socket));

  app.use("/health", createHealthRouter(() => handlers.getPublicUsers()));
  app.use("/api/v1/auth", createAuthRouter(storage));
  app.use("/api/v1/contacts", createContactRouter(storage));
  app.use("/api/v1/conversations", createConversationRouter(storage, fcmPushService));
  app.use("/api/v1", requireAuth, createApiRouter(io, history, pushSubscriptions, vapidKeys, (keys, subs) => storage.persistNotificationState(keys, subs), pushSubscriptions, () => handlers.getPublicUsers(), () => handlers.clearHistory(), (text, key, vars) => handlers.emitSystem(text, key, vars), storage));
  app.use("/api", createApiRouter(io, history, pushSubscriptions, vapidKeys, (keys, subs) => storage.persistNotificationState(keys, subs), pushSubscriptions, () => handlers.getPublicUsers(), () => handlers.clearHistory(), (text, key, vars) => handlers.emitSystem(text, key, vars), storage));

  async function initializeVapid() {
    const stored = await storage.readNotificationState();
    const keys = config.vapidPublicKey && config.vapidPrivateKey
      ? { publicKey: config.vapidPublicKey, privateKey: config.vapidPrivateKey }
      : stored?.vapidKeys?.publicKey && stored?.vapidKeys?.privateKey
        ? stored.vapidKeys
        : webPush.generateVAPIDKeys();

    if (Array.isArray(stored?.subscriptions)) {
      stored.subscriptions.forEach((record) => {
        const ep = String(record?.subscription?.endpoint || "");
        if (ep) pushSubscriptions.set(ep, { name: String(record.name || "").trim().slice(0, 24), lang: record.lang === "th" ? "th" : "tr", subscription: record.subscription, updatedAt: Number(record.updatedAt) || Date.now() });
      });
    }

    pushService.initialize(keys, pushSubscriptions);
    storage.persistNotificationState(keys, pushSubscriptions);
    return keys;
  }

  return { app, server, io, config };
}

function startServer(instance) {
  const { server, config } = instance;
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, () => {
      console.log(`Nova is running at http://localhost:${config.port}`);
      resolve();
    });
  });
}

if (require.main === module) {
  createApp()
    .then((instance) => startServer(instance))
    .catch((err) => {
      console.error("Failed to start:", err.message);
      process.exitCode = 1;
    });
}

module.exports = { createApp, startServer };
