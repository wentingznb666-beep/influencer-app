import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { getStoredUser, clearAuth } from "./authApi";
import LanguageSwitch from "./LanguageSwitch";
import { BrandLogo } from "./BrandLogo";
import { xtLayout, xtOutlineBtn } from "./brandTheme";
import { DeferredBlock, useDeferredInCompact, useResponsive } from "./responsive";
import { normalizeAccountText } from "./utils/accountText";

/** 顶栏/侧栏导航项定义，支持 hover 预加载。 */
export type DashboardNavItem = { to: string; label: string; preload?: () => void };

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
}: DashboardShellProps) {
  const navigate = useNavigate();
  const user = getStoredUser();
  const [logoutHover, setLogoutHover] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isCompact } = useResponsive();
  const headerExtrasReady = useDeferredInCompact(isCompact, 280);
  const shellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isCompact) setSidebarOpen(false);
  }, [isCompact]);

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
        <div className="xt-sidebar-brand" data-no-auto-translate>
          <div className="xt-sidebar-logo-wrap">
            <BrandLogo height={40} />
          </div>
          <div className="xt-sidebar-app">达人分发</div>
          <div className="xt-sidebar-role">{normalizeAccountText(roleTitle)}</div>
        </div>
        <nav className="xt-sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => "xt-sidebar-link" + (isActive ? " is-active" : "")}
              onClick={handleNavClick}
              onMouseEnter={() => item.preload?.()}
            >
              {normalizeAccountText(item.label)}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div style={xtLayout.mainColumn}>
        <header style={xtLayout.dashboardHeader}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
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
          </div>
          <div className="xt-header-actions" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <LanguageSwitch />
            <span data-no-auto-translate style={{ color: "var(--xt-text-muted)" }}>{normalizeUsername(user?.username)}</span>
            <DeferredBlock ready={headerExtrasReady}>{headerExtra}</DeferredBlock>
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
        <main className="xt-dashboard-main" style={{ ...xtLayout.mainContent, maxWidth: mainMaxWidth }}>
          {children}
        </main>
      </div>
    </div>
  );
}
