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
 * 规范化客户店铺名称输入。
 */
function normalizeClientShopName(value: unknown): string {
  return value != null ? String(value).trim() : "";
}

/**
 * 规范化客户对接群聊输入（群号或链接）。
 */
function normalizeClientGroupChat(value: unknown): string {
  return value != null ? String(value).trim() : "";
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
  const requesterRole = req.user?.role === "employee" ? "employee" : "admin";

  (async () => {
    const params: any[] = [requesterRole];
    let idx = 2;
    let sql = `
      SELECT mo.id, mo.order_no, mo.title, mo.requirements,
             mo.client_id,
             uc.username AS client_username,
             COALESCE(NULLIF(uc.display_name, ''), uc.username) AS client_display_name,
             mo.client_shop_name,
             mo.client_group_chat,
             mo.influencer_id,
             ui.username AS influencer_username,
             COALESCE(NULLIF(ui.display_name, ''), ui.username) AS influencer_display_name,
             mo.reward_points AS client_pay_points,
             CASE WHEN $1 = 'employee' THEN NULL ELSE mo.creator_reward_points END AS creator_reward_points,
             CASE WHEN $1 = 'employee' THEN NULL ELSE mo.platform_profit_points END AS platform_profit_points,
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
        OR COALESCE(mo.client_shop_name, '') ILIKE '%' || $${idx} || '%'
        OR COALESCE(mo.client_group_chat, '') ILIKE '%' || $${idx} || '%'
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

/**
 * PATCH /api/admin/orders/:id/client-info
 * 管理员/员工编辑客户基础信息（店铺名称、对接群聊）。
 */
router.patch("/:id/client-info", (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的订单 ID。" });
    return;
  }
  const { client_shop_name, client_group_chat } = req.body ?? {};
  const shopName = normalizeClientShopName(client_shop_name);
  const groupChat = normalizeClientGroupChat(client_group_chat);
  if (!shopName) {
    res.status(400).json({ error: "INVALID_CLIENT_SHOP_NAME", message: "请输入客户店铺名称。" });
    return;
  }
  if (shopName.length > 200) {
    res.status(400).json({ error: "INVALID_CLIENT_SHOP_NAME", message: "客户店铺名称最长 200 字符。" });
    return;
  }
  if (!groupChat) {
    res.status(400).json({ error: "INVALID_CLIENT_GROUP_CHAT", message: "请输入客户对接群聊（群号/链接）。" });
    return;
  }
  if (groupChat.length > 2000) {
    res.status(400).json({ error: "INVALID_CLIENT_GROUP_CHAT", message: "客户对接群聊最长 2000 字符。" });
    return;
  }
  (async () => {
    const updated = await query<{ id: number }>(
      `UPDATE client_market_orders
          SET client_shop_name = $1, client_group_chat = $2, updated_at = now()
        WHERE id = $3 AND is_deleted = 0
        RETURNING id`,
      [shopName, groupChat, id]
    );
    if (!updated.rows[0]) {
      res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
      return;
    }
    res.json({ ok: true });
  })().catch((e) => {
    console.error("admin orders client-info patch error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

export default router;

