import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { getPoints as getClientPoints } from "./clientApi";
import DashboardShell from "./DashboardShell";
import { xtOutlineBtn } from "./brandTheme";

const CLIENT_NAV = [
  { to: "/client/requests", label: "合作意向" },
  { to: "/client/orders", label: "订单跟踪" },
  { to: "/client/market-orders", label: "达人领单" },
  { to: "/client/works", label: "达人作品" },
  { to: "/client/points", label: "积分充值" },
];

/**
 * 客户端布局：侧栏导航 + 子路由出口。
 */
export default function ClientLayout() {
  const [balance, setBalance] = useState<number | null>(null);

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
    loadBalance();
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
