import { Router, Response } from "express";
import { query } from "../db";
import { requireAuth, requireRole, type AuthRequest } from "../auth";

const router = Router();
router.use(requireAuth);
router.use(requireRole("admin", "employee"));

/**
 * GET /api/admin/market-orders
 * 全量达人领单列表；可选 q 对订单号、标题、要求全文做精准匹配。
 */
router.get("/", (req: AuthRequest, res: Response) => {
  const rawQ = typeof req.query.q === "string" ? req.query.q.trim() : "";
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
    if (rawQ) {
      sql += ` WHERE (mo.order_no = $1 OR mo.title = $1 OR mo.requirements = $1)`;
      params.push(rawQ);
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
