import { useEffect, useMemo, useState, type ReactNode } from "react";

export type Breakpoint = "mobile" | "tablet" | "desktop";

/**
 * 统一维护项目断点：
 * - mobile: < 768
 * - tablet: 768 ~ 1024
 * - desktop: > 1024
 */
function getBreakpoint(width: number): Breakpoint {
  if (width < 768) return "mobile";
  if (width <= 1024) return "tablet";
  return "desktop";
}

/**
 * 响应式信息钩子：返回当前断点及常用布尔状态。
 */
export function useResponsive() {
  const [width, setWidth] = useState<number>(typeof window === "undefined" ? 1280 : window.innerWidth);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const breakpoint = useMemo(() => getBreakpoint(width), [width]);
  return {
    width,
    breakpoint,
    isMobile: breakpoint === "mobile",
    isTablet: breakpoint === "tablet",
    isDesktop: breakpoint === "desktop",
    isCompact: breakpoint !== "desktop",
  };
}

/**
 * 小屏延迟渲染非关键区域，优先展示核心内容。
 */
export function useDeferredInCompact(isCompact: boolean, delayMs = 240): boolean {
  const [ready, setReady] = useState(!isCompact);

  useEffect(() => {
    if (!isCompact) {
      setReady(true);
      return;
    }
    setReady(false);
    const timer = window.setTimeout(() => setReady(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, isCompact]);

  return ready;
}

/**
 * 非关键区域包装器：小屏下延迟显示。
 */
export function DeferredBlock({
  ready,
  children,
}: {
  ready: boolean;
  children: ReactNode;
}) {
  if (!ready) return null;
  return children as any;
}

