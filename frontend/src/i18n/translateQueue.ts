/**
 * 根据当前路由估算默认的自动翻译补全优先级（数值越小越优先）。
 */
export function defaultPathTranslatePriority(pathname: string): number {
  if (pathname.startsWith("/admin")) return 10;
  if (pathname.startsWith("/employee")) return 20;
  if (pathname.startsWith("/client")) return 30;
  if (pathname.startsWith("/influencer")) return 40;
  return 100;
}

/**
 * 从元素向上查找最近的 data-translate-priority 数值；无效则回落到路由默认优先级。
 */
export function readTranslatePriorityFromAncestors(el: Element | null, pathDefault: number): number {
  let cur: Element | null = el;
  while (cur) {
    if (cur.hasAttribute("data-translate-priority")) {
      const raw = cur.getAttribute("data-translate-priority") ?? "";
      const n = Number(raw);
      if (!Number.isNaN(n)) return n;
    }
    cur = cur.parentElement;
  }
  return pathDefault;
}

export type PendingKey = { key: string; pri: number };

/**
 * 合并同一中文 key 的多处出现：取更小优先级（更高优先）。
 */
export function mergePendingByMinPriority(items: PendingKey[]): PendingKey[] {
  const map = new Map<string, number>();
  for (const it of items) {
    const prev = map.get(it.key);
    if (prev === undefined || it.pri < prev) map.set(it.key, it.pri);
  }
  return Array.from(map.entries()).map(([key, pri]) => ({ key, pri }));
}

/**
 * 排序待请求批次：优先级升序，其次按文本长度降序（通常标题更长）。
 */
export function sortPendingForBatch(items: PendingKey[]): string[] {
  const copy = [...items];
  copy.sort((a, b) => {
    if (a.pri !== b.pri) return a.pri - b.pri;
    return b.key.length - a.key.length;
  });
  return copy.map((x) => x.key);
}

/**
 * 计算指数退避的毫秒延迟（带抖动与上限）。
 */
export function computeBackoffMs(attemptIndex: number, baseMs: number, maxMs: number): number {
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attemptIndex));
  const jitter = 0.85 + Math.random() * 0.3;
  return Math.min(maxMs, Math.floor(exp * jitter));
}