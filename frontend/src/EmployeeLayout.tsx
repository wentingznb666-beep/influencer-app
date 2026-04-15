import { Outlet } from "react-router-dom";
import DashboardShell from "./DashboardShell";

/**
 * Employee layout wrapper and navigation container.
 */
export default function EmployeeLayout() {
  const navItems = [
    { to: "/employee/models", label: "\u6a21\u7279\u5c55\u793a" },
    { to: "/employee/showcase-influencers", label: "Influencer" },
    { to: "/employee/showcase-content-creators", label: "Content Creator" },
    { to: "/employee/orders", label: "\u5546\u5bb6\u8ba2\u5355" },
    { to: "/employee/market-orders", label: "\u8fbe\u4eba\u9886\u5355" },
    { to: "/employee/skus", label: "SKU \u5217\u8868" },
    { to: "/employee/points", label: "\u79ef\u5206\u4e0e\u7ed3\u7b97" },
    { to: "/employee/op-logs", label: "\u6211\u7684\u64cd\u4f5c\u65e5\u5fd7" },
  ];
  return (
    <DashboardShell roleTitle="\u5458\u5de5\u7aef" navItems={navItems} mainMaxWidth={1000}>
      <Outlet />
    </DashboardShell>
  );
}
