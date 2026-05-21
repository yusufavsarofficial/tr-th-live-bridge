const THAI_REGEX = /[\u0E00-\u0E7F]/;
const TURKISH_CHAR_REGEX = /[A-Za-zÇĞİÖŞÜçğıöşü]/;
const THAI_GLOBAL = /[\u0E00-\u0E7F]/g;
const TURKISH_GLOBAL = /[A-Za-zÇĞİÖŞÜçğıöşü]/g;
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
  for (let i = 0; i < 3; i++) {
    const repaired = Buffer.from(current, "latin1").toString("utf8");
    const score = scoreTextEncoding(repaired);
    if (score > bestScore) { best = repaired; bestScore = score; }
    if (repaired === current) break;
    current = repaired;
  }
  return best;
}

function scoreTextEncoding(value) {
  const text = String(value || "");
  const thaiCount = (text.match(THAI_GLOBAL) || []).length;
  const mojibakeCount = (text.match(/[ÃÂ�]|à¸|à¹|Å|Ä/g) || []).length;
  const controlCount = (text.match(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g) || []).length;
  return thaiCount * 6 - mojibakeCount * 5 - controlCount * 10;
}

function createTranslationService(config) {
  const openaiClient = config.openaiApiKey ? new (require("openai"))({ apiKey: config.openaiApiKey }) : null;
  const { translate } = require("@vitalets/google-translate-api");

  async function safeTranslate(text, from, to) {
    const sourceText = normalizeInput(text);
    if (!sourceText || from === to) return sourceText;
    const cacheKey = `${from || "auto"}|${to}|${sourceText}`;
    if (translationCache.has(cacheKey)) return translationCache.get(cacheKey);

    const openAiFirst = config.translationProvider.toLowerCase() !== "legacy";
    const attempts = openAiFirst
      ? [
          () => translateWithOpenAI(sourceText, from, to),
          () => translateWithOpenAI(sourceText, "auto", to),
          () => translateWithGoogle(sourceText, from, to),
          () => translateWithMyMemory(sourceText, from, to),
        ]
      : [
          () => translateWithGoogle(sourceText, from, to),
          () => translateWithMyMemory(sourceText, from, to),
          () => translateWithOpenAI(sourceText, from, to),
        ];

    for (let i = 0; i < attempts.length; i++) {
      try {
        const translated = await withTimeout(attempts[i](), config.translateTimeoutMs);
        if (translated && (!isLikelyUntranslated(sourceText, translated, to) || i >= attempts.length - 1)) {
          translationCache.set(cacheKey, translated);
          if (translationCache.size > TRANSLATE_CACHE_MAX) {
            const firstKey = translationCache.keys().next().value;
            if (firstKey) translationCache.delete(firstKey);
          }
          return translated;
        }
      } catch { /* try next */ }
    }
    translationCache.set(cacheKey, sourceText);
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
    const best = matches.find(m => normalizeInput(m?.translation));
    return decodeHtmlEntities(normalizeInput(best?.translation || ""));
  }

  function decodeHtmlEntities(value) {
    return String(value || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  }

  function isLikelyUntranslated(source, translated, targetLang) {
    const src = normalizeInput(source);
    const tr = normalizeInput(translated);
    if (!tr) return true;
    if (/[ÃÂ�]|à¸|à¹|Å|Ä/.test(tr)) return true;
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
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("translate-timeout")), timeoutMs); }),
      ]);
    } finally { clearTimeout(timer); }
  }

  async function makeBilingualText(text) {
    const normalized = normalizeInput(text);
    const hasText = /[\p{L}\p{N}]/u.test(normalized);
    if (!hasText) return { sourceLang: "tr", trText: normalized, thText: normalized, primaryLang: "tr", primaryText: normalized, secondaryLang: "th", secondaryText: normalized };
    const sourceLang = detectSourceLanguage(normalized);
    if (sourceLang === "th") {
      const trText = await safeTranslate(normalized, "th", "tr");
      return { sourceLang, trText, thText: normalized, primaryLang: "th", primaryText: normalized, secondaryLang: "tr", secondaryText: trText };
    }
    const thText = await safeTranslate(normalized, "tr", "th");
    return { sourceLang: "tr", trText: normalized, thText, primaryLang: "tr", primaryText: normalized, secondaryLang: "th", secondaryText: thText };
  }

  function makeImmediateBilingualText(text) {
    const normalized = normalizeInput(text);
    const hasText = /[\p{L}\p{N}]/u.test(normalized);
    if (!hasText) return { sourceLang: "tr", trText: normalized, thText: normalized, primaryLang: "tr", primaryText: normalized, secondaryLang: "th", secondaryText: normalized };
    const sourceLang = detectSourceLanguage(normalized);
    if (sourceLang === "th") return { sourceLang, trText: "", thText: normalized, primaryLang: "th", primaryText: normalized, secondaryLang: "tr", secondaryText: "" };
    return { sourceLang: "tr", trText: normalized, thText: "", primaryLang: "tr", primaryText: normalized, secondaryLang: "th", secondaryText: "" };
  }

  return { makeBilingualText, makeImmediateBilingualText, safeTranslate };
}

module.exports = { createTranslationService, repairMojibake, detectSourceLanguage, normalizeInput };
