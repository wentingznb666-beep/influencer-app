import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { getStoredUser, clearAuth } from "./authApi";
import LanguageSwitch from "./LanguageSwitch";
import { BrandLogo } from "./BrandLogo";
import { xtLayout, xtOutlineBtn } from "./brandTheme";
import { DeferredBlock, useDeferredInCompact, useResponsive } from "./responsive";
import { normalizeAccountText } from "./utils/accountText";
import { clearAllSystemMessages, getSystemMessages, markSystemMessageRead, type SystemMessage } from "./systemMessageApi";

/** 顶栏/侧栏导航项定义，支持 hover 预加载；达人端可带分组与视觉锁定。 */
export type DashboardNavItem = {
  to: string;
  label: string;
  preload?: () => void;
  icon?: string;
  group?: "points" | "match" | "common";
  navLocked?: boolean;
};

/**
 * 标准化用户名，避免头部显示 unicode 转义残留或乱码。
 */
function normalizeUsername(text: string | null | undefined): string {
  if (!text) return "";
  let value = text;
  for (let i = 0; i < 2; i += 1) {
    const decoded = value.replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)));
    if (decoded === value) break;
    value = decoded;
  }
  value = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();

  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length > 1 && /^[A-Za-z0-9_.@-]{2,}$/.test(parts[0])) return parts[0];

  const leadingAscii = value.match(/^([A-Za-z0-9_.@-]{2,})/);
  if (leadingAscii && leadingAscii[1].length < value.length) return leadingAscii[1];

  return normalizeAccountText(value);
}

/**
 * 判断文本节点是否包含可疑的转义残留片段。
 */
function hasEscapedFragment(text: string): boolean {
  return /\\u[0-9a-fA-F]{4}|u[0-9a-fA-F]{4}|�/.test(text);
}

/**
 * 清洗容器内所有可疑文本节点。
 */
function sanitizeEscapedTextNodes(root: HTMLElement): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let cur: Node | null = walker.nextNode();
  while (cur) {
    const node = cur as Text;
    const raw = node.nodeValue ?? "";
    if (hasEscapedFragment(raw)) node.nodeValue = normalizeAccountText(raw);
    cur = walker.nextNode();
  }
}

const GROUP_LABELS: Record<"points" | "match" | "common", string> = {
  points: "积分业务组",
  match: "撮合业务组",
  common: "公共组",
};

/** 达人端侧栏分组渲染顺序（与产品菜单一致）。 */
const GROUP_ORDER: Array<keyof typeof GROUP_LABELS> = ["points", "match", "common"];

type InfluencerGroupId = keyof typeof GROUP_LABELS;

/**
 * 将达人端导航项按分组聚合，未标注分组的项会被忽略（不应出现）。
 */
function bucketInfluencerNavItems(items: DashboardNavItem[]): Record<InfluencerGroupId, DashboardNavItem[]> {
  const empty: Record<InfluencerGroupId, DashboardNavItem[]> = {
    points: [],
    match: [],
    common: [],
  };
  for (const it of items) {
    const g = it.group;
    if (g && empty[g]) empty[g].push(it);
  }
  return empty;
}

function resolveNavTarget(item: DashboardNavItem): string {
  if (item.navLocked && (item.to === "/influencer/demands" || item.to === "/influencer/my-demands")) {
    return "/influencer/permission";
  }
  return item.to;
}

/**
 * 判断当前路径是否对应某导航项（含锁定重定向目标），用于路由变化时自动展开所属分组。
 */
function isNavItemActiveForPath(pathname: string, item: DashboardNavItem): boolean {
  const target = resolveNavTarget(item);
  if (pathname === target) return true;
  if (target !== "/" && pathname.startsWith(`${target}/`)) return true;
  return false;
}


type DashboardShellProps = {
  /** 侧栏展示的角色名称，如「管理员端」 */
  roleTitle: string;
  /** 侧栏菜单项 */
  navItems: DashboardNavItem[];
  /** 主内容区最大宽度（像素） */
  mainMaxWidth?: number;
  /** 顶栏右侧额外内容（如余额、刷新） */
  headerExtra?: ReactNode;
  /** 退出按钮样式：描边或危险红 */
  logoutVariant?: "outline" | "danger";
  /** 子路由出口 */
  children: ReactNode;
  /** 达人端顶栏左侧展示用用户名。 */
  headerUsernameDisplay?: string;
  /** 达人端侧栏积分角标。 */
  sidebarBalanceBadge?: number | null;
  /** 达人端专用布局。 */
  shellVariant?: "default" | "influencer";
  /** 主内容区附加 class。 */
  mainClassName?: string;
};

