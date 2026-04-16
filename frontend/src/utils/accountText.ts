/**
 * 账号文本标准化工具：修复常见编码乱码与转义残留。
 */

/**
 * 尝试修复 UTF-8 被误按 Latin-1/Windows-1252 解码造成的乱码。
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
 * 对可读性进行打分：中文/常见账号字符得分更高。
 */
function scoreReadable(text: string): number {
  let score = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if ((code >= 0x4e00 && code <= 0x9fff) || /[A-Za-z0-9_.@\-\s]/.test(ch)) score += 2;
    else if (ch === "?" || ch === "？") score -= 3;
    else if (code < 0x20 || code === 0x7f) score -= 2;
    else score += 1;
  }
  return score;
}

/**
 * 解码各种 unicode 转义残留：\uXXXX、uXXXX、%uXXXX。
 */
function decodeLooseUnicodeEscapes(input: string): string {
  let value = input;
  for (let i = 0; i < 4; i += 1) {
    const decoded = value
      .replace(/\\\\u([0-9a-fA-F]{4})/g, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/%u([0-9a-fA-F]{4})/g, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)))
      // 放宽为全局 uXXXX 解码，兼容 u4f59u989d8693 这类脏串
      .replace(/u([0-9a-fA-F]{4})/g, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)));
    if (decoded === value) break;
    value = decoded;
  }
  return value;
}

/**
 * 统一标准化账号/昵称文本，尽量保证三端展示稳定可读。
 */
export function normalizeAccountText(input: unknown): string {
  const raw = typeof input === "string" ? input : "";
  if (!raw) return "";

  // 1) 先做 unicode 转义解码（含缺失反斜杠的 uXXXX 残留）
  let value = decodeLooseUnicodeEscapes(raw);

  // 2) 清理控制字符与替换字符
  value = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").replace(/\uFFFD+/g, "").trim();

  // 3) 尝试修复 mojibake，并保留更可读版本
  const repaired = tryRepairUtf8Mojibake(value).trim();
  if (scoreReadable(repaired) > scoreReadable(value)) value = repaired;

  // 4) 清理“中文后跟异常十六进制尾巴”
  value = value.replace(/([\u4e00-\u9fff])([0-9a-fA-F]{3,})$/g, "$1");

  // 5) 若前缀是健康账号且后缀脏数据，保留前缀
  const token = value.match(/^([A-Za-z0-9_.@-]{2,})/)?.[1];
  if (token && token.length < value.length) return token;

  // 6) 压缩连续问号，避免视觉污染
  value = value.replace(/\?{3,}/g, "?");
  return value;
}
