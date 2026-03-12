import { Router, Response } from "express";
import { getDb } from "../db";
import { requireAuth, requireRole, type AuthRequest } from "../auth";

const router = Router();
router.use(requireAuth);
router.use(requireRole("admin"));

/**
 * 获取锁定期天数配置。
 */
function getLockPeriodDays(database: ReturnType<typeof getDb>): number {
  const row = database.prepare("SELECT value FROM config WHERE key = 'lock_period_days'").get() as { value: string } | undefined;
  return Math.min(30, Math.max(1, Number(row?.value) || 5));
}

/**
 * GET /api/admin/settlement/weeks
 * 可结算的周列表（基于已通过投稿的 reviewed_at）。
 */
router.get("/weeks", (_req: AuthRequest, res: Response) => {
  const database = getDb();
  const lockDays = getLockPeriodDays(database);
  const rows = database
    .prepare(
      `
    SELECT DISTINCT date(s.reviewed_at) AS reviewed_date
    FROM submissions s
    WHERE s.status = 'approved' AND s.reviewed_at IS NOT NULL
    ORDER BY reviewed_date DESC
    LIMIT 52
  `
    )
    .all() as Array<{ reviewed_date: string }>;
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
  const database = getDb();
  const lockDays = getLockPeriodDays(database);
  const weekEnd = new Date(week + "T12:00:00Z");
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);
  const lockCutoff = new Date(weekEndStr + "T23:59:59Z");
  lockCutoff.setUTCDate(lockCutoff.getUTCDate() + lockDays);
  const lockCutoffStr = lockCutoff.toISOString().slice(0, 10);

  const rows = database
    .prepare(
      `
    SELECT tc.user_id, u.username, SUM(t.point_reward) AS amount
    FROM submissions s
    JOIN task_claims tc ON s.task_claim_id = tc.id
    JOIN users u ON tc.user_id = u.id
    JOIN tasks t ON tc.task_id = t.id
    WHERE s.status = 'approved'
      AND s.reviewed_at IS NOT NULL
      AND date(s.reviewed_at) >= ? AND date(s.reviewed_at) <= ?
      AND date(s.reviewed_at) <= ?
    GROUP BY tc.user_id
  `
    )
    .all(week, weekEndStr, lockCutoffStr) as Array<{ user_id: number; username: string; amount: number }>;

  const existing = database.prepare("SELECT id, user_id, amount, status, paid_at, note FROM settlement_records WHERE week_start = ?").all(week) as Array<{
    id: number;
    user_id: number;
    amount: number;
    status: string;
    paid_at: string | null;
    note: string | null;
  }>;
  const byUser = new Map(existing.map((e) => [e.user_id, e]));

  const list = rows.map((r) => {
    const rec = byUser.get(r.user_id);
    return {
      id: rec?.id ?? null,
      user_id: r.user_id,
      username: r.username,
      amount: rec?.amount ?? r.amount,
      status: rec?.status ?? "pending",
      paid_at: rec?.paid_at ?? null,
      note: rec?.note ?? null,
    };
  });
  res.json({ week, lock_period_days: lockDays, list });
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
  const database = getDb();
  const lockDays = getLockPeriodDays(database);
  const weekEnd = new Date(week + "T12:00:00Z");
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);
  const lockCutoff = new Date(weekEndStr + "T23:59:59Z");
  lockCutoff.setUTCDate(lockCutoff.getUTCDate() + lockDays);
  const lockCutoffStr = lockCutoff.toISOString().slice(0, 10);

  const rows = database
    .prepare(
      `
    SELECT tc.user_id, SUM(t.point_reward) AS amount
    FROM submissions s
    JOIN task_claims tc ON s.task_claim_id = tc.id
    JOIN tasks t ON tc.task_id = t.id
    WHERE s.status = 'approved' AND s.reviewed_at IS NOT NULL
      AND date(s.reviewed_at) >= ? AND date(s.reviewed_at) <= ?
      AND date(s.reviewed_at) <= ?
    GROUP BY tc.user_id
  `
    )
    .all(week, weekEndStr, lockCutoffStr) as Array<{ user_id: number; amount: number }>;

  const insert = database.prepare("INSERT OR IGNORE INTO settlement_records (user_id, week_start, amount, status) VALUES (?, ?, ?, 'pending')");
  for (const r of rows) {
    if (r.amount > 0) insert.run(r.user_id, week, r.amount);
  }
  res.json({ ok: true, week, count: rows.length });
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
  const database = getDb();
  const rows = database
    .prepare(
      `
    SELECT sr.id, sr.user_id, u.username, sr.amount, sr.status, sr.paid_at, sr.note, sr.created_at
    FROM settlement_records sr
    JOIN users u ON sr.user_id = u.id
    WHERE sr.week_start = ?
    ORDER BY sr.user_id
  `
    )
    .all(week) as Array<{ id: number; user_id: number; username: string; amount: number; status: string; paid_at: string | null; note: string | null; created_at: string }>;
  const header = "id,user_id,username,amount,status,paid_at,note,created_at";
  const lines = rows.map((r) => `${r.id},${r.user_id},"${escapeCsv(r.username)}",${r.amount},${r.status},"${escapeCsv(r.paid_at || "")}","${escapeCsv(r.note || "")}",${r.created_at}`);
  const csv = [header, ...lines].join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=settlement_${week}.csv`);
  res.send("\uFEFF" + csv);
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
  const database = getDb();
  const row = database.prepare("SELECT id FROM settlement_records WHERE id = ?").get(id);
  if (!row) {
    res.status(404).json({ error: "NOT_FOUND", message: "结算记录不存在。" });
    return;
  }
  database
    .prepare("UPDATE settlement_records SET status = ?, paid_at = CASE WHEN ? = 'paid' THEN datetime('now') ELSE paid_at END, note = COALESCE(?, note) WHERE id = ?")
    .run(status, status, note != null ? String(note) : null, id);
  res.json({ ok: true });
});

export default router;
