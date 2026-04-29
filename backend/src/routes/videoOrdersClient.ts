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

async function createMessageTx(
  client: { query: Function },
  userId: number,
  category: string,
  title: string,
  content: string,
  relatedType?: string,
  relatedId?: number
): Promise<void> {
  await client.query(
    `INSERT INTO system_messages (user_id, category, title, content, related_type, related_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, category, title, content, relatedType ?? null, relatedId ?? null]
  );
}

function toStringList(input: unknown): string[] {
  if (Array.isArray(input)) return input.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof input === "string") {
    return input
      .split(/\r?\n|,/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function formatErrorMessage(err: unknown): string {
  if (!err) return "";
  if (err instanceof Error) {
    const anyErr = err as any;
    const code = typeof anyErr.code === "string" ? anyErr.code : "";
    const detail = typeof anyErr.detail === "string" ? anyErr.detail : "";
    const constraint = typeof anyErr.constraint === "string" ? anyErr.constraint : "";
    const where = typeof anyErr.where === "string" ? anyErr.where : "";
    const parts = [err.message, code ? `code=${code}` : "", constraint ? `constraint=${constraint}` : "", detail ? `detail=${detail}` : "", where ? `where=${where}` : ""].filter(Boolean);
    return parts.join(" | ");
  }
  return String(err);
}

async function updateMonthlyStateWithFallback(
  client: { query: typeof query },
  orderId: number,
  desiredPhase: string,
  batchPayload: any[]
): Promise<void> {
  try {
    await client.query(`UPDATE video_order_states SET phase=$2, batch_payload=$3::jsonb, updated_at=now() WHERE order_id=$1`, [
      orderId,
      desiredPhase,
      JSON.stringify(batchPayload),
    ]);
  } catch (e: any) {
    const code = typeof e?.code === "string" ? e.code : "";
    if (code !== "23514") throw e;
    await client.query(`UPDATE video_order_states SET phase='delivered', batch_payload=$2::jsonb, updated_at=now() WHERE order_id=$1`, [
      orderId,
      JSON.stringify(batchPayload),
    ]);
  }
}

function normalizeMoney(input: unknown, fallback = 0): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n * 100) / 100;
}

function normalizeBatchList(input: unknown, submitterName?: string | null): any[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item: any, index) => {
      const deliveryLinks = toStringList(item?.delivery_links ?? item?.proof_links ?? item?.video_urls ?? item?.links);
      const batchNo = clampInt(Number(item?.batch_no ?? item?.batchNo ?? index + 1), 1, 999999);
      const acceptedCountRaw = Number(item?.accepted_count ?? item?.acceptedCount);
      const videoCount = clampInt(Number(item?.video_count ?? item?.videoCount ?? deliveryLinks.length), 0, 999999);
      const acceptedCount = Number.isFinite(acceptedCountRaw) ? clampInt(acceptedCountRaw, 0, Math.max(videoCount, 0)) : 0;
      return {
        batch_id: item?.batch_id ?? item?.id ?? batchNo,
        batch_no: batchNo,
        status: typeof item?.status === "string" && item.status ? item.status : "pending_acceptance",
        video_count: videoCount,
        accepted_count: acceptedCount,
        settled_amount: normalizeMoney(item?.settled_amount ?? item?.settlement_amount, 0),
        delivery_links: deliveryLinks,
        proof_links: deliveryLinks,
        submitted_at: typeof item?.submitted_at === "string" ? item.submitted_at : null,
        accepted_at: typeof item?.accepted_at === "string" ? item.accepted_at : null,
        settled_at: typeof item?.settled_at === "string" ? item.settled_at : null,
        accept_note:
          typeof item?.accept_note === "string"
            ? item.accept_note
            : typeof item?.remark === "string"
              ? item.remark
              : null,
        remark:
          typeof item?.remark === "string"
            ? item.remark
            : typeof item?.accept_note === "string"
              ? item.accept_note
              : null,
        submitter_name:
          typeof item?.submitter_name === "string"
            ? item.submitter_name
            : typeof item?.employee_username === "string"
              ? item.employee_username
              : submitterName || null,
      };
    })
    .sort((a, b) => Number(a.batch_no || 0) - Number(b.batch_no || 0));
}

function findBatchIndex(list: any[], batchToken: string): number {
  return list.findIndex((item) => String(item?.batch_id ?? item?.id ?? "") === batchToken || String(item?.batch_no ?? "") === batchToken);
}

function computeBatchSettledAmount(order: { unit_price_thb?: unknown; amount_thb?: unknown }, acceptedCount: number, batch: any): number {
  const unitPrice = normalizeMoney(order.unit_price_thb, 0);
  if (unitPrice > 0 && acceptedCount > 0) return Math.round(unitPrice * acceptedCount * 100) / 100;
  const unitCount = clampInt(Number((order as any)?.unit_count), 0, 999999);
  const orderAmount = normalizeMoney(order.amount_thb, 0);
  if (orderAmount > 0 && unitCount > 0 && acceptedCount > 0) {
    const perUnit = orderAmount / unitCount;
    if (Number.isFinite(perUnit) && perUnit > 0) return Math.round(perUnit * acceptedCount * 100) / 100;
  }
  const existing = normalizeMoney(batch?.settled_amount ?? batch?.settlement_amount, 0);
  if (existing > 0) return existing;
  return orderAmount > 0 ? orderAmount : 0;
}

function computeOrderPhaseFromBatches(list: any[]): string {
  if (!list.length) return "delivered";
  if (list.some((item) => String(item?.status || "") === "rejected")) return "in_progress";
  const allSettled = list.every((item) => String(item?.status || "") === "settled");
  if (allSettled) return "settled";
  const allAccepted = list.every((item) => {
    const status = String(item?.status || "");
    return status === "accepted" || status === "settled";
  });
  return allAccepted ? "accepted" : "delivered";
}

async function loadClientOwnedOrder(
  client: { query: typeof query },
  orderId: number,
  clientId: number,
  forUpdate = false
): Promise<any | null> {
  const lockSql = forUpdate ? " FOR UPDATE" : "";
  const rows = await client.query(
    `SELECT o.id, o.client_id, o.type_id, o.title, o.amount_thb, o.unit_price_thb, o.unit_count, o.payment_status, o.assigned_employee_id,
            COALESCE((to_jsonb(s)->>'phase'), 'created') AS phase,
            COALESCE((to_jsonb(s)->'proof_links'), '[]'::jsonb) AS proof_links,
            COALESCE((to_jsonb(s)->'publish_links'), '[]'::jsonb) AS publish_links,
            COALESCE((to_jsonb(s)->'batch_payload'), '[]'::jsonb) AS batch_payload,
            e.username AS employee_username
       FROM video_orders o
       LEFT JOIN video_order_states s ON s.order_id=o.id
       LEFT JOIN users e ON e.id=o.assigned_employee_id
      WHERE o.id=$1 AND o.client_id=$2${lockSql}`,
    [orderId, clientId]
  );
  return rows.rows[0] || null;
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
              COALESCE((to_jsonb(s)->>'phase'), 'created') AS phase,
              COALESCE((to_jsonb(s)->'proof_links'), '[]'::jsonb) AS proof_links,
              COALESCE((to_jsonb(s)->'publish_links'), '[]'::jsonb) AS publish_links,
              COALESCE((to_jsonb(s)->'batch_payload'), '[]'::jsonb) AS batch_payload,
              (to_jsonb(s)->>'review_note') AS review_note,
              NULLIF((to_jsonb(s)->>'reviewed_by'), '')::int AS reviewed_by,
              (to_jsonb(s)->>'reviewed_at') AS reviewed_at
         FROM video_orders o
         LEFT JOIN video_order_states s ON s.order_id=o.id
        WHERE o.client_id=$1
        ORDER BY o.id DESC`,
      [req.user!.userId]
    );
    return res.json({ list: rows.rows });
  } catch (e) {
    console.error("client list video orders error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: `服务器内部错误：${formatErrorMessage(e)}` });
  }
});

