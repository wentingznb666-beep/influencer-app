import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { getPoints as getInfluencerPoints } from "./influencerApi";
import DashboardShell from "./DashboardShell";
import { xtOutlineBtn } from "./brandTheme";

/**
 * 达人端路由预加载：用于侧栏 hover 预取 chunk（仅生产环境）。
 */
function preloadInfluencerRoutes(): Record<string, () => void> {
  if (!import.meta.env.PROD) return {};
  return {
    "/influencer/tasks": () => import("./influencer/TaskHallPage"),
    "/influencer/client-orders": () => import("./influencer/ClientOrdersHallPage"),
    "/influencer/my-tasks": () => import("./influencer/MyTasksPage"),
    "/influencer/points": () => import("./influencer/PointsPage"),
    "/influencer/withdraw": () => import("./influencer/WithdrawPage"),
  };
}

/**
 * 达人端布局：侧栏导航 + 子路由出口。
 */
export default function InfluencerLayout() {
  const [balance, setBalance] = useState<number | null>(null);
  const balanceTimerRef = useState<{ id: number | null; fired: boolean }>({ id: null, fired: false })[0];
  const preloadMap = preloadInfluencerRoutes();

  /**
   * 加载达人当前积分余额，用于在导航顶部展示。
   */
  const loadBalance = async () => {
    try {
      const data = await getInfluencerPoints();
      setBalance(typeof data?.balance === "number" ? data.balance : 0);
    } catch {
      setBalance(null);
    }
  };

  useEffect(() => {
    /**
     * 性能优化（仅生产环境）：登录跳转到达人端首屏时，余额请求延后 200ms，
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
      roleTitle="达人端"
      navItems={[
        { to: "/influencer/tasks", label: "任务大厅", preload: preloadMap["/influencer/tasks"] },
        { to: "/influencer/client-orders", label: "客户端发单", preload: preloadMap["/influencer/client-orders"] },
        { to: "/influencer/my-tasks", label: "我的任务", preload: preloadMap["/influencer/my-tasks"] },
        { to: "/influencer/points", label: "积分与收益", preload: preloadMap["/influencer/points"] },
        { to: "/influencer/withdraw", label: "申请提现", preload: preloadMap["/influencer/withdraw"] },
        { to: "/influencer/op-logs", label: "我的操作日志" },
      ]}
      mainMaxWidth={900}
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
