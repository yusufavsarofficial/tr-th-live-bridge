const express = require("express");
const { pool } = require("../db/pool");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();
const LOCATION_TTL_HOURS = 24;
const MIN_LOCATION_INTERVAL_SECONDS = 45;

function parseCoordinate(value, min, max) {
  const next = Number(value);
  if (!Number.isFinite(next) || next < min || next > max) return null;
  return next;
}

function serializeLocation(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    accuracy: row.accuracy === null ? null : Number(row.accuracy),
    createdAt: row.created_at,
    expiresAt: row.expires_at
  };
}

async function saveLocation(username, payload = {}) {
  const latitude = parseCoordinate(payload.latitude, -90, 90);
  const longitude = parseCoordinate(payload.longitude, -180, 180);
  const accuracy = payload.accuracy === undefined || payload.accuracy === null ? null : Number(payload.accuracy);
  if (latitude === null || longitude === null || (accuracy !== null && !Number.isFinite(accuracy))) {
    const error = new Error("INVALID_LOCATION");
    error.statusCode = 400;
    throw error;
  }

  await pool.query("DELETE FROM location_shares WHERE expires_at < NOW();");
  const recent = await pool.query(`
    SELECT id, user_id, latitude, longitude, accuracy, created_at, expires_at
    FROM location_shares
    WHERE user_id = $1 AND created_at > NOW() - ($2::INT * INTERVAL '1 second') AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
  `, [username, MIN_LOCATION_INTERVAL_SECONDS]);
  if (recent.rowCount) return serializeLocation(recent.rows[0]);

  const result = await pool.query(`
    INSERT INTO location_shares (user_id, latitude, longitude, accuracy, expires_at)
    VALUES ($1, $2, $3, $4, NOW() + ($5::INT * INTERVAL '1 hour'))
    RETURNING id, user_id, latitude, longitude, accuracy, created_at, expires_at
  `, [username, latitude, longitude, accuracy, LOCATION_TTL_HOURS]);
  return serializeLocation(result.rows[0]);
}

async function getLatestPartnerLocation(username) {
  const result = await pool.query(`
    SELECT id, user_id, latitude, longitude, accuracy, created_at, expires_at
    FROM location_shares
    WHERE user_id <> $1 AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
  `, [username]);
  return serializeLocation(result.rows[0]);
}

async function getOwnLatestLocation(username) {
  const result = await pool.query(`
    SELECT id, user_id, latitude, longitude, accuracy, created_at, expires_at
    FROM location_shares
    WHERE user_id = $1 AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
  `, [username]);
  return serializeLocation(result.rows[0]);
}

router.post("/api/location", authMiddleware, async (req, res) => {
  try {
    const location = await saveLocation(req.user.username, req.body);
    return res.json({ ok: true, location });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "LOCATION_UPDATE_FAILED" });
  }
});

router.get("/api/location/latest", authMiddleware, async (req, res) => {
  const [partnerLocation, ownLocation] = await Promise.all([
    getLatestPartnerLocation(req.user.username),
    getOwnLatestLocation(req.user.username)
  ]);
  res.json({ partnerLocation, ownLocation });
});

module.exports = {
  locationsRouter: router,
  saveLocation,
  getLatestPartnerLocation,
  getOwnLatestLocation
};
