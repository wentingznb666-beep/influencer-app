import { Router, Response } from "express";
import { query } from "../db";
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
  (async () => {
    const profileRes = await query<{ show_face: number; blacklisted: number }>(
      "SELECT show_face, blacklisted FROM influencer_profiles WHERE user_id = $1",
      [userId]
    );
    const profile = profileRes.rows[0];
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
    const params: any[] = [];
    let idx = 1;
    if (showFace === 0) {
      sql += " AND t.type = 'explain'";
    }
    if (platform && typeof platform === "string") {
      sql += ` AND t.platform = $${idx++}`;
      params.push(platform);
    }
    if (type === "face" || type === "explain") {
      sql += ` AND t.type = $${idx++}`;
      params.push(type);
    }
    sql += " ORDER BY t.point_reward DESC, t.id DESC";

    const tasksRes = await query<Array<Record<string, unknown> & { id: number }>>(sql, params);
    const rows = tasksRes.rows as any[];
    const taskIds = rows.map((r) => r.id) as number[];

    let claimedSet = new Set<number>();
    if (taskIds.length > 0) {
      const placeholders = taskIds.map((_, i) => `$${i + 2}`).join(",");
      const claimedRes = await query<{ task_id: number }>(
        `SELECT task_id FROM task_claims WHERE user_id = $1 AND task_id IN (${placeholders})`,
        [userId, ...taskIds]
      );
      claimedSet = new Set(claimedRes.rows.map((c) => c.task_id));
    }

    const list = rows.map((r: any) => ({ ...r, claimed: claimedSet.has(r.id) }));
    res.json({ list });
  })().catch((e) => {
    console.error("influencer tasks error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
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
  (async () => {
    const profileRes = await query<{ blacklisted: number }>("SELECT blacklisted FROM influencer_profiles WHERE user_id = $1", [userId]);
    if (profileRes.rows[0]?.blacklisted === 1) {
      res.status(403).json({ error: "BLACKLISTED", message: "您已被列入黑名单，无法领取任务。" });
      return;
    }

    const taskRes = await query<{ id: number; type: string; max_claim_count: number | null; point_reward: number; status: string }>(
      "SELECT id, type, max_claim_count, point_reward, status FROM tasks WHERE id = $1",
      [taskId]
    );
    const task = taskRes.rows[0];
    if (!task || task.status !== "published") {
      res.status(404).json({ error: "NOT_FOUND", message: "任务不存在或未发布。" });
      return;
    }

    if (task.type === "face") {
      const pRes = await query<{ show_face: number }>("SELECT show_face FROM influencer_profiles WHERE user_id = $1", [userId]);
      if (!pRes.rows[0] || pRes.rows[0].show_face !== 1) {
        res.status(403).json({ error: "FORBIDDEN", message: "该任务仅限露脸达人领取。" });
        return;
      }
    }

    const existing = await query<{ id: number }>("SELECT id FROM task_claims WHERE task_id = $1 AND user_id = $2", [taskId, userId]);
    if (existing.rows[0]) {
      res.status(409).json({ error: "ALREADY_CLAIMED", message: "您已领取过该任务。" });
      return;
    }

    const limitRes = await query<{ value: string }>("SELECT value FROM config WHERE key = 'daily_claim_limit'");
    const dailyLimit = Math.min(Number(limitRes.rows[0]?.value) || 10, 100);
    const todayStr = new Date().toISOString().slice(0, 10);
    const countTodayRes = await query<{ c: string }>("SELECT COUNT(*) AS c FROM task_claims WHERE user_id = $1 AND claimed_at::date = $2::date", [userId, todayStr]);
    const countToday = Number(countTodayRes.rows[0]?.c || 0);
    if (countToday >= dailyLimit) {
      res.status(429).json({ error: "DAILY_LIMIT", message: `今日领取已达上限（${dailyLimit} 条），请明日再试。` });
      return;
    }

    if (task.max_claim_count != null) {
      const claimedRes = await query<{ c: string }>("SELECT COUNT(*) AS c FROM task_claims WHERE task_id = $1", [taskId]);
      const claimed = Number(claimedRes.rows[0]?.c || 0);
      if (claimed >= task.max_claim_count) {
        res.status(409).json({ error: "TASK_FULL", message: "该任务已被领完。" });
        return;
      }
    }

    try {
      const created = await query<{ id: number }>(
        "INSERT INTO task_claims (task_id, user_id, status) VALUES ($1, $2, 'pending') RETURNING id",
        [taskId, userId]
      );
      res.status(201).json({ id: created.rows[0]!.id, task_id: taskId });
    } catch (e: any) {
      if (e?.code === "23505") {
        res.status(409).json({ error: "ALREADY_CLAIMED", message: "您已领取过该任务。" });
        return;
      }
      throw e;
    }
  })().catch((e) => {
    console.error("influencer claim error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * GET /api/influencer/my-claims
 * 我的任务列表：已领取任务及投稿状态。
 */
router.get("/my-claims", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  (async () => {
    const { rows } = await query(
      `
    SELECT tc.id AS claim_id, tc.task_id, tc.status AS claim_status, tc.claimed_at,
           t.point_reward, t.platform, t.type AS task_type,
           m.title AS material_title, m.cloud_link,
           s.id AS submission_id, s.work_link, s.status AS submission_status, s.note AS review_note
    FROM task_claims tc
    JOIN tasks t ON tc.task_id = t.id
    JOIN materials m ON t.material_id = m.id
    LEFT JOIN submissions s ON s.task_claim_id = tc.id
    WHERE tc.user_id = $1
    ORDER BY tc.claimed_at DESC
  `,
      [userId]
    );
    res.json({ list: rows });
  })().catch((e) => {
    console.error("influencer my-claims error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
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
  (async () => {
    const r = await query<Record<string, unknown>>(
      `
    SELECT tc.id AS claim_id, tc.task_id, tc.status AS claim_status, tc.claimed_at,
           t.point_reward, t.platform, m.title AS material_title, m.cloud_link, m.remark
    FROM task_claims tc
    JOIN tasks t ON tc.task_id = t.id
    JOIN materials m ON t.material_id = m.id
    WHERE tc.id = $1 AND tc.user_id = $2
  `,
      [claimId, userId]
    );
    const row = r.rows[0];
    if (!row) {
      res.status(404).json({ error: "NOT_FOUND", message: "记录不存在。" });
      return;
    }
    res.json(row);
  })().catch((e) => {
    console.error("influencer my-claim detail error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
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
  (async () => {
    const tcRes = await query<{ id: number; task_id: number; user_id: number; status: string }>(
      "SELECT id, task_id, user_id, status FROM task_claims WHERE id = $1",
      [Number(task_claim_id)]
    );
    const tc = tcRes.rows[0];
    if (!tc || tc.user_id !== userId) {
      res.status(404).json({ error: "NOT_FOUND", message: "领取记录不存在或无权操作。" });
      return;
    }
    if (tc.status !== "pending") {
      res.status(400).json({ error: "ALREADY_SUBMITTED", message: "该任务已提交过投稿。" });
      return;
    }
    const existing = await query<{ id: number }>("SELECT id FROM submissions WHERE task_claim_id = $1", [tc.id]);
    if (existing.rows[0]) {
      res.status(409).json({ error: "ALREADY_SUBMITTED", message: "该任务已提交过投稿。" });
      return;
    }
    await query("INSERT INTO submissions (task_claim_id, work_link, note, status) VALUES ($1, $2, $3, 'pending')", [tc.id, work_link.trim(), note ? String(note).trim() : null]);
    await query("UPDATE task_claims SET status = 'submitted' WHERE id = $1", [tc.id]);
    res.status(201).json({ ok: true });
  })().catch((e) => {
    console.error("influencer submission create error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * GET /api/influencer/points
 * 当前积分、本周预计结算、流水（最近 N 条）。
 */
router.get("/points", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  (async () => {
    const accRes = await query<{ id: number; balance: number }>("SELECT id, balance FROM point_accounts WHERE user_id = $1", [userId]);
    const acc = accRes.rows[0];
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

    const weekPendingRes = await query<{ total: string }>(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM point_ledger WHERE account_id = $1 AND amount > 0 AND created_at::date >= $2::date AND created_at::date <= $3::date",
      [acc.id, weekStartStr, weekEndStr]
    );
    const ledgerRes = await query<{ id: number; amount: number; type: string; ref_id: number | null; created_at: string }>(
      "SELECT id, amount, type, ref_id, created_at FROM point_ledger WHERE account_id = $1 ORDER BY id DESC LIMIT 50",
      [acc.id]
    );
    res.json({
      balance: acc.balance,
      weekPending: Number(weekPendingRes.rows[0]?.total || 0),
      ledger: ledgerRes.rows,
    });
  })().catch((e) => {
    console.error("influencer points error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * GET /api/influencer/withdrawals
 * 达人提现申请列表（仅本人）。
 */
router.get("/withdrawals", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  (async () => {
    const { rows } = await query(
      "SELECT id, amount, status, note, created_at, updated_at, paid_at FROM withdrawal_requests WHERE user_id = $1 ORDER BY id DESC LIMIT 200",
      [userId]
    );
    res.json({ list: rows });
  })().catch((e) => {
    console.error("influencer withdrawals list error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * POST /api/influencer/withdrawals
 * 发起提现申请（策略 A：申请不扣余额，打款时扣）。
 * 请求体: { amount }
 */
router.post("/withdrawals", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const { amount } = req.body ?? {};
  const num = Number(amount);
  if (!Number.isInteger(num) || num < 1 || num > 100000000) {
    res.status(400).json({ error: "INVALID_AMOUNT", message: "请填写有效提现金额（整数且大于 0）。" });
    return;
  }
  (async () => {
    const accRes = await query<{ balance: number }>("SELECT balance FROM point_accounts WHERE user_id = $1", [userId]);
    const balance = accRes.rows[0]?.balance ?? 0;
    if (balance < num) {
      res.status(409).json({ error: "INSUFFICIENT", message: `余额不足，当前余额 ${balance}。` });
      return;
    }
    const created = await query<{ id: number }>(
      "INSERT INTO withdrawal_requests (user_id, amount, status) VALUES ($1, $2, 'pending') RETURNING id",
      [userId, num]
    );
    res.status(201).json({ id: created.rows[0]!.id });
  })().catch((e) => {
    console.error("influencer withdrawals create error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

export default router;
