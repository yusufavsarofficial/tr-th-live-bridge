const { pool } = require("./pool");

const { encryptValue } = require("../services/encryptionService");

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
      receiver_username TEXT,
      status TEXT NOT NULL DEFAULT 'sent',
      read_by TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS original_text_encrypted TEXT;");
  await pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS translated_text_encrypted TEXT;");
  await pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS audio_url_encrypted TEXT;");
  await pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS receiver_username TEXT;");
  await pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'sent';");
  await pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();");
  await pool.query(`
    UPDATE messages
    SET receiver_username = CASE WHEN sender_username = 'Yusuf' THEN 'Neeja' ELSE 'Yusuf' END
    WHERE receiver_username IS NULL
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_messages_room_created_at ON messages (room_code, created_at DESC);");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_messages_sender_created_at ON messages (sender_username, created_at DESC);");

  const plaintextRows = await pool.query(`
    SELECT id, original_text, translated_text, audio_url
    FROM messages
    WHERE (original_text IS NOT NULL AND original_text_encrypted IS NULL)
       OR (translated_text IS NOT NULL AND translated_text_encrypted IS NULL)
       OR (audio_url IS NOT NULL AND audio_url_encrypted IS NULL)
    LIMIT 5000
  `);

  for (const row of plaintextRows.rows) {
    await pool.query(`
      UPDATE messages
      SET original_text_encrypted = COALESCE(original_text_encrypted, $2),
          translated_text_encrypted = COALESCE(translated_text_encrypted, $3),
          audio_url_encrypted = COALESCE(audio_url_encrypted, $4),
          original_text = NULL,
          translated_text = NULL,
          audio_url = NULL
      WHERE id = $1
    `, [
      row.id,
      row.original_text === null ? null : encryptValue(row.original_text),
      row.translated_text === null ? null : encryptValue(row.translated_text),
      row.audio_url === null ? null : encryptValue(row.audio_url)
    ]);
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS call_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      room_code TEXT NOT NULL,
      call_id TEXT NOT NULL UNIQUE,
      caller_username TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ringing',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      answered_at TIMESTAMPTZ,
      ended_at TIMESTAMPTZ
    );
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_call_events_pending ON call_events (room_code, status, created_at DESC);");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_tokens (
      username TEXT PRIMARY KEY,
      token TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS location_shares (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      accuracy DOUBLE PRECISION,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_location_shares_user_created_at ON location_shares (user_id, created_at DESC);");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_location_shares_expires_at ON location_shares (expires_at);");
  await pool.query("DELETE FROM location_shares WHERE expires_at < NOW();");
}

module.exports = { initDb };
