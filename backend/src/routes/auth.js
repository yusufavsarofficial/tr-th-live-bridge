const bcrypt = require("bcryptjs");
const express = require("express");
const rateLimit = require("express-rate-limit");
const { env } = require("../config/env");
const { authMiddleware, createToken } = require("../middleware/auth");

const router = express.Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

router.post("/api/auth/login", loginLimiter, async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  const roomCode = String(req.body?.roomCode || "");
  if (!["Yusuf", "Neeja"].includes(username) || password.length > 256 || roomCode.length > 128) {
    return res.status(401).json({ error: "INVALID_CREDENTIALS" });
  }
  if (roomCode !== env.privateRoomCode) return res.status(403).json({ error: "INVALID_ROOM_CODE" });

  const user = env.getUsers().find((item) => item.username === username);
  if (!user) return res.status(401).json({ error: "INVALID_CREDENTIALS" });
  if (!user.passwordHash.startsWith("$2")) return res.status(500).json({ error: "PASSWORD_HASH_NOT_CONFIGURED" });

  const validPassword = await bcrypt.compare(password || "", user.passwordHash);
  if (!validPassword) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

  const publicUser = { username: user.username, displayName: user.displayName, lang: user.lang };
  return res.json({ token: createToken(publicUser), user: publicUser });
});

router.get("/api/auth/verify", authMiddleware, (req, res) => {
  res.json({
    ok: true,
    user: {
      username: req.user.username,
      displayName: req.user.displayName,
      lang: req.user.lang
    }
  });
});

module.exports = { authRouter: router };
