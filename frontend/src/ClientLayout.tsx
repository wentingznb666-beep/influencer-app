import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { getPoints as getClientPoints } from "./clientApi";
import DashboardShell from "./DashboardShell";
import { xtOutlineBtn } from "./brandTheme";
import { normalizeAccountText } from "./utils/accountText";

const CLIENT_NAV = [
  { to: "/client/models", label: "模特展示" },
  { to: "/client/showcase-influencers", label: "Influencer" },
  { to: "/client/showcase-content-creators", label: "Content Creator" },
  { to: "/client/market-orders", label: "达人领单" },
  { to: "/client/skus", label: "SKU 列表" },
  { to: "/client/points", label: "积分充值" },
  { to: "/client/matching-center", label: "撮合中心" },
  { to: "/client/collab-pool", label: "达人需求广场" },
  { to: "/client/collab-my-applies", label: "我的需求报名" },
  { to: "/client/op-logs", label: "我的操作日志" },
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
