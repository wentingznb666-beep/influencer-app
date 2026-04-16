/**
 * 将后端返回的 work_links（JSONB / 混合格式）规范为字符串数组。
 * @param val 数据库或接口返回的原始值
 */
export function normalizeWorkLinks(val: unknown): string[] {
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
