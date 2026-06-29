/** 通用状态标签组件，自动匹配颜色方案 */
import type { CSSProperties } from "react";

type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral";

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  success: "xt-badge xt-badge--success",
  warning: "xt-badge xt-badge--warning",
  danger:  "xt-badge xt-badge--danger",
  info:    "xt-badge xt-badge--info",
  neutral: "xt-badge xt-badge--neutral",
};

/** 根据状态文本自动推断颜色变体 */
const STATUS_VARIANT_MAP: Record<string, BadgeVariant> = {
  // 中文
  "待领取":   "warning",
  "已领取":   "info",
  "已完成":   "success",
  "已取消":   "danger",
  "已关闭":   "neutral",
  "进行中":   "info",
  "待审核":   "warning",
  "已通过":   "success",
  "已拒绝":   "danger",
  "已结算":   "success",
  // 英文
  "open":      "warning",
  "claimed":   "info",
  "completed": "success",
  "cancelled": "danger",
};

export function getStatusVariant(status: string): BadgeVariant {
  return STATUS_VARIANT_MAP[status] ?? "neutral";
}

export default function StatusBadge({
  status,
  style,
}: {
  status: string;
  style?: CSSProperties;
}) {
  const { t } = useTranslation();
  const variant = getStatusVariant(status);
  return (
    <span className={VARIANT_CLASS[variant]} style={style}>
      {status}
    </span>
  );
}