router.get("/video-orders/:id", async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "INVALID_ID", message: "无效订单ID。" });
  try {
    const rows = await query(
      `SELECT o.id, o.client_id, o.type_id, o.title, o.requirements, o.amount_thb, o.payment_method, o.payment_status, o.paid_at, o.assigned_employee_id, o.created_at, o.updated_at,
              COALESCE((to_jsonb(s)->>'phase'), 'created') AS phase,
              COALESCE((to_jsonb(s)->'proof_links'), '[]'::jsonb) AS proof_links,
              COALESCE((to_jsonb(s)->'publish_links'), '[]'::jsonb) AS publish_links,
              COALESCE((to_jsonb(s)->'batch_payload'), '[]'::jsonb) AS batch_payload,
              (to_jsonb(s)->>'review_note') AS review_note,
              NULLIF((to_jsonb(s)->>'reviewed_by'), '')::int AS reviewed_by,
              (to_jsonb(s)->>'reviewed_at') AS reviewed_at
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
  const req = _req;
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "INVALID_ID", message: "无效订单ID。" });
  try {
    const ret = await withTx(async (client) => {
      await client.query(`INSERT INTO video_order_states (order_id) VALUES ($1) ON CONFLICT (order_id) DO NOTHING`, [id]);
      const row = await loadClientOwnedOrder(client, id, req.user!.userId, true);
      if (!row) return { kind: "not_found" as const };
      if (row.type_id === "monthly_package") return { kind: "use_batch_acceptance" as const };
      if (row.payment_status !== "paid") return { kind: "not_paid" as const };
      const proofLinks = toStringList(row.proof_links);
      const publishLinks = toStringList(row.publish_links);
      if (!proofLinks.length && !publishLinks.length) return { kind: "no_delivery" as const };
      await client.query(`UPDATE video_order_states SET phase='accepted', updated_at=now() WHERE order_id=$1`, [id]);
      await client.query(`UPDATE video_orders SET updated_at=now() WHERE id=$1`, [id]);
      if (Number(row.assigned_employee_id) > 0) {
        await createMessageTx(
          client,
          Number(row.assigned_employee_id),
          "video_order_accepted",
          "订单已验收",
          `视频订单 #${id}${row.title ? `（${row.title}）` : ""} 已被商家验收。`,
          "video_order",
          id
        );
      }
      return { kind: "ok" as const };
    });
    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    if (ret.kind === "use_batch_acceptance") return res.status(409).json({ error: "USE_BATCH_ACCEPTANCE", message: "包月订单请按批次验收。" });
    if (ret.kind === "not_paid") return res.status(409).json({ error: "ORDER_NOT_PAID", message: "订单尚未确认付款，暂不可验收。" });
    if (ret.kind === "no_delivery") return res.status(409).json({ error: "NO_DELIVERY", message: "当前订单暂无可验收的交付链接。" });
    return res.json({ ok: true });
  } catch (e) {
    console.error("client accept video order error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: `服务器内部错误：${formatErrorMessage(e)}` });
  }
});

