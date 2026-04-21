import { Outlet } from "react-router-dom";

import DashboardShell from "./DashboardShell";

import { getStoredUser } from "./authApi";



export const BASE_ADMIN_NAV = [

  { to: "/admin/influencers", label: "达人管理" },

  { to: "/admin/models", label: "模特展示" },

  { to: "/admin/showcase-influencers", label: "Influencer" },

  { to: "/admin/showcase-content-creators", label: "Content Creator" },

  { to: "/admin/orders", label: "商家订单" },

  { to: "/admin/market-orders", label: "达人领单" },

  { to: "/admin/skus", label: "SKU 列表" },

  { to: "/admin/points", label: "积分与结算" },

  { to: "/admin/settlement", label: "结算打款" },

  { to: "/admin/withdrawals", label: "提现管理" },

  { to: "/admin/risk", label: "防删与风控" },

  { to: "/admin/users", label: "账号管理" },

  { to: "/admin/merchant-members", label: "会员与保证金" },
  { to: "/admin/influencer-permissions", label: "达人撮合权限审核" },
    { to: "/admin/op-logs", label: "我的操作日志" },

];



/**

 * Admin layout wrapper and navigation container.

 */

export default function AdminLayout() {

  const user = getStoredUser();

  const navItems = user?.role === "admin" ? [{ to: "/admin/profit", label: "利润统计" }, ...BASE_ADMIN_NAV] : BASE_ADMIN_NAV;

  return (

    <DashboardShell roleTitle="管理员端" navItems={navItems} mainMaxWidth={1000}>

      <Outlet />

    </DashboardShell>

  );

}

