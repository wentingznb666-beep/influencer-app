import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

type OrderTableScrollAreaProps = {
  children: ReactNode;
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
 * 订单列表宽表横向滚动容器：
 * - 顶部与底部各一条横向滚动轨道同步 scrollLeft，避免「必须滚到表格最底才能拖到底部横条」的体验问题；
 * - 在捕获阶段于包裹层处理 wheel，顶轨/表格区域均可触发横向滚动，优先响应 Shift+纵轮与触控板横滑。
 */
export default function OrderTableScrollArea({ children }: OrderTableScrollAreaProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const muteScrollRef = useRef(false);
  const [topInnerWidth, setTopInnerWidth] = useState(0);
  const [showTopRail, setShowTopRail] = useState(false);

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
  }, [showTopRail, topInnerWidth]);

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
  }, [showTopRail]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const bottom = bottomRef.current;
    if (!wrap || !bottom) return;

    /**
     * 包裹层捕获 wheel：事件目标在底轨或顶轨内时统一改 bottom.scrollLeft（顶轨通过 scroll 事件与底轨同步）。
     */
    const onWheel = (e: WheelEvent) => {
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
  }, [showTopRail]);

  return (
    <div ref={wrapRef} className="xt-order-table-scroll-wrap">
      {showTopRail && (
        <div ref={topRef} className="xt-order-table-scroll-top" tabIndex={-1} aria-hidden>
          <div className="xt-order-table-scroll-top-inner" style={{ width: topInnerWidth, minHeight: 8 }} />
        </div>
      )}
      <div ref={bottomRef} className="xt-order-table-scroll">
        {children}
      </div>
    </div>
  );
}