router.post("/video-orders/:id/reject", async (_req: AuthRequest, res: Response) => {
  const req = _req;
  const id = Number(req.params.id);
  const note = typeof req.body?.note === "string" ? String(req.body.note).trim() : "";
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "INVALID_ID", message: "无效订单ID。" });
  try {
    const ret = await withTx(async (client) => {
      await client.query(`INSERT INTO video_order_states (order_id) VALUES ($1) ON CONFLICT (order_id) DO NOTHING`, [id]);
      const row = await loadClientOwnedOrder(client, id, req.user!.userId, true);
      if (!row) return { kind: "not_found" as const };
      if (row.type_id === "monthly_package") return { kind: "use_batch_reject" as const };
      if (row.payment_status !== "paid") return { kind: "not_paid" as const };
      const proofLinks = toStringList(row.proof_links);
      const publishLinks = toStringList(row.publish_links);
      if (!proofLinks.length && !publishLinks.length) return { kind: "no_delivery" as const };
      await client.query(
        `UPDATE video_order_states
            SET phase='in_progress', review_note=$2, reviewed_by=$3, reviewed_at=now(), updated_at=now()
          WHERE order_id=$1`,
        [id, note || null, req.user!.userId]
      );
      await client.query(`UPDATE video_orders SET updated_at=now() WHERE id=$1`, [id]);
      if (Number(row.assigned_employee_id) > 0) {
        await createMessageTx(
          client,
          Number(row.assigned_employee_id),
          "video_order_rejected",
          "订单需修改",
          `视频订单 #${id}${row.title ? `（${row.title}）` : ""} 被商家退回修改${note ? `：${note}` : "。"}`,
          "video_order",
          id
        );
      }
      return { kind: "ok" as const };
    });
    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    if (ret.kind === "use_batch_reject") return res.status(409).json({ error: "USE_BATCH_REJECT", message: "包月订单请按批次退回修改。" });
    if (ret.kind === "not_paid") return res.status(409).json({ error: "ORDER_NOT_PAID", message: "订单尚未确认付款，暂不可退回修改。" });
    if (ret.kind === "no_delivery") return res.status(409).json({ error: "NO_DELIVERY", message: "当前订单暂无可退回的交付内容。" });
    return res.json({ ok: true });
  } catch (e) {
    console.error("client reject video order error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: `服务器内部错误：${formatErrorMessage(e)}` });
  }
});




