import { Router, Response } from "express";

import { ensureVideoOrdersSchemaReady, query, withTx } from "../db";

import { requireAuth, requireRole, type AuthRequest } from "../auth";
import { readCooperationTypesConfig, isVisibleCooperationType, type CooperationTypeId } from "../cooperationTypes";



const router = Router();

router.use(requireAuth);
router.use(requireRole("client"));
router.use((req, res, next) => {
  void ensureVideoOrdersSchemaReady().then(() => next(), next);
});

type VideoOrderTypeId = Exclude<CooperationTypeId, "graded_video">;

function normalizeTypeId(input: unknown): VideoOrderTypeId | "" {
  const v = typeof input === "string" ? input.trim() : "";
  if (v === "high_quality_custom_video" || v === "monthly_package" || v === "creator_review_video") return v;
  return "";
}

function normalizeTitle(input: unknown): string {
  const v = typeof input === "string" ? input.trim() : "";
  if (!v || v.length > 200) return "";
  return v;
}

function normalizeAmountThb(input: unknown): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n < 0) return NaN;
  return Math.round(n * 100) / 100;
}

function normalizeRequirements(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") return {};
  return input as Record<string, unknown>;
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(Math.floor(n), min), max);
}

async function readNumberConfig(key: string): Promise<number | null> {
  const row = await query<{ value: string }>("SELECT value FROM config WHERE key=$1", [key]);
  const raw = row.rows[0]?.value;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function weekStartMondayUtcFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  const ws = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  ws.setUTCDate(ws.getUTCDate() - diff);
  return ws.toISOString().slice(0, 10);
}

async function ensureTypeVisibleToClient(typeId: VideoOrderTypeId): Promise<boolean> {
  const cfg = await readCooperationTypesConfig();
  return isVisibleCooperationType(cfg, typeId, "client");
}

