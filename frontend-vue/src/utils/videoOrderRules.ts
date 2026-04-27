import { GRADED_POINT_UNIT, GRADED_SETTLEMENT_UNIT, type GradedTier, type UnifiedOrderType } from "@/types/videoOrderExt";

/** 获取订单类型中文文案。 */
export function getOrderTypeZh(type: UnifiedOrderType): string {
  if (type === "graded_video") return "类型1：分级视频(A/B/C)";
  if (type === "high_quality_custom_video") return "类型2：高质量视频";
  if (type === "monthly_package") return "类型3：包月合作套餐";
  return "类型4：Creator带货测评视频";
}

/** 获取订单类型泰文文案。 */
export function getOrderTypeTh(type: UnifiedOrderType): string {
  if (type === "graded_video") return "ประเภท 1: วิดีโอแบบจัดระดับ (A/B/C)";
  if (type === "high_quality_custom_video") return "ประเภท 2: วิดีโอคุณภาพสูง";
  if (type === "monthly_package") return "ประเภท 3: แพ็กเกจรายเดือน";
  return "ประเภท 4: วิดีโอรีวิวขายของ Creator";
}

/** 计算类型1积分扣除。 */
export function calcGradedPoints(tier: GradedTier, count: number): number {
  const unit = GRADED_POINT_UNIT[tier] || 0;
  return unit * Math.max(1, Math.floor(Number(count) || 1));
}

/** 计算类型1兼职结算金额。 */
export function calcGradedSettlementThb(tier: GradedTier, count: number): number {
  const unit = GRADED_SETTLEMENT_UNIT[tier] || 0;
  return unit * Math.max(1, Math.floor(Number(count) || 1));
}

/** 获取类型标签颜色（高对比度方案）。 */
export function getOrderTypeTagClass(type: UnifiedOrderType): string {
  if (type === "graded_video") return "tag-gold";
  if (type === "high_quality_custom_video") return "tag-yellow";
  if (type === "monthly_package") return "tag-purple";
  return "tag-red";
}

/** 判断是否需要员工手动标记付款。 */
export function requiresEmployeeManualPayment(type: UnifiedOrderType): boolean {
  return type !== "graded_video";
}
