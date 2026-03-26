import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { getPoints as getClientPoints } from "./clientApi";
import DashboardShell from "./DashboardShell";
import { xtOutlineBtn } from "./brandTheme";

const CLIENT_NAV = [
  { to: "/client/requests", label: "合作意向" },
  { to: "/client/orders", label: "订单跟踪" },
  { to: "/client/market-orders", label: "达人领单" },
  { to: "/client/skus", label: "SKU 列表" },
  { to: "/client/works", label: "达人作品" },
  { to: "/client/points", label: "积分充值" },
  { to: "/client/op-logs", label: "我的操作日志" },
];

/**
 * 客户端布局：侧栏导航 + 子路由出口。
 */
export default function ClientLayout() {
  const [balance, setBalance] = useState<number | null>(null);
  const balanceTimerRef = useState<{ id: number | null; fired: boolean }>({ id: null, fired: false })[0];

  /**
   * 加载客户端当前积分余额，用于在导航顶部展示。
   */
  const loadBalance = async () => {
    try {
      const data = await getClientPoints();
      setBalance(typeof data?.balance === "number" ? data.balance : 0);
    } catch {
      setBalance(null);
    }
  };

  useEffect(() => {
    /**
     * 性能优化（仅生产环境）：登录跳转到客户端首屏时，余额请求延后 200ms，
     * 避免与首屏资源/路由渲染竞争；若用户在 200ms 内发生交互，则立即触发请求。
     */
    /** 触发余额请求（确保只触发一次）。 */
    const fire = () => {
      if (balanceTimerRef.fired) return;
      balanceTimerRef.fired = true;
      loadBalance();
    };
    if (!import.meta.env.PROD) {
      fire();
      return;
    }
    /** 用户意图触发：在用户交互前置拉取余额，避免感知延迟。 */
    const onUserIntent = () => fire();
    window.addEventListener("pointerdown", onUserIntent, { passive: true, once: true });
    window.addEventListener("keydown", onUserIntent, { passive: true, once: true } as any);
    balanceTimerRef.id = window.setTimeout(fire, 200) as unknown as number;
    return () => {
      window.removeEventListener("pointerdown", onUserIntent as any);
      window.removeEventListener("keydown", onUserIntent as any);
      if (balanceTimerRef.id != null) window.clearTimeout(balanceTimerRef.id);
    };
  }, []);

  return (
    <DashboardShell
      roleTitle="客户端"
      navItems={CLIENT_NAV}
      mainMaxWidth={1200}
      logoutVariant="danger"
      headerExtra={
        <>
          <span style={{ fontSize: 13, color: "var(--xt-text-muted)" }}>
            余额：
            <span style={{ fontWeight: 700, color: "var(--xt-primary)" }}>
              {balance == null ? "—" : balance}
            </span>
          </span>
          <button
            type="button"
            onClick={loadBalance}
            style={{ ...xtOutlineBtn, padding: "6px 10px", fontSize: 13 }}
          >
            刷新余额
          </button>
        </>
      }
    >
      <Outlet />
    </DashboardShell>
  );
}
