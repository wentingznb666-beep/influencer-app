/**
 * ????????????????????????????
 */

/**
 * ????UTF-8 ?? Latin-1/Windows-1252 ???????????
 */
function tryRepairUtf8Mojibake(input: string): string {
  try {
    const bytes = new Uint8Array(Array.from(input).map((ch) => ch.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return decoded;
  } catch {
    return input;
  }
}

/**
 * ????????????????????
 */
function scoreReadable(text: string): number {
  let score = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if ((code >= 0x4e00 && code <= 0x9fff) || /[A-Za-z0-9_.@\-\s]/.test(ch)) score += 2;
    else if (ch === "?" || ch === "?") score -= 3;
    else if (code < 0x20 || code === 0x7f) score -= 2;
    else score += 1;
  }
  return score;
}

/**
 * ???????????/?????
 */
export function normalizeAccountText(input: unknown): string {
  const raw = typeof input === "string" ? input : "";
  if (!raw) return "";

  // 1) decode escaped unicode like "\u4f60\u597d"
  let value = raw;
  for (let i = 0; i < 2; i += 1) {
    const decoded = value.replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)));
    if (decoded === value) break;
    value = decoded;
  }

  // 2) remove control chars and replacement-char runs
  value = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").replace(/\uFFFD+/g, "").trim();

  // 3) try mojibake repair and keep better candidate
  const repaired = tryRepairUtf8Mojibake(value).trim();
  if (scoreReadable(repaired) > scoreReadable(value)) value = repaired;

  // 4) if tail is polluted, keep first sane token
  const token = value.match(/^([A-Za-z0-9_.@-]{2,})/)?.[1];
  if (token && token.length < value.length) return token;

  // 5) compress excessive question marks
  value = value.replace(/\?{3,}/g, "?");
  return value;
}
