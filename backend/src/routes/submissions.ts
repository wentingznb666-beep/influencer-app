import { Router, Response } from "express";
import { getDb } from "../db";
import { requireAuth, requireRole, type AuthRequest } from "../auth";

const router = Router();
router.use(requireAuth);
router.use(requireRole("admin"));

/**
 * GET /api/admin/submissions
 * 投稿列表，支持 status 筛选：pending | approved | rejected。
 */
router.get("/", (req: AuthRequest, res: Response) => {
  const { status } = req.query as { status?: string };
  const database = getDb();
  let sql = `
    SELECT s.id, s.task_claim_id, s.work_link, s.note, s.status, s.submitted_at, s.reviewed_at,
           tc.task_id, tc.user_id AS influencer_id,
           u.username AS influencer_username,
           t.point_reward, t.platform,
           m.title AS material_title
    FROM submissions s
    JOIN task_claims tc ON s.task_claim_id = tc.id
    JOIN users u ON tc.user_id = u.id
    JOIN tasks t ON tc.task_id = t.id
    JOIN materials m ON t.material_id = m.id
    WHERE 1=1
  `;
  const params: string[] = [];
  if (status === "pending" || status === "approved" || status === "rejected") {
    sql += " AND s.status = ?";
    params.push(status);
  }
  sql += " ORDER BY s.id DESC";
  const rows = database.prepare(sql).all(...params);
  res.json({ list: rows });
});

/**
 * POST /api/admin/submissions/:id/approve
 * 通过审核：增加达人积分、更新投稿与领取状态。
 */
router.post("/:id/approve", (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的投稿 ID。" });
    return;
  }
  const database = getDb();
  const sub = database
    .prepare(
      "SELECT s.id, s.task_claim_id, s.status FROM submissions s WHERE s.id = ?"
    )
    .get(id) as { id: number; task_claim_id: number; status: string } | undefined;
  if (!sub) {
    res.status(404).json({ error: "NOT_FOUND", message: "投稿不存在。" });
    return;
  }
  if (sub.status !== "pending") {
    res.status(400).json({ error: "ALREADY_REVIEWED", message: "该投稿已审核。" });
    return;
  }
  const tc = database
    .prepare("SELECT task_id, user_id FROM task_claims WHERE id = ?")
    .get(sub.task_claim_id) as { task_id: number; user_id: number } | undefined;
  if (!tc) {
    res.status(500).json({ error: "DATA_ERROR", message: "领取记录异常。" });
    return;
  }
  const task = database.prepare("SELECT point_reward FROM tasks WHERE id = ?").get(tc.task_id) as { point_reward: number } | undefined;
  if (!task || task.point_reward < 1) {
    res.status(400).json({ error: "INVALID_TASK", message: "任务积分配置异常。" });
    return;
  }
  const acc = database.prepare("SELECT id, balance FROM point_accounts WHERE user_id = ?").get(tc.user_id) as { id: number; balance: number } | undefined;
  if (!acc) {
    res.status(500).json({ error: "DATA_ERROR", message: "达人积分账户不存在。" });
    return;
  }
  const run = database.transaction(() => {
    database.prepare("INSERT INTO point_ledger (account_id, amount, type, ref_id) VALUES (?, ?, 'task_approval', ?)").run(acc.id, task.point_reward, sub.id);
    database.prepare("UPDATE point_accounts SET balance = balance + ?, updated_at = datetime('now') WHERE id = ?").run(task.point_reward, acc.id);
    database.prepare("UPDATE submissions SET status = 'approved', reviewed_at = datetime('now') WHERE id = ?").run(id);
    database.prepare("UPDATE task_claims SET status = 'approved' WHERE id = ?").run(sub.task_claim_id);
  });
  run();
  res.json({ ok: true, point_reward: task.point_reward });
});

/**
 * POST /api/admin/submissions/:id/reject
 * 驳回投稿，可带驳回原因（存 note 或单独字段，当前用 note 存驳回原因）。
 */
router.post("/:id/reject", (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的投稿 ID。" });
    return;
  }
  const { reason } = req.body ?? {};
  const database = getDb();
  const sub = database.prepare("SELECT id, status FROM submissions WHERE id = ?").get(id) as { id: number; status: string } | undefined;
  if (!sub) {
    res.status(404).json({ error: "NOT_FOUND", message: "投稿不存在。" });
    return;
  }
  if (sub.status !== "pending") {
    res.status(400).json({ error: "ALREADY_REVIEWED", message: "该投稿已审核。" });
    return;
  }
  const rejectNote = reason != null ? String(reason).trim() : null;
  database
    .prepare("UPDATE submissions SET status = 'rejected', reviewed_at = datetime('now'), note = COALESCE(?, note) WHERE id = ?")
    .run(rejectNote, id);
  database.prepare("UPDATE task_claims SET status = 'rejected' WHERE id = (SELECT task_claim_id FROM submissions WHERE id = ?)").run(id);
  res.json({ ok: true });
});

export default router;
