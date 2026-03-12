import { Router, Response } from "express";
import { getDb } from "../db";
import { requireAuth, requireRole, type AuthRequest } from "../auth";

const router = Router();
router.use(requireAuth);
router.use(requireRole("influencer"));

/**
 * GET /api/influencer/tasks
 * 任务大厅：已发布任务，支持 platform、type 筛选；露脸任务仅对 show_face=1 的达人可见。
 */
router.get("/tasks", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const { platform, type } = req.query as { platform?: string; type?: string };
  const database = getDb();
  const profile = database.prepare("SELECT show_face, blacklisted FROM influencer_profiles WHERE user_id = ?").get(userId) as { show_face: number; blacklisted: number } | undefined;
  const showFace = profile?.show_face ?? 0;
  if (profile?.blacklisted === 1) {
    res.json({ list: [] });
    return;
  }
  let sql = `
    SELECT t.id, t.material_id, t.type, t.platform, t.max_claim_count, t.point_reward, t.created_at,
           m.title AS material_title, m.cloud_link, m.remark AS material_remark
    FROM tasks t
    JOIN materials m ON t.material_id = m.id
    WHERE t.status = 'published' AND m.status = 'online'
  `;
  const params: (string | number)[] = [];
  if (showFace === 0) {
    sql += " AND t.type = 'explain'";
  }
  if (platform && typeof platform === "string") {
    sql += " AND t.platform = ?";
    params.push(platform);
  }
  if (type === "face" || type === "explain") {
    sql += " AND t.type = ?";
    params.push(type);
  }
  sql += " ORDER BY t.point_reward DESC, t.id DESC";
  const rows = database.prepare(sql).all(...params);
  const taskIds = (rows as Array<{ id: number }>).map((r) => r.id);
  let claimedSet = new Set<number>();
  if (taskIds.length > 0) {
    const placeholders = taskIds.map(() => "?").join(",");
    const claimed = database.prepare(`SELECT task_id FROM task_claims WHERE user_id = ? AND task_id IN (${placeholders})`).all(userId, ...taskIds) as Array<{ task_id: number }>;
    claimedSet = new Set(claimed.map((c) => c.task_id));
  }
  const list = (rows as Array<Record<string, unknown> & { id: number }>).map((r) => ({ ...r, claimed: claimedSet.has(r.id) }));
  res.json({ list });
});

/**
 * POST /api/influencer/tasks/:taskId/claim
 * 领取任务：校验每日上限、是否已领、任务剩余量、黑名单。
 */
router.post("/tasks/:taskId/claim", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const taskId = Number(req.params.taskId);
  if (!Number.isInteger(taskId) || taskId < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的任务 ID。" });
    return;
  }
  const database = getDb();
  const profile = database.prepare("SELECT blacklisted FROM influencer_profiles WHERE user_id = ?").get(userId) as { blacklisted: number } | undefined;
  if (profile?.blacklisted === 1) {
    res.status(403).json({ error: "BLACKLISTED", message: "您已被列入黑名单，无法领取任务。" });
    return;
  }
  const task = database.prepare("SELECT id, type, max_claim_count, point_reward, status FROM tasks WHERE id = ?").get(taskId) as
    | { id: number; type: string; max_claim_count: number | null; point_reward: number; status: string }
    | undefined;
  if (!task || task.status !== "published") {
    res.status(404).json({ error: "NOT_FOUND", message: "任务不存在或未发布。" });
    return;
  }
  if (task.type === "face") {
    const p = database.prepare("SELECT show_face FROM influencer_profiles WHERE user_id = ?").get(userId) as { show_face: number } | undefined;
    if (!p || p.show_face !== 1) {
      res.status(403).json({ error: "FORBIDDEN", message: "该任务仅限露脸达人领取。" });
      return;
    }
  }
  const existing = database.prepare("SELECT id FROM task_claims WHERE task_id = ? AND user_id = ?").get(taskId, userId);
  if (existing) {
    res.status(409).json({ error: "ALREADY_CLAIMED", message: "您已领取过该任务。" });
    return;
  }
  const limitRow = database.prepare("SELECT value FROM config WHERE key = 'daily_claim_limit'").get() as { value: string } | undefined;
  const dailyLimit = Math.min(Number(limitRow?.value) || 10, 100);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStr = todayStart.toISOString().slice(0, 10);
  const countToday = database.prepare("SELECT COUNT(*) AS c FROM task_claims WHERE user_id = ? AND date(claimed_at) = ?").get(userId, todayStr) as { c: number };
  if (countToday.c >= dailyLimit) {
    res.status(429).json({ error: "DAILY_LIMIT", message: `今日领取已达上限（${dailyLimit} 条），请明日再试。` });
    return;
  }
  if (task.max_claim_count != null) {
    const claimed = database.prepare("SELECT COUNT(*) AS c FROM task_claims WHERE task_id = ?").get(taskId) as { c: number };
    if (claimed.c >= task.max_claim_count) {
      res.status(409).json({ error: "TASK_FULL", message: "该任务已被领完。" });
      return;
    }
  }
  try {
    const result = database.prepare("INSERT INTO task_claims (task_id, user_id, status) VALUES (?, ?, 'pending')").run(taskId, userId);
    res.status(201).json({ id: result.lastInsertRowid, task_id: taskId });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "SQLITE_CONSTRAINT") {
      res.status(409).json({ error: "ALREADY_CLAIMED", message: "您已领取过该任务。" });
      return;
    }
    throw e;
  }
});

