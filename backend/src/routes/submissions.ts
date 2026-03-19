import { Router, Response } from "express";
import { query, withTx } from "../db";
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
  (async () => {
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
    const params: any[] = [];
    let idx = 1;
    if (status === "pending" || status === "approved" || status === "rejected") {
      sql += ` AND s.status = $${idx++}`;
      params.push(status);
    }
    sql += " ORDER BY s.id DESC";
    const { rows } = await query(sql, params);
    res.json({ list: rows });
  })().catch((e) => {
    console.error("submissions list error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
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
  (async () => {
    const subRes = await query<{ id: number; task_claim_id: number; status: string }>(
      "SELECT id, task_claim_id, status FROM submissions WHERE id = $1",
      [id]
    );
    const sub = subRes.rows[0];
    if (!sub) {
      res.status(404).json({ error: "NOT_FOUND", message: "投稿不存在。" });
      return;
    }
    if (sub.status !== "pending") {
      res.status(400).json({ error: "ALREADY_REVIEWED", message: "该投稿已审核。" });
      return;
    }
    const tcRes = await query<{ task_id: number; user_id: number }>("SELECT task_id, user_id FROM task_claims WHERE id = $1", [sub.task_claim_id]);
    const tc = tcRes.rows[0];
    if (!tc) {
      res.status(500).json({ error: "DATA_ERROR", message: "领取记录异常。" });
      return;
    }
    const taskRes = await query<{ point_reward: number }>("SELECT point_reward FROM tasks WHERE id = $1", [tc.task_id]);
    const task = taskRes.rows[0];
    if (!task || task.point_reward < 1) {
      res.status(400).json({ error: "INVALID_TASK", message: "任务积分配置异常。" });
      return;
    }

    await withTx(async (client) => {
      const accRes = await client.query<{ id: number }>("SELECT id FROM point_accounts WHERE user_id = $1 FOR UPDATE", [tc.user_id]);
      const acc = accRes.rows[0];
      if (!acc) throw new Error("DATA_ERROR_NO_ACCOUNT");
      await client.query("INSERT INTO point_ledger (account_id, amount, type, ref_id) VALUES ($1, $2, 'task_approval', $3)", [acc.id, task.point_reward, sub.id]);
      await client.query("UPDATE point_accounts SET balance = balance + $1, updated_at = now() WHERE id = $2", [task.point_reward, acc.id]);
      await client.query("UPDATE submissions SET status = 'approved', reviewed_at = now() WHERE id = $1", [id]);
      await client.query("UPDATE task_claims SET status = 'approved' WHERE id = $1", [sub.task_claim_id]);
    });

    res.json({ ok: true, point_reward: task.point_reward });
  })().catch((e) => {
    console.error("submissions approve error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
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
  (async () => {
    const subRes = await query<{ id: number; status: string; task_claim_id: number }>("SELECT id, status, task_claim_id FROM submissions WHERE id = $1", [id]);
    const sub = subRes.rows[0];
    if (!sub) {
      res.status(404).json({ error: "NOT_FOUND", message: "投稿不存在。" });
      return;
    }
    if (sub.status !== "pending") {
      res.status(400).json({ error: "ALREADY_REVIEWED", message: "该投稿已审核。" });
      return;
    }
    const rejectNote = reason != null ? String(reason).trim() : null;
    await query("UPDATE submissions SET status = 'rejected', reviewed_at = now(), note = COALESCE($1, note) WHERE id = $2", [rejectNote, id]);
    await query("UPDATE task_claims SET status = 'rejected' WHERE id = $1", [sub.task_claim_id]);
    res.json({ ok: true });
  })().catch((e) => {
    console.error("submissions reject error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

export default router;
