const NAME_REGEX = /^[\p{L}0-9 ._-]{2,24}$/u;

function validateName(name) {
  if (!name) return "Name is required.";
  if (!NAME_REGEX.test(name)) return "Name must be 2-24 chars and can include letters, numbers, dot, underscore, dash.";
  return null;
}

function sanitizeText(text, maxLength) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function validateAttachment(attachment, maxBytes) {
  if (!attachment || typeof attachment !== "object") return null;
  const mime = String(attachment.mimeType || "").slice(0, 80);
  const dataUrl = String(attachment.dataUrl || "");
  const size = Number(attachment.size) || 0;
  if (!dataUrl.startsWith("data:") || size <= 0 || size > maxBytes) return null;
  return { name: String(attachment.name || "file").slice(0, 80), mimeType: mime, dataUrl, size, kind: ["image", "audio", "file"].includes(attachment.kind) ? attachment.kind : "file" };
}

module.exports = { validateName, sanitizeText, validateAttachment };
