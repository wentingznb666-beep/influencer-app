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
    { to: "/employee/market-orders", label: "视频分级订单", icon: "🎬", group: "points" },
    { to: "/employee/models", label: "模特展示", icon: "🧑", group: "points" },
    { to: "/employee/showcase-influencers", label: "Influencer", icon: "⭐", group: "points" },
    { to: "/employee/showcase-content-creators", label: "Content Creator", icon: "✍", group: "points" },
    { to: "/employee/graded-video-hall", label: "视频分级工作台", icon: "🧰", group: "points" },
    { to: "/employee/skus", label: "SKU 列表", icon: "🧱", group: "points" },
    { to: "/employee/points", label: "视频分级结算", icon: "🪙", group: "points" },
    { to: "/employee/influencers", label: "达人管理", icon: "👥", group: "match" },
    { to: "/employee/merchant-members", label: "会员与保证金", icon: "👑", group: "match" },
    { to: "/employee/influencer-permissions", label: "达人撮合权限审核", icon: "✅", group: "match" },
    { to: "/employee/cooperation-types", label: "合作业务类型说明", icon: "🧩", group: "match" },
    { to: "/employee/cooperation-orders", label: "合作订单工作台", icon: "🧾", group: "match" },
    { to: "/employee/vertical-connections", label: "数据看板", icon: "📊", group: "vertical" },
    { to: "/employee/vertical-connections/profiles", label: "达人资料管理", icon: "👥", group: "vertical" },
    { to: "/employee/vertical-connections/records", label: "建联记录", icon: "📋", group: "vertical" },
    { to: "/employee/vertical-connections/orders", label: "派单管理", icon: "💳", group: "vertical" },
    { to: "/employee/vertical-connections/grade-config", label: "等级配置", icon: "⚙️", group: "vertical" },
    { to: "/employee/vertical-connections/purchase", label: "达人进货管理", icon: "📦", group: "vertical" },
    { to: "/employee/users", label: "账号管理", icon: "👤", group: "common" },
    { to: "/employee/op-logs", label: "我的操作日志", icon: "📄", group: "common" },
  ];

  /** 手机端底部 Tab 栏显示的主要页面（最多 4 个）。 */
  const tabItems: DashboardNavItem[] = [
    { to: "/employee/graded-video-hall", label: "工作台", icon: "🧰" },
    { to: "/employee/market-orders", label: "视频订单", icon: "🎬" },
    { to: "/employee/points", label: "结算", icon: "🪙" },
    { to: "/employee/op-logs", label: "日志", icon: "📄" },
  ];

  return (
    <DashboardShell roleTitle="员工端" navItems={navItems} tabItems={tabItems} mainMaxWidth={1400}>
      <Outlet />
    </DashboardShell>
  );
}
