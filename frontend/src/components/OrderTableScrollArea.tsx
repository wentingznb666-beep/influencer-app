import { useEffect, useRef, type ReactNode } from "react";

type OrderTableScrollAreaProps = {
  children: ReactNode;
};

/**
 * 订单列表表格横向滚动容器：Shift+纵轮与触控板横向滑动优先横向滚动，改善全区域横滑体验。
 */
export default function OrderTableScrollArea({ children }: OrderTableScrollAreaProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const canScrollX = el.scrollWidth > el.clientWidth;
      if (!canScrollX) return;
      if (e.shiftKey && e.deltaY !== 0) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
        return;
      }
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 0) {
        el.scrollLeft += e.deltaX;
        e.preventDefault();
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div
      ref={ref}
      className="xt-order-table-scroll"
      style={{
        overflowX: "auto",
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      }}
    >
      {children}
    </div>
  );
}
