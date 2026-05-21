import { Router, Response } from "express";

import { ensureVideoOrdersSchemaReady, query, withTx } from "../db";

import { requireAuth, requireRole, type AuthRequest } from "../auth";
import { readCooperationTypesConfig, isVisibleCooperationType, type CooperationTypeId } from "../cooperationTypes";

import { createMessageTx } from "../systemMessages";

import { getUserFriendlyError } from "../userFriendlyError";



const router = Router();

router.use(requireAuth);
router.use(requireRole("employee"));
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

function normalizeUrls(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return (input as unknown[]).map((x) => String(x || "").trim()).filter(Boolean).slice(0, 20);
}

async function ensureTypeVisibleToEmployee(typeId: VideoOrderTypeId): Promise<boolean> {
  const cfg = await readCooperationTypesConfig();
  return isVisibleCooperationType(cfg, typeId, "employee");
}

router.get("/video-orders", async (req: AuthRequest, res: Response) => {
  const type = normalizeTypeId(req.query?.type);
  const phase = normalizePhase(req.query?.phase);
  const q = String(req.query?.q || "").trim();
  const limitRaw = Number(req.query?.limit || 200);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 500) : 200;

  const cfg = await readCooperationTypesConfig();
  const visibleTypes = cfg.types
    .filter((t) => t.id !== "graded_video" && Array.isArray(t.visible_roles) && t.visible_roles.includes("employee"))
    .map((t) => t.id) as VideoOrderTypeId[];
  if (!visibleTypes.length) return res.json({ list: [] });
  if (type && !visibleTypes.includes(type)) return res.json({ list: [] });

  const where: string[] = ["o.type_id = ANY($1::text[])"];
  const params: any[] = [visibleTypes];
  let idx = 2;

  if (type) {
    where.push(`o.type_id=$${idx++}`);
    params.push(type);
  }
  if (phase) {
    where.push(`COALESCE((to_jsonb(s)->>'phase'), 'created')=$${idx++}`);
    params.push(phase);
  }
  if (q) {
    where.push(`(o.title ILIKE $${idx})`);
    params.push(`%${q}%`);
    idx++;
  }

  try {
    const rows = await query(
      `SELECT o.id, o.client_id, o.type_id, o.title, o.requirements, o.amount_thb, o.payment_method, o.payment_status, o.paid_at, o.assigned_employee_id, o.created_at, o.updated_at,
              c.username AS client_username,
              ue.username AS employee_username,
              COALESCE((to_jsonb(s)->>'phase'), 'created') AS phase,
              COALESCE((to_jsonb(s)->'proof_links'), '[]'::jsonb) AS proof_links,
              COALESCE((to_jsonb(s)->'publish_links'), '[]'::jsonb) AS publish_links,
              COALESCE((to_jsonb(s)->'batch_payload'), '[]'::jsonb) AS batch_payload,
              (to_jsonb(s)->>'review_note') AS review_note,
              NULLIF((to_jsonb(s)->>'reviewed_by'), '')::int AS reviewed_by,
              (to_jsonb(s)->>'reviewed_at') AS reviewed_at
         FROM video_orders o
         JOIN users c ON c.id=o.client_id
         LEFT JOIN users ue ON ue.id=o.assigned_employee_id
         LEFT JOIN video_order_states s ON s.order_id=o.id
        WHERE ${where.join(" AND ")}
        ORDER BY o.id DESC
        LIMIT ${limit}`,
      params
    );
    return res.json({ list: rows.rows });
  } catch (e) {
    console.error("employee list video orders error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });
  }
});

router.post("/video-orders/:id/claim", async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "INVALID_ID", message: "无效订单ID。" });

  try {
    const ret = await withTx(async (client) => {
      const cur = await client.query<{ type_id: VideoOrderTypeId; payment_status: string; assigned_employee_id: number | null; client_id: number; title: string | null }>(
        `SELECT type_id, payment_status, assigned_employee_id, client_id, title
           FROM video_orders
          WHERE id=$1
          FOR UPDATE`,
        [id]
      );
      const row = cur.rows[0];
      if (!row) return { kind: "not_found" as const };
      if (!(await ensureTypeVisibleToEmployee(row.type_id))) return { kind: "not_allowed" as const };
      if (row.assigned_employee_id && row.assigned_employee_id !== req.user!.userId) return { kind: "already_claimed" as const };
      await client.query(`UPDATE video_orders SET assigned_employee_id=$2, updated_at=now() WHERE id=$1`, [id, req.user!.userId]);
      await client.query(`INSERT INTO video_order_states (order_id) VALUES ($1) ON CONFLICT (order_id) DO NOTHING`, [id]);
      /**
       * 2/3/4 类型订单：
       * - 未付款：接单后保持 assigned，等待员工手动标记付款
       * - 已付款：直接进入制作中 in_progress
       */
      const nextPhase = row.payment_status === "paid" ? "in_progress" : "assigned";
      await client.query(`UPDATE video_order_states SET phase=$2, updated_at=now() WHERE order_id=$1`, [id, nextPhase]);
      await createMessageTx(
        client,
        row.client_id,
        "video_order_claim",
        "订单已接单",
        `视频订单 #${id}${row.title ? `（${row.title}）` : ""} 已接单，当前进度：${nextPhase}。`,
        "video_order",
        id
      );
      return { kind: "ok" as const };
    });
    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    if (ret.kind === "not_allowed") return res.status(403).json({ error: "FORBIDDEN", message: "该类型当前不可处理。" });
    if (ret.kind === "already_claimed") return res.status(409).json({ error: "ALREADY_CLAIMED", message: "订单已被其他员工接单。" });
    return res.json({ ok: true });
  } catch (e) {
    console.error("employee claim video order error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });
  }
});

