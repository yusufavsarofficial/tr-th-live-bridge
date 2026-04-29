const express = require("express");
const { pool } = require("../db/pool");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

router.post("/api/push-token", authMiddleware, async (req, res) => {
  const token = String(req.body?.token || "");
  if (!token.startsWith("ExponentPushToken[")) return res.status(400).json({ error: "INVALID_PUSH_TOKEN" });

  await pool.query(`
    INSERT INTO push_tokens (username, token, updated_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (username)
    DO UPDATE SET token = EXCLUDED.token, updated_at = NOW()
  `, [req.user.username, token]);

  res.json({ ok: true });
});

module.exports = { pushRouter: router };
