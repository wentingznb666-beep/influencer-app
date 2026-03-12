import { Router, Response } from "express";
import { getDb } from "../db";
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
  const database = getDb();
  const rows = database.prepare("SELECT id, product_info, target_platform, budget, need_face, status, created_at FROM client_requests WHERE client_id = ? ORDER BY id DESC").all(clientId);
  res.json({ list: rows });
});

/**
 * POST /api/client/requests
 * 提交合作意向/任务需求。
 */
router.post("/requests", (req: AuthRequest, res: Response) => {
  const clientId = req.user!.userId;
  const { product_info, target_platform, budget, need_face } = req.body ?? {};
  const database = getDb();
  const result = database
    .prepare(
      "INSERT INTO client_requests (client_id, product_info, target_platform, budget, need_face, status) VALUES (?, ?, ?, ?, ?, 'submitted')"
    )
    .run(
      clientId,
      product_info != null ? String(product_info) : null,
      target_platform != null ? String(target_platform) : null,
      budget != null ? String(budget) : null,
      need_face ? 1 : 0
    );
  res.status(201).json({ id: result.lastInsertRowid });
});

/**
 * GET /api/client/orders
 * 样品/订单跟踪列表。
 */
router.get("/orders", (req: AuthRequest, res: Response) => {
  const clientId = req.user!.userId;
  const database = getDb();
  const rows = database
    .prepare(
      `
    SELECT o.id, o.request_id, o.status, o.note, o.created_at, o.updated_at,
           r.product_info, r.target_platform
    FROM sample_orders o
    LEFT JOIN client_requests r ON o.request_id = r.id
    WHERE o.client_id = ?
    ORDER BY o.id DESC
  `
    )
    .all(clientId);
  res.json({ list: rows });
});

/**
 * POST /api/client/orders
 * 创建样品/订单（可关联需求）。
 */
router.post("/orders", (req: AuthRequest, res: Response) => {
  const clientId = req.user!.userId;
  const { request_id, note } = req.body ?? {};
  const database = getDb();
  if (request_id != null) {
    const r = database.prepare("SELECT id FROM client_requests WHERE id = ? AND client_id = ?").get(Number(request_id), clientId);
    if (!r) {
      res.status(400).json({ error: "INVALID_REQUEST", message: "需求不存在或无权关联。" });
      return;
    }
  }
  const result = database
    .prepare("INSERT INTO sample_orders (client_id, request_id, status, note) VALUES (?, ?, 'pending', ?)")
    .run(clientId, request_id != null ? Number(request_id) : null, note != null ? String(note) : null);
  res.status(201).json({ id: result.lastInsertRowid });
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
  const database = getDb();
  const row = database.prepare("SELECT id FROM sample_orders WHERE id = ? AND client_id = ?").get(id, clientId);
  if (!row) {
    res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    return;
  }
  const updates: string[] = [];
  const params: (string | number)[] = [];
  if (status === "pending" || status === "sent" || status === "received") {
    updates.push("status = ?");
    params.push(status);
  }
  if (note !== undefined) {
    updates.push("note = ?");
    params.push(String(note));
  }
  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    params.push(id);
    database.prepare(`UPDATE sample_orders SET ${updates.join(", ")} WHERE id = ?`).run(...params);
  }
  res.json({ ok: true });
});

/**
 * GET /api/client/works
 * 达人已发布作品列表（已通过审核的投稿，含作品链接、达人、任务/素材信息）。
 */
router.get("/works", (req: AuthRequest, res: Response) => {
  const database = getDb();
  const rows = database
    .prepare(
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
    )
    .all() as Array<Record<string, unknown> & { id: number }>;
  const list = rows.map((r) => ({ ...r, play_count: null }));
  res.json({ list });
});

/**
 * GET /api/client/points
 * 当前积分余额与流水。
 */
router.get("/points", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const database = getDb();
  const acc = database.prepare("SELECT id, balance FROM point_accounts WHERE user_id = ?").get(userId) as { id: number; balance: number } | undefined;
  if (!acc) {
    res.json({ balance: 0, ledger: [] });
    return;
  }
  const ledger = database
    .prepare("SELECT id, amount, type, created_at FROM point_ledger WHERE account_id = ? ORDER BY id DESC LIMIT 50")
    .all(acc.id) as Array<{ id: number; amount: number; type: string; created_at: string }>;
  res.json({ balance: acc.balance, ledger });
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
  const database = getDb();
  let acc = database.prepare("SELECT id, balance FROM point_accounts WHERE user_id = ?").get(userId) as { id: number; balance: number } | undefined;
  if (!acc) {
    database.prepare("INSERT INTO point_accounts (user_id, balance) VALUES (?, 0)").run(userId);
    acc = database.prepare("SELECT id, balance FROM point_accounts WHERE user_id = ?").get(userId) as { id: number; balance: number };
  }
  database.prepare("INSERT INTO point_ledger (account_id, amount, type, ref_id) VALUES (?, ?, 'client_recharge', NULL)").run(acc.id, num);
  database.prepare("UPDATE point_accounts SET balance = balance + ?, updated_at = datetime('now') WHERE id = ?").run(num, acc.id);
  res.json({ ok: true, balance: acc.balance + num });
});

export default router;
