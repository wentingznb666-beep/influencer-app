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

router.post("/video-orders/:id/mark-paid", async (_req: AuthRequest, res: Response) => {
  return res.status(403).json({
    error: "FORBIDDEN",
    message: "该类型订单需由员工端手动标记付款后进入制作流程。",
  });
});

router.post("/video-orders/:id/accept", async (_req: AuthRequest, res: Response) => {
  return res.status(403).json({
    error: "FORBIDDEN",
    message: "商家端当前为只读视图，不支持在该端修改订单状态。",
  });
});

router.post("/video-orders/:id/reject", async (_req: AuthRequest, res: Response) => {
  return res.status(403).json({
    error: "FORBIDDEN",
    message: "商家端当前为只读视图，不支持在该端修改订单状态。",
  });
});



/** 商家确认包月订单某批次验收。 */
router.post("/video-orders/:id/monthly-batches/:batchNo/accept", async (_req: AuthRequest, res: Response) => {
  return res.status(403).json({
    error: "FORBIDDEN",
    message: "商家端当前为只读视图，不支持在该端修改批次状态。",
  });
});

/** 商家将包月订单某批次标记为已结算。 */
router.post("/video-orders/:id/monthly-batches/:batchNo/settle", async (_req: AuthRequest, res: Response) => {
  return res.status(403).json({
    error: "FORBIDDEN",
    message: "商家端当前为只读视图，不支持在该端修改批次状态。",
  });
});

export default router;

