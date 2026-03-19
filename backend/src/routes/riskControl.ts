import { Router, Response } from "express";
import { query, withTx } from "../db";
import { requireAuth, requireRole, type AuthRequest } from "../auth";

const router = Router();
router.use(requireAuth);
router.use(requireRole("admin"));

async function getLockPeriodDays(): Promise<number> {
  const row = await query<{ value: string }>("SELECT value FROM config WHERE key = 'lock_period_days'");
  return Math.min(30, Math.max(1, Number(row.rows[0]?.value) || 5));
}

/**
 * GET /api/admin/risk/checks
 * 投稿巡检结果列表，支持 submission_id、result 筛选。
 */
router.get("/checks", (req: AuthRequest, res: Response) => {
  const { submission_id, result, limit = "100" } = req.query as { submission_id?: string; result?: string; limit?: string };
  (async () => {
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
    const params: any[] = [];
    let idx = 1;
    if (submission_id) {
      sql += ` AND c.submission_id = $${idx++}`;
      params.push(Number(submission_id));
    }
    if (result === "ok" || result === "deleted" || result === "suspicious") {
      sql += ` AND c.check_result = $${idx++}`;
      params.push(result);
    }
    sql += ` ORDER BY c.id DESC LIMIT $${idx++}`;
    params.push(Math.min(Number(limit) || 100, 500));
    const { rows } = await query(sql, params);
    res.json({ list: rows });
  })().catch((e) => {
    console.error("risk checks list error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
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
  const subRes = await query<{ id: number; work_link: string; status: string; reviewed_at: string | null }>(
    "SELECT id, work_link, status, reviewed_at FROM submissions WHERE id = $1",
    [id]
  );
  const sub = subRes.rows[0];
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
  await query("INSERT INTO submission_checks (submission_id, check_result, note) VALUES ($1, $2, $3)", [id, checkResult, note]);

  const lockDays = await getLockPeriodDays();
  const reviewedAt = sub.reviewed_at ? new Date(sub.reviewed_at) : null;
  const lockEnd = reviewedAt ? new Date(reviewedAt.getTime() + lockDays * 24 * 60 * 60 * 1000) : null;
  const now = new Date();
  const inLockPeriod = lockEnd && now < lockEnd;
  if (checkResult !== "ok" && inLockPeriod && sub.status === "approved") {
    const tcRes = await query<{ user_id: number }>(
      "SELECT tc.user_id FROM task_claims tc JOIN submissions s ON s.task_claim_id = tc.id WHERE s.id = $1",
      [id]
    );
    const tc = tcRes.rows[0];
    if (tc) {
      const taskRes = await query<{ point_reward: number }>(
        "SELECT t.point_reward FROM tasks t JOIN task_claims tc ON tc.task_id = t.id JOIN submissions s ON s.task_claim_id = tc.id WHERE s.id = $1",
        [id]
      );
      const pointReward = taskRes.rows[0]?.point_reward ?? 0;
      if (pointReward > 0) {
        await withTx(async (client) => {
          const accRes = await client.query<{ id: number; balance: number }>("SELECT id, balance FROM point_accounts WHERE user_id = $1 FOR UPDATE", [tc.user_id]);
          const acc = accRes.rows[0];
          if (!acc) return;
          const deduct = Math.min(pointReward, acc.balance);
          await client.query("INSERT INTO point_ledger (account_id, amount, type, ref_id) VALUES ($1, $2, 'violation_deduct', $3)", [acc.id, -deduct, id]);
          await client.query("UPDATE point_accounts SET balance = balance - $1, updated_at = now() WHERE id = $2", [deduct, acc.id]);
          await client.query("INSERT INTO influencer_violations (user_id, submission_id, reason) VALUES ($1, $2, $3)", [tc.user_id, id, "lock_period_delete"]);
          const cntRes = await client.query<{ c: string }>("SELECT COUNT(*) AS c FROM influencer_violations WHERE user_id = $1", [tc.user_id]);
          const cnt = Number(cntRes.rows[0]?.c || 0);
          if (cnt >= 3) {
            const exists = await client.query("SELECT 1 FROM influencer_profiles WHERE user_id = $1", [tc.user_id]);
            if (exists.rows[0]) {
              await client.query("UPDATE influencer_profiles SET blacklisted = 1, updated_at = now() WHERE user_id = $1", [tc.user_id]);
            } else {
              await client.query("INSERT INTO influencer_profiles (user_id, show_face, blacklisted, level, updated_at) VALUES ($1, 0, 1, 1, now())", [tc.user_id]);
            }
          }
        });
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
  (async () => {
    let sql = `
    SELECT v.id, v.user_id, v.submission_id, v.reason, v.created_at, u.username
    FROM influencer_violations v
    JOIN users u ON v.user_id = u.id
    WHERE 1=1
  `;
    const params: any[] = [];
    let idx = 1;
    if (user_id) {
      sql += ` AND v.user_id = $${idx++}`;
      params.push(Number(user_id));
    }
    sql += ` ORDER BY v.id DESC LIMIT $${idx++}`;
    params.push(Math.min(Number(limit) || 50, 200));
    const { rows } = await query(sql, params);
    res.json({ list: rows });
  })().catch((e) => {
    console.error("risk violations error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * GET /api/admin/risk/alerts
 * 告警列表：巡检结果为 deleted/suspicious 且未处理的（可扩展为“需人工复核”）。
 */
router.get("/alerts", (req: AuthRequest, res: Response) => {
  (async () => {
    const { rows } = await query(
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
    );
    res.json({ list: rows });
  })().catch((e) => {
    console.error("risk alerts error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

export default router;
