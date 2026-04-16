/**
 * 前端：订单 SKU 字段（与发单时写入的 JSONB 结构一致）。
 */

/**
 * 解析接口返回的 sku_codes 为字符串数组。
 */
export function normalizeSkuCodes(val: unknown): string[] {
  if (val == null) return [];
  if (Array.isArray(val)) return val.map((x) => String(x).trim()).filter((s) => s.length > 0);
  return [];
}

/**
 * 解析 sku_ids。
 */
export function normalizeSkuIds(val: unknown): number[] {
  if (val == null) return [];
  if (Array.isArray(val)) return val.map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0);
  return [];
}

/**
 * 解析 sku_images（图片 URL）。
 */
export function normalizeSkuImages(val: unknown): string[] {
  if (val == null) return [];
  if (Array.isArray(val)) return val.map((x) => String(x).trim()).filter((s) => s.length > 0);
  return [];
}