router.post("/video-orders", async (req: AuthRequest, res: Response) => {
  const typeId = normalizeTypeId(req.body?.type_id);
  const title = normalizeTitle(req.body?.title);
  const amountThb = normalizeAmountThb(req.body?.amount_thb);
  const requirements = normalizeRequirements(req.body?.requirements);

  if (!typeId) return res.status(400).json({ error: "INVALID_TYPE", message: "无效的视频订单类型。" });
  if (!title) return res.status(400).json({ error: "INVALID_TITLE", message: "请填写订单标题（1-200字）。" });
  if (!Number.isFinite(amountThb) || amountThb < 0) return res.status(400).json({ error: "INVALID_AMOUNT", message: "请填写有效金额（THB）。" });

  const taskCountRaw = Number((requirements as any)?.task_count || 0);
  const monthlyMinRaw = Number((requirements as any)?.min_videos_per_month || 0);

  const unitCount =
    typeId === "creator_review_video"
      ? clampInt(taskCountRaw || 8, 8, 10)
      : typeId === "monthly_package"
        ? clampInt(monthlyMinRaw || 20, 20, 999)
        : 1;

  if (typeId === "creator_review_video") {
    if (taskCountRaw && (taskCountRaw < 8 || taskCountRaw > 10)) {
      return res.status(400).json({ error: "INVALID_TASK_COUNT", message: "测评视频任务条数需为 8-10 条。" });
    }
  }

  if (typeId === "monthly_package") {
    if (monthlyMinRaw && monthlyMinRaw < 20) {
      return res.status(400).json({ error: "INVALID_MONTHLY_MIN", message: "包月合作每月不少于 20 条。" });
    }
  }

  const configUnitPrice = typeId === "creator_review_video" ? await readNumberConfig("creator_review_video_unit_price_thb") : null;
  const unitPriceThb = typeId === "monthly_package" ? 650 : typeId === "creator_review_video" ? configUnitPrice : null;
  const computedTotal = unitPriceThb != null ? Math.round(unitPriceThb * unitCount * 100) / 100 : null;
  const finalAmount = amountThb > 0 ? amountThb : computedTotal != null ? computedTotal : 0;

  if (typeId !== "creator_review_video" && finalAmount <= 0) {
    return res.status(400).json({ error: "INVALID_AMOUNT", message: "请填写有效金额（THB）。" });
  }

  if (!(await ensureTypeVisibleToClient(typeId))) {
    return res.status(400).json({ error: "TYPE_NOT_AVAILABLE", message: "该类型当前不可用。" });
  }

  try {
    const created = await withTx(async (client) => {
      const ins = await client.query<{ id: number }>(
        `INSERT INTO video_orders (client_id, type_id, title, requirements, amount_thb, unit_price_thb, unit_count, boss_unit_price_thb, payment_method, payment_status)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, 'offline', 'unpaid')
         RETURNING id`,
        [req.user!.userId, typeId, title, JSON.stringify({ ...requirements, task_count: unitCount }), finalAmount, unitPriceThb, unitCount, unitPriceThb]
      );
      const row = ins.rows[0];
      if (!row) return null;
      await client.query(`INSERT INTO video_order_states (order_id) VALUES ($1) ON CONFLICT (order_id) DO NOTHING`, [row.id]);
      return row;
    });
    if (!created) return res.status(500).json({ error: "DB_ERROR", message: "创建失败，请重试。" });
    return res.status(201).json({ id: created.id });
  } catch (e) {
    console.error("client create video order error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

router.get("/video-orders", async (req: AuthRequest, res: Response) => {
  try {
    const rows = await query(
      `SELECT o.id, o.type_id, o.title, o.requirements, o.amount_thb, o.payment_method, o.payment_status, o.paid_at, o.assigned_employee_id, o.created_at, o.updated_at,
              COALESCE(s.phase,'created') AS phase,
              COALESCE(s.proof_links,'[]'::jsonb) AS proof_links,
              COALESCE(s.publish_links,'[]'::jsonb) AS publish_links,
              COALESCE(s.batch_payload,'[]'::jsonb) AS batch_payload,
              s.review_note, s.reviewed_by, s.reviewed_at
         FROM video_orders o
         LEFT JOIN video_order_states s ON s.order_id=o.id
        WHERE o.client_id=$1
        ORDER BY o.id DESC`,
      [req.user!.userId]
    );
    return res.json({ list: rows.rows });
  } catch (e) {
    console.error("client list video orders error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

router.get("/video-orders/:id", async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "INVALID_ID", message: "无效订单ID。" });
  try {
    const rows = await query(
      `SELECT o.id, o.client_id, o.type_id, o.title, o.requirements, o.amount_thb, o.payment_method, o.payment_status, o.paid_at, o.assigned_employee_id, o.created_at, o.updated_at,
              COALESCE(s.phase,'created') AS phase,
              COALESCE(s.proof_links,'[]'::jsonb) AS proof_links,
              COALESCE(s.publish_links,'[]'::jsonb) AS publish_links,
              COALESCE(s.batch_payload,'[]'::jsonb) AS batch_payload,
              s.review_note, s.reviewed_by, s.reviewed_at
         FROM video_orders o
         LEFT JOIN video_order_states s ON s.order_id=o.id
        WHERE o.id=$1 AND o.client_id=$2`,
      [id, req.user!.userId]
    );
    const row = rows.rows[0];
    if (!row) return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    return res.json({ order: row });
  } catch (e) {
    console.error("client get video order error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

router.post("/video-orders/:id/mark-paid", async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "INVALID_ID", message: "无效订单ID。" });
  try {
    const updated = await withTx(async (client) => {
      const cur = await client.query<{ payment_status: string; amount_thb: any }>(
        `SELECT payment_status, amount_thb FROM video_orders WHERE id=$1 AND client_id=$2 FOR UPDATE`,
        [id, req.user!.userId]
      );
      const row = cur.rows[0];
      if (!row) return { kind: "not_found" as const };
      const amount = Number(row.amount_thb);
      if (!Number.isFinite(amount) || amount <= 0) return { kind: "amount_missing" as const };
      if (row.payment_status === "paid") return { kind: "ok" as const };
      await client.query(`UPDATE video_orders SET payment_status='paid', paid_at=now(), updated_at=now() WHERE id=$1`, [id]);
      await client.query(`UPDATE video_order_states SET phase='paid', updated_at=now() WHERE order_id=$1`, [id]);
      return { kind: "ok" as const };
    });
    if (updated.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    if (updated.kind === "amount_missing") return res.status(400).json({ error: "AMOUNT_REQUIRED", message: "该订单金额尚未配置，暂不可标记已付款。" });
    return res.json({ ok: true });
  } catch (e) {
    console.error("client mark paid error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

router.post("/video-orders/:id/accept", async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "INVALID_ID", message: "无效订单ID。" });
  try {
    const ret = await withTx(async (client) => {
      const cur = await client.query<{ type_id: VideoOrderTypeId; payment_status: string; phase: string }>(
        `SELECT o.type_id, o.payment_status, COALESCE(s.phase,'created') AS phase
           FROM video_orders o
           LEFT JOIN video_order_states s ON s.order_id=o.id
          WHERE o.id=$1 AND o.client_id=$2
          FOR UPDATE`,
        [id, req.user!.userId]
      );
      const row = cur.rows[0];
      if (!row) return { kind: "not_found" as const };
      if (row.payment_status !== "paid") return { kind: "not_paid" as const };
      if (row.type_id === "creator_review_video") {
        if (row.phase !== "published") return { kind: "publish_required" as const };
      } else {
        if (row.phase !== "delivered") return { kind: "deliver_required" as const };
      }
      await client.query(`UPDATE video_order_states SET phase='completed', updated_at=now() WHERE order_id=$1`, [id]);
      await client.query(`UPDATE video_orders SET updated_at=now() WHERE id=$1`, [id]);
      return { kind: "ok" as const };
    });
    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    if (ret.kind === "not_paid") return res.status(400).json({ error: "PAYMENT_REQUIRED", message: "请先完成线下付款后再验收。" });
    if (ret.kind === "publish_required") return res.status(400).json({ error: "PUBLISH_REQUIRED", message: "该订单需先发布后才能验收。" });
    if (ret.kind === "deliver_required") return res.status(400).json({ error: "DELIVER_REQUIRED", message: "员工尚未提交交付内容，暂不可验收。" });
    return res.json({ ok: true });
  } catch (e) {
    console.error("client accept video order error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

router.post("/video-orders/:id/reject", async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const note = typeof req.body?.note === "string" ? String(req.body.note).trim() : "";
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "INVALID_ID", message: "无效订单ID。" });
  try {
    const ret = await withTx(async (client) => {
      const cur = await client.query<{ payment_status: string; phase: string }>(
        `SELECT o.payment_status, COALESCE(s.phase,'created') AS phase
           FROM video_orders o
           LEFT JOIN video_order_states s ON s.order_id=o.id
          WHERE o.id=$1 AND o.client_id=$2
          FOR UPDATE`,
        [id, req.user!.userId]
      );
      const row = cur.rows[0];
      if (!row) return { kind: "not_found" as const };
      if (row.payment_status !== "paid") return { kind: "not_paid" as const };
      if (!["delivered", "published"].includes(row.phase)) return { kind: "not_ready" as const };
      await client.query(`UPDATE video_order_states SET phase='rejected', review_note=$2, updated_at=now() WHERE order_id=$1`, [id, note || null]);
      await client.query(`UPDATE video_orders SET updated_at=now() WHERE id=$1`, [id]);
      return { kind: "ok" as const };
    });
    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    if (ret.kind === "not_paid") return res.status(400).json({ error: "PAYMENT_REQUIRED", message: "请先完成线下付款后再验收。" });
    if (ret.kind === "not_ready") return res.status(400).json({ error: "NOT_READY", message: "订单当前状态不可驳回。" });
    return res.json({ ok: true });
  } catch (e) {
    console.error("client reject video order error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});



/** 商家确认包月订单某批次验收。 */
router.post("/video-orders/:id/monthly-batches/:batchNo/accept", async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const batchNo = Number(req.params.batchNo);
  const acceptedCount = Number(req.body?.accepted_count || 0);
  const note = typeof req.body?.note === "string" ? String(req.body.note).trim() : "";
  if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(batchNo) || batchNo <= 0) {
    return res.status(400).json({ error: "INVALID_ID", message: "无效参数。" });
  }
  if (!Number.isFinite(acceptedCount) || acceptedCount < 0) {
    return res.status(400).json({ error: "INVALID_INPUT", message: "验收数量不正确。" });
  }

  try {
    const ret = await withTx(async (client) => {
      const cur = await client.query<{ type_id: string; payment_status: string; batch_payload: any }>(
        `SELECT o.type_id, o.payment_status, COALESCE(s.batch_payload,'[]'::jsonb) AS batch_payload
           FROM video_orders o
           LEFT JOIN video_order_states s ON s.order_id=o.id
          WHERE o.id=$1 AND o.client_id=$2
          FOR UPDATE`,
        [id, req.user!.userId]
      );
      const row = cur.rows[0];
      if (!row) return { kind: "not_found" as const };
      if (row.type_id !== "monthly_package") return { kind: "not_supported" as const };
      if (row.payment_status !== "paid") return { kind: "not_paid" as const };
      const list = Array.isArray(row.batch_payload) ? row.batch_payload : [];
      const idx = list.findIndex((x: any) => Number(x?.batch_no) === batchNo);
      if (idx < 0) return { kind: "batch_missing" as const };
      const item = { ...list[idx] };
      item.status = "accepted";
      item.accepted_count = Math.floor(acceptedCount);
      item.accept_note = note || null;
      item.accepted_at = new Date().toISOString();
      list[idx] = item;
      await client.query(`UPDATE video_order_states SET batch_payload=$2::jsonb, updated_at=now() WHERE order_id=$1`, [id, JSON.stringify(list)]);
      await client.query(`UPDATE video_orders SET updated_at=now() WHERE id=$1`, [id]);
      return { kind: "ok" as const, item };
    });
    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    if (ret.kind === "not_supported") return res.status(400).json({ error: "NOT_SUPPORTED", message: "仅包月订单支持批次验收。" });
    if (ret.kind === "not_paid") return res.status(400).json({ error: "PAYMENT_REQUIRED", message: "请先付款后操作。" });
    if (ret.kind === "batch_missing") return res.status(404).json({ error: "BATCH_NOT_FOUND", message: "批次不存在。" });
    return res.json({ ok: true, batch: ret.item });
  } catch (e) {
    console.error("client accept monthly batch error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

/** 商家将包月订单某批次标记为已结算。 */
router.post("/video-orders/:id/monthly-batches/:batchNo/settle", async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const batchNo = Number(req.params.batchNo);
  const settledAmount = Number(req.body?.settled_amount || 0);
  if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(batchNo) || batchNo <= 0) {
    return res.status(400).json({ error: "INVALID_ID", message: "无效参数。" });
  }
  if (!Number.isFinite(settledAmount) || settledAmount < 0) {
    return res.status(400).json({ error: "INVALID_INPUT", message: "结算金额不正确。" });
  }

  try {
    const ret = await withTx(async (client) => {
      const cur = await client.query<{ type_id: string; payment_status: string; batch_payload: any }>(
        `SELECT o.type_id, o.payment_status, COALESCE(s.batch_payload,'[]'::jsonb) AS batch_payload
           FROM video_orders o
           LEFT JOIN video_order_states s ON s.order_id=o.id
          WHERE o.id=$1 AND o.client_id=$2
          FOR UPDATE`,
        [id, req.user!.userId]
      );
      const row = cur.rows[0];
      if (!row) return { kind: "not_found" as const };
      if (row.type_id !== "monthly_package") return { kind: "not_supported" as const };
      if (row.payment_status !== "paid") return { kind: "not_paid" as const };
      const list = Array.isArray(row.batch_payload) ? row.batch_payload : [];
      const idx = list.findIndex((x: any) => Number(x?.batch_no) === batchNo);
      if (idx < 0) return { kind: "batch_missing" as const };
      const item = { ...list[idx] };
      if (item.status !== "accepted" && item.status !== "settled") return { kind: "not_accepted" as const };
      item.status = "settled";
      item.settled_amount = Math.round(settledAmount * 100) / 100;
      item.settled_at = new Date().toISOString();
      list[idx] = item;
      await client.query(`UPDATE video_order_states SET batch_payload=$2::jsonb, updated_at=now() WHERE order_id=$1`, [id, JSON.stringify(list)]);
      await client.query(`UPDATE video_orders SET updated_at=now() WHERE id=$1`, [id]);

      const weekStart = weekStartMondayUtcFromIso(item.settled_at);
      await client.query(
        `INSERT INTO video_order_settlements (order_id, batch_no, week_start, amount_thb, status)
         VALUES ($1, $2, $3::date, $4, 'pending')
         ON CONFLICT (order_id, batch_no)
         DO UPDATE SET week_start=EXCLUDED.week_start, amount_thb=EXCLUDED.amount_thb, updated_at=now()`,
        [id, batchNo, weekStart, item.settled_amount]
      );
      return { kind: "ok" as const, item };
    });
    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    if (ret.kind === "not_supported") return res.status(400).json({ error: "NOT_SUPPORTED", message: "仅包月订单支持批次结算。" });
    if (ret.kind === "not_paid") return res.status(400).json({ error: "PAYMENT_REQUIRED", message: "请先付款后操作。" });
    if (ret.kind === "batch_missing") return res.status(404).json({ error: "BATCH_NOT_FOUND", message: "批次不存在。" });
    if (ret.kind === "not_accepted") return res.status(400).json({ error: "BATCH_NOT_ACCEPTED", message: "请先完成批次验收。" });
    return res.json({ ok: true, batch: ret.item });
  } catch (e) {
    console.error("client settle monthly batch error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

export default router;

