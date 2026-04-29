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
const { uploadsRouter, uploadDir } = require("./routes/uploads");
const { registerSockets } = require("./sockets");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: env.corsOrigin, methods: ["GET", "POST"] } });

app.use(helmet());
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 60 * 1000, max: 120 }));
app.use("/uploads", express.static(uploadDir, { dotfiles: "deny", immutable: true, maxAge: "1h" }));
app.get("/api/rtc-config", (req, res) => {
  const iceServers = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:global.stun.twilio.com:3478" }];
  if (env.turn.url && env.turn.username && env.turn.password) {
    iceServers.push({ urls: env.turn.url, username: env.turn.username, credential: env.turn.password });
  }
  res.json({ iceServers });
});
app.use(healthRouter);
app.use(authRouter);
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
