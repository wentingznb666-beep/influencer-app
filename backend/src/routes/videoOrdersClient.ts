import { Router, Response } from "express";

import { query, withTx } from "../db";

import { requireAuth, requireRole, type AuthRequest } from "../auth";
import { readCooperationTypesConfig, isVisibleCooperationType, type CooperationTypeId } from "../cooperationTypes";



const router = Router();

router.use(requireAuth);
router.use(requireRole("client"));

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
  if (!Number.isFinite(amountThb) || amountThb <= 0) return res.status(400).json({ error: "INVALID_AMOUNT", message: "请填写有效金额（THB）。" });

  if (!(await ensureTypeVisibleToClient(typeId))) {
    return res.status(400).json({ error: "TYPE_NOT_AVAILABLE", message: "该类型当前不可用。" });
  }

  try {
    const created = await withTx(async (client) => {
      const ins = await client.query<{ id: number }>(
        `INSERT INTO video_orders (client_id, type_id, title, requirements, amount_thb, payment_method, payment_status)
         VALUES ($1, $2, $3, $4::jsonb, $5, 'offline', 'unpaid')
         RETURNING id`,
        [req.user!.userId, typeId, title, JSON.stringify(requirements), amountThb]
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
      `SELECT o.id, o.type_id, o.title, o.amount_thb, o.payment_method, o.payment_status, o.paid_at, o.assigned_employee_id, o.created_at, o.updated_at,
              COALESCE(s.phase,'created') AS phase,
              COALESCE(s.proof_links,'[]'::jsonb) AS proof_links,
              COALESCE(s.publish_links,'[]'::jsonb) AS publish_links,
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
      const cur = await client.query<{ payment_status: string }>(
        `SELECT payment_status FROM video_orders WHERE id=$1 AND client_id=$2 FOR UPDATE`,
        [id, req.user!.userId]
      );
      const row = cur.rows[0];
      if (!row) return { kind: "not_found" as const };
      if (row.payment_status === "paid") return { kind: "ok" as const };
      await client.query(`UPDATE video_orders SET payment_status='paid', paid_at=now(), updated_at=now() WHERE id=$1`, [id]);
      await client.query(`UPDATE video_order_states SET phase='paid', updated_at=now() WHERE order_id=$1`, [id]);
      return { kind: "ok" as const };
    });
    if (updated.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
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

export default router;

