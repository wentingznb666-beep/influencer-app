/**
 * 解析日期参数（YYYY-MM-DD），非法时返回空字符串。
 */
export function normalizeDateOnly(value: unknown): string {
  if (typeof value !== "string") return "";
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "";
  return v;
}
