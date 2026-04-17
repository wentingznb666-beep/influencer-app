/** 撮合权限状态文案映射。 */
export function formatInfluencerPermissionStatus(status: string | null | undefined): string {
  const v = String(status || "unapplied");
  if (v === "pending") return "待审核";
  if (v === "approved") return "已通过";
  if (v === "rejected") return "已拒绝";
  if (v === "disabled") return "已禁用";
  return "未申请";
}

/** 达人需求状态文案映射。 */
export function formatDemandStatus(status: string | null | undefined): string {
  const v = String(status || "pending_review");
  if (v === "open") return "开放报名";
  if (v === "pending_review") return "待审核";
  if (v === "matched") return "已匹配";
  if (v === "rejected") return "已拒绝";
  if (v === "closed") return "已关闭";
  return v;
}

/** 需求报名状态文案映射。 */
export function formatDemandApplyStatus(status: string | null | undefined): string {
  const v = String(status || "not_applied");
  if (v === "pending") return "待达人选择";
  if (v === "selected") return "已被选中";
  if (v === "rejected") return "已被拒绝";
  return "未报名";
}

/** 商家会员等级文案映射。 */
export function formatMemberLevel(level: number | string | null | undefined): string {
  const n = Number(level || 0);
  if (n === 1) return "基础会员";
  if (n === 2) return "高级会员";
  if (n === 3) return "旗舰会员";
  return "非会员";
}

/** 商家保证金状态文案映射。 */
export function formatDepositStatus(status: string | null | undefined): string {
  const v = String(status || "none");
  if (v === "active") return "正常";
  if (v === "warning") return "预警";
  if (v === "frozen") return "冻结";
  if (v === "closed") return "关闭";
  return "未开通";
}