/**
 * GET /api/influencer/my-claims
 * 我的任务列表：已领取任务及投稿状态。
 */
router.get("/my-claims", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const database = getDb();
  const rows = database
    .prepare(
      `
    SELECT tc.id AS claim_id, tc.task_id, tc.status AS claim_status, tc.claimed_at,
           t.point_reward, t.platform, t.type AS task_type,
           m.title AS material_title, m.cloud_link,
           s.id AS submission_id, s.work_link, s.status AS submission_status, s.note AS review_note
    FROM task_claims tc
    JOIN tasks t ON tc.task_id = t.id
    JOIN materials m ON t.material_id = m.id
    LEFT JOIN submissions s ON s.task_claim_id = tc.id
    WHERE tc.user_id = ?
    ORDER BY tc.claimed_at DESC
  `
    )
    .all(userId);
  res.json({ list: rows });
});

/**
 * GET /api/influencer/my-claims/:claimId
 * 单条领取详情（含下载链接），用于复制/打开云盘。
 */
router.get("/my-claims/:claimId", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const claimId = Number(req.params.claimId);
  if (!Number.isInteger(claimId) || claimId < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的领取 ID。" });
    return;
  }
  const database = getDb();
  const row = database
    .prepare(
      `
    SELECT tc.id AS claim_id, tc.task_id, tc.status AS claim_status, tc.claimed_at,
           t.point_reward, t.platform, m.title AS material_title, m.cloud_link, m.remark
    FROM task_claims tc
    JOIN tasks t ON tc.task_id = t.id
    JOIN materials m ON t.material_id = m.id
    WHERE tc.id = ? AND tc.user_id = ?
  `
    )
    .get(claimId, userId) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: "NOT_FOUND", message: "记录不存在。" });
    return;
  }
  res.json(row);
});

/**
 * POST /api/influencer/submissions
 * 投稿：提交作品链接，创建 submission 并更新 task_claim 为 submitted。
 */
router.post("/submissions", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const { task_claim_id, work_link, note } = req.body ?? {};
  if (!task_claim_id || !work_link || typeof work_link !== "string" || !work_link.trim()) {
    res.status(400).json({ error: "INVALID_INPUT", message: "请提供领取 ID 与作品链接。" });
    return;
  }
  const database = getDb();
  const tc = database.prepare("SELECT id, task_id, user_id, status FROM task_claims WHERE id = ?").get(Number(task_claim_id)) as
    | { id: number; task_id: number; user_id: number; status: string }
    | undefined;
  if (!tc || tc.user_id !== userId) {
    res.status(404).json({ error: "NOT_FOUND", message: "领取记录不存在或无权操作。" });
    return;
  }
  if (tc.status !== "pending") {
    res.status(400).json({ error: "ALREADY_SUBMITTED", message: "该任务已提交过投稿。" });
    return;
  }
  const existing = database.prepare("SELECT id FROM submissions WHERE task_claim_id = ?").get(tc.id);
  if (existing) {
    res.status(409).json({ error: "ALREADY_SUBMITTED", message: "该任务已提交过投稿。" });
    return;
  }
  database.prepare("INSERT INTO submissions (task_claim_id, work_link, note, status) VALUES (?, ?, ?, 'pending')").run(tc.id, work_link.trim(), note ? String(note).trim() : null);
  database.prepare("UPDATE task_claims SET status = 'submitted' WHERE id = ?").run(tc.id);
  res.status(201).json({ ok: true });
});

/**
 * GET /api/influencer/points
 * 当前积分、本周预计结算、流水（最近 N 条）。
 */
router.get("/points", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const database = getDb();
  const acc = database.prepare("SELECT id, balance FROM point_accounts WHERE user_id = ?").get(userId) as { id: number; balance: number } | undefined;
  if (!acc) {
    res.json({ balance: 0, weekPending: 0, ledger: [] });
    return;
  }
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);
  const weekPending = database
    .prepare(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM point_ledger WHERE account_id = ? AND amount > 0 AND date(created_at) >= ? AND date(created_at) <= ?"
    )
    .get(acc.id, weekStartStr, weekEndStr) as { total: number };
  const ledger = database
    .prepare("SELECT id, amount, type, ref_id, created_at FROM point_ledger WHERE account_id = ? ORDER BY id DESC LIMIT 50")
    .all(acc.id) as Array<{ id: number; amount: number; type: string; ref_id: number | null; created_at: string }>;
  res.json({
    balance: acc.balance,
    weekPending: weekPending?.total ?? 0,
    ledger,
  });
});

export default router;
