import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { getPoints as getInfluencerPoints } from "./influencerApi";
import { getInfluencerPermissionStatus } from "./matchingApi";
import DashboardShell, { type DashboardNavItem } from "./DashboardShell";
import { normalizeAccountText } from "./utils/accountText";
import { showToast } from "./utils/showToast";

type PermissionStatus = "unapplied" | "pending" | "approved" | "rejected" | "disabled";

/**
 * 生产环境预加载常用达人页，加快首次进入速度。
 */
function preloadInfluencerRoutes(): Record<string, () => void> {
  if (!import.meta.env.PROD) return {};
  return {
    "/influencer/client-orders": () => import("./influencer/ClientOrdersHallPage"),
    "/influencer/points": () => import("./influencer/PointsPage"),
    "/influencer/withdraw": () => import("./influencer/WithdrawPage"),
  };
}

/**
 * 达人端布局：侧栏分组/图标、顶栏积分与刷新、撮合权限视觉锁定。
 */
export default function InfluencerLayout() {
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>("unapplied");
  const balanceTimerRef = useState<{ id: number | null; fired: boolean }>({ id: null, fired: false })[0];
  const preloadMap = preloadInfluencerRoutes();

  /**
   * 读取撮合权限状态，用于侧栏「发布合作需求」「我的需求」锁定样式。
   */
  const loadPermission = async () => {
    try {
      const data = await getInfluencerPermissionStatus();
      setPermissionStatus(String(data?.status || "unapplied") as PermissionStatus);
    } catch {
      setPermissionStatus("unapplied");
    }
  };

  /**
   * 加载顶栏与侧栏共用的积分余额。
   * @param opts.fromUser 为 true 时表示用户手动刷新，成功后弹出轻提示。
   */
  const loadBalance = async (opts?: { fromUser?: boolean }) => {
    setBalanceLoading(true);
    setBalanceError(null);
    try {
      const data = await getInfluencerPoints();
      setBalance(typeof data?.balance === "number" ? data.balance : 0);
      if (opts?.fromUser) showToast("余额已更新");
    } catch {
      setBalance(null);
      setBalanceError("刷新失败");
    } finally {
      setBalanceLoading(false);
    }
  };

  useEffect(() => {
    void loadPermission();
  }, []);

  useEffect(() => {
    /**
     * 首次进入时延迟或首次用户操作后加载余额，避免阻塞翻译与首屏。
     */
    const fire = () => {
      if (balanceTimerRef.fired) return;
      balanceTimerRef.fired = true;
      void loadBalance();
    };
    if (!import.meta.env.PROD) {
      fire();
      return;
    }
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

  const matchLocked = permissionStatus !== "approved";

  const navItems: DashboardNavItem[] = [
    { to: "/influencer/client-orders", label: "商家端发单", menuHint: "รับงานจากร้านค้าและส่งลิงก์ผลงาน", icon: "🛒", group: "points", preload: preloadMap["/influencer/client-orders"] },
    { to: "/influencer/points", label: "积分与收益", menuHint: "ดูคะแนนคงเหลือและรายรับล่าสุด", icon: "🪙", group: "points", preload: preloadMap["/influencer/points"] },
    { to: "/influencer/withdraw", label: "申请提现", menuHint: "ยื่นถอนเงินเข้าบัญชีธนาคาร", icon: "💰", group: "points", preload: preloadMap["/influencer/withdraw"] },
    { to: "/influencer/task-hall", label: "任务大厅", menuHint: "สมัครงานจับคู่และติดตามสถานะ", icon: "📋", group: "match" },
    { to: "/influencer/payment-profile", label: "收款信息", menuHint: "ตั้งค่าบัญชีรับเงินสำหรับการโอน", icon: "💳", group: "match" },
    { to: "/influencer/permission", label: "撮合权限申请", menuHint: "ยื่นขอสิทธิ์ก่อนเผยแพร่ความต้องการ", icon: "⬆️", group: "match" },
    { to: "/influencer/demands", label: "发布合作需求", menuHint: "โพสต์ความต้องการเพื่อรับสมัครร้านค้า", icon: "📝", group: "match", navLocked: matchLocked },
    { to: "/influencer/my-demands", label: "我的需求", menuHint: "จัดการงานที่โพสต์และใบสมัครทั้งหมด", icon: "📦", group: "match", navLocked: matchLocked },
    { to: "/influencer/op-logs", label: "我的操作日志", menuHint: "ตรวจสอบประวัติการใช้งานบัญชี", icon: "📄", group: "common" },
  ];

  return (
    <DashboardShell
      roleTitle="达人端"
      shellVariant="influencer"
      headerUsernameDisplay="influencer002"
      sidebarBalanceBadge={typeof balance === "number" ? balance : null}
      mainClassName="xt-main-th"
      navItems={navItems}
      mainMaxWidth={900}
      headerExtra={
        <div className="xt-header-balance-cluster">
          <span className="xt-header-balance-label">{normalizeAccountText("积分")}</span>
          <span className="xt-header-balance-value">{balanceLoading ? "…" : balance == null ? "—" : balance}</span>
          <button
            type="button"
            className={"xt-balance-refresh-btn" + (balanceLoading ? " is-loading" : "")}
            onClick={() => void loadBalance({ fromUser: true })}
            disabled={balanceLoading}
            aria-label={normalizeAccountText("刷新余额")}
          >
            <span className="xt-balance-refresh-ic" aria-hidden>
              ↻
            </span>
          </button>
          {balanceError ? <span className="xt-header-balance-err">{balanceError}</span> : null}
        </div>
      }
    >
      <Outlet />
    </DashboardShell>
  );
}