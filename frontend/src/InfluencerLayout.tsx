import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { getInfluencerPermissionStatus } from "./matchingApi";
import DashboardShell, { type DashboardNavItem } from "./DashboardShell";
import { useAppStore } from "./stores/AppStore";

type PermissionStatus = "unapplied" | "pending" | "approved" | "rejected" | "disabled";

/**
 * 达人端布局：侧栏分组/图标、顶栏积分与刷新、撮合权限视觉锁定。
 */
export default function InfluencerLayout() {
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>("unapplied");
  const { setRole } = useAppStore();

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

  useEffect(() => {
    void loadPermission();
  }, []);

  /** Synchronize the current role into the global store. */
  useEffect(() => {
    setRole("influencer");
  }, [setRole]);

  const matchLocked = permissionStatus !== "approved";

  const navItems: DashboardNavItem[] = [
    { to: "/influencer/task-hall", label: "任务大厅", menuHint: "สมัครงานจับคู่และติดตามสถานะ", icon: "📋", group: "match" },
    { to: "/influencer/payment-profile", label: "收款信息", menuHint: "ตั้งค่าบัญชีรับเงินสำหรับการโอน", icon: "💳", group: "match" },
    { to: "/influencer/profile", label: "达人信息", menuHint: "完善账号与擅长领域后才可报名", icon: "👤", group: "match" },
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
      mainClassName="xt-main-th"
      navItems={navItems}
      mainMaxWidth={900}
    >
      <Outlet />
    </DashboardShell>
  );
}
