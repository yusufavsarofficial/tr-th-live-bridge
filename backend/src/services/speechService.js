const fs = require("fs");
const OpenAI = require("openai");
const { env } = require("../config/env");
const { translateMessage } = require("./translationService");

async function transcribeNeejaAudio(filePath) {
  if (!env.openaiApiKey || env.openaiApiKey === "CHANGE_ME") {
    return { originalText: "", translatedText: "", warning: "OPENAI_API_KEY_MISSING" };
  }

  const client = new OpenAI({ apiKey: env.openaiApiKey });
  const transcription = await client.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: "whisper-1",
    language: "th"
  });
  const originalText = transcription.text?.trim() || "";
  const translatedText = originalText ? await translateMessage(originalText, "th", "tr") : "";

  return { originalText, translatedText };
}

module.exports = { transcribeNeejaAudio };
