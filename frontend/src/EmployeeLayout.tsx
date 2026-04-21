import { Outlet } from "react-router-dom";

import DashboardShell from "./DashboardShell";



/**

 * Employee layout wrapper and navigation container.

 */

export default function EmployeeLayout() {

  const navItems = [
    /** ???????? */
    { to: "/employee/models", label: "????", icon: "??", group: "points" as const },
    { to: "/employee/showcase-influencers", label: "influencer", icon: "?", group: "points" as const },
    { to: "/employee/showcase-content-creators", label: "content", icon: "??", group: "points" as const },
    { to: "/employee/orders", label: "????", icon: "??", group: "points" as const },
    { to: "/employee/market-orders", label: "????", icon: "??", group: "points" as const },
    { to: "/employee/skus", label: "Sku", icon: "??", group: "points" as const },
    { to: "/employee/points", label: "?????", icon: "??", group: "points" as const },

    /** ???????? */
    { to: "/employee/merchant-members", label: "??????", icon: "???", group: "match" as const },
    { to: "/employee/influencer-permissions", label: "????????", icon: "?", group: "match" as const },

    /** ?????? */
    { to: "/employee/op-logs", label: "??????", icon: "??", group: "common" as const },
  ];

  return (

    <DashboardShell roleTitle="员工端" navItems={navItems} mainMaxWidth={1000}>

      <Outlet />

    </DashboardShell>

  );

}

