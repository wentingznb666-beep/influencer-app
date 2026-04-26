import { Router, Response } from "express";

import { query, withTx } from "../db";

import { requireAuth, requireRole, type AuthRequest } from "../auth";
import { readCooperationTypesConfig, isVisibleCooperationType, type CooperationTypeId } from "../cooperationTypes";
import { ensurePointAccountLocked } from "../pointAccounts";



const router = Router();

router.use(requireAuth);
router.use(requireRole("client"));

type VideoOrderTypeId = CooperationTypeId;

function normalizeTypeId(input: unknown): VideoOrderTypeId | "" {
  const v = typeof input === "string" ? input.trim() : "";
  if (v === "graded_video" || v === "high_quality_custom_video" || v === "monthly_package" || v === "creator_review_video") return v;
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

function normalizeTier(input: unknown): "A" | "B" | "C" | "" {
  const v = typeof input === "string" ? input.trim().toUpperCase() : "";
  if (v === "A" || v === "B" || v === "C") return v;
  return "";
}

function normalizeTaskCount(input: unknown): number {
  const n = Number(input);
  if (!Number.isFinite(n)) return NaN;
  const k = Math.floor(n);
  if (k < 1 || k > 100) return NaN;
  return k;
}

function normalizePublishMethod(input: unknown): "client_self_publish" | "tap_creator_publish" | "" {
  const v = typeof input === "string" ? input.trim() : "";
  if (v === "client_self_publish" || v === "tap_creator_publish") return v;
  return "";
}

router.post("/video-orders", async (req: AuthRequest, res: Response) => {
  const typeId = normalizeTypeId(req.body?.type_id);
  const title = normalizeTitle(req.body?.title);
  const amountThb = normalizeAmountThb(req.body?.amount_thb);
  const requirements = normalizeRequirements(req.body?.requirements);

  if (!typeId) return res.status(400).json({ error: "INVALID_TYPE", message: "无效的视频订单类型。" });
  if (!title) return res.status(400).json({ error: "INVALID_TITLE", message: "请填写订单标题（1-200字）。" });

  if (!(await ensureTypeVisibleToClient(typeId))) {
    return res.status(400).json({ error: "TYPE_NOT_AVAILABLE", message: "该类型当前不可用。" });
  }

  try {
    const created = await withTx(async (client) => {
      if (typeId === "graded_video") {
        const tier = normalizeTier(requirements.tier);
        const taskCount = normalizeTaskCount(requirements.task_count);
        const publishMethod = normalizePublishMethod(requirements.publish_method);
        if (!tier) return { kind: "bad_tier" as const };
        if (!Number.isFinite(taskCount)) return { kind: "bad_task_count" as const };
        if (!publishMethod) return { kind: "bad_publish_method" as const };

        const pricing: Record<"A" | "B" | "C", number> = { A: 60, B: 40, C: 20 };
        const points = pricing[tier] * taskCount;

        const acc = await ensurePointAccountLocked(client, req.user!.userId);
        if (acc.balance < points) return { kind: "insufficient_points" as const, need: points, balance: acc.balance };

        const noteZh =
          "兼职仅负责拍摄剪辑，无TikTok账号、不发布视频，需到我方办公室拍摄；视频不露脸、不提供脚本、不支持修改。";
        const noteTh =
          "พนักงานพาร์ทไทม์รับผิดชอบเฉพาะถ่ายทำ/ตัดต่อ ไม่มีบัญชี TikTok และไม่โพสต์ ต้องมาถ่ายที่ออฟฟิศของเรา; ไม่โชว์หน้า ไม่ทำสคริปต์ และไม่รับแก้ไข";

        const mergedReq = {
          ...requirements,
          tier,
          task_count: taskCount,
          publish_method: publishMethod,
          auto_note_zh: noteZh,
          auto_note_th: noteTh,
          points_per_video: pricing[tier],
          points_total: points,
        };

        const ins = await client.query<{ id: number }>(
          `INSERT INTO video_orders (client_id, type_id, title, requirements, amount_thb, payment_method, payment_status, paid_at)
           VALUES ($1, 'graded_video', $2, $3::jsonb, $4, 'points', 'paid', now())
           RETURNING id`,
          [req.user!.userId, title, JSON.stringify(mergedReq), points]
        );
        const row = ins.rows[0];
        if (!row) return null;

        await client.query(
          `INSERT INTO point_ledger (account_id, amount, type, ref_id) VALUES ($1, $2, $3, $4)`,
          [acc.id, -points, "video_order_graded_pay", row.id]
        );
        await client.query(`UPDATE point_accounts SET balance = balance - $2, updated_at=now() WHERE id=$1`, [acc.id, points]);

        await client.query(`INSERT INTO video_order_states (order_id, phase) VALUES ($1, 'in_progress') ON CONFLICT (order_id) DO NOTHING`, [row.id]);
        return { kind: "ok" as const, id: row.id };
      }

      let finalAmount = amountThb;
      if (typeId === "creator_review_video" && (!Number.isFinite(finalAmount) || finalAmount < 0)) finalAmount = 0;
      if (typeId === "creator_review_video" && finalAmount === 0) {
        finalAmount = 0;
      } else {
        if (!Number.isFinite(finalAmount) || finalAmount <= 0) return { kind: "bad_amount" as const };
        if (typeId === "high_quality_custom_video" && (finalAmount < 4000 || finalAmount > 5000)) return { kind: "bad_amount_range" as const };
      }

      const ins = await client.query<{ id: number }>(
        `INSERT INTO video_orders (client_id, type_id, title, requirements, amount_thb, payment_method, payment_status)
         VALUES ($1, $2, $3, $4::jsonb, $5, 'offline', 'unpaid')
         RETURNING id`,
        [req.user!.userId, typeId, title, JSON.stringify(requirements), finalAmount]
      );
      const row = ins.rows[0];
      if (!row) return null;
      await client.query(`INSERT INTO video_order_states (order_id) VALUES ($1) ON CONFLICT (order_id) DO NOTHING`, [row.id]);
      return { kind: "ok" as const, id: row.id };
    });
    if (!created) return res.status(500).json({ error: "DB_ERROR", message: "创建失败，请重试。" });
    if ((created as any).kind === "bad_tier") return res.status(400).json({ error: "INVALID_TIER", message: "请选择分级档位（A/B/C）。" });
    if ((created as any).kind === "bad_task_count") return res.status(400).json({ error: "INVALID_TASK_COUNT", message: "请填写有效数量（1-100）。" });
    if ((created as any).kind === "bad_publish_method") return res.status(400).json({ error: "INVALID_PUBLISH_METHOD", message: "请选择发布方式。" });
    if ((created as any).kind === "insufficient_points")
      return res.status(400).json({ error: "INSUFFICIENT_POINTS", message: "积分余额不足。", need: (created as any).need, balance: (created as any).balance });
    if ((created as any).kind === "bad_amount") return res.status(400).json({ error: "INVALID_AMOUNT", message: "请填写有效金额（THB）。" });
    if ((created as any).kind === "bad_amount_range") return res.status(400).json({ error: "INVALID_AMOUNT_RANGE", message: "高质量定制单价需在 4000-5000 THB 之间。" });
    return res.status(201).json({ id: (created as any).id });
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
              s.review_note, s.reviewed_by, s.reviewed_at,
              COALESCE(mb.accepted_count,0) AS monthly_accepted_count,
              COALESCE(mb.planned_count,0) AS monthly_planned_count,
              COALESCE(ms.settled_amount_thb,0) AS monthly_settled_amount_thb
         FROM video_orders o
         LEFT JOIN video_order_states s ON s.order_id=o.id
         LEFT JOIN (
           SELECT order_id, SUM(accepted_count) AS accepted_count, SUM(planned_count) AS planned_count
             FROM video_order_monthly_batches
            GROUP BY order_id
         ) mb ON mb.order_id=o.id
         LEFT JOIN (
           SELECT order_id, SUM(amount_thb) AS settled_amount_thb
             FROM video_order_weekly_settlements
            WHERE status='paid'
            GROUP BY order_id
         ) ms ON ms.order_id=o.id
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
      const cur = await client.query<{ payment_method: string; payment_status: string }>(
        `SELECT payment_method, payment_status FROM video_orders WHERE id=$1 AND client_id=$2 FOR UPDATE`,
        [id, req.user!.userId]
      );
      const row = cur.rows[0];
      if (!row) return { kind: "not_found" as const };
      if (row.payment_method === "points") return { kind: "not_supported" as const };
      if (row.payment_status === "paid") return { kind: "ok" as const };
      await client.query(`UPDATE video_orders SET payment_status='paid', paid_at=now(), updated_at=now() WHERE id=$1`, [id]);
      await client.query(`UPDATE video_order_states SET phase='paid', updated_at=now() WHERE order_id=$1`, [id]);
      return { kind: "ok" as const };
    });
    if (updated.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    if (updated.kind === "not_supported") return res.status(400).json({ error: "NOT_SUPPORTED", message: "该订单不支持线下标记付款。" });
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
    if (ret.kind === "not_paid") return res.status(400).json({ error: "PAYMENT_REQUIRED", message: "请先完成付款后再验收。" });
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
    if (ret.kind === "not_paid") return res.status(400).json({ error: "PAYMENT_REQUIRED", message: "请先完成付款后再验收。" });
    if (ret.kind === "not_ready") return res.status(400).json({ error: "NOT_READY", message: "订单当前状态不可驳回。" });
    return res.json({ ok: true });
  } catch (e) {
    console.error("client reject video order error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

router.post("/video-orders/:id/cancel", async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "INVALID_ID", message: "无效订单ID。" });
  try {
    const ret = await withTx(async (client) => {
      const cur = await client.query<{ id: number; payment_method: string; payment_status: string; requirements: any; phase: string }>(
        `SELECT o.id, o.payment_method, o.payment_status, o.requirements, COALESCE(s.phase,'created') AS phase
           FROM video_orders o
           LEFT JOIN video_order_states s ON s.order_id=o.id
          WHERE o.id=$1 AND o.client_id=$2
          FOR UPDATE`,
        [id, req.user!.userId]
      );
      const row = cur.rows[0];
      if (!row) return { kind: "not_found" as const };
      if (row.phase === "completed") return { kind: "completed" as const };
      if (row.payment_method !== "points") {
        await client.query(`UPDATE video_order_states SET phase='cancelled', updated_at=now() WHERE order_id=$1`, [id]);
        await client.query(`UPDATE video_orders SET updated_at=now() WHERE id=$1`, [id]);
        return { kind: "ok" as const };
      }
      if (row.payment_status !== "paid") {
        await client.query(`UPDATE video_order_states SET phase='cancelled', updated_at=now() WHERE order_id=$1`, [id]);
        await client.query(`UPDATE video_orders SET updated_at=now() WHERE id=$1`, [id]);
        return { kind: "ok" as const };
      }

      const pointsTotal = Number((row.requirements as any)?.points_total || 0);
      if (!Number.isFinite(pointsTotal) || pointsTotal <= 0) return { kind: "bad_points" as const };

      const acc = await ensurePointAccountLocked(client, req.user!.userId);
      await client.query(
        `INSERT INTO point_ledger (account_id, amount, type, ref_id) VALUES ($1, $2, $3, $4)`,
        [acc.id, pointsTotal, "video_order_graded_refund", id]
      );
      await client.query(`UPDATE point_accounts SET balance = balance + $2, updated_at=now() WHERE id=$1`, [acc.id, pointsTotal]);

      await client.query(`UPDATE video_orders SET payment_status='refunded', updated_at=now() WHERE id=$1`, [id]);
      await client.query(`UPDATE video_order_states SET phase='cancelled', updated_at=now() WHERE order_id=$1`, [id]);
      return { kind: "ok" as const };
    });
    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    if (ret.kind === "completed") return res.status(400).json({ error: "COMPLETED", message: "已完成订单不可取消。" });
    if (ret.kind === "bad_points") return res.status(400).json({ error: "BAD_POINTS", message: "订单积分信息异常。" });
    return res.json({ ok: true });
  } catch (e) {
    console.error("client cancel video order error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

router.get("/video-orders/:id/monthly/batches", async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "INVALID_ID", message: "无效订单ID。" });
  try {
    const own = await query<{ id: number; type_id: string }>(`SELECT id, type_id FROM video_orders WHERE id=$1 AND client_id=$2`, [id, req.user!.userId]);
    const row = own.rows[0];
    if (!row) return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    if (row.type_id !== "monthly_package") return res.status(400).json({ error: "NOT_SUPPORTED", message: "该订单类型不支持批次。" });
    const rows = await query(
      `SELECT b.*, COALESCE(s.id,0) AS settlement_id, COALESCE(s.status,'') AS settlement_status, COALESCE(s.amount_thb,0) AS settlement_amount_thb, s.paid_at AS settlement_paid_at
         FROM video_order_monthly_batches b
         LEFT JOIN video_order_weekly_settlements s ON s.batch_id=b.id
        WHERE b.order_id=$1
        ORDER BY b.week_start DESC`,
      [id]
    );
    return res.json({ list: rows.rows });
  } catch (e) {
    console.error("client list monthly batches error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

router.post("/video-orders/:id/monthly/batches/:batchId/accept", async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const batchId = Number(req.params.batchId);
  const acceptedCountRaw = req.body?.accepted_count;
  const acceptedCount = acceptedCountRaw == null ? NaN : Number(acceptedCountRaw);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "INVALID_ID", message: "无效订单ID。" });
  if (!Number.isFinite(batchId) || batchId <= 0) return res.status(400).json({ error: "INVALID_BATCH_ID", message: "无效批次ID。" });
  try {
    const ret = await withTx(async (client) => {
      const own = await client.query<{ type_id: string; payment_status: string }>(
        `SELECT type_id, payment_status FROM video_orders WHERE id=$1 AND client_id=$2 FOR UPDATE`,
        [id, req.user!.userId]
      );
      const order = own.rows[0];
      if (!order) return { kind: "not_found" as const };
      if (order.type_id !== "monthly_package") return { kind: "not_supported" as const };
      if (order.payment_status !== "paid") return { kind: "not_paid" as const };
      const b = await client.query<{ id: number; submitted_count: number; status: string }>(
        `SELECT id, submitted_count, status FROM video_order_monthly_batches WHERE id=$1 AND order_id=$2 FOR UPDATE`,
        [batchId, id]
      );
      const batch = b.rows[0];
      if (!batch) return { kind: "batch_not_found" as const };
      if (!["submitted", "pending"].includes(batch.status)) return { kind: "bad_status" as const };

      const finalAccepted = Number.isFinite(acceptedCount) ? Math.max(0, Math.floor(acceptedCount)) : batch.submitted_count;
      if (finalAccepted < 0 || finalAccepted > batch.submitted_count) return { kind: "bad_count" as const };

      await client.query(`UPDATE video_order_monthly_batches SET accepted_count=$2, status='accepted', updated_at=now() WHERE id=$1`, [batchId, finalAccepted]);

      const unitPrice = 650;
      const amount = Math.round(finalAccepted * unitPrice * 100) / 100;
      await client.query(
        `INSERT INTO video_order_weekly_settlements (order_id, batch_id, unit_price_thb, video_count, amount_thb, status)
         VALUES ($1,$2,$3,$4,$5,'pending')
         ON CONFLICT (batch_id) DO UPDATE SET unit_price_thb=EXCLUDED.unit_price_thb, video_count=EXCLUDED.video_count, amount_thb=EXCLUDED.amount_thb, status='pending', paid_at=NULL`,
        [id, batchId, unitPrice, finalAccepted, amount]
      );
      return { kind: "ok" as const };
    });
    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    if (ret.kind === "not_supported") return res.status(400).json({ error: "NOT_SUPPORTED", message: "该订单类型不支持批次。" });
    if (ret.kind === "not_paid") return res.status(400).json({ error: "PAYMENT_REQUIRED", message: "请先完成付款后再验收批次。" });
    if (ret.kind === "batch_not_found") return res.status(404).json({ error: "BATCH_NOT_FOUND", message: "批次不存在。" });
    if (ret.kind === "bad_status") return res.status(400).json({ error: "BAD_STATUS", message: "批次当前状态不可验收。" });
    if (ret.kind === "bad_count") return res.status(400).json({ error: "BAD_COUNT", message: "验收数量不合法。" });
    return res.json({ ok: true });
  } catch (e) {
    console.error("client accept monthly batch error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

router.post("/video-orders/:id/monthly/settlements/:settlementId/mark-paid", async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const settlementId = Number(req.params.settlementId);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "INVALID_ID", message: "无效订单ID。" });
  if (!Number.isFinite(settlementId) || settlementId <= 0) return res.status(400).json({ error: "INVALID_SETTLEMENT_ID", message: "无效结算单ID。" });
  try {
    const ret = await withTx(async (client) => {
      const own = await client.query<{ type_id: string; payment_status: string }>(
        `SELECT type_id, payment_status FROM video_orders WHERE id=$1 AND client_id=$2 FOR UPDATE`,
        [id, req.user!.userId]
      );
      const order = own.rows[0];
      if (!order) return { kind: "not_found" as const };
      if (order.type_id !== "monthly_package") return { kind: "not_supported" as const };
      if (order.payment_status !== "paid") return { kind: "not_paid" as const };

      const s = await client.query<{ id: number; batch_id: number; status: string }>(
        `SELECT id, batch_id, status FROM video_order_weekly_settlements WHERE id=$1 AND order_id=$2 FOR UPDATE`,
        [settlementId, id]
      );
      const st = s.rows[0];
      if (!st) return { kind: "settlement_not_found" as const };
      if (st.status === "paid") return { kind: "ok" as const };

      await client.query(`UPDATE video_order_weekly_settlements SET status='paid', paid_at=now() WHERE id=$1`, [settlementId]);
      await client.query(`UPDATE video_order_monthly_batches SET status='settled', updated_at=now() WHERE id=$1`, [st.batch_id]);
      return { kind: "ok" as const };
    });
    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    if (ret.kind === "not_supported") return res.status(400).json({ error: "NOT_SUPPORTED", message: "该订单类型不支持结算。" });
    if (ret.kind === "not_paid") return res.status(400).json({ error: "PAYMENT_REQUIRED", message: "请先完成付款后再结算。" });
    if (ret.kind === "settlement_not_found") return res.status(404).json({ error: "SETTLEMENT_NOT_FOUND", message: "结算单不存在。" });
    return res.json({ ok: true });
  } catch (e) {
    console.error("client mark settlement paid error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

export default router;
