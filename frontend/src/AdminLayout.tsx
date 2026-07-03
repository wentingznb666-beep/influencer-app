import { Outlet } from "react-router-dom";
import { useEffect } from "react";

import DashboardShell, { type DashboardNavItem } from "./DashboardShell";
import { useAppStore } from "./stores/AppStore";

const BASE_ADMIN_NAV: DashboardNavItem[] = [
  { to: "/admin/profit", label: "利润统计", icon: "📊", group: "common" },
  { to: "/admin/influencers", label: "达人管理", icon: "👥", group: "match" },
  { to: "/admin/market-orders", label: "视频分级订单", icon: "🎬", group: "points" },
  { to: "/admin/showcase-influencers", label: "Influencer", icon: "⭐", group: "points" },
  { to: "/admin/showcase-content-creators", label: "Content Creator", icon: "✍", group: "points" },
  { to: "/admin/skus", label: "SKU 列表", icon: "📦", group: "points" },
  { to: "/admin/points", label: "视频分级结算", icon: "🪙", group: "points" },
  { to: "/admin/settlement", label: "结算打款", icon: "💳", group: "points" },
  { to: "/admin/withdrawals", label: "提现管理", icon: "🏧", group: "points" },
  { to: "/admin/users", label: "账号管理", icon: "👤", group: "common" },
  { to: "/admin/merchant-members", label: "会员与保证金", icon: "👑", group: "match" },
  { to: "/admin/influencer-permissions", label: "达人撮合权限审核", icon: "✅", group: "match" },
  { to: "/admin/cooperation-types", label: "合作业务类型配置", icon: "🧩", group: "match" },
  { to: "/admin/cooperation-orders", label: "合作订单工作台", icon: "🧾", group: "match" },
  { to: "/admin/risk", label: "防删与风控", icon: "🛡", group: "common" },
  { to: "/admin/op-logs", label: "我的操作日志", icon: "📄", group: "common" },
];

/** 手机端底部 Tab 栏显示的主要页面（最多 4 个）。 */
const ADMIN_TAB_ITEMS: DashboardNavItem[] = [
  { to: "/admin/profit", label: "利润", icon: "📊" },
  { to: "/admin/influencers", label: "达人", icon: "👥" },
  { to: "/admin/market-orders", label: "视频订单", icon: "🎬" },
  { to: "/admin/points", label: "结算", icon: "🪙" },
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
    <DashboardShell roleTitle="管理员端" navItems={BASE_ADMIN_NAV} tabItems={ADMIN_TAB_ITEMS} mainMaxWidth={1000}>
      <Outlet />
    </DashboardShell>
  );
}
