import { Router, Response } from "express";
import { query } from "../db";
import { requireAuth, requireRole, type AuthRequest } from "../auth";

const router = Router();
router.use(requireAuth);
router.use(requireRole("admin", "employee"));

/**
 * GET /api/admin/skus/clients
 * 管理员/员工获取客户下拉选项（仅返回客户端账号）。
 */
router.get("/clients", (_req: AuthRequest, res: Response) => {
  (async () => {
    const { rows } = await query<{ id: number; username: string }>(
      `
      SELECT u.id, u.username
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE r.name = 'client'
      ORDER BY u.id DESC
      LIMIT 2000
      `
    );
    res.json({ list: rows });
  })().catch((e) => {
    console.error("admin skus clients error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * GET /api/admin/skus
 * 管理员/员工查看客户 SKU 列表，支持按客户或 SKU 关键词搜索。
 */
router.get("/", (req: AuthRequest, res: Response) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const clientId = typeof req.query.client_id === "string" ? Number(req.query.client_id) : null;
  (async () => {
    const params: any[] = [];
    let idx = 1;
    let sql = `
      SELECT s.id, s.client_id, u.username AS client_username, s.sku_code, s.sku_name, s.sku_images, s.created_at, s.updated_at
        FROM client_skus s
        JOIN users u ON s.client_id = u.id
       WHERE s.is_deleted = 0
    `;
    if (clientId && Number.isInteger(clientId) && clientId > 0) {
      sql += ` AND s.client_id = $${idx++}`;
      params.push(clientId);
    }
    if (q) {
      sql += ` AND (u.username ILIKE '%' || $${idx} || '%' OR s.sku_code ILIKE '%' || $${idx} || '%' OR COALESCE(s.sku_name,'') ILIKE '%' || $${idx} || '%' OR s.client_id::text = $${idx})`;
      params.push(q);
      idx++;
    }
    sql += ` ORDER BY s.id DESC LIMIT 1000`;
    const { rows } = await query(sql, params);
    res.json({ list: rows });
  })().catch((e) => {
    console.error("admin skus list error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

export default router;

