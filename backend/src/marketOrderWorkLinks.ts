/**
 * 达人领单订单「多条交付链接」：JSONB 数组与请求体验证。
 */

/** 单条链接最大长度 */
export const MAX_WORK_LINK_LEN = 2000;

/** 最多条数 */
export const MAX_WORK_LINK_COUNT = 50;

/**
 * 从数据库 JSONB / 兼容旧数据解析为字符串数组。
 */
export function normalizeWorkLinksFromDb(val: unknown): string[] {
  if (val == null) return [];
  if (Array.isArray(val)) {
    return val.map((x) => String(x).trim()).filter((s) => s.length > 0);
  }
  if (typeof val === "string") {
    const t = val.trim();
    if (!t) return [];
    try {
      const j = JSON.parse(t) as unknown;
      if (Array.isArray(j)) return j.map((x) => String(x).trim()).filter((s) => s.length > 0);
    } catch {
      return [t];
    }
    return [t];
  }
  return [];
}

/**
 * 从请求体解析 work_links 数组（忽略空串）。
 */
export function parseWorkLinksFromBody(body: unknown): string[] {
  if (body == null || typeof body !== "object") return [];
  const raw = (body as { work_links?: unknown }).work_links;
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x).trim()).filter((s) => s.length > 0);
}

/**
 * 校验完单时提交的链接列表；通过返回 null，否则返回错误文案。
 */
export function validateWorkLinksForComplete(links: string[]): string | null {
  if (links.length === 0) return "请至少填写一条交付链接。";
  if (links.length > MAX_WORK_LINK_COUNT) return `最多 ${MAX_WORK_LINK_COUNT} 条链接。`;
  for (const s of links) {
    if (s.length > MAX_WORK_LINK_LEN) return `单条链接最长 ${MAX_WORK_LINK_LEN} 字符。`;
  }
  return null;
}

/**
 * 校验管理端编辑的链接列表（允许空数组表示清空）。
 */
export function validateWorkLinksForAdminEdit(links: string[]): string | null {
  if (links.length > MAX_WORK_LINK_COUNT) return `最多 ${MAX_WORK_LINK_COUNT} 条链接。`;
  for (const s of links) {
    if (s.length > MAX_WORK_LINK_LEN) return `单条链接最长 ${MAX_WORK_LINK_LEN} 字符。`;
  }
  return null;
}