/** 员工手动标记付款：仅 2/3/4 类订单可用，成功后进入制作中。 */
router.post("/video-orders/:id/mark-paid", async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "INVALID_ID", message: "无效订单ID。" });
  try {
    const ret = await withTx(async (client) => {
      const cur = await client.query<{ payment_status: string; assigned_employee_id: number | null; amount_thb: unknown; client_id: number; title: string | null }>(
        `SELECT payment_status, assigned_employee_id, amount_thb, client_id, title
           FROM video_orders
          WHERE id=$1
          FOR UPDATE`,
        [id]
      );
      const row = cur.rows[0];
      if (!row) return { kind: "not_found" as const };
      if (row.assigned_employee_id && row.assigned_employee_id !== req.user!.userId) return { kind: "not_assigned" as const };
      const amount = Number(row.amount_thb);
      if (!Number.isFinite(amount) || amount < 0) return { kind: "invalid_amount" as const };

      await client.query(`UPDATE video_orders SET assigned_employee_id=$2, payment_status='paid', paid_at=now(), updated_at=now() WHERE id=$1`, [id, req.user!.userId]);
      await client.query(`INSERT INTO video_order_states (order_id) VALUES ($1) ON CONFLICT (order_id) DO NOTHING`, [id]);
      await client.query(`UPDATE video_order_states SET phase='in_progress', updated_at=now() WHERE order_id=$1`, [id]);
      await createMessageTx(
        client,
        row.client_id,
        "video_order_paid",
        "订单已确认付款",
        `视频订单 #${id}${row.title ? `（${row.title}）` : ""} 已确认线下付款，开始制作中。`,
        "video_order",
        id
      );
      return { kind: "ok" as const };
    });
    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    if (ret.kind === "not_assigned") return res.status(403).json({ error: "NOT_ASSIGNED", message: "该订单已由其他员工接单。" });
    if (ret.kind === "invalid_amount") return res.status(400).json({ error: "INVALID_AMOUNT", message: "订单金额异常，无法标记付款。" });
    return res.json({ ok: true });
  } catch (e) {
    console.error("employee mark paid error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });
  }
});

router.patch("/video-orders/:id/phase", async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const phase = normalizePhase(req.body?.phase);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "INVALID_ID", message: "无效订单ID。" });
  if (!phase) return res.status(400).json({ error: "INVALID_PHASE", message: "无效流程状态。" });

  try {
    const ret = await withTx(async (client) => {
      const cur = await client.query<{ type_id: VideoOrderTypeId; payment_status: string; assigned_employee_id: number | null }>(
        `SELECT type_id, payment_status, assigned_employee_id
           FROM video_orders
          WHERE id=$1
          FOR UPDATE`,
        [id]
      );
      const row = cur.rows[0];
      if (!row) return { kind: "not_found" as const };
      if (row.payment_status !== "paid") return { kind: "not_paid" as const };
      if (!(await ensureTypeVisibleToEmployee(row.type_id))) return { kind: "not_allowed" as const };
      if (!row.assigned_employee_id || row.assigned_employee_id !== req.user!.userId) return { kind: "not_assigned" as const };
      await client.query(`INSERT INTO video_order_states (order_id) VALUES ($1) ON CONFLICT (order_id) DO NOTHING`, [id]);
      await client.query(`UPDATE video_order_states SET phase=$2, updated_at=now() WHERE order_id=$1`, [id, phase]);
      await client.query(`UPDATE video_orders SET updated_at=now() WHERE id=$1`, [id]);
      return { kind: "ok" as const };
    });
    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    if (ret.kind === "not_paid") return res.status(400).json({ error: "PAYMENT_REQUIRED", message: "订单未完成线下付款。" });
    if (ret.kind === "not_allowed") return res.status(403).json({ error: "FORBIDDEN", message: "该类型当前不可处理。" });
    if (ret.kind === "not_assigned") return res.status(403).json({ error: "NOT_ASSIGNED", message: "请先接单后再更新流程。" });
    return res.json({ ok: true });
  } catch (e) {
    console.error("employee set phase error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });
  }
});

