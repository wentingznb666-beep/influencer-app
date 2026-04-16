import type { CSSProperties } from "react";

/**
 * 湘泰（XIANGTAI）跨境电商品牌视觉：深靛蓝主色、橙色点缀、极淡灰蓝背景。
 * 颜色值与 `index.css` 中 :root 变量保持一致，供内联样式复用。
 */

export const xtLayout = {
  /** 整页背景（旧版顶栏布局，保留兼容） */
  pageBg: { background: "var(--xt-bg)", minHeight: "100vh" } as CSSProperties,
  header: {
    background: "var(--xt-surface)",
    padding: "16px 24px",
    boxShadow: "0 1px 4px rgba(21, 42, 69, 0.07)",
    borderBottom: "1px solid var(--xt-border)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } as CSSProperties,
  title: { margin: 0, fontSize: 18, fontWeight: 600, color: "var(--xt-primary)", letterSpacing: "0.02em" } as CSSProperties,
  main: { margin: "0 auto", padding: 24 } as CSSProperties,
  navRow: { display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" as const } as CSSProperties,
  /** 侧栏 + 主区整体容器 */
  dashboardShell: {
    display: "flex",
    minHeight: "100vh",
    background: "var(--xt-bg)",
  } as CSSProperties,
  /** 左侧深靛蓝导航 */
  sidebar: {
    width: 240,
    flexShrink: 0,
    background: "var(--xt-sidebar-bg)",
    display: "flex",
    flexDirection: "column",
    boxShadow: "4px 0 32px rgba(26, 35, 126, 0.2)",
  } as CSSProperties,
  /** 右侧列：顶栏 + 主内容 */
  mainColumn: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    background: "var(--xt-bg)",
  } as CSSProperties,
  /** 顶栏（白底） */
  dashboardHeader: {
    background: "var(--xt-surface)",
    padding: "var(--xt-header-padding)",
    boxShadow: "0 1px 0 rgba(21, 42, 69, 0.06)",
    borderBottom: "1px solid var(--xt-border)",
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    flexWrap: "wrap" as const,
    gap: 12,
  } as CSSProperties,
  /** 主内容区内边距（与卡片、表格留白） */
  mainContent: {
    flex: 1,
    padding: "var(--xt-main-padding)",
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box" as const,
  } as CSSProperties,
};

/**
 * 顶部导航链接：未选中 / 选中态。
 */
export function navTabStyle(isActive: boolean): CSSProperties {
  const base: CSSProperties = {
    padding: "8px 12px",
    borderRadius: 8,
    textDecoration: "none",
    color: "var(--xt-text)",
    fontWeight: 500,
    transition: "background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease",
  };
  if (!isActive) return base;
  return {
    ...base,
    background: "var(--xt-nav-active-bg)",
    color: "var(--xt-primary)",
    fontWeight: 600,
    boxShadow: "inset 0 -2px 0 var(--xt-accent)",
  };
}

/** 主操作按钮（橙色点缀） */
export const xtPrimaryBtn: CSSProperties = {
  padding: "8px 16px",
  background: "var(--xt-accent)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
  boxShadow: "0 1px 2px rgba(224, 112, 32, 0.25)",
};

/** 次要描边按钮（靛蓝边框） */
export const xtOutlineBtn: CSSProperties = {
  padding: "6px 12px",
  border: "1px solid var(--xt-border-strong)",
  borderRadius: 8,
  background: "var(--xt-surface)",
  color: "var(--xt-primary)",
  cursor: "pointer",
  fontWeight: 500,
};
