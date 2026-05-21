const THAI_REGEX = /[\u0E00-\u0E7F]/;
const TURKISH_CHAR_REGEX = /[A-Za-z\u00c7\u011e\u0130\u00d6\u015e\u00dc\u00e7\u011f\u0131\u00f6\u015f\u00fc]/;
const THAI_GLOBAL = /[\u0E00-\u0E7F]/g;
const TURKISH_GLOBAL = /[A-Za-z\u00c7\u011e\u0130\u00d6\u015e\u00dc\u00e7\u011f\u0131\u00f6\u015f\u00fc]/g;
const MOJIBAKE_REGEX = /(?:[\u00c3\u00c2\ufffd]|\u00e0\u00b8|\u00e0\u00b9|\u00c5|\u00c4)/;
const MOJIBAKE_GLOBAL = /(?:[\u00c3\u00c2\ufffd]|\u00e0\u00b8|\u00e0\u00b9|\u00c5|\u00c4)/g;
const TRANSLATE_CACHE_MAX = 2000;
const translationCache = new Map();

function detectSourceLanguage(text) {
  const thaiCount = (String(text).match(THAI_GLOBAL) || []).length;
  const turkishCount = (String(text).match(TURKISH_GLOBAL) || []).length;
  if (thaiCount > 0 && turkishCount === 0) return "th";
  if (thaiCount > 0 && turkishCount > 0) return thaiCount >= turkishCount ? "th" : "tr";
  return "tr";
}

function normalizeInput(value) {
  return repairMojibake(value).replace(/\s+/g, " ").trim();
}

function repairMojibake(value) {
  let best = String(value || "");
  let current = best;
  let bestScore = scoreTextEncoding(best);

  for (let i = 0; i < 3; i += 1) {
    const repaired = Buffer.from(current, "latin1").toString("utf8");
    const score = scoreTextEncoding(repaired);
    if (score > bestScore) {
      best = repaired;
      bestScore = score;
    }
    if (repaired === current) break;
    current = repaired;
  }

  return best;
}

function scoreTextEncoding(value) {
  const text = String(value || "");
  const thaiCount = (text.match(THAI_GLOBAL) || []).length;
  const mojibakeCount = (text.match(MOJIBAKE_GLOBAL) || []).length;
  const controlCount = (text.match(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g) || []).length;
  return thaiCount * 6 - mojibakeCount * 5 - controlCount * 10;
}

