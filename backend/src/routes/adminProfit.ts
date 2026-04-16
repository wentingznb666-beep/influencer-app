import { Router, Response } from "express";
import { query, withTx } from "../db";
import { requireAuth, requireRole, type AuthRequest } from "../auth";

const router = Router();
router.use(requireAuth);
router.use(requireRole("admin"));

/**
 * 解析日期字符串（YYYY-MM-DD），非法返回 null。
 */
function parseDateOnly(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const v = input.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return v;
}

/**
 * 获取当月起止日期（YYYY-MM-DD）。
 */
function getCurrentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { start: fmt(first), end: fmt(last) };
}

/**
 * GET /api/admin/profit/exclusions
 * 拉取利润统计的排除账号配置。
 */
router.get("/exclusions", (_req: AuthRequest, res: Response) => {
  (async () => {
    const { rows } = await query<{
      user_id: number;
      username: string;
      display_name: string | null;
      role_name: string;
      created_at: string;
    }>(
      `
      SELECT e.user_id, u.username, u.display_name, r.name AS role_name, e.created_at
      FROM admin_profit_exclusions e
      JOIN users u ON e.user_id = u.id
      JOIN roles r ON u.role_id = r.id
      ORDER BY e.user_id DESC
      `
    );
    res.json({ list: rows });
  })().catch((e) => {
    console.error("admin profit exclusions list error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * PUT /api/admin/profit/exclusions
 * 批量覆盖利润统计排除账号。
 */
router.put("/exclusions", (req: AuthRequest, res: Response) => {
  const ids = Array.isArray(req.body?.user_ids) ? req.body.user_ids : [];
  const userIds = Array.from(
    new Set(
      ids
        .map((x: unknown) => Number(x))
        .filter((x: number) => Number.isInteger(x) && x > 0)
    )
  );
  const adminUserId = req.user!.userId;
  (async () => {
    await withTx(async (client) => {
      await client.query("DELETE FROM admin_profit_exclusions");
      if (userIds.length > 0) {
        await client.query(
          `INSERT INTO admin_profit_exclusions (user_id, created_by)
           SELECT id, $1 FROM users WHERE id = ANY($2::int[])
           ON CONFLICT (user_id) DO NOTHING`,
          [adminUserId, userIds]
        );
      }
    });
    res.json({ ok: true, user_ids: userIds });
  })().catch((e) => {
    console.error("admin profit exclusions put error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * GET /api/admin/profit/summary
 * 按时间区间统计利润，并支持按月聚合及排除账号过滤。
 */
router.get("/summary", (req: AuthRequest, res: Response) => {
  const from = parseDateOnly(req.query.start);
  const to = parseDateOnly(req.query.end);
  const month = typeof req.query.month === "string" ? req.query.month.trim() : "";
  let startDate = from;
  let endDate = to;
  if (!startDate || !endDate) {
    if (/^\d{4}-\d{2}$/.test(month)) {
      const [yStr, mStr] = month.split("-");
      const y = Number(yStr);
      const m = Number(mStr);
      const first = new Date(y, m - 1, 1);
      const last = new Date(y, m, 0);
      const pad = (n: number) => String(n).padStart(2, "0");
      startDate = `${first.getFullYear()}-${pad(first.getMonth() + 1)}-${pad(first.getDate())}`;
      endDate = `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`;
    } else {
      const range = getCurrentMonthRange();
      startDate = range.start;
      endDate = range.end;
    }
  }
  if (!startDate || !endDate || startDate > endDate) {
    res.status(400).json({ error: "INVALID_RANGE", message: "时间区间无效，请检查开始与结束日期。" });
    return;
  }
  (async () => {
    const exclusionRes = await query<{ user_id: number }>("SELECT user_id FROM admin_profit_exclusions");
    const excluded = exclusionRes.rows.map((r) => r.user_id);
    const params: unknown[] = [startDate, endDate];
    let idx = 3;
    let exclusionSql = "";
    if (excluded.length > 0) {
      exclusionSql = ` AND mo.client_id <> ALL($${idx}::int[]) AND COALESCE(mo.influencer_id, 0) <> ALL($${idx}::int[])`;
      params.push(excluded);
      idx += 1;
    }

    const summaryRes = await query<{
      total_orders: string;
      total_client_pay: string;
      total_creator_reward: string;
      total_profit: string;
    }>(
      `
      SELECT
        COUNT(*)::text AS total_orders,
        COALESCE(SUM(mo.reward_points), 0)::text AS total_client_pay,
        COALESCE(SUM(mo.creator_reward_points), 0)::text AS total_creator_reward,
        COALESCE(SUM(mo.platform_profit_points), 0)::text AS total_profit
      FROM client_market_orders mo
      WHERE mo.is_deleted = 0
        AND mo.status = 'completed'
        AND mo.completed_at::date >= $1::date
        AND mo.completed_at::date <= $2::date
        ${exclusionSql}
      `,
      params
    );

    const monthlyRes = await query<{
      month_key: string;
      total_orders: string;
      total_profit: string;
    }>(
      `
      SELECT to_char(date_trunc('month', mo.completed_at), 'YYYY-MM') AS month_key,
             COUNT(*)::text AS total_orders,
             COALESCE(SUM(mo.platform_profit_points), 0)::text AS total_profit
      FROM client_market_orders mo
      WHERE mo.is_deleted = 0
        AND mo.status = 'completed'
        AND mo.completed_at::date >= $1::date
        AND mo.completed_at::date <= $2::date
        ${exclusionSql}
      GROUP BY date_trunc('month', mo.completed_at)
      ORDER BY date_trunc('month', mo.completed_at) ASC
      `,
      params
    );

    const detailRes = await query<{
      id: number;
      order_no: string | null;
      completed_at: string;
      client_id: number;
      client_username: string;
      influencer_id: number | null;
      influencer_username: string | null;
      client_pay_points: number;
      creator_reward_points: number;
      platform_profit_points: number;
    }>(
      `
      SELECT mo.id, mo.order_no, mo.completed_at,
             mo.client_id, uc.username AS client_username,
             mo.influencer_id, ui.username AS influencer_username,
             mo.reward_points AS client_pay_points,
             mo.creator_reward_points,
             mo.platform_profit_points
      FROM client_market_orders mo
      JOIN users uc ON mo.client_id = uc.id
      LEFT JOIN users ui ON mo.influencer_id = ui.id
      WHERE mo.is_deleted = 0
        AND mo.status = 'completed'
        AND mo.completed_at::date >= $1::date
        AND mo.completed_at::date <= $2::date
        ${exclusionSql}
      ORDER BY mo.completed_at DESC, mo.id DESC
      LIMIT 1000
      `,
      params
    );

    const summary = summaryRes.rows[0] || {
      total_orders: "0",
      total_client_pay: "0",
      total_creator_reward: "0",
      total_profit: "0",
    };
    res.json({
      range: { start: startDate, end: endDate },
      excluded_user_ids: excluded,
      summary: {
        total_orders: Number(summary.total_orders || 0),
        total_client_pay: Number(summary.total_client_pay || 0),
        total_creator_reward: Number(summary.total_creator_reward || 0),
        total_profit: Number(summary.total_profit || 0),
      },
      monthly: monthlyRes.rows.map((r) => ({
        month: r.month_key,
        total_orders: Number(r.total_orders || 0),
        total_profit: Number(r.total_profit || 0),
      })),
      list: detailRes.rows,
    });
  })().catch((e) => {
    console.error("admin profit summary error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

export default router;
