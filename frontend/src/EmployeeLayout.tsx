import { Outlet } from "react-router-dom";
import DashboardShell from "./DashboardShell";

/**
 * Employee layout wrapper and navigation container.
 */
export default function EmployeeLayout() {
  const navItems = [
    { to: "/employee/models", label: "模特展示" },
    { to: "/employee/showcase-influencers", label: "Influencer" },
    { to: "/employee/showcase-content-creators", label: "Content Creator" },
    { to: "/employee/orders", label: "商家订单" },
    { to: "/employee/market-orders", label: "达人领单" },
    { to: "/employee/skus", label: "SKU 列表" },
    { to: "/employee/points", label: "积分与结算" },
    { to: "/employee/op-logs", label: "我的操作日志" },
  ];
  return (
    <DashboardShell roleTitle="员工端" navItems={navItems} mainMaxWidth={1000}>
      <Outlet />
    </DashboardShell>
  );
}
