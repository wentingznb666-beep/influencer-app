import { Router, Response } from "express";

import { ensureVideoOrdersSchemaReady, query, withTx } from "../db";

import { requireAuth, requireRole, type AuthRequest } from "../auth";
import { readCooperationTypesConfig, isVisibleCooperationType, type CooperationTypeId } from "../cooperationTypes";



const router = Router();

router.use(requireAuth);
router.use(requireRole("admin"));
router.use((req, res, next) => {
  void ensureVideoOrdersSchemaReady().then(() => next(), next);
});

type VideoOrderTypeId = Exclude<CooperationTypeId, "graded_video">;

function normalizeTypeId(input: unknown): VideoOrderTypeId | "" {
  const v = typeof input === "string" ? input.trim() : "";
  if (v === "high_quality_custom_video" || v === "monthly_package" || v === "creator_review_video") return v;
  return "";
}

function normalizePhase(input: unknown): string {
  const v = typeof input === "string" ? input.trim() : "";
  const allowed = new Set([
    "created",
    "paid",
    "assigned",
    "in_progress",
    "submitted",
    "review_pending",
    "review_rejected",
    "approved_to_publish",
    "published",
    "delivered",
    "completed",
    "rejected",
  ]);
  if (!v || v.length > 50) return "";
  if (!allowed.has(v)) return "";
  return v;
}

async function ensureTypeVisibleToAdmin(typeId: VideoOrderTypeId): Promise<boolean> {
  const cfg = await readCooperationTypesConfig();
  return isVisibleCooperationType(cfg, typeId, "admin");
}

