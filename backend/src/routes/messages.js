const express = require("express");
const { pool } = require("../db/pool");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

router.get("/api/messages", authMiddleware, async (req, res) => {
  const result = await pool.query(`
    SELECT id, sender_username, sender_display_name, sender_lang, target_lang,
      original_text, translated_text, audio_url, message_type, read_by, created_at
    FROM (
      SELECT id, sender_username, sender_display_name, sender_lang, target_lang,
        original_text, translated_text, audio_url, message_type, read_by, created_at
      FROM messages
      WHERE room_code = $1
      ORDER BY created_at DESC
      LIMIT 200
    ) recent
    ORDER BY created_at ASC
  `, ["private-room"]);

  res.json({ messages: result.rows });
});

module.exports = { messagesRouter: router };
