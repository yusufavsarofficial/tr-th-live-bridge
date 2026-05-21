const { OAuth2Client } = require("google-auth-library");

const GOOGLE_CLIENT_IDS = (process.env.GOOGLE_CLIENT_IDS || "").split(",").filter(Boolean);

let _client = null;
function getClient() {
  if (!_client && GOOGLE_CLIENT_IDS.length > 0) {
    _client = new OAuth2Client(GOOGLE_CLIENT_IDS[0]);
  }
  return _client;
}

async function verifyGoogleToken(idToken) {
  const client = getClient();
  if (!client) {
    return { error: "Google auth not configured. Set GOOGLE_CLIENT_IDS." };
  }
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_IDS,
    });
    const payload = ticket.getPayload();
    return {
      ok: true,
      email: payload.email,
      name: payload.name || payload.email.split("@")[0],
      picture: payload.picture || null,
      sub: payload.sub,
    };
  } catch (err) {
    return { error: "Invalid Google ID token: " + err.message };
  }
}

function isConfigured() {
  return GOOGLE_CLIENT_IDS.length > 0;
}

module.exports = { verifyGoogleToken, isConfigured };
