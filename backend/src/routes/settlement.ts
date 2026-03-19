import { Router, Response } from "express";
import { query } from "../db";
import { requireAuth, requireRole, type AuthRequest } from "../auth";

const router = Router();
router.use(requireAuth);
router.use(requireRole("admin"));

/**
 * 获取锁定期天数配置。
 */
async function getLockPeriodDays(): Promise<number> {
  const r = await query<{ value: string }>("SELECT value FROM config WHERE key = 'lock_period_days'");
  return Math.min(30, Math.max(1, Number(r.rows[0]?.value) || 5));
}

/**
 * GET /api/admin/settlement/weeks
 * 可结算的周列表（基于已通过投稿的 reviewed_at）。
 */
router.get("/weeks", (_req: AuthRequest, res: Response) => {
  (async () => {
    const lockDays = await getLockPeriodDays();
    const { rows } = await query<{ reviewed_date: string }>(
      `
    SELECT DISTINCT (s.reviewed_at::date)::text AS reviewed_date
    FROM submissions s
    WHERE s.status = 'approved' AND s.reviewed_at IS NOT NULL
    ORDER BY reviewed_date DESC
    LIMIT 52
  `
    );
    const weekSet = new Set<string>();
    for (const r of rows) {
      const d = new Date(r.reviewed_date + "T12:00:00Z");
      const weekStart = new Date(d);
      weekStart.setUTCDate(d.getUTCDate() - d.getUTCDay());
      const weekStartStr = weekStart.toISOString().slice(0, 10);
      weekSet.add(weekStartStr);
    }
    const weeks = Array.from(weekSet).sort().reverse();
    res.json({ weeks, lock_period_days: lockDays });
  })().catch((e) => {
    console.error("settlement weeks error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * GET /api/admin/settlement/summary
 * 指定周的结算汇总：按达人汇总“锁定期已过”的通过投稿积分，并合并已存在的 settlement_records。
 */
router.get("/summary", (req: AuthRequest, res: Response) => {
  const { week } = req.query as { week?: string };
  if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(week)) {
    res.status(400).json({ error: "INVALID_WEEK", message: "请提供 week 参数，格式 YYYY-MM-DD（周一日期）。" });
    return;
  }
  (async () => {
  const lockDays = await getLockPeriodDays();
  const weekEnd = new Date(week + "T12:00:00Z");
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);
  const lockCutoff = new Date(weekEndStr + "T23:59:59Z");
  lockCutoff.setUTCDate(lockCutoff.getUTCDate() + lockDays);
  const lockCutoffStr = lockCutoff.toISOString().slice(0, 10);

  const rows = (await query<{ user_id: number; username: string; amount: string }>(
      `
    SELECT tc.user_id, u.username, SUM(t.point_reward) AS amount
    FROM submissions s
    JOIN task_claims tc ON s.task_claim_id = tc.id
    JOIN users u ON tc.user_id = u.id
    JOIN tasks t ON tc.task_id = t.id
    WHERE s.status = 'approved'
      AND s.reviewed_at IS NOT NULL
      AND s.reviewed_at::date >= $1::date AND s.reviewed_at::date <= $2::date
      AND s.reviewed_at::date <= $3::date
    GROUP BY tc.user_id
  `
    , [week, weekEndStr, lockCutoffStr])).rows;

  const existing = (await query<{
    id: number;
    user_id: number;
    amount: number;
    status: string;
    paid_at: string | null;
    note: string | null;
  }>("SELECT id, user_id, amount, status, paid_at, note FROM settlement_records WHERE week_start = $1", [week])).rows;
  const byUser = new Map(existing.map((e) => [e.user_id, e]));

  const list = rows.map((r) => {
    const rec = byUser.get(r.user_id);
    return {
      id: rec?.id ?? null,
      user_id: r.user_id,
      username: r.username,
      amount: rec?.amount ?? Number(r.amount),
      status: rec?.status ?? "pending",
      paid_at: rec?.paid_at ?? null,
      note: rec?.note ?? null,
    };
  });
  res.json({ week, lock_period_days: lockDays, list });
  })().catch((e) => {
    console.error("settlement summary error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * POST /api/admin/settlement/generate
 * 生成指定周的结算记录（若不存在则插入 pending）。
 */
router.post("/generate", (req: AuthRequest, res: Response) => {
  const { week } = req.body ?? {};
  if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(week)) {
    res.status(400).json({ error: "INVALID_WEEK", message: "请提供 week，格式 YYYY-MM-DD。" });
    return;
  }
  (async () => {
  const lockDays = await getLockPeriodDays();
  const weekEnd = new Date(week + "T12:00:00Z");
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);
  const lockCutoff = new Date(weekEndStr + "T23:59:59Z");
  lockCutoff.setUTCDate(lockCutoff.getUTCDate() + lockDays);
  const lockCutoffStr = lockCutoff.toISOString().slice(0, 10);

  const rows = (await query<{ user_id: number; amount: string }>(
      `
    SELECT tc.user_id, SUM(t.point_reward) AS amount
    FROM submissions s
    JOIN task_claims tc ON s.task_claim_id = tc.id
    JOIN tasks t ON tc.task_id = t.id
    WHERE s.status = 'approved' AND s.reviewed_at IS NOT NULL
      AND s.reviewed_at::date >= $1::date AND s.reviewed_at::date <= $2::date
      AND s.reviewed_at::date <= $3::date
    GROUP BY tc.user_id
  `
    , [week, weekEndStr, lockCutoffStr])).rows;

  for (const r of rows) {
    const amount = Number(r.amount);
    if (amount > 0) {
      await query(
        "INSERT INTO settlement_records (user_id, week_start, amount, status) VALUES ($1, $2::date, $3, 'pending') ON CONFLICT (user_id, week_start) DO NOTHING",
        [r.user_id, week, amount]
      );
    }
  }
  res.json({ ok: true, week, count: rows.length });
  })().catch((e) => {
    console.error("settlement generate error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * GET /api/admin/settlement/export
 * 导出指定周结算报表 CSV。
 */
router.get("/export", (req: AuthRequest, res: Response) => {
  const { week } = req.query as { week?: string };
  if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(week)) {
    res.status(400).json({ error: "INVALID_WEEK", message: "请提供 week 参数。" });
    return;
  }
  (async () => {
    const rows = (await query<Array<{ id: number; user_id: number; username: string; amount: number; status: string; paid_at: string | null; note: string | null; created_at: string }>>(
      `
    SELECT sr.id, sr.user_id, u.username, sr.amount, sr.status, sr.paid_at, sr.note, sr.created_at
    FROM settlement_records sr
    JOIN users u ON sr.user_id = u.id
    WHERE sr.week_start = $1::date
    ORDER BY sr.user_id
  `
      , [week])).rows as any;
  const header = "id,user_id,username,amount,status,paid_at,note,created_at";
  const lines = rows.map((r: { id: number; user_id: number; username: string; amount: number; status: string; paid_at: string | null; note: string | null; created_at: string }) => `${r.id},${r.user_id},"${escapeCsv(r.username)}",${r.amount},${r.status},"${escapeCsv(r.paid_at || "")}","${escapeCsv(r.note || "")}",${r.created_at}`);
  const csv = [header, ...lines].join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=settlement_${week}.csv`);
  res.send("\uFEFF" + csv);
  })().catch((e) => {
    console.error("settlement export error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

function escapeCsv(v: string): string {
  return v.replace(/"/g, '""');
}

/**
 * PATCH /api/admin/settlement/:id
 * 更新打款状态：paid | exception，可选 note。
 */
router.patch("/:id", (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的结算记录 ID。" });
    return;
  }
  const { status, note } = req.body ?? {};
  if (status !== "paid" && status !== "exception") {
    res.status(400).json({ error: "INVALID_STATUS", message: "status 须为 paid 或 exception。" });
    return;
  }
  (async () => {
    const row = await query<{ id: number }>("SELECT id FROM settlement_records WHERE id = $1", [id]);
    if (!row.rows[0]) {
      res.status(404).json({ error: "NOT_FOUND", message: "结算记录不存在。" });
      return;
    }
    await query(
      "UPDATE settlement_records SET status = $1, paid_at = CASE WHEN $1 = 'paid' THEN now() ELSE paid_at END, note = COALESCE($2, note) WHERE id = $3",
      [status, note != null ? String(note) : null, id]
    );
    res.json({ ok: true });
  })().catch((e) => {
    console.error("settlement patch error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

export default router;
