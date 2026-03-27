import { Router, Response } from "express";
import { query } from "../db";
import { requireAuth, requireRole, type AuthRequest } from "../auth";

const router = Router();
router.use(requireAuth);
router.use(requireRole("admin", "employee"));

/**
 * 解析日期参数（YYYY-MM-DD），非法时返回空字符串。
 */
function normalizeDateOnly(value: unknown): string {
  if (typeof value !== "string") return "";
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "";
  return v;
}

/**
 * GET /api/admin/market-orders
 * 全量达人领单列表；支持订单号精准搜索 + 创建日期（单日/区间）筛选。
 */
router.get("/", (req: AuthRequest, res: Response) => {
  const rawQ = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const startDate = normalizeDateOnly(req.query.start_date);
  const endDate = normalizeDateOnly(req.query.end_date);
  (async () => {
    let sql = `
      SELECT mo.id, mo.order_no, mo.title, mo.requirements,
             mo.reward_points AS client_pay_points,
             mo.creator_reward_points AS creator_reward_points,
             mo.platform_profit_points AS platform_profit_points,
             mo.tier,
             mo.status,
             mo.client_id, uc.username AS client_username,
             mo.client_shop_name, mo.client_group_chat,
             mo.influencer_id, ui.username AS influencer_username,
             mo.work_link, mo.created_at, mo.updated_at, mo.completed_at
      FROM client_market_orders mo
      JOIN users uc ON mo.client_id = uc.id
      LEFT JOIN users ui ON mo.influencer_id = ui.id
    `;
    const params: unknown[] = [];
    const where: string[] = [];
    let idx = 1;
    if (rawQ) {
      where.push(`(mo.order_no = $${idx} OR mo.title = $${idx} OR mo.requirements = $${idx})`);
      params.push(rawQ);
      idx += 1;
    }
    if (startDate) {
      where.push(`mo.created_at::date >= $${idx}::date`);
      params.push(startDate);
      idx += 1;
    }
    if (endDate) {
      where.push(`mo.created_at::date <= $${idx}::date`);
      params.push(endDate);
      idx += 1;
    }
    if (where.length > 0) {
      sql += ` WHERE ${where.join(" AND ")}`;
    }
    sql += ` ORDER BY mo.id DESC LIMIT 500`;
    const { rows } = await query(sql, params);
    res.json({ list: rows });
  })().catch((e) => {
    console.error("admin market-orders list error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

export default router;
