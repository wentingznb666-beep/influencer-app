import { Outlet } from "react-router-dom";
import { useMemo } from "react";
import DashboardShell, { type DashboardNavItem } from "./DashboardShell";

type NavGroup = {
  key: "points" | "match" | "common";
  children: DashboardNavItem[];
};

/** ??????????role -> group -> children?? */
const EMPLOYEE_NAV_GROUPS: NavGroup[] = [
  {
    key: "points",
    children: [
      { to: "/employee/models", label: "????", icon: "??", group: "points" },
      { to: "/employee/showcase-influencers", label: "influencer", icon: "?", group: "points" },
      { to: "/employee/showcase-content-creators", label: "content", icon: "??", group: "points" },
      { to: "/employee/orders", label: "????", icon: "??", group: "points" },
      { to: "/employee/market-orders", label: "????", icon: "??", group: "points" },
      { to: "/employee/skus", label: "Sku", icon: "???", group: "points" },
      { to: "/employee/points", label: "?????", icon: "??", group: "points" },
    ],
  },
  {
    key: "match",
    children: [
      { to: "/employee/merchant-members", label: "??????", icon: "???", group: "match" },
      { to: "/employee/influencer-permissions", label: "????????", icon: "?", group: "match" },
    ],
  },
  {
    key: "common",
    children: [{ to: "/employee/op-logs", label: "??????", icon: "??", group: "common" }],
  },
];

/** ????????? DashboardShell ??? */
function flattenNavGroups(groups: NavGroup[]): DashboardNavItem[] {
  return groups.flatMap((group) => group.children);
}

/** Employee layout wrapper and navigation container. */
export default function EmployeeLayout() {
  const navItems = useMemo(() => flattenNavGroups(EMPLOYEE_NAV_GROUPS), []);
  return (
    <DashboardShell roleTitle="???" navItems={navItems} mainMaxWidth={1000}>
      <Outlet />
    </DashboardShell>
  );
}