function createTranslationService(config) {
  const openaiClient = config.openaiApiKey ? new (require("openai"))({ apiKey: config.openaiApiKey }) : null;
  const { translate } = require("@vitalets/google-translate-api");

  async function safeTranslate(text, from, to) {
    const sourceText = normalizeInput(text);
    if (!sourceText || from === to) return sourceText;

    const sourceLang = normalizeLang(from, sourceText);
    const targetLang = normalizeLang(to, sourceText);
    const cacheKey = `${sourceLang}|${targetLang}|${sourceText}`;
    if (translationCache.has(cacheKey)) return translationCache.get(cacheKey);

    const openAiFirst = String(config.translationProvider || "").toLowerCase() !== "legacy";
    const attempts = openAiFirst
      ? [
          () => translateWithOpenAI(sourceText, sourceLang, targetLang),
          () => translateWithOpenAI(sourceText, "auto", targetLang),
          () => translateWithGoogle(sourceText, sourceLang, targetLang),
          () => translateWithMyMemory(sourceText, sourceLang, targetLang),
        ]
      : [
          () => translateWithGoogle(sourceText, sourceLang, targetLang),
          () => translateWithMyMemory(sourceText, sourceLang, targetLang),
          () => translateWithOpenAI(sourceText, sourceLang, targetLang),
        ];

    for (let i = 0; i < attempts.length; i += 1) {
      try {
        const translated = await withTimeout(attempts[i](), config.translateTimeoutMs);
        if (translated && (!isLikelyUntranslated(sourceText, translated, targetLang) || i >= attempts.length - 1)) {
          cacheTranslation(cacheKey, translated);
          return translated;
        }
      } catch {
        // Try the next provider.
      }
    }

    cacheTranslation(cacheKey, sourceText);
    return sourceText;
  }

  async function translateWithOpenAI(text, from, to) {
    if (!openaiClient) throw new Error("openai-not-configured");
    const fromLabel = from && from !== "auto" ? from : "auto-detect";
    const response = await openaiClient.responses.create({
      model: config.openaiTranslateModel,
      input: `You are a strict translation engine.\nTranslate the user's text from ${fromLabel} to ${to}.\nRules:\n- Return only the translated text.\n- No explanations, no quotes, no prefixes.\n- Preserve meaning and tone naturally.\n\n${text}`,
      temperature: 0,
      max_output_tokens: Math.max(64, text.length * 4),
    });
    return normalizeInput(response?.output_text || "");
  }

  async function translateWithGoogle(text, from, to) {
    const result = await translate(text, { from: from || "auto", to });
    return normalizeInput(result?.text || "");
  }

  async function translateWithMyMemory(text, from, to) {
    const sourceLang = from && from !== "auto" ? from : detectSourceLanguage(text);
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", text);
    url.searchParams.set("langpair", `${sourceLang}|${to}`);
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`mymemory-http-${response.status}`);

    const payload = await response.json();
    const result = normalizeInput(payload?.responseData?.translatedText || "");
    if (result) return decodeHtmlEntities(result);

    const matches = Array.isArray(payload?.matches) ? payload.matches : [];
    const best = matches.find((m) => normalizeInput(m?.translation));
    return decodeHtmlEntities(normalizeInput(best?.translation || ""));
  }

  function makeImmediateBilingualText(text) {
    const normalized = normalizeInput(text);
    const hasText = /[\p{L}\p{N}]/u.test(normalized);
    if (!hasText) return emptyBilingual(normalized);

    const sourceLang = detectSourceLanguage(normalized);
    if (sourceLang === "th") {
      return { sourceLang, trText: "", thText: normalized, primaryLang: "th", primaryText: normalized, secondaryLang: "tr", secondaryText: "" };
    }
    return { sourceLang: "tr", trText: normalized, thText: "", primaryLang: "tr", primaryText: normalized, secondaryLang: "th", secondaryText: "" };
  }

  async function makeBilingualText(text) {
    const immediate = makeImmediateBilingualText(text);
    if (!immediate.primaryText) return immediate;

    if (immediate.sourceLang === "th") {
      const trText = await safeTranslate(immediate.thText, "th", "tr");
      return { ...immediate, trText, secondaryText: trText };
    }

    const thText = await safeTranslate(immediate.trText, "tr", "th");
    return { ...immediate, thText, secondaryText: thText };
  }

  function cacheTranslation(cacheKey, translated) {
    translationCache.set(cacheKey, translated);
    if (translationCache.size > TRANSLATE_CACHE_MAX) {
      const firstKey = translationCache.keys().next().value;
      if (firstKey) translationCache.delete(firstKey);
    }
  }

  return { makeBilingualText, makeImmediateBilingualText, safeTranslate };
}

function normalizeLang(lang, text) {
  if (lang === "th" || lang === "tr" || lang === "en") return lang;
  if (lang === "auto") return "auto";
  return detectSourceLanguage(text);
}

function emptyBilingual(text) {
  return { sourceLang: "tr", trText: text, thText: text, primaryLang: "tr", primaryText: text, secondaryLang: "th", secondaryText: text };
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function isLikelyUntranslated(source, translated, targetLang) {
  const src = normalizeInput(source);
  const tr = normalizeInput(translated);
  if (!tr) return true;
  const questionMarks = (tr.match(/\?/g) || []).length;
  if (questionMarks >= 3 && questionMarks / Math.max(tr.length, 1) > 0.35) return true;
  if (MOJIBAKE_REGEX.test(tr)) return true;
  if (targetLang === "th" && TURKISH_CHAR_REGEX.test(src) && !THAI_REGEX.test(tr)) return true;
  if (targetLang === "tr" && THAI_REGEX.test(src) && THAI_REGEX.test(tr)) return true;
  if (src.length > 3 && tr.toLowerCase() === src.toLowerCase()) return true;
  return false;
}

async function withTimeout(promise, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("translate-timeout")), Number(timeoutMs) || 3500);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { createTranslationService, repairMojibake, detectSourceLanguage, normalizeInput };
