const jwt = require("jsonwebtoken");
const { env } = require("../config/env");

function createToken(user) {
  return jwt.sign(
    { username: user.username, displayName: user.displayName, lang: user.lang },
    env.jwtSecret,
    { expiresIn: "30d" }
  );
}

function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "AUTH_REQUIRED" });
  try {
    req.user = verifyToken(token);
    return next();
  } catch {
    return res.status(401).json({ error: "INVALID_TOKEN" });
  }
}

module.exports = { authMiddleware, createToken, verifyToken };
