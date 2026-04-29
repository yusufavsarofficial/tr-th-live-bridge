const OpenAI = require("openai");
const { env } = require("../config/env");

const langNames = { tr: "Turkish", th: "Thai" };
const TRANSLATION_TIMEOUT_MS = 15000;
const promptByPair = {
  "tr:th": "Translate from Turkish to natural, short Thai. Do not add explanations. Return only the translation.",
  "th:tr": "Translate from Thai to natural, short Turkish. Do not add explanations. Return only the translation."
};

async function translateMessage(text, sourceLang, targetLang) {
  if (!text || sourceLang === targetLang) return text || "";
  if (env.translationProvider !== "openai") return "";
  if (!env.openaiApiKey || env.openaiApiKey === "CHANGE_ME") {
    const error = new Error("OpenAI API key is not configured.");
    error.code = "OPENAI_API_KEY_MISSING";
    throw error;
  }

  const client = new OpenAI({ apiKey: env.openaiApiKey, timeout: TRANSLATION_TIMEOUT_MS });
  const systemPrompt = promptByPair[`${sourceLang}:${targetLang}`] || "Translate the private chat message naturally and briefly. Do not add explanations. Return only the translation.";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRANSLATION_TIMEOUT_MS);
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Source language: ${langNames[sourceLang] || sourceLang}\nTarget language: ${langNames[targetLang] || targetLang}\nText:\n${text}` }
      ]
    }, { signal: controller.signal });
    return response.choices[0]?.message?.content?.trim() || "";
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { translateMessage };
