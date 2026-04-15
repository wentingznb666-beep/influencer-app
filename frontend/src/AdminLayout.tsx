import { Outlet } from "react-router-dom";
import DashboardShell from "./DashboardShell";
import { getStoredUser } from "./authApi";

export const BASE_ADMIN_NAV = [
  { to: "/admin/influencers", label: "\u8fbe\u4eba\u7ba1\u7406" },
  { to: "/admin/models", label: "\u6a21\u7279\u5c55\u793a" },
  { to: "/admin/showcase-influencers", label: "Influencer" },
  { to: "/admin/showcase-content-creators", label: "Content Creator" },
  { to: "/admin/orders", label: "\u5546\u5bb6\u8ba2\u5355" },
  { to: "/admin/market-orders", label: "\u8fbe\u4eba\u9886\u5355" },
  { to: "/admin/skus", label: "SKU \u5217\u8868" },
  { to: "/admin/points", label: "\u79ef\u5206\u4e0e\u7ed3\u7b97" },
  { to: "/admin/settlement", label: "\u7ed3\u7b97\u6253\u6b3e" },
  { to: "/admin/withdrawals", label: "\u63d0\u73b0\u7ba1\u7406" },
  { to: "/admin/risk", label: "\u9632\u5220\u4e0e\u98ce\u63a7" },
  { to: "/admin/users", label: "\u8d26\u53f7\u7ba1\u7406" },
  { to: "/admin/op-logs", label: "\u6211\u7684\u64cd\u4f5c\u65e5\u5fd7" },
];

/**
 * Admin layout wrapper and navigation container.
 */
export default function AdminLayout() {
  const user = getStoredUser();
  const navItems = user?.role === "admin" ? [{ to: "/admin/profit", label: "\u5229\u6da6\u7edf\u8ba1" }, ...BASE_ADMIN_NAV] : BASE_ADMIN_NAV;
  return (
    <DashboardShell roleTitle="\u7ba1\u7406\u5458\u7aef" navItems={navItems} mainMaxWidth={1000}>
      <Outlet />
    </DashboardShell>
  );
}
