import { Outlet } from "react-router-dom";

import DashboardShell from "./DashboardShell";

import { getStoredUser } from "./authApi";



export const BASE_ADMIN_NAV = [
  /** ???????? */
  { to: "/admin/showcase-influencers", label: "influencer", icon: "?", group: "points" as const },
  { to: "/admin/showcase-content-creators", label: "content", icon: "??", group: "points" as const },
  { to: "/admin/orders", label: "????", icon: "??", group: "points" as const },
  { to: "/admin/market-orders", label: "????", icon: "??", group: "points" as const },
  { to: "/admin/skus", label: "Sku", icon: "??", group: "points" as const },
  { to: "/admin/points", label: "?????", icon: "??", group: "points" as const },
  { to: "/admin/settlement", label: "????", icon: "??", group: "points" as const },
  { to: "/admin/withdrawals", label: "????", icon: "??", group: "points" as const },
  { to: "/admin/users", label: "????", icon: "??", group: "points" as const },

  /** ???????? */
  { to: "/admin/merchant-members", label: "??????", icon: "???", group: "match" as const },
  { to: "/admin/influencer-permissions", label: "????????", icon: "?", group: "match" as const },

  /** ?????? */
  { to: "/admin/risk", label: "?????", icon: "??", group: "common" as const },
  { to: "/admin/op-logs", label: "??????", icon: "??", group: "common" as const },
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

