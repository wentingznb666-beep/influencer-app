import { Outlet } from "react-router-dom";
import { useMemo } from "react";
import DashboardShell, { type DashboardNavItem } from "./DashboardShell";
import { getStoredUser } from "./authApi";

type NavGroup = {
  key: "points" | "match" | "common";
  children: DashboardNavItem[];
};

/** ???????????role -> group -> children?? */
const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    key: "points",
    children: [
      { to: "/admin/showcase-influencers", label: "influencer", icon: "?", group: "points" },
      { to: "/admin/showcase-content-creators", label: "content", icon: "??", group: "points" },
      { to: "/admin/orders", label: "????", icon: "??", group: "points" },
      { to: "/admin/market-orders", label: "????", icon: "??", group: "points" },
      { to: "/admin/skus", label: "Sku", icon: "???", group: "points" },
      { to: "/admin/points", label: "?????", icon: "??", group: "points" },
      { to: "/admin/settlement", label: "????", icon: "??", group: "points" },
      { to: "/admin/withdrawals", label: "????", icon: "??", group: "points" },
      { to: "/admin/users", label: "????", icon: "??", group: "points" },
    ],
  },
  {
    key: "match",
    children: [
      { to: "/admin/merchant-members", label: "??????", icon: "???", group: "match" },
      { to: "/admin/influencer-permissions", label: "????????", icon: "?", group: "match" },
    ],
  },
  {
    key: "common",
    children: [
      { to: "/admin/profit", label: "????", icon: "??", group: "common" },
      { to: "/admin/risk", label: "?????", icon: "??", group: "common" },
      { to: "/admin/op-logs", label: "??????", icon: "??", group: "common" },
    ],
  },
];

/** ????????? DashboardShell ??? */
function flattenNavGroups(groups: NavGroup[]): DashboardNavItem[] {
  return groups.flatMap((group) => group.children);
}

/** Admin layout wrapper and navigation container. */
export default function AdminLayout() {
  const user = getStoredUser();
  const navItems = useMemo(() => flattenNavGroups(ADMIN_NAV_GROUPS), []);
  if (user?.role !== "admin") {
    return (
      <DashboardShell roleTitle="????" navItems={navItems} mainMaxWidth={1000}>
        <Outlet />
      </DashboardShell>
    );
  }
  return (
    <DashboardShell roleTitle="????" navItems={navItems} mainMaxWidth={1000}>
      <Outlet />
    </DashboardShell>
  );
}
