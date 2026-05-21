const { verifyToken } = require("../services/auth");

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ ok: false, error: "Authentication required." });
    return;
  }
  const payload = verifyToken(header.slice(7));
  if (!payload) {
    res.status(401).json({ ok: false, error: "Invalid or expired token." });
    return;
  }
  req.user = payload;
  next();
}

function socketAuth(socket, next) {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      socket.user = payload;
    }
  }
  next();
}

module.exports = { requireAuth, socketAuth };
