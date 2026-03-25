import { Router, Response } from "express";
import { query } from "../db";
import { requireAuth, requireRole, type AuthRequest } from "../auth";

const router = Router();
router.use(requireAuth);
router.use(requireRole("admin", "employee"));

type OrderStatus = "pending" | "sent" | "received";

/**
 * 解析订单状态筛选参数；空值表示不筛选。
 */
function normalizeOrderStatus(value: unknown): OrderStatus | "" {
  if (value === "pending" || value === "sent" || value === "received") return value;
  return "";
}

/**
 * GET /api/admin/orders
 * 管理员查看所有客户订单（sample_orders），支持：
 * - q：按订单号（ID）、客户用户名、备注模糊匹配
 * - status：按订单状态筛选（pending/sent/received）
 */
router.get("/", (req: AuthRequest, res: Response) => {
  const rawQ = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const status = normalizeOrderStatus(req.query.status);

  (async () => {
    const params: any[] = [];
    let idx = 1;
    let sql = `
      SELECT o.id, o.client_id, u.username AS client_username,
             o.request_id, r.product_info, r.target_platform,
             o.status, o.note, o.created_at, o.updated_at
      FROM sample_orders o
      JOIN users u ON o.client_id = u.id
      LEFT JOIN client_requests r ON o.request_id = r.id
      WHERE 1=1
    `;

    if (status) {
      sql += ` AND o.status = $${idx++}`;
      params.push(status);
    }

    if (rawQ) {
      // 订单号支持输入数字（匹配 ID），否则按用户名/备注模糊匹配
      const asId = Number(rawQ);
      if (Number.isInteger(asId) && asId > 0) {
        sql += ` AND o.id = $${idx++}`;
        params.push(asId);
      } else {
        sql += ` AND (u.username ILIKE '%' || $${idx++} || '%' OR COALESCE(o.note,'') ILIKE '%' || $${idx++} || '%')`;
        params.push(rawQ, rawQ);
      }
    }

    sql += ` ORDER BY o.id DESC LIMIT 500`;

    const { rows } = await query(sql, params);
    res.json({ list: rows });
  })().catch((e) => {
    console.error("admin orders list error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

export default router;

