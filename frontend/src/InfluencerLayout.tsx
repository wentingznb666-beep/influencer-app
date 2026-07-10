import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { getInfluencerPermissionStatus } from "./matchingApi";
import DashboardShell, { type DashboardNavItem } from "./DashboardShell";
import { useAppStore } from "./stores/AppStore";
import { fetchWithAuth } from "./fetchWithAuth";

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
  const [invBadge, setInvBadge] = useState(0);
  const [orderBadge, setOrderBadge] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [rc, ro] = await Promise.all([
          fetchWithAuth("/api/influencer/connections"),
          fetchWithAuth("/api/influencer/connection-orders"),
        ]);
        const conns = ((await rc.json()).list || []);
        const orders = ((await ro.json()).list || []);
        setInvBadge(conns.filter((c:any)=>c.status==="pending").length);
        setOrderBadge(orders.filter((o:any)=>o.influencer_response==="pending"||o.review_status==="rejected").length);
      } catch {}
    })();
  }, []);

  const navItems: DashboardNavItem[] = [
    { to: "/influencer/task-hall", label: "任务大厅", menuHint: "สมัครงานจับคู่และติดตามสถานะ", icon: "📋", group: "match" },
    { to: "/influencer/payment-profile", label: "收款信息", menuHint: "ตั้งค่าบัญชีรับเงินสำหรับการโอน", icon: "💳", group: "match" },
    { to: "/influencer/profile", label: "达人信息", menuHint: "完善账号与擅长领域后才可报名", icon: "👤", group: "match" },
    { to: "/influencer/vertical-connections", label: "合作中心", menuHint: "ดูภาพรวมการเชื่อมต่อ", icon: "🏠", group: "vertical" },
    { to: "/influencer/vertical-connections/invitations", label: invBadge > 0 ? `建联邀请 (${invBadge})` : "建联邀请", menuHint: "ดูคำเชิญเชื่อมต่อ", icon: "📨", group: "vertical" },
    { to: "/influencer/vertical-connections/orders", label: orderBadge > 0 ? `我的派单 (${orderBadge})` : "我的派单", menuHint: "รายการคำสั่งงาน", icon: "📋", group: "vertical" },
    { to: "/influencer/vertical-connections/payment", label: "收款设置", menuHint: "ตั้งค่าบัญชีรับเงิน", icon: "💳", group: "vertical" },
    { to: "/influencer/vertical-connections/profile", label: "我的资料", menuHint: "กรอก/แก้ไขข้อมูลส่วนตัว", icon: "👤", group: "vertical" },
    { to: "/influencer/vertical-connections/purchase/demands", label: "我的需求", icon: "📝", group: "vertical" },
    { to: "/influencer/vertical-connections/purchase/orders", label: "我的订单", icon: "📦", group: "vertical" },
  { to: "/influencer/permission", label: "撮合权限申请", menuHint: "ยื่นขอสิทธิ์ก่อนเผยแพร่ความต้องการ", icon: "⬆️", group: "match" },
    { to: "/influencer/demands", label: "发布合作需求", menuHint: "โพสต์ความต้องการเพื่อรับสมัครร้านค้า", icon: "📝", group: "match", navLocked: matchLocked },
    { to: "/influencer/my-demands", label: "我的需求", menuHint: "จัดการงานที่โพสต์และใบสมัครทั้งหมด", icon: "📦", group: "match", navLocked: matchLocked },
    { to: "/influencer/op-logs", label: "我的操作日志", menuHint: "ตรวจสอบประวัติการใช้งานบัญชี", icon: "📄", group: "common" },
  ];

  /** 手机端底部 Tab 栏显示的主要页面（最多 4 个）。 */
  const tabItems: DashboardNavItem[] = [
    { to: "/influencer/dashboard", label: "首页", icon: "🏠" },
    { to: "/influencer/my-demands", label: "需求", icon: "📦" },
    { to: "/influencer/profile", label: "我的", icon: "👤" },
    { to: "/influencer/op-logs", label: "日志", icon: "📄" },
  ];

  return (
    <DashboardShell
      roleTitle="达人端"
      shellVariant="influencer"
      headerUsernameDisplay="influencer002"
      mainClassName="xt-main-th"
      navItems={navItems}
      tabItems={tabItems}
      mainMaxWidth={900}
    >
      <Outlet />
    </DashboardShell>
  );
}
