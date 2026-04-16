import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

type OrderTableScrollAreaProps = {
  children: ReactNode;
  /**
   * 为 true 时：宽屏不出现横向滚动条，表格铺满容器；窄屏（≤767px，与 ORDER_TABLE_MOBILE_BREAKPOINT_PX 一致）由 CSS 恢复横向滑动。
   */
  fitContent?: boolean;
};

/**
 * 从 WheelEvent 解析横向滚轮增量（兼容 deltaX 与 WebKit 遗留 wheelDeltaX）。
 */
function getWheelDeltaX(e: WheelEvent): number {
  if (e.deltaX !== 0) return e.deltaX;
  const w = e as WheelEvent & { wheelDeltaX?: number };
  if (typeof w.wheelDeltaX === "number" && w.wheelDeltaX !== 0) {
    return -w.wheelDeltaX / 120;
  }
  return 0;
}

/**
 * 判断事件目标是否落在可交互控件上（避免拖拽与点击/输入冲突）。
 */
function isInteractiveTarget(target: EventTarget | null): boolean {
  const el = target instanceof Element ? target : null;
  if (!el) return false;
  return (
    el.closest(
      'a, button, input, select, textarea, label, [contenteditable="true"], [role="button"]',
    ) !== null
  );
}

/** 与 index.css 中订单表移动端 @media (max-width: …) 断点一致 */
const ORDER_TABLE_MOBILE_BREAKPOINT_PX = 767;

/**
 * 是否为窄屏（移动端）：fit 模式下需恢复横向滚轮/拖拽与顶轨。
 */
function isOrderTableMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia('(max-width: ' + String(ORDER_TABLE_MOBILE_BREAKPOINT_PX) + 'px)').matches;
}

/**
 * 订单列表宽表横向滚动容器：
 * - 顶部与底部各一条横向滚动轨道同步 scrollLeft，避免「必须滚到表格最底才能拖到底部横条」的体验问题；
 * - 在捕获阶段于包裹层处理 wheel，顶轨/表格区域均可触发横向滚动，优先响应 Shift+纵轮与触控板横滑；
 * - 桌面端：仅在表格列区域（bottom 横向滚动容器）内，按住鼠标左键拖拽即可实时改变 scrollLeft（与地图「抓手」一致）。
 */
