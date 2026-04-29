const { pool } = require("../db/pool");

async function getRecipientToken(senderUsername) {
  const result = await pool.query(
    "SELECT token FROM push_tokens WHERE username <> $1 ORDER BY updated_at DESC LIMIT 1",
    [senderUsername]
  );
  return result.rows[0]?.token || "";
}

async function sendPushToPartner(senderUsername, payload) {
  const token = await getRecipientToken(senderUsername);
  if (!token) return;

  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        to: token,
        sound: "default",
        priority: "high",
        ...payload
      })
    });
  } catch {
    // Push is best-effort; database history still guarantees delivery on next open.
  }
}

module.exports = { sendPushToPartner };