router.post("/video-orders/:id/submit-proof", async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const videoUrls = normalizeUrls(req.body?.video_urls);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "INVALID_ID", message: "无效订单ID。" });
  if (!videoUrls.length) return res.status(400).json({ error: "INVALID_INPUT", message: "请提交交付链接。" });

  try {
    const ret = await withTx(async (client) => {
      const cur = await client.query<{ type_id: VideoOrderTypeId; payment_status: string; assigned_employee_id: number | null; client_id: number; title: string | null }>(
        `SELECT type_id, payment_status, assigned_employee_id, client_id, title
           FROM video_orders
          WHERE id=$1
          FOR UPDATE`,
        [id]
      );
      const row = cur.rows[0];
      if (!row) return { kind: "not_found" as const };
      if (row.payment_status !== "paid") return { kind: "not_paid" as const };
      if (!(await ensureTypeVisibleToEmployee(row.type_id))) return { kind: "not_allowed" as const };
      if (!row.assigned_employee_id || row.assigned_employee_id !== req.user!.userId) return { kind: "not_assigned" as const };

      const nextPhase = row.type_id === "creator_review_video" ? "review_pending" : "delivered";
      await client.query(`INSERT INTO video_order_states (order_id) VALUES ($1) ON CONFLICT (order_id) DO NOTHING`, [id]);
      await client.query(
        `UPDATE video_order_states
            SET phase=$2, proof_links=$3::jsonb, updated_at=now()
          WHERE order_id=$1`,
        [id, nextPhase, JSON.stringify(videoUrls)]
      );
      await client.query(`UPDATE video_orders SET updated_at=now() WHERE id=$1`, [id]);
      await createMessageTx(
        client,
        row.client_id,
        "video_order_proof_submitted",
        "已提交交付链接",
        `视频订单 #${id}${row.title ? `（${row.title}）` : ""} 已提交交付链接，当前进度：${nextPhase}。`,
        "video_order",
        id
      );
      return { kind: "ok" as const, nextPhase };
    });
    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    if (ret.kind === "not_paid") return res.status(400).json({ error: "PAYMENT_REQUIRED", message: "订单未完成线下付款。" });
    if (ret.kind === "not_allowed") return res.status(403).json({ error: "FORBIDDEN", message: "该类型当前不可处理。" });
    if (ret.kind === "not_assigned") return res.status(403).json({ error: "NOT_ASSIGNED", message: "请先接单后再提交交付。" });
    return res.json({ ok: true });
  } catch (e) {
    console.error("employee submit proof error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });
  }
});

router.post("/video-orders/:id/publish", async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const publishLink = String(req.body?.publish_link || "").trim();
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "INVALID_ID", message: "无效订单ID。" });
  if (!publishLink) return res.status(400).json({ error: "INVALID_INPUT", message: "请填写发布链接。" });

  try {
    const ret = await withTx(async (client) => {
      await client.query(`INSERT INTO video_order_states (order_id) VALUES ($1) ON CONFLICT (order_id) DO NOTHING`, [id]);
      const cur = await client.query<{ type_id: VideoOrderTypeId; payment_status: string; assigned_employee_id: number | null; phase: string; publish_links: any; client_id: number; title: string | null }>(
        `SELECT o.type_id,
                o.payment_status,
                o.assigned_employee_id,
                o.client_id,
                o.title,
                (to_jsonb(s)->>'phase') AS phase,
                (to_jsonb(s)->'publish_links') AS publish_links
           FROM video_orders o
           JOIN video_order_states s ON s.order_id=o.id
          WHERE o.id=$1
          FOR UPDATE`,
        [id]
      );
      const row = cur.rows[0];
      if (!row) return { kind: "not_found" as const };
      if (row.payment_status !== "paid") return { kind: "not_paid" as const };
      if (row.type_id !== "creator_review_video") return { kind: "not_supported" as const };
      if (!row.assigned_employee_id || row.assigned_employee_id !== req.user!.userId) return { kind: "not_assigned" as const };
      if (row.phase !== "approved_to_publish") return { kind: "not_approved" as const };

      const list = Array.isArray(row.publish_links) ? row.publish_links : [];
      list.push({ url: publishLink, by: req.user!.userId, at: new Date().toISOString() });
      await client.query(
        `UPDATE video_order_states SET phase='published', publish_links=$2::jsonb, updated_at=now() WHERE order_id=$1`,
        [id, JSON.stringify(list)]
      );
      await client.query(`UPDATE video_orders SET updated_at=now() WHERE id=$1`, [id]);
      await createMessageTx(
        client,
        row.client_id,
        "video_order_published",
        "订单已发布",
        `视频订单 #${id}${row.title ? `（${row.title}）` : ""} 已完成发布链接提交。`,
        "video_order",
        id
      );
      return { kind: "ok" as const };
    });
    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    if (ret.kind === "not_paid") return res.status(400).json({ error: "PAYMENT_REQUIRED", message: "订单未完成线下付款。" });
    if (ret.kind === "not_supported") return res.status(400).json({ error: "NOT_SUPPORTED", message: "该类型不需要发布环节。" });
    if (ret.kind === "not_assigned") return res.status(403).json({ error: "NOT_ASSIGNED", message: "请先接单后再提交发布。" });
    if (ret.kind === "not_approved") return res.status(400).json({ error: "REVIEW_REQUIRED", message: "该订单需先审核通过后再发布。" });
    return res.json({ ok: true });
  } catch (e) {
    console.error("employee publish error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });
  }
});



