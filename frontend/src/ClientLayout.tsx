import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { getPoints as getClientPoints } from "./clientApi";
import DashboardShell from "./DashboardShell";
import { xtOutlineBtn } from "./brandTheme";

const CLIENT_NAV = [
  { to: "/client/models", label: "\u6a21\u7279\u5c55\u793a" },
  { to: "/client/showcase-influencers", label: "Influencer" },
  { to: "/client/showcase-content-creators", label: "Content Creator" },
  { to: "/client/market-orders", label: "\u8fbe\u4eba\u9886\u5355" },
  { to: "/client/collab-pool", label: "\u8fbe\u4eba\u5408\u4f5c\u6c60" },
  { to: "/client/skus", label: "SKU \u5217\u8868" },
  { to: "/client/points", label: "\u79ef\u5206\u5145\u503c" },
  { to: "/client/op-logs", label: "\u6211\u7684\u64cd\u4f5c\u65e5\u5fd7" },
];

/**
 * ?????????? + ??????
 */
export default function ClientLayout() {
  const [balance, setBalance] = useState<number | null>(null);
  const balanceTimerRef = useState<{ id: number | null; fired: boolean }>({ id: null, fired: false })[0];

  /**
   * ??????????????????????
   */
  const loadBalance = async () => {
    try {
      const data = await getClientPoints();
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
      roleTitle="\u5546\u5bb6\u7aef"
      navItems={CLIENT_NAV}
      mainMaxWidth={1200}
      logoutVariant="danger"
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
