import { Outlet } from "react-router-dom";
import { useEffect } from "react";

import DashboardShell, { type DashboardNavItem } from "./DashboardShell";
import { useAppStore } from "./stores/AppStore";

/**
 * Employee layout wrapper and navigation container.
 */
export default function EmployeeLayout() {
  const { setRole } = useAppStore();

  /** Synchronize the current role into the global store. */
  useEffect(() => {
    setRole("employee");
  }, [setRole]);

  const navItems: DashboardNavItem[] = [
    { to: "/employee/models", label: "模特展示", icon: "🧑", group: "match" },
    { to: "/employee/showcase-influencers", label: "Influencer", icon: "⭐", group: "match" },
    { to: "/employee/showcase-content-creators", label: "Content Creator", icon: "✍", group: "match" },
    { to: "/employee/orders", label: "商家订单", icon: "📦", group: "points" },
    { to: "/employee/market-orders", label: "视频分级订单", icon: "🎬", group: "points" },
    { to: "/employee/graded-video-hall", label: "视频分级工作台", icon: "🧰", group: "points" },
    { to: "/employee/skus", label: "SKU 列表", icon: "🧱", group: "points" },
    { to: "/employee/points", label: "视频分级结算", icon: "🪙", group: "points" },
    { to: "/employee/merchant-members", label: "会员与保证金", icon: "👑", group: "match" },
    { to: "/employee/influencer-permissions", label: "达人撮合权限审核", icon: "✅", group: "match" },
    { to: "/employee/cooperation-types", label: "合作业务类型说明", icon: "🧩", group: "match" },
    { to: "/employee/cooperation-orders", label: "合作订单工作台", icon: "🧾", group: "match" },
    { to: "/employee/op-logs", label: "我的操作日志", icon: "📄", group: "common" },
  ];

  return (
    <DashboardShell roleTitle="员工端" navItems={navItems} mainMaxWidth={1000}>
      <Outlet />
    </DashboardShell>
  );
}
