const OpenAI = require("openai");
const { env } = require("../config/env");

const langNames = { tr: "Turkish", th: "Thai" };

async function translateMessage(text, sourceLang, targetLang) {
  if (!text || sourceLang === targetLang) return text || "";
  if (env.translationProvider !== "openai") return "";
  if (!env.openaiApiKey || env.openaiApiKey === "CHANGE_ME") {
    const error = new Error("OpenAI API key is not configured.");
    error.code = "OPENAI_API_KEY_MISSING";
    throw error;
  }

  const client = new OpenAI({ apiKey: env.openaiApiKey });
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      { role: "system", content: "Translate the private chat message. Return only the translation." },
      { role: "user", content: `Translate from ${langNames[sourceLang] || sourceLang} to ${langNames[targetLang] || targetLang}: ${text}` }
    ]
  });
  return response.choices[0]?.message?.content?.trim() || "";
}

module.exports = { translateMessage };
