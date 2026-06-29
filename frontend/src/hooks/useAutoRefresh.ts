/**
 * 订单/消息自动刷新 Hook。
 * - 每 N 秒轮询一次订单数变化，有新订单时播放提示音。
 * - 页面切换到后台时暂停轮询（省电省流量），切回前台时立即检查一次。
 * - 监听全局 `hermes:refresh-orders` 事件，支持消息点击触发刷新。
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
  // 标记是否刚由 visibility 变更触发了 refresh，避免同一次 load 被 setInterval 重复触发
  const justRefreshedRef = useRef(false);

  onNewOrderRef.current = onNewOrder;
  fetchCountRef.current = fetchCount;

  // 核心检测：获取计数并与上次比较
  const check = useCallback(async (isInitial?: boolean): Promise<void> => {
    try {
      const current = await fetchCountRef.current();
      if (!isInitial && prevCountRef.current !== null && current > prevCountRef.current) {
        playNotificationSound();
        onNewOrderRef.current?.();
      }
      prevCountRef.current = current;
    } catch {
      // 网络错误静默跳过，下次重试
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval>;
    let running = false;

    const guardedCheck = async () => {
      if (running) return;
      if (justRefreshedRef.current) return; // visibility 刚触发过，跳过这次
      running = true;
      try {
        await check();
      } finally {
        running = false;
      }
    };

    // 首次建立基准（不触发通知）
    check(true);

    timer = setInterval(guardedCheck, intervalMs);

    // 页面可见性：切后台停止轮询，切前台立刻检查
    const handleVisibility = () => {
      if (document.hidden) return;
      // 恢复 AudioContext
      resumeAudioContext();
      // 标记刚刷新，避免 setInterval 紧随其后又触发一次
      justRefreshedRef.current = true;
      guardedCheck();
      // 500ms 后清除标记
      setTimeout(() => { justRefreshedRef.current = false; }, 500);
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [intervalMs, enabled, check]);

  // 全局自定义事件：点击消息跳转后触发刷新（由 DashboardShell 发射）
  useEffect(() => {
    const handler = () => {
      resumeAudioContext();
      onNewOrderRef.current?.();
      // 仅更新基准，不重复通知
      fetchCountRef.current().then((c) => {
        prevCountRef.current = c;
      }).catch(() => {});
    };
    window.addEventListener("hermes:refresh-orders", handler);
    return () => window.removeEventListener("hermes:refresh-orders", handler);
  }, []);
}

export default useAutoRefresh;
