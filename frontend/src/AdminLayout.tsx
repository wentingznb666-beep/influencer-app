import { Outlet } from "react-router-dom";
import DashboardShell from "./DashboardShell";

const ADMIN_NAV = [
  { to: "/admin/materials", label: "素材管理" },
  { to: "/admin/tasks", label: "任务管理" },
  { to: "/admin/influencers", label: "达人管理" },
  { to: "/admin/submissions", label: "投稿审核" },
  { to: "/admin/orders", label: "客户订单" },
  { to: "/admin/skus", label: "SKU 列表" },
  { to: "/admin/points", label: "积分与结算" },
  { to: "/admin/settlement", label: "结算打款" },
  { to: "/admin/withdrawals", label: "提现管理" },
  { to: "/admin/risk", label: "防删与风控" },
  { to: "/admin/users", label: "账号管理" },
  { to: "/admin/market-orders", label: "达人领单" },
  { to: "/admin/op-logs", label: "我的操作日志" },
];

/**
 * 管理员端布局：侧栏导航 + 子路由出口。
 */
export default function AdminLayout() {
  return (
    <DashboardShell roleTitle="管理员端" navItems={ADMIN_NAV} mainMaxWidth={1000}>
      <Outlet />
    </DashboardShell>
  );
}
