const MESSAGE_TYPES = new Set(["text", "image", "audio", "video", "file", "system"]);

export function requireString(value: unknown, fieldName: string) {
  const text = optionalString(value);
  if (!text) {
    throw new Error(`${fieldName}_required`);
  }

  return text;
}

export function optionalString(value: unknown) {
  if (typeof value !== "string") return undefined;

  const text = value.trim();
  return text || undefined;
}

export function isValidMessageType(value: unknown) {
  return typeof value === "string" && MESSAGE_TYPES.has(value);
}
