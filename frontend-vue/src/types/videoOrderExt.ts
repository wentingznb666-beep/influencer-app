/** 统一订单类型枚举。 */
export type UnifiedOrderType = "graded_video" | "high_quality_custom_video" | "monthly_package" | "creator_review_video";

/** 类型1分级档位。 */
export type GradedTier = "A" | "B" | "C";

/** 包月批次状态。 */
export type MonthlyBatchStatus = "pending_acceptance" | "accepted" | "settled";

/** 包月批次记录。 */
export type MonthlyBatchRecord = {
  batch_no: number;
  status: MonthlyBatchStatus;
  video_count: number;
  accepted_count?: number;
  settled_amount?: number;
  proof_links?: string[];
  submitted_at?: string;
  accepted_at?: string;
  settled_at?: string;
  accept_note?: string | null;
};

/** 类型1自动结算单价（THB/条）。 */
export const GRADED_SETTLEMENT_UNIT: Record<GradedTier, number> = {
  A: 15,
  B: 10,
  C: 5,
};

/** 类型1积分扣除单价（积分/条）。 */
export const GRADED_POINT_UNIT: Record<GradedTier, number> = {
  A: 60,
  B: 40,
  C: 20,
};
