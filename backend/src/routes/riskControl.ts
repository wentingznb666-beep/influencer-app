import { Router, Response } from "express";
import { getDb } from "../db";
import { requireAuth, requireRole, type AuthRequest } from "../auth";

const router = Router();
router.use(requireAuth);
router.use(requireRole("admin"));

function getLockPeriodDays(database: ReturnType<typeof getDb>): number {
  const row = database.prepare("SELECT value FROM config WHERE key = 'lock_period_days'").get() as { value: string } | undefined;
  return Math.min(30, Math.max(1, Number(row?.value) || 5));
}

/**
 * GET /api/admin/risk/checks
 * 投稿巡检结果列表，支持 submission_id、result 筛选。
 */
router.get("/checks", (req: AuthRequest, res: Response) => {
  const { submission_id, result, limit = "100" } = req.query as { submission_id?: string; result?: string; limit?: string };
  const database = getDb();
  let sql = `
    SELECT c.id, c.submission_id, c.check_result, c.checked_at, c.note,
           s.work_link, s.status AS submission_status,
           tc.user_id, u.username AS influencer_username
    FROM submission_checks c
    JOIN submissions s ON c.submission_id = s.id
    JOIN task_claims tc ON s.task_claim_id = tc.id
    JOIN users u ON tc.user_id = u.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];
  if (submission_id) {
    sql += " AND c.submission_id = ?";
    params.push(Number(submission_id));
  }
  if (result === "ok" || result === "deleted" || result === "suspicious") {
    sql += " AND c.check_result = ?";
    params.push(result);
  }
  sql += " ORDER BY c.id DESC LIMIT ?";
  params.push(Math.min(Number(limit) || 100, 500));
  const rows = database.prepare(sql).all(...params);
  res.json({ list: rows });
});

/**
 * POST /api/admin/risk/check
 * 手动触发单条投稿链接可访问性检查（简单 HTTP HEAD 检测）。
 */
router.post("/check", async (req: AuthRequest, res: Response) => {
  const { submission_id } = req.body ?? {};
  const id = Number(submission_id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "请提供有效的 submission_id。" });
    return;
  }
  const database = getDb();
  const sub = database.prepare("SELECT id, work_link, status, reviewed_at FROM submissions WHERE id = ?").get(id) as
    | { id: number; work_link: string; status: string; reviewed_at: string | null }
    | undefined;
  if (!sub) {
    res.status(404).json({ error: "NOT_FOUND", message: "投稿不存在。" });
    return;
  }
  let checkResult: "ok" | "deleted" | "suspicious" = "ok";
  let note: string | null = null;
  try {
    const fetchRes = await fetch(sub.work_link, { method: "HEAD", redirect: "follow" });
    if (!fetchRes.ok) {
      checkResult = "suspicious";
      note = `HTTP ${fetchRes.status}`;
    }
  } catch (e: unknown) {
    checkResult = "deleted";
    note = e instanceof Error ? e.message : "请求失败";
  }
  database.prepare("INSERT INTO submission_checks (submission_id, check_result, note) VALUES (?, ?, ?)").run(id, checkResult, note);

  const lockDays = getLockPeriodDays(database);
  const reviewedAt = sub.reviewed_at ? new Date(sub.reviewed_at) : null;
  const lockEnd = reviewedAt ? new Date(reviewedAt.getTime() + lockDays * 24 * 60 * 60 * 1000) : null;
  const now = new Date();
  const inLockPeriod = lockEnd && now < lockEnd;
  if (checkResult !== "ok" && inLockPeriod && sub.status === "approved") {
    const tc = database.prepare("SELECT user_id FROM task_claims WHERE id = (SELECT task_claim_id FROM submissions WHERE id = ?)").get(id) as { user_id: number };
    if (tc) {
      const task = database.prepare("SELECT t.point_reward FROM tasks t JOIN task_claims tc ON tc.task_id = t.id JOIN submissions s ON s.task_claim_id = tc.id WHERE s.id = ?").get(id) as { point_reward: number } | undefined;
      const pointReward = task?.point_reward ?? 0;
      const acc = database.prepare("SELECT id, balance FROM point_accounts WHERE user_id = ?").get(tc.user_id) as { id: number; balance: number };
      if (acc && pointReward > 0) {
        const deduct = Math.min(pointReward, acc.balance);
        database.transaction(() => {
          database.prepare("INSERT INTO point_ledger (account_id, amount, type, ref_id) VALUES (?, ?, 'violation_deduct', ?)").run(acc.id, -deduct, id);
          database.prepare("UPDATE point_accounts SET balance = balance - ?, updated_at = datetime('now') WHERE id = ?").run(deduct, acc.id);
          database.prepare("INSERT INTO influencer_violations (user_id, submission_id, reason) VALUES (?, ?, ?)").run(tc.user_id, id, "lock_period_delete");
          const violationCount = database.prepare("SELECT COUNT(*) AS c FROM influencer_violations WHERE user_id = ?").get(tc.user_id) as { c: number };
          if (violationCount.c >= 3) {
            const exists = database.prepare("SELECT 1 FROM influencer_profiles WHERE user_id = ?").get(tc.user_id);
            if (exists) {
              database.prepare("UPDATE influencer_profiles SET blacklisted = 1, updated_at = datetime('now') WHERE user_id = ?").run(tc.user_id);
            } else {
              database.prepare("INSERT INTO influencer_profiles (user_id, show_face, blacklisted, level, updated_at) VALUES (?, 0, 1, 1, datetime('now'))").run(tc.user_id);
            }
          }
        })();
      }
    }
  }

  res.json({ submission_id: id, check_result: checkResult, note });
});

/**
 * GET /api/admin/risk/violations
 * 违规记录列表，支持 user_id 筛选。
 */
router.get("/violations", (req: AuthRequest, res: Response) => {
  const { user_id, limit = "50" } = req.query as { user_id?: string; limit?: string };
  const database = getDb();
  let sql = `
    SELECT v.id, v.user_id, v.submission_id, v.reason, v.created_at, u.username
    FROM influencer_violations v
    JOIN users u ON v.user_id = u.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];
  if (user_id) {
    sql += " AND v.user_id = ?";
    params.push(Number(user_id));
  }
  sql += " ORDER BY v.id DESC LIMIT ?";
  params.push(Math.min(Number(limit) || 50, 200));
  const rows = database.prepare(sql).all(...params);
  res.json({ list: rows });
});

/**
 * GET /api/admin/risk/alerts
 * 告警列表：巡检结果为 deleted/suspicious 且未处理的（可扩展为“需人工复核”）。
 */
router.get("/alerts", (req: AuthRequest, res: Response) => {
  const database = getDb();
  const rows = database
    .prepare(
      `
    SELECT c.id, c.submission_id, c.check_result, c.checked_at, c.note,
           s.work_link, tc.user_id, u.username
    FROM submission_checks c
    JOIN submissions s ON c.submission_id = s.id
    JOIN task_claims tc ON s.task_claim_id = tc.id
    JOIN users u ON tc.user_id = u.id
    WHERE c.check_result IN ('deleted', 'suspicious')
    ORDER BY c.id DESC
    LIMIT 100
  `
    )
    .all();
  res.json({ list: rows });
});

export default router;