export default function OrderTableScrollArea({ children, fitContent = false }: OrderTableScrollAreaProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const muteScrollRef = useRef(false);
  const [topInnerWidth, setTopInnerWidth] = useState(0);
  const [showTopRail, setShowTopRail] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== "undefined" ? isOrderTableMobileViewport() : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${ORDER_TABLE_MOBILE_BREAKPOINT_PX}px)`);
    const apply = () => setIsMobileViewport(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  /**
   * 根据底部容器尺寸更新顶部占位宽度，并在无需横滑时隐藏顶轨。
   */
  const updateTopRailSize = useCallback(() => {
    const bottom = bottomRef.current;
    if (!bottom) return;
    const sw = bottom.scrollWidth;
    const cw = bottom.clientWidth;
    setTopInnerWidth(sw);
    setShowTopRail(sw > cw);
  }, []);

  useEffect(() => {
    const bottom = bottomRef.current;
    if (!bottom) return;
    const ro = new ResizeObserver(() => {
      updateTopRailSize();
    });
    ro.observe(bottom);
    updateTopRailSize();
    return () => ro.disconnect();
  }, [updateTopRailSize]);

  /**
   * 顶轨刚出现时与底轨 scrollLeft 对齐，避免双轨错位。
   */
  useLayoutEffect(() => {
    if (!showTopRail) return;
    const top = topRef.current;
    const bottom = bottomRef.current;
    if (!top || !bottom) return;
    top.scrollLeft = bottom.scrollLeft;
  }, [showTopRail, topInnerWidth, isMobileViewport, fitContent]);

  /**
   * 顶轨与底轨 scrollLeft 双向同步；muteScrollRef 避免程序化赋值时互相触发 scroll 死循环。
   */
  useEffect(() => {
    const top = topRef.current;
    const bottom = bottomRef.current;
    if (!bottom) return;

    const onTopScroll = () => {
      if (muteScrollRef.current || !top) return;
      muteScrollRef.current = true;
      try {
        bottom.scrollLeft = top.scrollLeft;
      } finally {
        muteScrollRef.current = false;
      }
    };

    const onBottomScroll = () => {
      if (muteScrollRef.current || !top) return;
      muteScrollRef.current = true;
      try {
        top.scrollLeft = bottom.scrollLeft;
      } finally {
        muteScrollRef.current = false;
      }
    };

    bottom.addEventListener("scroll", onBottomScroll);
    if (top) {
      top.addEventListener("scroll", onTopScroll);
    }

    return () => {
      bottom.removeEventListener("scroll", onBottomScroll);
      if (top) {
        top.removeEventListener("scroll", onTopScroll);
      }
    };
  }, [showTopRail, fitContent, isMobileViewport]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const bottom = bottomRef.current;
    if (!wrap || !bottom) return;

    /**
     * 包裹层捕获 wheel：事件目标在底轨或顶轨内时统一改 bottom.scrollLeft（顶轨通过 scroll 事件与底轨同步）。
     */
    const onWheel = (e: WheelEvent) => {
      if (fitContent && !isOrderTableMobileViewport()) return;
      const top = topRef.current;
      const t = e.target as Node;
      if (!bottom.contains(t) && !(top && top.contains(t))) return;

      const canScrollX = bottom.scrollWidth > bottom.clientWidth;
      if (!canScrollX) return;

      const dx = getWheelDeltaX(e);
      const dy = e.deltaY;

      if (e.shiftKey && dy !== 0) {
        bottom.scrollLeft += dy;
        e.preventDefault();
        return;
      }
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 0) {
        bottom.scrollLeft += dx;
        e.preventDefault();
      }
    };

    wrap.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => wrap.removeEventListener("wheel", onWheel, { capture: true } as AddEventListenerOptions);
  }, [showTopRail, fitContent]);

  /**
   * 桌面端：在表格列区域（bottom 横向滚动容器）内按住左键拖拽，实时同步 scrollLeft；
   * 先检测横向位移阈值再进入拖拽，避免轻微点击与选中文本被误判；使用 document 级 pointer 监听，指针移出表格仍可拖。
   */
  useEffect(() => {
    if (fitContent && !isMobileViewport) return;
    const scrollEl = bottomRef.current;
    if (!scrollEl) return;
    const tableEl: HTMLDivElement = scrollEl;

    /** 横向位移超过该值才视为拖拽滚动，避免与单元格点击冲突 */
    const DRAG_THRESHOLD_PX = 5;

    type DragPhase = "idle" | "pending" | "dragging";
    let phase: DragPhase = "idle";
    let dragPointerId = -1;
    let startClientX = 0;
    let startScrollLeft = 0;

    /** 当前是否具备横向可滚空间 */
    const canScrollHorizontally = () => tableEl.scrollWidth > tableEl.clientWidth;

    /** 将拖拽位移映射为 scrollLeft（向右拖 = 内容跟随，scrollLeft 减小） */
    const applyDragToScrollLeft = (clientX: number) => {
      const maxLeft = Math.max(0, tableEl.scrollWidth - tableEl.clientWidth);
      const next = startScrollLeft - (clientX - startClientX);
      tableEl.scrollLeft = Math.max(0, Math.min(maxLeft, next));
    };

    const cleanupDocListeners = () => {
      document.removeEventListener("pointermove", onDocPointerMove, true);
      document.removeEventListener("pointerup", onDocPointerUp, true);
      document.removeEventListener("pointercancel", onDocPointerUp, true);
    };

    const endDrag = (moved: boolean) => {
      document.body.style.userSelect = "";
      tableEl.style.cursor = "";
      try {
        if (dragPointerId >= 0) {
          tableEl.releasePointerCapture(dragPointerId);
        }
      } catch {
        /* 已释放或非当前 capture */
      }
      if (moved) {
        const stopClick = (ev: Event) => {
          ev.preventDefault();
          ev.stopPropagation();
          document.removeEventListener("click", stopClick, true);
        };
        document.addEventListener("click", stopClick, true);
      }
      phase = "idle";
      dragPointerId = -1;
      cleanupDocListeners();
    };

    /** document 上捕获 pointermove：超过阈值后进入 dragging，并实时更新 scrollLeft */
    function onDocPointerMove(e: PointerEvent) {
      if (phase === "idle" || e.pointerId !== dragPointerId) return;
      if (phase === "pending") {
        if (Math.abs(e.clientX - startClientX) < DRAG_THRESHOLD_PX) return;
        phase = "dragging";
        tableEl.setPointerCapture(e.pointerId);
        document.body.style.userSelect = "none";
        tableEl.style.cursor = "grabbing";
      }
      if (phase === "dragging") {
        applyDragToScrollLeft(e.clientX);
        e.preventDefault();
      }
    }

    /** document 上捕获 pointerup/cancel：结束 pending 或拖拽并做清理 */
    function onDocPointerUp(e: PointerEvent) {
      if (e.pointerId !== dragPointerId) return;
      const wasDragging = phase === "dragging";
      cleanupDocListeners();
      if (phase === "pending") {
        phase = "idle";
        dragPointerId = -1;
        return;
      }
      if (phase === "dragging") {
        endDrag(wasDragging);
      }
    }

    /** 表格列区域按下左键：进入 pending 并挂载 document 级指针监听 */
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      if (!canScrollHorizontally()) return;
      if (isInteractiveTarget(e.target)) return;
      if (phase !== "idle") return;

      phase = "pending";
      dragPointerId = e.pointerId;
      startClientX = e.clientX;
      startScrollLeft = tableEl.scrollLeft;

      document.addEventListener("pointermove", onDocPointerMove, true);
      document.addEventListener("pointerup", onDocPointerUp, true);
      document.addEventListener("pointercancel", onDocPointerUp, true);
    };

    tableEl.addEventListener("pointerdown", onPointerDown);

    return () => {
      tableEl.removeEventListener("pointerdown", onPointerDown);
      cleanupDocListeners();
      document.body.style.userSelect = "";
      tableEl.style.cursor = "";
    };
  }, [fitContent, isMobileViewport]);

  const wrapClass = fitContent
    ? "xt-order-table-scroll-wrap xt-order-table-scroll-wrap--fit"
    : "xt-order-table-scroll-wrap";
  const bottomClass = fitContent
    ? "xt-order-table-scroll xt-order-table-scroll--fit"
    : "xt-order-table-scroll";

  return (
    <div ref={wrapRef} className={wrapClass}>
      {showTopRail && (!fitContent || (fitContent && isMobileViewport)) && (
        <div ref={topRef} className="xt-order-table-scroll-top" tabIndex={-1} aria-hidden>
          <div className="xt-order-table-scroll-top-inner" style={{ width: topInnerWidth, minHeight: 8 }} />
        </div>
      )}
      <div ref={bottomRef} className={bottomClass}>
        {children}
      </div>
    </div>
  );
}