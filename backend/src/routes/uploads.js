const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const { authMiddleware } = require("../middleware/auth");

const uploadDir = path.resolve(__dirname, "../../uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeExt = path.extname(file.originalname || ".m4a").replace(/[^.\w]/g, "") || ".m4a";
    cb(null, `${Date.now()}-${req.user.username}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("audio/")) return cb(new Error("ONLY_AUDIO_ALLOWED"));
    return cb(null, true);
  }
});

const router = express.Router();

router.post("/api/uploads/audio", authMiddleware, upload.single("audio"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "AUDIO_FILE_REQUIRED" });
  return res.json({ audioUrl: `/uploads/${req.file.filename}` });
});

module.exports = { uploadsRouter: router, uploadDir };
