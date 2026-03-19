import { Router, Response } from "express";
import { query, withTx } from "../db";
import { requireAuth, requireRole, type AuthRequest } from "../auth";

const router = Router();
router.use(requireAuth);
router.use(requireRole("client"));

/**
 * GET /api/client/requests
 * 当前客户的需求/合作意向列表。
 */
router.get("/requests", (req: AuthRequest, res: Response) => {
  const clientId = req.user!.userId;
  (async () => {
    const { rows } = await query("SELECT id, product_info, target_platform, budget, need_face, status, created_at FROM client_requests WHERE client_id = $1 ORDER BY id DESC", [clientId]);
    res.json({ list: rows });
  })().catch((e) => {
    console.error("client requests list error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * POST /api/client/requests
 * 提交合作意向/任务需求。
 */
router.post("/requests", (req: AuthRequest, res: Response) => {
  const clientId = req.user!.userId;
  const { product_info, target_platform, budget, need_face } = req.body ?? {};
  (async () => {
    const created = await query<{ id: number }>(
      "INSERT INTO client_requests (client_id, product_info, target_platform, budget, need_face, status) VALUES ($1, $2, $3, $4, $5, 'submitted') RETURNING id",
      [clientId, product_info != null ? String(product_info) : null, target_platform != null ? String(target_platform) : null, budget != null ? String(budget) : null, need_face ? 1 : 0]
    );
    res.status(201).json({ id: created.rows[0]!.id });
  })().catch((e) => {
    console.error("client requests create error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * GET /api/client/orders
 * 样品/订单跟踪列表。
 */
router.get("/orders", (req: AuthRequest, res: Response) => {
  const clientId = req.user!.userId;
  (async () => {
    const { rows } = await query(
      `
    SELECT o.id, o.request_id, o.status, o.note, o.created_at, o.updated_at,
           r.product_info, r.target_platform
    FROM sample_orders o
    LEFT JOIN client_requests r ON o.request_id = r.id
    WHERE o.client_id = $1
    ORDER BY o.id DESC
  `,
      [clientId]
    );
    res.json({ list: rows });
  })().catch((e) => {
    console.error("client orders list error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * POST /api/client/orders
 * 创建样品/订单（可关联需求）。
 */
router.post("/orders", (req: AuthRequest, res: Response) => {
  const clientId = req.user!.userId;
  const { request_id, note } = req.body ?? {};
  (async () => {
    if (request_id != null) {
      const r = await query<{ id: number }>("SELECT id FROM client_requests WHERE id = $1 AND client_id = $2", [Number(request_id), clientId]);
      if (!r.rows[0]) {
        res.status(400).json({ error: "INVALID_REQUEST", message: "需求不存在或无权关联。" });
        return;
      }
    }
    const created = await query<{ id: number }>(
      "INSERT INTO sample_orders (client_id, request_id, status, note) VALUES ($1, $2, 'pending', $3) RETURNING id",
      [clientId, request_id != null ? Number(request_id) : null, note != null ? String(note) : null]
    );
    res.status(201).json({ id: created.rows[0]!.id });
  })().catch((e) => {
    console.error("client orders create error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * PATCH /api/client/orders/:id
 * 更新订单状态（客户可更新备注，状态一般由管理员或流程更新，此处允许客户更新便于协作）。
 */
router.patch("/orders/:id", (req: AuthRequest, res: Response) => {
  const clientId = req.user!.userId;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的订单 ID。" });
    return;
  }
  const { status, note } = req.body ?? {};
  (async () => {
    const row = await query<{ id: number }>("SELECT id FROM sample_orders WHERE id = $1 AND client_id = $2", [id, clientId]);
    if (!row.rows[0]) {
      res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
      return;
    }

    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (status === "pending" || status === "sent" || status === "received") {
      sets.push(`status = $${idx++}`);
      params.push(status);
    }
    if (note !== undefined) {
      sets.push(`note = $${idx++}`);
      params.push(String(note));
    }
    if (sets.length > 0) {
      sets.push(`updated_at = now()`);
      params.push(id);
      params.push(clientId);
      await query(`UPDATE sample_orders SET ${sets.join(", ")} WHERE id = $${idx++} AND client_id = $${idx++}`, params);
    }
    res.json({ ok: true });
  })().catch((e) => {
    console.error("client orders patch error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * GET /api/client/works
 * 达人已发布作品列表（已通过审核的投稿，含作品链接、达人、任务/素材信息）。
 */
router.get("/works", (req: AuthRequest, res: Response) => {
  (async () => {
    const { rows } = await query(
      `
    SELECT s.id, s.work_link, s.submitted_at,
           u.username AS influencer_username,
           t.platform, t.point_reward,
           m.title AS material_title, m.type AS material_type
    FROM submissions s
    JOIN task_claims tc ON s.task_claim_id = tc.id
    JOIN users u ON tc.user_id = u.id
    JOIN tasks t ON tc.task_id = t.id
    JOIN materials m ON t.material_id = m.id
    WHERE s.status = 'approved'
    ORDER BY s.submitted_at DESC
  `
    );
    const list = (rows as Array<Record<string, unknown> & { id: number }>).map((r) => ({ ...r, play_count: null }));
    res.json({ list });
  })().catch((e) => {
    console.error("client works list error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * GET /api/client/points
 * 当前积分余额与流水。
 */
router.get("/points", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  (async () => {
    const accRes = await query<{ id: number; balance: number }>("SELECT id, balance FROM point_accounts WHERE user_id = $1", [userId]);
    const acc = accRes.rows[0];
    if (!acc) {
      res.json({ balance: 0, ledger: [] });
      return;
    }
    const ledgerRes = await query<{ id: number; amount: number; type: string; created_at: string }>(
      "SELECT id, amount, type, created_at FROM point_ledger WHERE account_id = $1 ORDER BY id DESC LIMIT 50",
      [acc.id]
    );
    res.json({ balance: acc.balance, ledger: ledgerRes.rows });
  })().catch((e) => {
    console.error("client points error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * POST /api/client/recharge
 * 充值得积分（模拟：实际应由支付回调或管理员操作写入）。
 */
router.post("/recharge", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const { amount } = req.body ?? {};
  const num = Number(amount);
  if (!Number.isInteger(num) || num < 1 || num > 1000000) {
    res.status(400).json({ error: "INVALID_AMOUNT", message: "请填写有效充值积分（1–1000000）。" });
    return;
  }
  (async () => {
    const result = await withTx(async (client) => {
      const accRes = await client.query<{ id: number; balance: number }>("SELECT id, balance FROM point_accounts WHERE user_id = $1 FOR UPDATE", [userId]);
      let acc = accRes.rows[0];
      if (!acc) {
        const created = await client.query<{ id: number; balance: number }>(
          "INSERT INTO point_accounts (user_id, balance) VALUES ($1, 0) RETURNING id, balance",
          [userId]
        );
        acc = created.rows[0]!;
      }
      await client.query("INSERT INTO point_ledger (account_id, amount, type, ref_id) VALUES ($1, $2, 'client_recharge', NULL)", [acc.id, num]);
      const updated = await client.query<{ balance: number }>("UPDATE point_accounts SET balance = balance + $1, updated_at = now() WHERE id = $2 RETURNING balance", [num, acc.id]);
      return updated.rows[0]!.balance;
    });
    res.json({ ok: true, balance: result });
  })().catch((e) => {
    console.error("client recharge error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

export default router;