/**
 * 三端通用后台壳：左侧深靛蓝侧栏 + 顶栏 + 主内容区。
 */
export default function DashboardShell({
  roleTitle,
  navItems,
  mainMaxWidth = 1000,
  headerExtra,
  logoutVariant = "outline",
  children,
  headerUsernameDisplay,
  sidebarBalanceBadge,
  shellVariant = "default",
  mainClassName,
}: DashboardShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getStoredUser();
  const [logoutHover, setLogoutHover] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isCompact } = useResponsive();
  const headerExtrasReady = useDeferredInCompact(isCompact, 280);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState<SystemMessage[]>([]);
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgError, setMsgError] = useState<string | null>(null);

  /** 达人端分组折叠状态：默认全部收起，仅展示分组标题。 */
  const [groupOpen, setGroupOpen] = useState<Record<InfluencerGroupId, boolean>>({
    points: false,
    match: false,
    common: false,
  });

  const influencerBuckets = useMemo(
    () => (shellVariant === "influencer" ? bucketInfluencerNavItems(navItems) : null),
    [shellVariant, navItems],
  );

  /**
   * 当前路由落在某一组内时自动展开该组，便于看到激活项；不强制收起用户已展开的其他组。
   */
  useEffect(() => {
    if (!influencerBuckets) return;
    const path = location.pathname;
    for (const gid of GROUP_ORDER) {
      for (const item of influencerBuckets[gid]) {
        if (isNavItemActiveForPath(path, item)) {
          setGroupOpen((prev) => (prev[gid] ? prev : { ...prev, [gid]: true }));
          return;
        }
      }
    }
  }, [location.pathname, influencerBuckets]);

  useEffect(() => {
    if (!isCompact) setSidebarOpen(false);
  }, [isCompact]);

  /** 读取系统消息列表。 */
  const loadMessages = async () => {
    setMsgLoading(true);
    setMsgError(null);
    try {
      const data = await getSystemMessages();
      setMessages(Array.isArray(data?.list) ? data.list : []);
    } catch (e) {
      setMsgError(e instanceof Error ? e.message : "消息加载失败");
    } finally {
      setMsgLoading(false);
    }
  };

  /** 标记某条消息已读。 */
  const readMessage = async (messageId: number) => {
    try {
      await markSystemMessageRead(messageId);
      setMessages((prev) => prev.map((it) => (it.id === messageId ? { ...it, is_read: 1 } : it)));
    } catch (e) {
      setMsgError(e instanceof Error ? e.message : "已读失败");
    }
  };

  /** 清空当前账号全部消息。 */
  const clearAllMessages = async () => {
    if (!window.confirm("确认清空全部消息吗？")) return;
    setMsgError(null);
    try {
      await clearAllSystemMessages();
      setMessages([]);
    } catch (e) {
      setMsgError(e instanceof Error ? e.message : "清空失败");
    }
  };

  /** 未读数量，用于右上角红点提示。 */
  const unreadCount = messages.filter((it) => Number(it.is_read) !== 1).length;

  useEffect(() => {
    void loadMessages();
    const timer = window.setInterval(() => void loadMessages(), 20000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isCompact || !sidebarOpen) return;
    const origin = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = origin;
    };
  }, [isCompact, sidebarOpen]);

  /**
   * 全区域文本兜底清洗：修复运行时注入或历史缓存导致的 uXXXX 脏串。
   */
  useEffect(() => {
    const root = shellRef.current;
    if (!root) return;

    sanitizeEscapedTextNodes(root);

    const observer = new MutationObserver(() => {
      sanitizeEscapedTextNodes(root);
    });

    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [user?.username, roleTitle, navItems, headerExtra]);

  /**
   * 清除登录态并回到登录页。
   */
  const handleLogout = () => {
    clearAuth();
    navigate("/login", { replace: true });
  };

  /**
   * 点击菜单后自动关闭小屏抽屉，避免遮挡主内容。
   */
  const handleNavClick = () => {
    if (isCompact) setSidebarOpen(false);
  };

  /**
   * 切换达人端某一业务分组的展开/收起。
   */
  const toggleInfluencerGroup = (gid: InfluencerGroupId) => {
    setGroupOpen((prev) => ({ ...prev, [gid]: !prev[gid] }));
  };

  /**
   * 渲染单条侧栏链接（达人端与普通端 class 略有差异）。
   */
  const renderNavLink = (item: DashboardNavItem) => {
    const target = resolveNavTarget(item);
    return (
      <NavLink
        key={item.to}
        to={target}
        title={item.navLocked ? "需申请撮合权限后解锁" : undefined}
        className={({ isActive }) =>
          "xt-sidebar-link" +
          (shellVariant === "influencer" ? " xt-sidebar-link--inf" : "") +
          (item.navLocked ? " is-locked" : "") +
          (isActive ? " is-active" : "")
        }
        onClick={handleNavClick}
        onMouseEnter={() => item.preload?.()}
      >
        {item.icon ? <span className="xt-sidebar-link__ic" aria-hidden>{item.icon}</span> : null}
        <span className="xt-sidebar-link__txt">{normalizeAccountText(item.label)}</span>
        {item.navLocked ? <span className="xt-sidebar-link__lock">🔒</span> : null}
      </NavLink>
    );
  };

  const logoutBtnStyle: CSSProperties =
    logoutVariant === "danger"
      ? {
          padding: "6px 12px",
          border: "1px solid #fecaca",
          borderRadius: 8,
          background: logoutHover ? "#fef2f2" : "#fff",
          color: "#dc2626",
          cursor: "pointer",
          fontWeight: 500,
          transition: "background-color 160ms ease",
        }
      : xtOutlineBtn;

  const dashboardHeaderStyle: CSSProperties =
    shellVariant === "influencer"
      ? { ...xtLayout.dashboardHeader, justifyContent: "space-between", alignItems: "center", width: "100%" }
      : xtLayout.dashboardHeader;

  return (
    <div ref={shellRef} style={xtLayout.dashboardShell}>
      {isCompact && sidebarOpen && (
        <button
          type="button"
          aria-label="关闭菜单遮罩"
          className="xt-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={"xt-sidebar" + (isCompact ? " is-compact" : "") + (sidebarOpen ? " is-open" : "")}
        style={xtLayout.sidebar}
        aria-hidden={isCompact ? !sidebarOpen : false}
      >
        <div className="xt-sidebar-brand">
          <div className="xt-sidebar-logo-wrap">
            <BrandLogo height={40} />
          </div>
          <div className="xt-sidebar-app">达人分发</div>
          <div className="xt-sidebar-role">{normalizeAccountText(roleTitle)}</div>
          {shellVariant === "influencer" && typeof sidebarBalanceBadge === "number" ? (
            <div className="xt-sidebar-balance-pill" title="积分余额">
              <span className="xt-sidebar-balance-pill__label">积分</span>
              <span className="xt-sidebar-balance-pill__value">{sidebarBalanceBadge}</span>
            </div>
          ) : null}
        </div>
        <nav className="xt-sidebar-nav">
          {shellVariant === "influencer" && influencerBuckets
            ? GROUP_ORDER.map((gid) => {
                const items = influencerBuckets[gid];
                if (items.length === 0) return null;
                const expanded = groupOpen[gid];
                return (
                  <div key={gid} className="xt-sidebar-group">
                    <button
                      type="button"
                      className="xt-sidebar-group-toggle"
                      aria-expanded={expanded}
                      onClick={() => toggleInfluencerGroup(gid)}
                    >
                      <span className="xt-sidebar-group-toggle__chevron" aria-hidden />
                      <span className="xt-sidebar-group-toggle__label">{GROUP_LABELS[gid]}</span>
                    </button>
                    {expanded ? <div className="xt-sidebar-group-children">{items.map((it) => renderNavLink(it))}</div> : null}
                  </div>
                );
              })
            : navItems.map((item) => renderNavLink(item))}
        </nav>
      </aside>
      <div style={xtLayout.mainColumn}>
        <header style={dashboardHeaderStyle}>
          <div
            style={{
              flex: shellVariant === "influencer" ? "1 1 auto" : 1,
              display: "flex",
              alignItems: "center",
              gap: shellVariant === "influencer" ? 10 : 8,
              flexWrap: "wrap",
              minWidth: 0,
            }}
          >
            {isCompact && (
              <button
                type="button"
                aria-label={sidebarOpen ? "收起导航菜单" : "展开导航菜单"}
                aria-expanded={sidebarOpen}
                className="xt-hamburger-btn"
                onClick={() => setSidebarOpen((v) => !v)}
              >
                {sidebarOpen ? "✕" : "☰"}
              </button>
            )}
            {shellVariant === "influencer" ? (
              <>
                <span className="xt-header-sysname">达人分发</span>
                <span data-no-auto-translate className="xt-header-username" style={{ color: "var(--xt-text-muted)", fontWeight: 600 }}>
                  {headerUsernameDisplay || normalizeUsername(user?.username) || "influencer002"}
                </span>
                <DeferredBlock ready={headerExtrasReady}>{headerExtra}</DeferredBlock>
              </>
            ) : null}
          </div>
          <div
            className={"xt-header-actions" + (shellVariant === "influencer" ? " xt-header-actions--inf" : "")}
            style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
          >
            <LanguageSwitch />
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setMsgOpen((v) => !v)}
                aria-label="消息通知"
                className={shellVariant === "influencer" ? "xt-header-msg-btn" : undefined}
                style={{ ...xtOutlineBtn, padding: shellVariant === "influencer" ? "6px 12px" : "6px 10px", fontSize: 13, position: "relative" }}
              >
                {shellVariant === "influencer" ? "🔔" : "消息通知"}
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -6,
                      minWidth: 16,
                      height: 16,
                      borderRadius: 8,
                      background: "#dc2626",
                      color: "#fff",
                      fontSize: 11,
                      lineHeight: "16px",
                      textAlign: "center",
                      padding: "0 4px",
                    }}
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
              {msgOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: 38,
                    right: 0,
                    width: 360,
                    maxHeight: 420,
                    overflow: "auto",
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    boxShadow: "0 10px 24px rgba(15,23,42,0.12)",
                    zIndex: 20,
                    padding: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <strong>消息通知</strong>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" onClick={() => void loadMessages()} style={{ ...xtOutlineBtn, padding: "4px 8px", fontSize: 12 }}>
                        刷新
                      </button>
                      <button type="button" onClick={() => void clearAllMessages()} style={{ ...xtOutlineBtn, padding: "4px 8px", fontSize: 12 }}>
                        清空全部
                      </button>
                    </div>
                  </div>
                  {msgError && <p style={{ color: "#b91c1c", margin: "6px 0" }}>{msgError}</p>}
                  {msgLoading && <p style={{ margin: "6px 0" }}>加载中…</p>}
                  {!msgLoading && messages.length === 0 && <p style={{ margin: "6px 0", color: "#64748b" }}>暂无消息</p>}
                  <div style={{ display: "grid", gap: 8 }}>
                    {messages.map((it) => (
                      <div
                        key={it.id}
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: 8,
                          padding: 8,
                          background: Number(it.is_read) === 1 ? "#fff" : "#eff6ff",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <strong style={{ fontSize: 13 }}>{it.title || "系统通知"}</strong>
                          {Number(it.is_read) !== 1 && (
                            <button type="button" onClick={() => void readMessage(it.id)} style={{ ...xtOutlineBtn, padding: "2px 8px", fontSize: 12 }}>
                              标记已读
                            </button>
                          )}
                        </div>
                        <p style={{ margin: "6px 0", fontSize: 13 }}>{it.content || "-"}</p>
                        <div style={{ fontSize: 12, color: "#64748b" }}>{String(it.created_at || "")}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {shellVariant !== "influencer" ? (
              <span data-no-auto-translate style={{ color: "var(--xt-text-muted)" }}>{normalizeUsername(user?.username)}</span>
            ) : null}
            {shellVariant !== "influencer" ? <DeferredBlock ready={headerExtrasReady}>{headerExtra}</DeferredBlock> : null}
            <button
              type="button"
              onClick={handleLogout}
              onMouseEnter={() => setLogoutHover(true)}
              onMouseLeave={() => setLogoutHover(false)}
              style={logoutBtnStyle}
            >
              退出
            </button>
          </div>
        </header>
        <main
          className={"xt-dashboard-main" + (shellVariant === "influencer" ? " xt-main-influencer" : "") + (mainClassName ? " " + mainClassName : "")}
          style={{ ...xtLayout.mainContent, maxWidth: mainMaxWidth }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

