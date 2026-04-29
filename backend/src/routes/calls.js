const express = require("express");
const { pool } = require("../db/pool");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

router.get("/api/calls/pending", authMiddleware, async (req, res) => {
  const result = await pool.query(`
    SELECT call_id, caller_username, status, created_at
    FROM call_events
    WHERE room_code = $1
      AND caller_username <> $2
      AND status = 'ringing'
      AND created_at > NOW() - INTERVAL '2 minutes'
    ORDER BY created_at DESC
    LIMIT 1
  `, ["private-room", req.user.username]);

  res.json({ calls: result.rows });
});

module.exports = { callsRouter: router };
