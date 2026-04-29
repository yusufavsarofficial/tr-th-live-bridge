const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { Server } = require("socket.io");
const { env } = require("./config/env");
const { initDb } = require("./db/init");
const { healthRouter } = require("./routes/health");
const { authRouter } = require("./routes/auth");
const { callsRouter } = require("./routes/calls");
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
  pingInterval: 25000
});

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
app.get("/apk/sevgilim-chat.apk", (req, res) => res.redirect(302, apkDownloadUrl));
app.get("/api/rtc-config", (req, res) => {
  const iceServers = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:global.stun.twilio.com:3478" }];
  if (env.turn.url && env.turn.username && env.turn.password) {
    iceServers.push({ urls: env.turn.url, username: env.turn.username, credential: env.turn.password });
  }
  res.json({ iceServers });
});
app.use(healthRouter);
app.use(authRouter);
app.use(callsRouter);
app.use(messagesRouter);
app.use(pushRouter);
app.use(uploadsRouter);
registerSockets(io);

async function start() {
  await initDb();
  server.listen(env.port, () => console.log(`Sevgilim Chat backend is running on port ${env.port}`));
}

start().catch((error) => {
  console.error("Backend failed to start", error);
  process.exit(1);
});
