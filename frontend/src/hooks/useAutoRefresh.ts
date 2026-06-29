/**
 * 订单/消息自动刷新 Hook。
 * 每 N 秒轮询一次订单数变化，有新订单时播放提示音。
 */
import { useEffect, useRef, useCallback } from "react";
import { playNotificationSound, resumeAudioContext } from "../notificationSound";

export interface UseAutoRefreshOptions {
  /** 轮询间隔（毫秒），默认 30000（30 秒） */
  intervalMs?: number;
  /** 是否启用轮询，默认 true */
  enabled?: boolean;
  /** 获取当前订单总数的回调 */
  fetchCount: () => Promise<number>;
  /** 新订单到来时的回调（可选，可在此触发 UI 刷新） */
  onNewOrder?: () => void;
}

/**
 * 自动轮询并检测新订单。当订单数增加时触发回调并播放提示音。
 *
 * 用法：
 * ```tsx
 * const [list, setList] = useState<Order[]>([]);
 * const load = useCallback(async () => { ... }, []);
 *
 * useAutoRefresh({
 *   fetchCount: async () => {
 *     const res = await api.getOrders();
 *     return res.list.length;
 *   },
 *   onNewOrder: () => load(),
 * });
 * ```
 */
export function useAutoRefresh(options: UseAutoRefreshOptions): void {
  const {
    intervalMs = 30000,
    enabled = true,
    fetchCount,
    onNewOrder,
  } = options;

  const prevCountRef = useRef<number | null>(null);
  const onNewOrderRef = useRef(onNewOrder);
  const fetchCountRef = useRef(fetchCount);

  onNewOrderRef.current = onNewOrder;
  fetchCountRef.current = fetchCount;

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval>;
    let running = false;

    const check = async () => {
      if (running) return;
      running = true;
      try {
        const current = await fetchCountRef.current();
        if (prevCountRef.current !== null && current > prevCountRef.current) {
          playNotificationSound();
          onNewOrderRef.current?.();
        }
        prevCountRef.current = current;
      } catch {
        // 网络错误静默跳过，下次重试
      } finally {
        running = false;
      }
    };

    // 首次建立基准（不触发通知）
    fetchCountRef
      .current()
      .then((c) => {
        prevCountRef.current = c;
      })
      .catch(() => {});

    timer = setInterval(check, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs, enabled]);

  // 全局自定义事件：点击消息跳转后触发刷新（由 DashboardShell 发射）
  useEffect(() => {
    const handler = () => {
      // 恢复 AudioContext 解决浏览器自动播放策略
      resumeAudioContext();
      onNewOrderRef.current?.();
    };
    window.addEventListener("hermes:refresh-orders", handler);
    return () => window.removeEventListener("hermes:refresh-orders", handler);
  }, []);
}

export default useAutoRefresh;
