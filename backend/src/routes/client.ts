import { Router, Response } from "express";

import { query, withTx } from "../db";

import { requireAuth, requireRole, type AuthRequest } from "../auth";

import { recordOperationLogTx } from "../operationLog";
import { getUserFriendlyError } from "../userFriendlyError";



const router = Router();

router.use(requireAuth);

router.use(requireRole("client"));



const PUBLISH_METHOD_CLIENT_SELF = "client_self_publish";

const PUBLISH_METHOD_INFLUENCER_CART = "influencer_publish_with_cart";



/**
 * 解析多图字段：支持字符串数组，最多 20 条，每条去空白后入库。
 */
export function normalizeProductImages(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((x) => typeof x === "string")
    .map((x) => String(x).trim())
    .filter(Boolean)
    .slice(0, 20);
}

/**
 * 解析 SKU 编码/名称数组：支持字符串数组，最多 100 条。
 */
export function normalizeSkuCodes(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((x) => typeof x === "string")
    .map((x) => String(x).trim())
    .filter(Boolean)
    .slice(0, 100);
}

/**
 * 解析 SKU ID 列表：仅保留正整数，最多 100 条。
 */
export function normalizeSkuIds(input: unknown): number[] {
  if (!Array.isArray(input)) return [];
  const out: number[] = [];
  for (const v of input) {
    const n = Number(v);
    if (Number.isInteger(n) && n > 0) out.push(n);
    if (out.length >= 100) break;
  }
  return out;
}

/**
 * 解析并校验商家店铺名称（必填）。
 */
export function normalizeClientShopName(input: unknown): string {
  const value = input != null ? String(input).trim() : "";
  return value.replace(/<[^>]*>/g, "");
}

/**
 * 解析并校验商家对接群聊（必填，可为群号或链接）。
 */
export function normalizeClientGroupChat(input: unknown): string {
  const value = input != null ? String(input).trim() : "";
  return value.replace(/<[^>]*>/g, "");
}

/**
 * 规范化订单发布方式，仅允许固定枚举值。
 */
export function normalizePublishMethod(input: unknown): string {
  const value = input != null ? String(input).trim() : "";
  if (value === PUBLISH_METHOD_CLIENT_SELF || value === PUBLISH_METHOD_INFLUENCER_CART) return value;
  return "";
}

/**
 * 根据 SKU ID 列表读取当前商家 SKU（用于发单时快照）。
 */
export async function resolveSkuSnapshotByIds(clientId: number, skuIds: number[]): Promise<{ ids: number[]; codes: string[]; images: string[] }> {
  if (skuIds.length === 0) return { ids: [], codes: [], images: [] };
  const { rows } = await query<{ id: number; sku_code: string; sku_name: string | null; sku_images: string[] }>(
    `SELECT id, sku_code, sku_name, sku_images
       FROM client_skus
      WHERE client_id = $1 AND is_deleted = 0 AND id = ANY($2::int[])
      ORDER BY id DESC LIMIT 500`,
    [clientId, skuIds]
  );
  const ids = rows.map((r) => r.id);
  const codes = rows.map((r) => (r.sku_name ? `${r.sku_code} / ${r.sku_name}` : r.sku_code));
  const images = rows.flatMap((r) => (Array.isArray(r.sku_images) ? r.sku_images : [])).slice(0, 200);
  return { ids, codes, images };
}



/**
 * GET /api/client/requests
 * 当前商家的需求/合作意向列表。
 */
