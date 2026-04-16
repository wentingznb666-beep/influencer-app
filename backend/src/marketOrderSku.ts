/**
 * 达人领单订单 SKU 字段：JSONB 数组与前端展示用规范化。
 */

/**
 * 从数据库 JSONB 解析 SKU 编码/名称展示串列表（发单时存为「编码 / 名称」等）。
 */
export function normalizeSkuCodesFromDb(val: unknown): string[] {
  if (val == null) return [];
  if (Array.isArray(val)) return val.map((x) => String(x).trim()).filter((s) => s.length > 0);
  if (typeof val === "string") {
    const t = val.trim();
    if (!t) return [];
    try {
      const j = JSON.parse(t) as unknown;
      if (Array.isArray(j)) return j.map((x) => String(x).trim()).filter((s) => s.length > 0);
    } catch {
      return [t];
    }
  }
  return [];
}

/**
 * 从数据库 JSONB 解析 SKU 主键 ID 列表。
 */
export function normalizeSkuIdsFromDb(val: unknown): number[] {
  if (val == null) return [];
  if (Array.isArray(val)) {
    return val.map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0);
  }
  return [];
}

/**
 * 从数据库 JSONB 解析 SKU 配图 URL 列表。
 */
export function normalizeSkuImagesFromDb(val: unknown): string[] {
  if (val == null) return [];
  if (Array.isArray(val)) return val.map((x) => String(x).trim()).filter((s) => s.length > 0);
  if (typeof val === "string") {
    const t = val.trim();
    if (!t) return [];
    try {
      const j = JSON.parse(t) as unknown;
      if (Array.isArray(j)) return j.map((x) => String(x).trim()).filter((s) => s.length > 0);
    } catch {
      return [];
    }
  }
  return [];
}
