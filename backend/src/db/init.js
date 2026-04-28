const { pool } = require("./pool");

async function initDb() {
  await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto;");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_code TEXT NOT NULL,
      sender_username TEXT NOT NULL,
      sender_display_name TEXT NOT NULL,
      sender_lang TEXT NOT NULL,
      target_lang TEXT NOT NULL,
      original_text TEXT,
      translated_text TEXT,
      audio_url TEXT,
      message_type TEXT NOT NULL DEFAULT 'text',
      read_by TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

module.exports = { initDb };