/** 商家查看包月订单批次记录。 */
router.get("/video-orders/:id/batches", async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "INVALID_ID", message: "无效订单ID。" });
  try {
    const row = await loadClientOwnedOrder({ query }, id, req.user!.userId);
    if (!row) return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    const list = normalizeBatchList(row.batch_payload, row.employee_username);
    return res.json({ list });
  } catch (e) {
    console.error("client list monthly batches error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: `服务器内部错误：${formatErrorMessage(e)}` });
  }
});

/** 商家确认包月订单某批次验收。 */
router.post("/video-orders/:id/monthly-batches/:batchNo/accept", async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const batchToken = String(req.params.batchNo || "").trim();
  const remark = typeof req.body?.remark === "string" ? String(req.body.remark).trim() : typeof req.body?.note === "string" ? String(req.body.note).trim() : "";
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "INVALID_ID", message: "无效订单ID。" });
  if (!batchToken) return res.status(400).json({ error: "INVALID_BATCH", message: "无效批次号。" });
  try {
    const ret = await withTx(async (client) => {
      await client.query(`INSERT INTO video_order_states (order_id) VALUES ($1) ON CONFLICT (order_id) DO NOTHING`, [id]);
      const row = await loadClientOwnedOrder(client, id, req.user!.userId, true);
      if (!row) return { kind: "not_found" as const };
      if (row.type_id !== "monthly_package") return { kind: "not_supported" as const };
      if (row.payment_status !== "paid") return { kind: "not_paid" as const };
      const list = normalizeBatchList(row.batch_payload, row.employee_username);
      const idx = findBatchIndex(list, batchToken);
      if (idx < 0) return { kind: "batch_not_found" as const };

      const current = list[idx];
      if (!current.delivery_links?.length) return { kind: "no_delivery" as const };
      if (String(current.status || "") === "settled") return { kind: "already_settled" as const, batch: current };

      const rawAccepted = Number(req.body?.accepted_count ?? current.accepted_count ?? current.video_count);
      const acceptedCount = clampInt(rawAccepted || current.video_count || 0, 1, Math.max(Number(current.video_count || 0), 1));
      const nowIso = new Date().toISOString();
      const nextBatch = {
        ...current,
        status: "accepted",
        accepted_count: acceptedCount,
        accepted_at: nowIso,
        settled_amount: computeBatchSettledAmount(row, acceptedCount, current),
        accept_note: remark || current.accept_note || null,
        remark: remark || current.remark || null,
        submitter_name: current.submitter_name || row.employee_username || null,
      };
      list[idx] = nextBatch;
      await updateMonthlyStateWithFallback(client, id, computeOrderPhaseFromBatches(list), list);
      await client.query(`UPDATE video_orders SET updated_at=now() WHERE id=$1`, [id]);
      if (Number(row.assigned_employee_id) > 0) {
        await createMessageTx(
          client,
          Number(row.assigned_employee_id),
          "video_order_batch_accepted",
          "批次已验收",
          `视频订单 #${id}${row.title ? `（${row.title}）` : ""} 第 ${Number(current.batch_no || batchToken)} 批已验收，验收数量：${acceptedCount}。`,
          "video_order",
          id
        );
      }
      return { kind: "ok" as const, batch: nextBatch };
    });
    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    if (ret.kind === "not_supported") return res.status(409).json({ error: "NOT_SUPPORTED", message: "当前订单类型不支持批次验收。" });
    if (ret.kind === "not_paid") return res.status(409).json({ error: "ORDER_NOT_PAID", message: "订单尚未确认付款，暂不可验收。" });
    if (ret.kind === "batch_not_found") return res.status(404).json({ error: "BATCH_NOT_FOUND", message: "批次不存在。" });
    if (ret.kind === "no_delivery") return res.status(409).json({ error: "NO_DELIVERY", message: "该批次暂无交付链接，暂不可验收。" });
    if (ret.kind === "already_settled") return res.status(409).json({ error: "ALREADY_SETTLED", message: "该批次已结算，无需重复验收。" });
    return res.json({ ok: true, batch: ret.batch });
  } catch (e) {
    console.error("client accept monthly batch error:", e);
    return res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: `服务器内部错误：${formatErrorMessage(e)}`,
    });
  }
});

