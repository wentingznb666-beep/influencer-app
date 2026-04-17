import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { getPoints as getInfluencerPoints } from "./influencerApi";
import DashboardShell from "./DashboardShell";
import { xtOutlineBtn } from "./brandTheme";
import { normalizeAccountText } from "./utils/accountText";

/**
 * Preload common influencer pages for faster navigation.
 */
function preloadInfluencerRoutes(): Record<string, () => void> {
  if (!import.meta.env.PROD) return {};
  return {
    "/influencer/client-orders": () => import("./influencer/ClientOrdersHallPage"),
    "/influencer/points": () => import("./influencer/PointsPage"),
    "/influencer/withdraw": () => import("./influencer/WithdrawPage"),
  };
}

/**
 * Influencer layout with navigation and balance header.
 */
export default function InfluencerLayout() {
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const balanceTimerRef = useState<{ id: number | null; fired: boolean }>({ id: null, fired: false })[0];
  const preloadMap = preloadInfluencerRoutes();

  /**
   * Load influencer points balance for header display.
   */
  const loadBalance = async () => {
    setBalanceLoading(true);
    setBalanceError(null);
    try {
      const data = await getInfluencerPoints();
      setBalance(typeof data?.balance === "number" ? data.balance : 0);
    } catch {
      setBalance(null);
      setBalanceError("刷新失败");
    } finally {
      setBalanceLoading(false);
    }
  };

  useEffect(() => {
    /** Trigger the balance load exactly once. */
    const fire = () => {
      if (balanceTimerRef.fired) return;
      balanceTimerRef.fired = true;
      void loadBalance();
    };
    if (!import.meta.env.PROD) {
      fire();
      return;
    }
    /** Listen for first user intent to preload balance. */
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
        { to: "/influencer/client-orders", label: "商家端发单", preload: preloadMap["/influencer/client-orders"] },
        { to: "/influencer/points", label: "积分与收益", preload: preloadMap["/influencer/points"] },
        { to: "/influencer/withdraw", label: "申请提现", preload: preloadMap["/influencer/withdraw"] },
        { to: "/influencer/task-hall", label: "任务大厅" },
        { to: "/influencer/payment-profile", label: "收款信息" },
        { to: "/influencer/permission", label: "撮合权限申请" },
        { to: "/influencer/demands", label: "发布合作需求" },
        { to: "/influencer/op-logs", label: "我的操作日志" },
      ]}
      mainMaxWidth={900}
      headerExtra={
        <>
          <span style={{ fontSize: 13, color: "var(--xt-text-muted)" }}>
            {normalizeAccountText("余额")}
            <span style={{ fontWeight: 700, color: "var(--xt-primary)" }}>
              {balanceLoading ? "..." : balance == null ? "—" : balance}
            </span>
          </span>
          <button
            type="button"
            onClick={() => void loadBalance()}
            disabled={balanceLoading}
            style={{ ...xtOutlineBtn, padding: "6px 10px", fontSize: 13, opacity: balanceLoading ? 0.7 : 1 }}
          >
            {balanceLoading ? "刷新中..." : normalizeAccountText("刷新余额")}
          </button>
          {balanceError && <span style={{ fontSize: 12, color: "#b91c1c" }}>{balanceError}</span>}
        </>
      }
    >
      <Outlet />
    </DashboardShell>
  );
}
