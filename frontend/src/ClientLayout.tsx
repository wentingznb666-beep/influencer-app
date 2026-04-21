import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { getPoints as getClientPoints } from "./clientApi";
import DashboardShell from "./DashboardShell";
import { xtOutlineBtn } from "./brandTheme";
import { normalizeAccountText } from "./utils/accountText";

const CLIENT_NAV = [
  /** ???????? */
  { to: "/client/models", label: "????", icon: "??", group: "points" as const },
  { to: "/client/showcase-influencers", label: "influencer", icon: "?", group: "points" as const },
  { to: "/client/showcase-content-creators", label: "content", icon: "??", group: "points" as const },
  { to: "/client/market-orders", label: "????", icon: "??", group: "points" as const },
  { to: "/client/skus", label: "Sku", icon: "??", group: "points" as const },
  { to: "/client/points", label: "????", icon: "??", group: "points" as const },

  /** ???????? */
  { to: "/client/matching-orders", label: "??????", icon: "??", group: "match" as const },
  { to: "/client/member-center", label: "????", icon: "??", group: "match" as const },
  { to: "/client/matching-center", label: "????", icon: "??", group: "match" as const },
  { to: "/client/collab-pool", label: "??????", icon: "??", group: "match" as const },
  { to: "/client/collab-my-applies", label: "??????", icon: "??", group: "match" as const },

  /** ?????? */
  { to: "/client/op-logs", label: "??????", icon: "??", group: "common" as const },
];

/**
 * Merchant layout with navigation and balance header.
 */
export default function ClientLayout() {
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const balanceTimerRef = useState<{ id: number | null; fired: boolean }>({ id: null, fired: false })[0];

  /**
   * Load merchant points balance for header display.
   */
  const loadBalance = async () => {
    setBalanceLoading(true);
    setBalanceError(null);
    try {
      const data = await getClientPoints();
      setBalance(typeof data?.balance === "number" ? data.balance : 0);
    } catch {
      setBalance(null);
      setBalanceError("刷新失败");
    } finally {
      setBalanceLoading(false);
    }
  };

  useEffect(() => {
    /** Trigger the balance load exactly once. */
    const fire = () => {
      if (balanceTimerRef.fired) return;
      balanceTimerRef.fired = true;
      void loadBalance();
    };
    if (!import.meta.env.PROD) {
      fire();
      return;
    }
    /** Listen for first user intent to preload balance. */
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
      roleTitle="商家端"
      navItems={CLIENT_NAV}
      mainMaxWidth={1200}
      logoutVariant="danger"
      headerExtra={
        <>
          <span style={{ fontSize: 13, color: "var(--xt-text-muted)" }}>
            {normalizeAccountText("余额")}
            <span style={{ fontWeight: 700, color: "var(--xt-primary)" }}>
              {balanceLoading ? "..." : balance == null ? "—" : balance}
            </span>
          </span>
          <button
            type="button"
            onClick={() => void loadBalance()}
            disabled={balanceLoading}
            style={{ ...xtOutlineBtn, padding: "6px 10px", fontSize: 13, opacity: balanceLoading ? 0.7 : 1 }}
          >
            {balanceLoading ? "刷新中..." : normalizeAccountText("刷新余额")}
          </button>
          {balanceError && <span style={{ fontSize: 12, color: "#b91c1c" }}>{balanceError}</span>}
        </>
      }
    >
      <Outlet />
    </DashboardShell>
  );
}

