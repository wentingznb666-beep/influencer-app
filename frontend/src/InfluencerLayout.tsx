import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { getPoints as getInfluencerPoints } from "./influencerApi";
import DashboardShell from "./DashboardShell";
import { xtOutlineBtn } from "./brandTheme";

/**
 * ????????????? hover ?? chunk????????
 */
function preloadInfluencerRoutes(): Record<string, () => void> {
  if (!import.meta.env.PROD) return {};
  return {
    "/influencer/client-orders": () => import("./influencer/ClientOrdersHallPage"),
    "/influencer/points": () => import("./influencer/PointsPage"),
    "/influencer/withdraw": () => import("./influencer/WithdrawPage"),
    "/influencer/business-match": () => import("./influencer/BusinessMatchPage"),
    "/influencer/demands": () => import("./influencer/InfluencerDemandsPage"),
  };
}

/**
 * ?????????? + ??????
 */
export default function InfluencerLayout() {
  const [balance, setBalance] = useState<number | null>(null);
  const balanceTimerRef = useState<{ id: number | null; fired: boolean }>({ id: null, fired: false })[0];
  const preloadMap = preloadInfluencerRoutes();

  /**
   * ?????????????????????
   */
  const loadBalance = async () => {
    try {
      const data = await getInfluencerPoints();
      setBalance(typeof data?.balance === "number" ? data.balance : 0);
    } catch {
      setBalance(null);
    }
  };

  useEffect(() => {
    /**
     * ?????????????????????????????? 200ms?
     * ???????/??????????? 200ms ??????????????
     */
    /** ???????????????? */
    const fire = () => {
      if (balanceTimerRef.fired) return;
      balanceTimerRef.fired = true;
      loadBalance();
    };
    if (!import.meta.env.PROD) {
      fire();
      return;
    }
    /** ?????????????????????????? */
    const onUserIntent = () => fire();
    window.addEventListener("pointerdown", onUserIntent, { passive: true, once: true });
    window.addEventListener("keydown", onUserIntent, { passive: true, once: true } as any);
    balanceTimerRef.id = window.setTimeout(fire, 200) as unknown as number;
    return () => {
      window.removeEventListener("pointerdown", onUserIntent as any);
      window.removeEventListener("keydown", onUserIntent as any);
      if (balanceTimerRef.id != null) window.clearTimeout(balanceTimerRef.id);
    };
  }, []);

  return (
    <DashboardShell
      roleTitle="\u8fbe\u4eba\u7aef"
      navItems={[
        { to: "/influencer/client-orders", label: "\u5546\u5bb6\u7aef\u53d1\u5355", preload: preloadMap["/influencer/client-orders"] },
        { to: "/influencer/business-match", label: "\u5546\u5355\u64ae\u5408", preload: preloadMap["/influencer/business-match"] },
        { to: "/influencer/demands", label: "\u53d1\u5e03\u5408\u4f5c\u9700\u6c42", preload: preloadMap["/influencer/demands"] },
        { to: "/influencer/points", label: "\u79ef\u5206\u4e0e\u6536\u76ca", preload: preloadMap["/influencer/points"] },
        { to: "/influencer/withdraw", label: "\u7533\u8bf7\u63d0\u73b0", preload: preloadMap["/influencer/withdraw"] },
        { to: "/influencer/op-logs", label: "\u6211\u7684\u64cd\u4f5c\u65e5\u5fd7" },
      ]}
      mainMaxWidth={900}
      headerExtra={
        <>
          <span style={{ fontSize: 13, color: "var(--xt-text-muted)" }}>
            \u4f59\u989d?
            <span style={{ fontWeight: 700, color: "var(--xt-primary)" }}>
              {balance == null ? "?" : balance}
            </span>
          </span>
          <button
            type="button"
            onClick={loadBalance}
            style={{ ...xtOutlineBtn, padding: "6px 10px", fontSize: 13 }}
          >
            \u5237\u65b0\u4f59\u989d
          </button>
        </>
      }
    >
      <Outlet />
    </DashboardShell>
  );
}
