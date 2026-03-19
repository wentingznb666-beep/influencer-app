import { Router, Response } from "express";
import { query, withTx } from "../db";
import { requireAuth, requireRole, type AuthRequest } from "../auth";

const router = Router();
router.use(requireAuth);
router.use(requireRole("admin"));

type WithdrawalStatus = "pending" | "paid" | "rejected";

/**
 * GET /api/admin/withdrawals
 * 管理员查看提现申请列表，支持 status 筛选。
 */
router.get("/", (req: AuthRequest, res: Response) => {
  const { status, limit = "100" } = req.query as { status?: string; limit?: string };
  (async () => {
    const lim = Math.min(Number(limit) || 100, 500);
    const params: any[] = [];
    let idx = 1;
    let where = "1=1";
    if (status === "pending" || status === "paid" || status === "rejected") {
      where += ` AND w.status = $${idx++}`;
      params.push(status);
    }
    params.push(lim);
    const { rows } = await query(
      `
      SELECT w.id, w.user_id, u.username, w.amount, w.status, w.note, w.created_at, w.updated_at, w.paid_at
      FROM withdrawal_requests w
      JOIN users u ON w.user_id = u.id
      WHERE ${where}
      ORDER BY w.id DESC
      LIMIT $${idx++}
    `,
      params
    );
    res.json({ list: rows });
  })().catch((e) => {
    console.error("admin withdrawals list error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * PATCH /api/admin/withdrawals/:id
 * 处理提现：标记 paid 或 rejected，并可记录 note。
 * - paid：会扣减达人积分并写入流水（策略 A：打款时扣）。
 */
router.patch("/:id", (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的提现单 ID。" });
    return;
  }
  const { status, note } = req.body ?? {};
  const newStatus = status as WithdrawalStatus;
  if (newStatus !== "paid" && newStatus !== "rejected") {
    res.status(400).json({ error: "INVALID_STATUS", message: "status 须为 paid 或 rejected。" });
    return;
  }

  (async () => {
    if (newStatus === "rejected") {
      const r = await query(
        "UPDATE withdrawal_requests SET status = 'rejected', note = COALESCE($1, note), updated_at = now() WHERE id = $2 AND status = 'pending'",
        [note != null ? String(note) : null, id]
      );
      if (r.rowCount === 0) {
        res.status(409).json({ error: "NOT_PENDING", message: "该提现单不是待处理状态。" });
        return;
      }
      res.json({ ok: true });
      return;
    }

    const result = await withTx(async (client) => {
      const wRes = await client.query<{ id: number; user_id: number; amount: number; status: string }>(
        "SELECT id, user_id, amount, status FROM withdrawal_requests WHERE id = $1 FOR UPDATE",
        [id]
      );
      const w = wRes.rows[0];
      if (!w) return { kind: "not_found" as const };
      if (w.status !== "pending") return { kind: "not_pending" as const };

      const accRes = await client.query<{ id: number; balance: number }>(
        "SELECT id, balance FROM point_accounts WHERE user_id = $1 FOR UPDATE",
        [w.user_id]
      );
      const acc = accRes.rows[0];
      if (!acc) return { kind: "no_account" as const };
      if (acc.balance < w.amount) return { kind: "insufficient" as const, balance: acc.balance };

      await client.query("INSERT INTO point_ledger (account_id, amount, type, ref_id) VALUES ($1, $2, 'withdraw_paid', $3)", [acc.id, -w.amount, w.id]);
      const updatedAcc = await client.query<{ balance: number }>(
        "UPDATE point_accounts SET balance = balance - $1, updated_at = now() WHERE id = $2 RETURNING balance",
        [w.amount, acc.id]
      );
      await client.query(
        "UPDATE withdrawal_requests SET status = 'paid', note = COALESCE($1, note), updated_at = now(), paid_at = now() WHERE id = $2",
        [note != null ? String(note) : null, id]
      );
      return { kind: "ok" as const, balance: updatedAcc.rows[0]!.balance };
    });

    if (result.kind === "not_found") {
      res.status(404).json({ error: "NOT_FOUND", message: "提现单不存在。" });
      return;
    }
    if (result.kind === "not_pending") {
      res.status(409).json({ error: "NOT_PENDING", message: "该提现单不是待处理状态。" });
      return;
    }
    if (result.kind === "no_account") {
      res.status(500).json({ error: "DATA_ERROR", message: "达人积分账户不存在。" });
      return;
    }
    if (result.kind === "insufficient") {
      res.status(409).json({ error: "INSUFFICIENT", message: `达人余额不足，当前余额 ${result.balance}。` });
      return;
    }
    res.json({ ok: true, balance: result.balance });
  })().catch((e) => {
    console.error("admin withdrawals patch error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

export default router;

