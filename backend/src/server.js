const http = require("http");
const https = require("https");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { Server } = require("socket.io");
const { env } = require("./config/env");
const { initDb } = require("./db/init");
const { authMiddleware } = require("./middleware/auth");
const { healthRouter } = require("./routes/health");
const { authRouter } = require("./routes/auth");
const { callsRouter } = require("./routes/calls");
const { locationsRouter } = require("./routes/locations");
const { messagesRouter } = require("./routes/messages");
const { pushRouter } = require("./routes/push");
const { uploadsRouter, uploadDir } = require("./routes/uploads");
const { registerSockets } = require("./sockets");

const apkDownloadUrl = "https://expo.dev/artifacts/eas/x2d23kCJK2ZtDhvTDBhjLG.apk";
const app = express();
const server = http.createServer(app);
const allowedOrigins = env.corsOrigin.split(",").map((origin) => origin.trim()).filter(Boolean);
const corsOptions = {
  origin(origin, callback) {
    if (!origin || env.corsOrigin === "*" || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("CORS_NOT_ALLOWED"));
  }
};
const io = new Server(server, {
  cors: { ...corsOptions, methods: ["GET", "POST"] },
  maxHttpBufferSize: 1_000_000,
  pingTimeout: 30000,
  pingInterval: 25000,
  transports: ["websocket", "polling"]
});

function streamApk(res, url) {
  const request = https.get(url, (upstreamRes) => {
    if (upstreamRes.statusCode && upstreamRes.statusCode >= 300 && upstreamRes.statusCode < 400 && upstreamRes.headers.location) {
      upstreamRes.resume();
      streamApk(res, upstreamRes.headers.location);
      return;
    }
    if (upstreamRes.statusCode !== 200) {
      res.status(502).json({ error: "APK_DOWNLOAD_FAILED" });
      upstreamRes.resume();
      return;
    }
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader("Content-Disposition", "attachment; filename=\"sevgilim-chat.apk\"");
    res.setHeader("Cache-Control", "public, max-age=300");
    if (upstreamRes.headers["content-length"]) res.setHeader("Content-Length", upstreamRes.headers["content-length"]);
    upstreamRes.pipe(res);
  });
  request.on("error", () => {
    if (!res.headersSent) res.status(502).json({ error: "APK_DOWNLOAD_FAILED" });
  });
}

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({
  hsts: env.nodeEnv === "production" ? { maxAge: 31536000, includeSubDomains: true } : false
}));
app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false }));
app.use("/uploads", express.static(uploadDir, { dotfiles: "deny", immutable: true, maxAge: "1h" }));
app.get("/", (req, res) => res.json({
  ok: true,
  service: "sevgilim-chat-backend",
  apk: "/apk/sevgilim-chat.apk",
  health: "/health"
}));
app.get("/apk/sevgilim-chat.apk", (req, res) => streamApk(res, apkDownloadUrl));
app.get("/api/rtc-config", authMiddleware, (req, res) => {
  const iceServers = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:global.stun.twilio.com:3478" }];
  if (env.turn.url && env.turn.username && env.turn.password) {
    iceServers.push({ urls: env.turn.url, username: env.turn.username, credential: env.turn.password });
  }
  res.json({ iceServers });
});
app.use(healthRouter);
app.use(authRouter);
app.use(callsRouter);
app.use(locationsRouter);
app.use(messagesRouter);
app.use(pushRouter);
app.use(uploadsRouter);
registerSockets(io);

async function start() {
  await initDb();
  server.listen(env.port, () => console.log(`Sevgilim Chat backend is running on port ${env.port}`));
}

start().catch((error) => {
  console.error("Backend failed to start", error.message || "START_FAILED");
  process.exit(1);
});
