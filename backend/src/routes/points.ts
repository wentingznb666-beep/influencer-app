import { Router, Response } from "express";
import { query, withTx } from "../db";
import { requireAuth, requireRole, type AuthRequest } from "../auth";

const router = Router();
router.use(requireAuth);
router.use(requireRole("admin", "employee"));

/**
 * GET /api/admin/points/summary
 * 积分汇总：各用户（达人/客户）当前余额及可选按周统计。
 */
router.get("/summary", (req: AuthRequest, res: Response) => {
  const { week } = req.query as { week?: string };
  (async () => {
    const accountsRes = await query<{ id: number; user_id: number; balance: number; updated_at: string; username: string; role: string }>(
      `
    SELECT pa.id, pa.user_id, pa.balance, pa.updated_at, u.username, r.name AS role
    FROM point_accounts pa
    JOIN users u ON pa.user_id = u.id
    JOIN roles r ON u.role_id = r.id
    ORDER BY pa.user_id
  `
    );
    const accounts = accountsRes.rows;

    let weekSummary: Array<{ user_id: number; username: string; role: string; total_added: number }> = [];
    if (week) {
      const [y, w] = week.split("-").map(Number);
      if (y && w) {
        const weekStart = new Date(Date.UTC(y, 0, 1 + (w - 1) * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
        const startStr = weekStart.toISOString().slice(0, 10);
        const endStr = weekEnd.toISOString().slice(0, 10);
        const ws = await query<{ user_id: number; username: string; role: string; total_added: string }>(
          `
        SELECT u.id AS user_id, u.username, r.name AS role, COALESCE(SUM(l.amount), 0) AS total_added
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN point_accounts pa ON pa.user_id = u.id
        LEFT JOIN point_ledger l ON l.account_id = pa.id AND l.amount > 0 AND l.created_at::date >= $1::date AND l.created_at::date <= $2::date
        GROUP BY u.id, u.username, r.name
      `,
          [startStr, endStr]
        );
        weekSummary = ws.rows.map((r) => ({ ...r, total_added: Number(r.total_added) }));
      }
    }
    res.json({ accounts, weekSummary });
  })().catch((e) => {
    console.error("points summary error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * GET /api/admin/points/ledger
 * 积分流水，支持 user_id、limit、offset。
 */
router.get("/ledger", (req: AuthRequest, res: Response) => {
  const { user_id, limit = "50", offset = "0" } = req.query as { user_id?: string; limit?: string; offset?: string };
  (async () => {
    let sql = `
    SELECT l.id, l.account_id, l.amount, l.type, l.ref_id, l.created_at, pa.user_id, u.username
    FROM point_ledger l
    JOIN point_accounts pa ON l.account_id = pa.id
    JOIN users u ON pa.user_id = u.id
    WHERE 1=1
  `;
    const params: any[] = [];
    let idx = 1;
    if (user_id) {
      sql += ` AND pa.user_id = $${idx++}`;
      params.push(Number(user_id));
    }
    sql += ` ORDER BY l.id DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(Math.min(Number(limit) || 50, 200), Math.max(0, Number(offset) || 0));
    const { rows } = await query(sql, params);
    res.json({ list: rows });
  })().catch((e) => {
    console.error("points ledger error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * GET /api/admin/points/recharge-orders
 * 管理员查看充值订单，支持状态筛选。
 */
router.get("/recharge-orders", (req: AuthRequest, res: Response) => {
  const { status, limit = "100" } = req.query as { status?: string; limit?: string };
  (async () => {
    const lim = Math.min(Number(limit) || 100, 500);
    const params: any[] = [];
    let idx = 1;
    let where = "1=1";
    if (status === "pending" || status === "approved" || status === "rejected") {
      where += ` AND ro.status = $${idx++}`;
      params.push(status);
    }
    params.push(lim);
    const { rows } = await query(
      `
      SELECT ro.id, ro.order_no, ro.user_id, u.username, ro.amount, ro.status, ro.note, ro.created_at, ro.updated_at, ro.approved_at
      FROM recharge_orders ro
      JOIN users u ON ro.user_id = u.id
      WHERE ${where}
      ORDER BY ro.id DESC
      LIMIT $${idx++}
      `,
      params
    );
    res.json({ list: rows });
  })().catch((e) => {
    console.error("recharge orders list error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * PATCH /api/admin/points/recharge-orders/:id
 * 管理员确认或驳回充值订单，确认后才入账到商家端余额。
 */
router.patch("/recharge-orders/:id", (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const { status, note } = req.body ?? {};
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效订单 ID。" });
    return;
  }
  if (status !== "approved" && status !== "rejected") {
    res.status(400).json({ error: "INVALID_STATUS", message: "status 仅支持 approved 或 rejected。" });
    return;
  }

  (async () => {
    if (status === "rejected") {
      const r = await query(
        "UPDATE recharge_orders SET status = 'rejected', note = COALESCE($1, note), updated_at = now() WHERE id = $2 AND status = 'pending'",
        [note != null ? String(note) : null, id]
      );
      if (r.rowCount === 0) {
        res.status(409).json({ error: "NOT_PENDING", message: "该订单不是待处理状态。" });
        return;
      }
      res.json({ ok: true });
      return;
    }

    const result = await withTx(async (client) => {
      const orderRes = await client.query<{ id: number; user_id: number; amount: number; status: string }>(
        "SELECT id, user_id, amount, status FROM recharge_orders WHERE id = $1 FOR UPDATE",
        [id]
      );
      const order = orderRes.rows[0];
      if (!order) return { kind: "not_found" as const };
      if (order.status !== "pending") return { kind: "not_pending" as const };

      const accRes = await client.query<{ id: number; balance: number }>(
        "SELECT id, balance FROM point_accounts WHERE user_id = $1 FOR UPDATE",
        [order.user_id]
      );
      let acc = accRes.rows[0];
      if (!acc) {
        const created = await client.query<{ id: number; balance: number }>(
          "INSERT INTO point_accounts (user_id, balance) VALUES ($1, 0) RETURNING id, balance",
          [order.user_id]
        );
        acc = created.rows[0]!;
      }

      await client.query("INSERT INTO point_ledger (account_id, amount, type, ref_id) VALUES ($1, $2, 'client_recharge_approved', $3)", [acc.id, order.amount, order.id]);
      const updated = await client.query<{ balance: number }>(
        "UPDATE point_accounts SET balance = balance + $1, updated_at = now() WHERE id = $2 RETURNING balance",
        [order.amount, acc.id]
      );
      await client.query(
        "UPDATE recharge_orders SET status = 'approved', note = COALESCE($1, note), updated_at = now(), approved_at = now() WHERE id = $2",
        [note != null ? String(note) : null, id]
      );
      return { kind: "ok" as const, balance: updated.rows[0]!.balance };
    });

    if (result.kind === "not_found") {
      res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
      return;
    }
    if (result.kind === "not_pending") {
      res.status(409).json({ error: "NOT_PENDING", message: "该订单不是待处理状态。" });
      return;
    }
    res.json({ ok: true, balance: result.balance });
  })().catch((e) => {
    console.error("recharge order patch error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * POST /api/admin/points/manual-recharge
 * 管理员手动积分调整：
 * - mode=add：为达人/商家加积分
 * - mode=deduct：扣减达人或商家积分（余额不足则拒绝）
 */
router.post("/manual-recharge", (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "FORBIDDEN", message: "员工无直接充值权限。" });
    return;
  }
  const { user_id, amount, note, mode } = req.body ?? {};
  const userId = Number(user_id);
  const num = Number(amount);
  const actionMode = mode === "deduct" ? "deduct" : "add";
  if (!Number.isInteger(userId) || userId < 1) {
    res.status(400).json({ error: "INVALID_USER_ID", message: "请提供有效的用户 ID。" });
    return;
  }
  if (!Number.isInteger(num) || num < 1 || num > 100000000) {
    res.status(400).json({ error: "INVALID_AMOUNT", message: "请填写有效充值积分（1–100000000）。" });
    return;
  }

  (async () => {
    const result = await withTx(async (client) => {
      const userRes = await client.query<{ id: number; role: string; username: string }>(
        `
        SELECT u.id, r.name AS role, u.username
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = $1
        FOR UPDATE
        `,
        [userId]
      );
      const user = userRes.rows[0];
      if (!user) return { kind: "not_found" as const };
      if (user.role !== "influencer" && user.role !== "client") return { kind: "invalid_role" as const, role: user.role };

      const accRes = await client.query<{ id: number; balance: number }>(
        "SELECT id, balance FROM point_accounts WHERE user_id = $1 FOR UPDATE",
        [userId]
      );
      let acc = accRes.rows[0];
      if (!acc) {
        const created = await client.query<{ id: number; balance: number }>(
          "INSERT INTO point_accounts (user_id, balance) VALUES ($1, 0) RETURNING id, balance",
          [userId]
        );
        acc = created.rows[0]!;
      }

      if (actionMode === "deduct" && acc.balance < num) {
        return { kind: "insufficient" as const, balance: acc.balance };
      }

      const delta = actionMode === "deduct" ? -num : num;
      const ledgerType = actionMode === "deduct" ? "admin_manual_deduct" : "admin_manual_recharge";
      await client.query(
        "INSERT INTO point_ledger (account_id, amount, type, ref_id) VALUES ($1, $2, $3, NULL)",
        [acc.id, delta, ledgerType]
      );
      const updated = await client.query<{ balance: number }>(
        "UPDATE point_accounts SET balance = balance + $1, updated_at = now() WHERE id = $2 RETURNING balance",
        [delta, acc.id]
      );
      return { kind: "ok" as const, username: user.username, role: user.role, balance: updated.rows[0]!.balance, mode: actionMode };
    });

    if (result.kind === "not_found") {
      res.status(404).json({ error: "NOT_FOUND", message: "目标用户不存在。" });
      return;
    }
    if (result.kind === "invalid_role") {
      res.status(400).json({ error: "INVALID_ROLE", message: "仅可为达人或商家充值。" });
      return;
    }
    if (result.kind === "insufficient") {
      res.status(409).json({ error: "INSUFFICIENT", message: `积分不足，当前余额 ${result.balance}。` });
      return;
    }
    res.status(201).json({
      ok: true,
      user_id: userId,
      username: result.username,
      role: result.role,
      amount: num,
      mode: result.mode,
      note: note != null ? String(note) : null,
      balance: result.balance,
    });
  })().catch((e) => {
    console.error("manual recharge error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

export default router;
