import { Outlet } from "react-router-dom";
import { useEffect } from "react";

import DashboardShell, { type DashboardNavItem } from "./DashboardShell";
import { useAppStore } from "./stores/AppStore";

const BASE_ADMIN_NAV: DashboardNavItem[] = [
  { to: "/admin/profit", label: "利润统计", icon: "📊", group: "common" },
  { to: "/admin/influencers", label: "达人管理", icon: "👥", group: "points" },
  { to: "/admin/models", label: "模特展示", icon: "🧑", group: "points" },
  { to: "/admin/showcase-influencers", label: "Influencer", icon: "⭐", group: "points" },
  { to: "/admin/showcase-content-creators", label: "Content Creator", icon: "✍", group: "points" },
  { to: "/admin/orders", label: "商家订单", icon: "📦", group: "points" },
  { to: "/admin/market-orders", label: "达人领单", icon: "📾", group: "points" },
  { to: "/admin/skus", label: "SKU 列表", icon: "📦", group: "points" },
  { to: "/admin/points", label: "积分与结算", icon: "🪙", group: "points" },
  { to: "/admin/settlement", label: "结算打款", icon: "💳", group: "points" },
  { to: "/admin/withdrawals", label: "提现管理", icon: "🏧", group: "points" },
  { to: "/admin/users", label: "账号管理", icon: "👤", group: "points" },
  { to: "/admin/merchant-members", label: "会员与保证金", icon: "👑", group: "match" },
  { to: "/admin/influencer-permissions", label: "达人撮合权限审核", icon: "✅", group: "match" },
  { to: "/admin/risk", label: "防删与风控", icon: "🛡", group: "common" },
  { to: "/admin/op-logs", label: "我的操作日志", icon: "📄", group: "common" },
];

/**
 * Admin layout wrapper and navigation container.
 */
export default function AdminLayout() {
  const { setRole } = useAppStore();

  /** Synchronize the current role into the global store. */
  useEffect(() => {
    setRole("admin");
  }, [setRole]);

  return (
    <DashboardShell roleTitle="管理员端" navItems={BASE_ADMIN_NAV} mainMaxWidth={1000}>
      <Outlet />
    </DashboardShell>
  );
}
