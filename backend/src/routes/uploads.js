const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const multer = require("multer");
const { authMiddleware } = require("../middleware/auth");
const { transcribeAudio } = require("../services/speechService");

const uploadDir = path.resolve(__dirname, "../../uploads");
fs.mkdirSync(uploadDir, { recursive: true });
const allowedExtensions = new Set([".aac", ".m4a", ".mp3", ".ogg", ".wav", ".webm"]);
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const AUDIO_TRANSLATION_FAILED_TEXT = "Çeviri alınamadı";

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const incomingExt = path.extname(file.originalname || ".m4a").toLowerCase();
    const safeExt = allowedExtensions.has(incomingExt) ? incomingExt : ".m4a";
    cb(null, `${crypto.randomUUID()}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_AUDIO_BYTES },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || ".m4a").toLowerCase();
    if (!file.mimetype.startsWith("audio/") || !allowedExtensions.has(ext)) return cb(new Error("ONLY_AUDIO_ALLOWED"));
    return cb(null, true);
  }
});

const router = express.Router();

router.post("/api/uploads/audio", authMiddleware, upload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "AUDIO_FILE_REQUIRED" });
  let speech = { originalText: "", translatedText: "" };

  try {
    const targetLang = req.user.lang === "tr" ? "th" : "tr";
    speech = await transcribeAudio(req.file.path, req.user.lang, targetLang);
  } catch (error) {
    speech = { originalText: "", translatedText: AUDIO_TRANSLATION_FAILED_TEXT, warning: error.code || "AUDIO_TRANSLATION_FAILED" };
  }
  if (speech.warning && !speech.translatedText) speech.translatedText = AUDIO_TRANSLATION_FAILED_TEXT;
  if (speech.warning) speech.warning = "AUDIO_TRANSLATION_FAILED";

  return res.json({
    audioUrl: `/uploads/${req.file.filename}`,
    originalText: speech.originalText || "",
    translatedText: speech.translatedText || "",
    warning: speech.warning
  });
});

router.use((error, req, res, next) => {
  if (error?.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "AUDIO_FILE_TOO_LARGE" });
  if (error) return res.status(400).json({ error: error.message || "UPLOAD_FAILED" });
  return next();
});

module.exports = { uploadsRouter: router, uploadDir };