/** 员工提交包月订单批次交付。 */
router.post("/video-orders/:id/monthly-batches/submit", async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const batchNo = Number(req.body?.batch_no || 0);
  const videoCount = Number(req.body?.video_count || 0);
  const videoUrls = normalizeUrls(req.body?.video_urls);
  if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(batchNo) || batchNo <= 0) {
    return res.status(400).json({ error: "INVALID_ID", message: "无效参数。" });
  }
  if (!Number.isFinite(videoCount) || videoCount < 1) {
    return res.status(400).json({ error: "INVALID_INPUT", message: "请输入有效视频数量。" });
  }
  if (!videoUrls.length) {
    return res.status(400).json({ error: "INVALID_INPUT", message: "请提交该批次视频链接。" });
  }

  try {
    const ret = await withTx(async (client) => {
      await client.query(`INSERT INTO video_order_states (order_id) VALUES ($1) ON CONFLICT (order_id) DO NOTHING`, [id]);
      const cur = await client.query<{ type_id: string; payment_status: string; assigned_employee_id: number | null; batch_payload: any; client_id: number; title: string | null }>(
        `SELECT o.type_id,
                o.payment_status,
                o.assigned_employee_id,
                o.client_id,
                o.title,
                (to_jsonb(s)->'batch_payload') AS batch_payload
           FROM video_orders o
           JOIN video_order_states s ON s.order_id=o.id
          WHERE o.id=$1
          FOR UPDATE`,
        [id]
      );
      const row = cur.rows[0];
      if (!row) return { kind: "not_found" as const };
      if (row.type_id !== "monthly_package") return { kind: "not_supported" as const };
      if (row.payment_status !== "paid") return { kind: "not_paid" as const };
      if (!row.assigned_employee_id || row.assigned_employee_id !== req.user!.userId) return { kind: "not_assigned" as const };

      const list = Array.isArray(row.batch_payload) ? row.batch_payload : [];
      const idx = list.findIndex((x: any) => Number(x?.batch_no) === batchNo);
      const next = {
        ...(idx >= 0 ? list[idx] : {}),
        batch_no: batchNo,
        status: "pending_acceptance",
        video_count: Math.floor(videoCount),
        proof_links: videoUrls,
        submitted_at: new Date().toISOString(),
      };
      if (idx >= 0) list[idx] = next;
      else list.push(next);
      list.sort((a: any, b: any) => Number(a?.batch_no || 0) - Number(b?.batch_no || 0));

      await client.query(`UPDATE video_order_states SET phase='delivered', batch_payload=$2::jsonb, updated_at=now() WHERE order_id=$1`, [id, JSON.stringify(list)]);
      await client.query(`UPDATE video_orders SET updated_at=now() WHERE id=$1`, [id]);
      await createMessageTx(
        client,
        row.client_id,
        "video_order_batch_submitted",
        "包月批次已提交",
        `视频订单 #${id}${row.title ? `（${row.title}）` : ""} 已提交第 ${batchNo} 批交付，共 ${Math.floor(videoCount)} 条。`,
        "video_order",
        id
      );
      return { kind: "ok" as const, batch: next };
    });
    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    if (ret.kind === "not_supported") return res.status(400).json({ error: "NOT_SUPPORTED", message: "仅包月订单支持批次提交。" });
    if (ret.kind === "not_paid") return res.status(400).json({ error: "PAYMENT_REQUIRED", message: "订单未完成线下付款。" });
    if (ret.kind === "not_assigned") return res.status(403).json({ error: "NOT_ASSIGNED", message: "请先接单后再提交批次交付。" });
    return res.json({ ok: true, batch: ret.batch });
  } catch (e) {
    console.error("employee submit monthly batch error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });
  }
});

export default router;

