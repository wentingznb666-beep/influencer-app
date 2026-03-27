import { Outlet } from "react-router-dom";
import DashboardShell from "./DashboardShell";

/**
 * 员工端布局：复刻管理员端壳层样式与菜单结构，
 * 但路径独立为 /employee，便于权限与路由隔离。
 */
export default function EmployeeLayout() {
  const navItems = [
    { to: "/employee/orders", label: "客户订单" },
    { to: "/employee/market-orders", label: "达人领单" },
    { to: "/employee/skus", label: "SKU 列表" },
    { to: "/employee/points", label: "积分与结算" },
    { to: "/employee/users", label: "账号管理" },
    { to: "/employee/op-logs", label: "我的操作日志" },
  ];
  return (
    <DashboardShell roleTitle="员工端" navItems={navItems} mainMaxWidth={1000}>
      <Outlet />
    </DashboardShell>
  );
}