router.get("/requests", (req: AuthRequest, res: Response) => {
  const clientId = req.user!.userId;
  (async () => {
    const { rows } = await query(
      "SELECT id, product_info, target_platform, budget, need_face, status, created_at FROM client_requests WHERE client_id = $1 AND is_deleted = 0 ORDER BY id DESC LIMIT 500",
      [clientId]
    );
    res.json({ list: rows });
  })().catch((e) => {
    console.error("client requests list error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });
  });
});

/**
 * GET /api/client/requests/:id
 * 获取单条合作意向（用于编辑页回显）。
 */
router.get("/requests/:id", (req: AuthRequest, res: Response) => {
  const clientId = req.user!.userId;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的需求 ID。" });
    return;
  }
  (async () => {
    const { rows } = await query(
      "SELECT id, product_info, target_platform, budget, need_face, status, created_at FROM client_requests WHERE id = $1 AND client_id = $2 AND is_deleted = 0",
      [id, clientId]
    );
    const row = rows[0];
    if (!row) {
      res.status(404).json({ error: "NOT_FOUND", message: "需求不存在。" });
      return;
    }
    res.json({ item: row });
  })().catch((e) => {
    console.error("client requests detail error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });
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
    const created = await withTx(async (client) => {
      const ins = await client.query<{ id: number }>(
        "INSERT INTO client_requests (client_id, product_info, target_platform, budget, need_face, status) VALUES ($1, $2, $3, $4, $5, 'submitted') RETURNING id",
        [clientId, product_info != null ? String(product_info) : null, target_platform != null ? String(target_platform) : null, budget != null ? String(budget) : null, need_face ? 1 : 0]
      );
      const id = ins.rows[0]!.id;
      await recordOperationLogTx(client, { userId: clientId, actionType: "create", targetType: "intent", targetId: id });
      return { id };
    });
    res.status(201).json({ id: created.id });
  })().catch((e) => {
    console.error("client requests create error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });
  });
});

/**
 * PATCH /api/client/requests/:id
 * 编辑合作意向（仅允许编辑自己的记录；软删除的不允许编辑）。
 */
router.patch("/requests/:id", (req: AuthRequest, res: Response) => {
  const clientId = req.user!.userId;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的需求 ID。" });
    return;
  }
  const { product_info, target_platform, budget, need_face, status } = req.body ?? {};
  if (status !== undefined && status !== "draft" && status !== "submitted") {
    res.status(400).json({ error: "INVALID_STATUS", message: "商家仅可将需求状态设为 draft 或 submitted。" });
    return;
  }
  (async () => {
    const row = await query<{ id: number }>(
      "SELECT id FROM client_requests WHERE id = $1 AND client_id = $2 AND is_deleted = 0",
      [id, clientId]
    );
    if (!row.rows[0]) {
      res.status(404).json({ error: "NOT_FOUND", message: "需求不存在。" });
      return;
    }
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (product_info !== undefined) {
      sets.push(`product_info = $${idx++}`);
      params.push(product_info == null ? null : String(product_info));
    }
    if (target_platform !== undefined) {
      sets.push(`target_platform = $${idx++}`);
      params.push(target_platform == null ? null : String(target_platform));
    }
    if (budget !== undefined) {
      sets.push(`budget = $${idx++}`);
      params.push(budget == null ? null : String(budget));
    }
    if (need_face !== undefined) {
      sets.push(`need_face = $${idx++}`);
      params.push(need_face ? 1 : 0);
    }
    if (status === "draft" || status === "submitted") {
      sets.push(`status = $${idx++}`);
      params.push(status);
    }
    if (sets.length === 0) {
      res.json({ ok: true });
      return;
    }
    await withTx(async (client) => {
      params.push(id);
      params.push(clientId);
      await client.query(`UPDATE client_requests SET ${sets.join(", ")} WHERE id = $${idx++} AND client_id = $${idx++}`, params);
      await recordOperationLogTx(client, { userId: clientId, actionType: "edit", targetType: "intent", targetId: id });
    });
    res.json({ ok: true });
  })().catch((e) => {
    console.error("client requests patch error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });
  });
});

/**
 * DELETE /api/client/requests/:id
 * 软删除合作意向。
 */
router.delete("/requests/:id", (req: AuthRequest, res: Response) => {
  const clientId = req.user!.userId;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的需求 ID。" });
    return;
  }
  (async () => {
    const result = await withTx(async (client) => {
      const updated = await client.query<{ id: number }>(
        "UPDATE client_requests SET is_deleted = 1, deleted_at = now() WHERE id = $1 AND client_id = $2 AND is_deleted = 0 RETURNING id",
        [id, clientId]
      );
      if (!updated.rows[0]) {
        return { kind: "not_found" as const };
      }
      await recordOperationLogTx(client, { userId: clientId, actionType: "delete", targetType: "intent", targetId: id });
      return { kind: "ok" as const };
    });
    if (result.kind === "not_found") {
      res.status(404).json({ error: "NOT_FOUND", message: "需求不存在。" });
      return;
    }
    res.json({ ok: true });
  })().catch((e) => {
    console.error("client requests delete error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });
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
    WHERE o.client_id = $1 AND o.is_deleted = 0
    ORDER BY o.id DESC
    LIMIT 500
  `,
      [clientId]
    );
    res.json({ list: rows });
  })().catch((e) => {
    console.error("client orders list error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });
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
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });
  });
});

/**
 * PATCH /api/client/orders/:id
 * 更新订单状态（商家可更新备注，状态一般由管理员或流程更新，此处允许商家更新便于协作）。
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
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });
  });
});

/**
 * GET /api/client/works
 * 达人作品板块已下线，统一返回停用状态。
 */
router.get("/works", (req: AuthRequest, res: Response) => {
  res.status(410).json({ error: "MODULE_DISABLED", message: "达人作品板块已下线。" });
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
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });
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
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });
  });
});

export default router;
