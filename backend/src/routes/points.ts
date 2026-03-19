import { Router, Response } from "express";
import { query } from "../db";
import { requireAuth, requireRole, type AuthRequest } from "../auth";

const router = Router();
router.use(requireAuth);
router.use(requireRole("admin"));

/**
 * GET /api/admin/points/summary
 * 积分汇总：各用户（达人/客户）当前余额及可选按周统计。
 */
router.get("/summary", (req: AuthRequest, res: Response) => {
  const { week } = req.query as { week?: string };
  (async () => {
    const accountsRes = await query<{ id: number; user_id: number; balance: number; updated_at: string; username: string; role: string }>(
      `
    SELECT pa.id, pa.user_id, pa.balance, pa.updated_at, u.username, r.name AS role
    FROM point_accounts pa
    JOIN users u ON pa.user_id = u.id
    JOIN roles r ON u.role_id = r.id
    ORDER BY pa.user_id
  `
    );
    const accounts = accountsRes.rows;

    let weekSummary: Array<{ user_id: number; username: string; role: string; total_added: number }> = [];
    if (week) {
      const [y, w] = week.split("-").map(Number);
      if (y && w) {
        const weekStart = new Date(Date.UTC(y, 0, 1 + (w - 1) * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
        const startStr = weekStart.toISOString().slice(0, 10);
        const endStr = weekEnd.toISOString().slice(0, 10);
        const ws = await query<{ user_id: number; username: string; role: string; total_added: string }>(
          `
        SELECT u.id AS user_id, u.username, r.name AS role, COALESCE(SUM(l.amount), 0) AS total_added
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN point_accounts pa ON pa.user_id = u.id
        LEFT JOIN point_ledger l ON l.account_id = pa.id AND l.amount > 0 AND l.created_at::date >= $1::date AND l.created_at::date <= $2::date
        GROUP BY u.id, u.username, r.name
      `,
          [startStr, endStr]
        );
        weekSummary = ws.rows.map((r) => ({ ...r, total_added: Number(r.total_added) }));
      }
    }
    res.json({ accounts, weekSummary });
  })().catch((e) => {
    console.error("points summary error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * GET /api/admin/points/ledger
 * 积分流水，支持 user_id、limit、offset。
 */
router.get("/ledger", (req: AuthRequest, res: Response) => {
  const { user_id, limit = "50", offset = "0" } = req.query as { user_id?: string; limit?: string; offset?: string };
  (async () => {
    let sql = `
    SELECT l.id, l.account_id, l.amount, l.type, l.ref_id, l.created_at, pa.user_id, u.username
    FROM point_ledger l
    JOIN point_accounts pa ON l.account_id = pa.id
    JOIN users u ON pa.user_id = u.id
    WHERE 1=1
  `;
    const params: any[] = [];
    let idx = 1;
    if (user_id) {
      sql += ` AND pa.user_id = $${idx++}`;
      params.push(Number(user_id));
    }
    sql += ` ORDER BY l.id DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(Math.min(Number(limit) || 50, 200), Math.max(0, Number(offset) || 0));
    const { rows } = await query(sql, params);
    res.json({ list: rows });
  })().catch((e) => {
    console.error("points ledger error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

export default router;