/** 商家将包月订单某批次退回修改。 */
router.post("/video-orders/:id/monthly-batches/:batchNo/reject", async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const batchToken = String(req.params.batchNo || "").trim();
  const note = typeof req.body?.remark === "string" ? String(req.body.remark).trim() : typeof req.body?.note === "string" ? String(req.body.note).trim() : "";
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "INVALID_ID", message: "无效订单ID。" });
  if (!batchToken) return res.status(400).json({ error: "INVALID_BATCH", message: "无效批次号。" });
  try {
    const ret = await withTx(async (client) => {
      await client.query(`INSERT INTO video_order_states (order_id) VALUES ($1) ON CONFLICT (order_id) DO NOTHING`, [id]);
      const row = await loadClientOwnedOrder(client, id, req.user!.userId, true);
      if (!row) return { kind: "not_found" as const };
      if (row.type_id !== "monthly_package") return { kind: "not_supported" as const };
      if (row.payment_status !== "paid") return { kind: "not_paid" as const };
      const list = normalizeBatchList(row.batch_payload, row.employee_username);
      const idx = findBatchIndex(list, batchToken);
      if (idx < 0) return { kind: "batch_not_found" as const };

      const current = list[idx];
      if (!current.delivery_links?.length) return { kind: "no_delivery" as const };
      if (String(current.status || "") === "settled") return { kind: "already_settled" as const };

      const nextBatch = {
        ...current,
        status: "rejected",
        accepted_count: 0,
        accepted_at: null,
        settled_amount: 0,
        settled_at: null,
        accept_note: note || current.accept_note || null,
        remark: note || current.remark || null,
        submitter_name: current.submitter_name || row.employee_username || null,
      };
      list[idx] = nextBatch;
      await updateMonthlyStateWithFallback(client, id, computeOrderPhaseFromBatches(list), list);
      await client.query(`UPDATE video_orders SET updated_at=now() WHERE id=$1`, [id]);
      if (Number(row.assigned_employee_id) > 0) {
        await createMessageTx(
          client,
          Number(row.assigned_employee_id),
          "video_order_batch_rejected",
          "批次需修改",
          `视频订单 #${id}${row.title ? `（${row.title}）` : ""} 第 ${Number(current.batch_no || batchToken)} 批被退回修改${note ? `：${note}` : "。"}`,
          "video_order",
          id
        );
      }
      return { kind: "ok" as const, batch: nextBatch };
    });
    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    if (ret.kind === "not_supported") return res.status(409).json({ error: "NOT_SUPPORTED", message: "当前订单类型不支持批次退回修改。" });
    if (ret.kind === "not_paid") return res.status(409).json({ error: "ORDER_NOT_PAID", message: "订单尚未确认付款，暂不可退回修改。" });
    if (ret.kind === "batch_not_found") return res.status(404).json({ error: "BATCH_NOT_FOUND", message: "批次不存在。" });
    if (ret.kind === "no_delivery") return res.status(409).json({ error: "NO_DELIVERY", message: "该批次暂无交付内容，暂不可退回修改。" });
    if (ret.kind === "already_settled") return res.status(409).json({ error: "ALREADY_SETTLED", message: "该批次已结算，不能再退回修改。" });
    return res.json({ ok: true, batch: ret.batch });
  } catch (e) {
    console.error("client reject monthly batch error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

/** 商家将包月订单某批次标记为已结算。 */
router.post("/video-orders/:id/monthly-batches/:batchNo/settle", async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const batchToken = String(req.params.batchNo || "").trim();
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "INVALID_ID", message: "无效订单ID。" });
  if (!batchToken) return res.status(400).json({ error: "INVALID_BATCH", message: "无效批次号。" });
  try {
    const ret = await withTx(async (client) => {
      await client.query(`INSERT INTO video_order_states (order_id) VALUES ($1) ON CONFLICT (order_id) DO NOTHING`, [id]);
      const row = await loadClientOwnedOrder(client, id, req.user!.userId, true);
      if (!row) return { kind: "not_found" as const };
      if (row.type_id !== "monthly_package") return { kind: "not_supported" as const };
      const list = normalizeBatchList(row.batch_payload, row.employee_username);
      const idx = findBatchIndex(list, batchToken);
      if (idx < 0) return { kind: "batch_not_found" as const };
      const current = list[idx];
      const status = String(current.status || "");
      if (status !== "accepted" && status !== "settled") return { kind: "not_accepted" as const };

      const rawSettledAmount = Number(req.body?.settled_amount);
      const settledAmount =
        Number.isFinite(rawSettledAmount) && rawSettledAmount > 0
          ? Math.round(rawSettledAmount * 100) / 100
          : computeBatchSettledAmount(row, Number(current.accepted_count || current.video_count || 0), current);
      const nowIso = new Date().toISOString();
      const nextBatch = {
        ...current,
        status: "settled",
        settled_amount: settledAmount,
        settled_at: nowIso,
      };
      list[idx] = nextBatch;

      const weekStart = weekStartMondayUtcFromIso(String(current.accepted_at || current.submitted_at || nowIso));
      await client.query(
        `INSERT INTO video_order_settlements (order_id, batch_no, week_start, amount_thb, status, paid_at, updated_at)
         VALUES ($1, $2, $3, $4, 'pending', NULL, now())
         ON CONFLICT (order_id, batch_no)
         DO UPDATE SET week_start=EXCLUDED.week_start, amount_thb=EXCLUDED.amount_thb, updated_at=now()`,
        [id, Number(current.batch_no || 0), weekStart, settledAmount]
      );
      await updateMonthlyStateWithFallback(client, id, computeOrderPhaseFromBatches(list), list);
      await client.query(`UPDATE video_orders SET updated_at=now() WHERE id=$1`, [id]);
      if (Number(row.assigned_employee_id) > 0) {
        await createMessageTx(
          client,
          Number(row.assigned_employee_id),
          "video_order_batch_settled",
          "批次已结算",
          `视频订单 #${id}${row.title ? `（${row.title}）` : ""} 第 ${Number(current.batch_no || batchToken)} 批已结算，结算金额：${settledAmount} THB。`,
          "video_order",
          id
        );
      }
      return { kind: "ok" as const, batch: nextBatch };
    });
    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    if (ret.kind === "not_supported") return res.status(409).json({ error: "NOT_SUPPORTED", message: "当前订单类型不支持批次结算。" });
    if (ret.kind === "batch_not_found") return res.status(404).json({ error: "BATCH_NOT_FOUND", message: "批次不存在。" });
    if (ret.kind === "not_accepted") return res.status(409).json({ error: "BATCH_NOT_ACCEPTED", message: "请先验收该批次，再执行结算。" });
    return res.json({ ok: true, batch: ret.batch });
  } catch (e) {
    console.error("client settle monthly batch error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

export default router;