router.get("/video-orders", async (req: AuthRequest, res: Response) => {
  const type = normalizeTypeId(req.query?.type);
  const phase = normalizePhase(req.query?.phase);
  const q = String(req.query?.q || "").trim();
  const limitRaw = Number(req.query?.limit || 200);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 500) : 200;

  const where: string[] = ["1=1"];
  const params: any[] = [];
  let idx = 1;

  if (type) {
    where.push(`o.type_id=$${idx++}`);
    params.push(type);
  }
  if (phase) {
    where.push(`COALESCE((to_jsonb(s)->>'phase'), 'created')=$${idx++}`);
    params.push(phase);
  }
  if (q) {
    where.push(`(o.title ILIKE $${idx} OR c.username ILIKE $${idx})`);
    params.push(`%${q}%`);
    idx++;
  }

  try {
    const rows = await query(
      `SELECT o.id, o.client_id, o.type_id, o.title, o.requirements, o.amount_thb, o.payment_method, o.payment_status, o.paid_at, o.assigned_employee_id, o.created_at, o.updated_at,
              c.username AS client_username,
              e.username AS employee_username,
              COALESCE((to_jsonb(s)->>'phase'), 'created') AS phase,
              COALESCE((to_jsonb(s)->'proof_links'), '[]'::jsonb) AS proof_links,
              COALESCE((to_jsonb(s)->'publish_links'), '[]'::jsonb) AS publish_links,
              COALESCE((to_jsonb(s)->'batch_payload'), '[]'::jsonb) AS batch_payload,
              (to_jsonb(s)->>'review_note') AS review_note,
              NULLIF((to_jsonb(s)->>'reviewed_by'), '')::int AS reviewed_by,
              (to_jsonb(s)->>'reviewed_at') AS reviewed_at
         FROM video_orders o
         JOIN users c ON c.id=o.client_id
         LEFT JOIN users e ON e.id=o.assigned_employee_id
         LEFT JOIN video_order_states s ON s.order_id=o.id
        WHERE ${where.join(" AND ")}
        ORDER BY o.id DESC
        LIMIT ${limit}`,
      params
    );
    return res.json({ list: rows.rows });
  } catch (e) {
    console.error("admin list video orders error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

router.post("/video-orders/:id/review", async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const action = String(req.body?.action || "").trim();
  const note = typeof req.body?.note === "string" ? String(req.body.note).trim() : "";
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "INVALID_ID", message: "无效订单ID。" });
  if (action !== "approve" && action !== "reject") return res.status(400).json({ error: "INVALID_ACTION", message: "无效审核动作。" });

  try {
    const ret = await withTx(async (client) => {
      await client.query(`INSERT INTO video_order_states (order_id) VALUES ($1) ON CONFLICT (order_id) DO NOTHING`, [id]);
      const cur = await client.query<{ type_id: VideoOrderTypeId; phase: string }>(
        `SELECT o.type_id, (to_jsonb(s)->>'phase') AS phase
           FROM video_orders o
           JOIN video_order_states s ON s.order_id=o.id
          WHERE o.id=$1
          FOR UPDATE`,
        [id]
      );
      const row = cur.rows[0];
      if (!row) return { kind: "not_found" as const };
      if (!(await ensureTypeVisibleToAdmin(row.type_id))) return { kind: "not_allowed" as const };
      if (row.type_id !== "creator_review_video") return { kind: "not_supported" as const };
      if (row.phase !== "review_pending") return { kind: "not_pending" as const };

      const nextPhase = action === "approve" ? "approved_to_publish" : "review_rejected";
      await client.query(
        `UPDATE video_order_states
            SET phase=$2, review_note=$3, reviewed_by=$4, reviewed_at=now(), updated_at=now()
          WHERE order_id=$1`,
        [id, nextPhase, note || null, req.user!.userId]
      );
      await client.query(`UPDATE video_orders SET updated_at=now() WHERE id=$1`, [id]);
      return { kind: "ok" as const, nextPhase };
    });
    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    if (ret.kind === "not_allowed") return res.status(403).json({ error: "FORBIDDEN", message: "该类型当前不可管理。" });
    if (ret.kind === "not_supported") return res.status(400).json({ error: "NOT_SUPPORTED", message: "该类型不需要审核环节。" });
    if (ret.kind === "not_pending") return res.status(400).json({ error: "INVALID_STATE", message: "当前状态不可审核。" });
    return res.json({ ok: true, phase: ret.nextPhase });
  } catch (e) {
    console.error("admin review video order error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

router.get("/video-orders/settlements", async (req: AuthRequest, res: Response) => {
  const week = typeof req.query?.week === "string" ? String(req.query.week).trim() : "";
  const where: string[] = ["1=1"];
  const params: any[] = [];
  let idx = 1;
  if (week) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return res.status(400).json({ error: "INVALID_WEEK", message: "week 格式应为 YYYY-MM-DD" });
    where.push(`s.week_start = $${idx++}::date`);
    params.push(week);
  }
  try {
    const rows = await query(
      `SELECT s.id, s.order_id, s.batch_no, s.week_start::text AS week_start, s.amount_thb, s.status, s.paid_at,
              o.type_id, o.title,
              c.username AS client_username,
              e.username AS employee_username
         FROM video_order_settlements s
         JOIN video_orders o ON o.id = s.order_id
         JOIN users c ON c.id = o.client_id
         LEFT JOIN users e ON e.id = o.assigned_employee_id
        WHERE ${where.join(" AND ")}
        ORDER BY s.week_start DESC, s.id DESC
        LIMIT 500`,
      params
    );
    return res.json({ list: rows.rows });
  } catch (e) {
    console.error("admin list video order settlements error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

router.patch("/video-orders/settlements/:id", async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const status = typeof req.body?.status === "string" ? String(req.body.status).trim() : "";
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "INVALID_ID", message: "无效ID" });
  if (status !== "paid" && status !== "pending") return res.status(400).json({ error: "INVALID_STATUS", message: "status 必须为 pending 或 paid" });
  try {
    const updated = await withTx(async (client) => {
      const cur = await client.query<{ id: number }>("SELECT id FROM video_order_settlements WHERE id=$1 FOR UPDATE", [id]);
      if (!cur.rows[0]) return { kind: "not_found" as const };
      await client.query(
        "UPDATE video_order_settlements SET status=$1, paid_at=CASE WHEN $1='paid' THEN now() ELSE paid_at END, updated_at=now() WHERE id=$2",
        [status, id]
      );
      return { kind: "ok" as const };
    });
    if (updated.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "记录不存在" });
    return res.json({ ok: true });
  } catch (e) {
    console.error("admin patch video order settlement error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

export default router;

