import { Router, Response } from "express";
import { query, withTx } from "../db";
import { ensurePointAccountLocked } from "../pointAccounts";
import { allocateMarketOrderNo } from "../marketOrderNo";
import { requireAuth, requireRole, type AuthRequest } from "../auth";

const router = Router();
router.use(requireAuth);
router.use(requireRole("client"));

/**
 * 达人领单类订单积分规则：
 * - 客户发单即扣积分（按档位 A/B/C：60/40/20）
 * - 订单完成后，达人收益固定为 5（不随客户支付变化）
 */
const MARKET_ORDER_CREATOR_REWARD = 5;

/**
 * 将档位映射为客户支付积分。
 */
function resolveMarketOrderPayPoints(tier: string): { tier: "A" | "B" | "C"; payPoints: number } {
  if (tier === "A") return { tier: "A", payPoints: 60 };
  if (tier === "B") return { tier: "B", payPoints: 40 };
  return { tier: "C", payPoints: 20 };
}

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
    const rechargeOrderRes = await query<{ id: number; order_no: string | null; amount: number; status: string; note: string | null; created_at: string; approved_at: string | null }>(
      "SELECT id, order_no, amount, status, note, created_at, approved_at FROM recharge_orders WHERE user_id = $1 ORDER BY id DESC LIMIT 50",
      [userId]
    );
    res.json({ balance: acc.balance, ledger: ledgerRes.rows, rechargeOrders: rechargeOrderRes.rows });
  })().catch((e) => {
    console.error("client points error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * POST /api/client/recharge
 * 提交充值订单，待管理员确认后再入账。
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
    const created = await withTx(async (client) => {
      const dateRes = await client.query<{ date_key: string }>("SELECT to_char((now() AT TIME ZONE 'Asia/Shanghai'), 'YYYYMMDD') AS date_key");
      const dateKey = dateRes.rows[0]!.date_key;
      const seqRes = await client.query<{ last_no: number }>(
        `
        INSERT INTO biz_order_counters (prefix, date_key, last_no)
        VALUES ('XT', $1, 1)
        ON CONFLICT (prefix, date_key)
        DO UPDATE SET last_no = biz_order_counters.last_no + 1
        RETURNING last_no
        `,
        [dateKey]
      );
      const seqNo = seqRes.rows[0]!.last_no;
      const orderNo = `XT${dateKey}-${seqNo}`;
      const inserted = await client.query<{ id: number; order_no: string }>(
        "INSERT INTO recharge_orders (order_no, user_id, amount, status) VALUES ($1, $2, $3, 'pending') RETURNING id, order_no",
        [orderNo, userId, num]
      );
      return inserted.rows[0]!;
    });
    res.status(201).json({ id: created.id, order_no: created.order_no, status: "pending" });
  })().catch((e) => {
    console.error("client recharge error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * GET /api/client/market-orders
 * 当前客户发布的「达人领单」订单列表（含要求、状态、奖励积分）。
 */
router.get("/market-orders", (req: AuthRequest, res: Response) => {
  const clientId = req.user!.userId;
  const rawQ = typeof req.query.q === "string" ? req.query.q.trim() : "";
  (async () => {
    let sql = `SELECT id, order_no, title, requirements, reward_points, status, influencer_id, work_link, created_at, updated_at, completed_at
       FROM client_market_orders WHERE client_id = $1`;
    const params: unknown[] = [clientId];
    if (rawQ) {
      sql += ` AND (order_no = $2 OR title = $2 OR requirements = $2)`;
      params.push(rawQ);
    }
    sql += ` ORDER BY id DESC`;
    const { rows } = await query(sql, params);
    res.json({ list: rows });
  })().catch((e) => {
    console.error("client market-orders list error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * POST /api/client/market-orders
 * 创建达人可领取的订单：发单时按档位扣积分（C=20 / B=40 / A=60）。
 */
router.post("/market-orders", (req: AuthRequest, res: Response) => {
  const clientId = req.user!.userId;
  const { requirements, title, tier, voice_link, voice_note } = req.body ?? {};
  const reqText = requirements != null ? String(requirements).trim() : "";
  if (!reqText || reqText.length > 8000) {
    res.status(400).json({ error: "INVALID_REQUIREMENTS", message: "请填写任务要求（1–8000 字）。" });
    return;
  }
  let titleText = title != null ? String(title).trim() : "";
  if (titleText.length > 200) {
    res.status(400).json({ error: "INVALID_TITLE", message: "订单标题最长 200 字。" });
    return;
  }
  if (!titleText) {
    titleText = reqText.length > 200 ? reqText.slice(0, 200) : reqText;
  }
  (async () => {
    const result = await withTx(async (client) => {
      const acc = await ensurePointAccountLocked(client, clientId);
      const resolved = resolveMarketOrderPayPoints(typeof tier === "string" ? tier.trim().toUpperCase() : "");
      const payPoints = resolved.payPoints;
      const platformProfit = Math.max(payPoints - MARKET_ORDER_CREATOR_REWARD, 0);
      if (acc.balance < payPoints) {
        return { kind: "insufficient" as const, balance: acc.balance, need: payPoints };
      }
      const voiceLink = voice_link != null ? String(voice_link).trim() : "";
      const voiceNote = voice_note != null ? String(voice_note).trim() : "";
      if (resolved.tier === "A") {
        if (voiceLink.length > 2000) {
          return { kind: "bad_voice" as const, message: "配音素材链接最长 2000 字符。" };
        }
        if (voiceNote.length > 2000) {
          return { kind: "bad_voice" as const, message: "配音要求备注最长 2000 字符。" };
        }
      }
      const orderNo = await allocateMarketOrderNo(client);
      const ins = await client.query<{ id: number; order_no: string }>(
        `INSERT INTO client_market_orders
           (client_id, order_no, title, requirements, reward_points, tier, creator_reward_points, platform_profit_points, pay_deducted, voice_link, voice_note, status)
         VALUES
           ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, 'open')
         RETURNING id, order_no`,
        [
          clientId,
          orderNo,
          titleText,
          reqText,
          payPoints,
          resolved.tier,
          MARKET_ORDER_CREATOR_REWARD,
          platformProfit,
          resolved.tier === "A" ? (voiceLink || null) : null,
          resolved.tier === "A" ? (voiceNote || null) : null,
        ]
      );
      const orderId = ins.rows[0]!.id;
      // 发单即扣积分（入账到流水），并标记 pay_deducted=1，避免完单重复扣款
      await client.query("INSERT INTO point_ledger (account_id, amount, type, ref_id) VALUES ($1, $2, 'market_order_client_pay', $3)", [
        acc.id,
        -payPoints,
        orderId,
      ]);
      await client.query("UPDATE point_accounts SET balance = balance - $1, updated_at = now() WHERE id = $2", [payPoints, acc.id]);
      await client.query("UPDATE client_market_orders SET pay_deducted = 1, updated_at = now() WHERE id = $1", [orderId]);
      return { kind: "ok" as const, id: ins.rows[0]!.id, order_no: ins.rows[0]!.order_no };
    });
    if (result.kind === "bad_voice") {
      res.status(400).json({ error: "INVALID_VOICE", message: result.message });
      return;
    }
    if (result.kind === "insufficient") {
      res.status(409).json({
        error: "INSUFFICIENT_POINTS",
        message: `发单积分不足（需 ${result.need}），当前余额 ${result.balance}。`,
      });
      return;
    }
    // 返回给客户端：显示其支付积分（reward_points 字段历史沿用）
    res.status(201).json({ id: result.id, order_no: result.order_no });
  })().catch((e) => {
    console.error("client market-orders create error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

export default router;
