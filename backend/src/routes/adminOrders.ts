import { Router, Response } from "express";
import { query } from "../db";
import { requireAuth, requireRole, type AuthRequest } from "../auth";

const router = Router();
router.use(requireAuth);
router.use(requireRole("admin", "employee"));

type OrderStatus = "open" | "claimed" | "completed" | "cancelled";

/**
 * 解析订单状态筛选参数；空值表示不筛选。
 */
function normalizeOrderStatus(value: unknown): OrderStatus | "" {
  if (value === "open" || value === "claimed" || value === "completed" || value === "cancelled") return value;
  return "";
}

/**
 * GET /api/admin/orders
 * 管理员/员工查看客户端发起的达人领单订单（client_market_orders），支持：
 * - q：按订单号、标题、要求、客户账号/名称、达人账号/昵称模糊匹配
 * - status：按订单状态筛选（open/claimed/completed/cancelled）
 */
router.get("/", (req: AuthRequest, res: Response) => {
  const rawQ = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const status = normalizeOrderStatus(req.query.status);

  (async () => {
    const params: any[] = [];
    let idx = 1;
    let sql = `
      SELECT mo.id, mo.order_no, mo.title, mo.requirements,
             mo.client_id,
             uc.username AS client_username,
             COALESCE(NULLIF(uc.display_name, ''), uc.username) AS client_display_name,
             mo.influencer_id,
             ui.username AS influencer_username,
             COALESCE(NULLIF(ui.display_name, ''), ui.username) AS influencer_display_name,
             mo.reward_points AS client_pay_points,
             mo.creator_reward_points,
             mo.platform_profit_points,
             mo.tier,
             mo.status,
             mo.work_link,
             mo.created_at,
             mo.updated_at,
             mo.completed_at
      FROM client_market_orders mo
      JOIN users uc ON mo.client_id = uc.id
      LEFT JOIN users ui ON mo.influencer_id = ui.id
      WHERE 1=1
    `;

    if (status) {
      sql += ` AND mo.status = $${idx++}`;
      params.push(status);
    }

    if (rawQ) {
      sql += ` AND (
        mo.order_no ILIKE '%' || $${idx} || '%'
        OR COALESCE(mo.title, '') ILIKE '%' || $${idx} || '%'
        OR mo.requirements ILIKE '%' || $${idx} || '%'
        OR uc.username ILIKE '%' || $${idx} || '%'
        OR COALESCE(uc.display_name, '') ILIKE '%' || $${idx} || '%'
        OR COALESCE(ui.username, '') ILIKE '%' || $${idx} || '%'
        OR COALESCE(ui.display_name, '') ILIKE '%' || $${idx} || '%'
      )`;
      params.push(rawQ);
      idx += 1;
    }

    sql += ` ORDER BY mo.id DESC LIMIT 500`;

    const { rows } = await query(sql, params);
    res.json({ list: rows });
  })().catch((e) => {
    console.error("admin orders list error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

export default router;

