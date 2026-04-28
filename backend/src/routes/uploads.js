const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const { authMiddleware } = require("../middleware/auth");
const { transcribeNeejaAudio } = require("../services/speechService");

const uploadDir = path.resolve(__dirname, "../../uploads");
fs.mkdirSync(uploadDir, { recursive: true });
const allowedExtensions = new Set([".aac", ".m4a", ".mp3", ".ogg", ".wav", ".webm"]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const incomingExt = path.extname(file.originalname || ".m4a").toLowerCase();
    const safeExt = allowedExtensions.has(incomingExt) ? incomingExt : ".m4a";
    cb(null, `${Date.now()}-${req.user.username}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
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

  if (req.user.username === "Neeja") {
    try {
      speech = await transcribeNeejaAudio(req.file.path);
    } catch (error) {
      speech = { originalText: "", translatedText: "", warning: error.code || "AUDIO_TRANSLATION_FAILED" };
    }
  }

  return res.json({
    audioUrl: `/uploads/${req.file.filename}`,
    originalText: speech.originalText || "",
    translatedText: speech.translatedText || "",
    warning: speech.warning
  });
});

module.exports = { uploadsRouter: router, uploadDir };
