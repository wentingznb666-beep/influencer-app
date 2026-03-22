import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { getPoints as getInfluencerPoints } from "./influencerApi";
import DashboardShell from "./DashboardShell";
import { xtOutlineBtn } from "./brandTheme";

const INFLUENCER_NAV = [
  { to: "/influencer/tasks", label: "任务大厅" },
  { to: "/influencer/client-orders", label: "客户端发单" },
  { to: "/influencer/my-tasks", label: "我的任务" },
  { to: "/influencer/points", label: "积分与收益" },
  { to: "/influencer/withdraw", label: "申请提现" },
];

/**
 * 达人端布局：侧栏导航 + 子路由出口。
 */
export default function InfluencerLayout() {
  const [balance, setBalance] = useState<number | null>(null);

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
    loadBalance();
  }, []);

  return (
    <DashboardShell
      roleTitle="达人端"
      navItems={INFLUENCER_NAV}
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
