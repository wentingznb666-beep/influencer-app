import { Router, Response } from "express";
import { query } from "../db";
import { requireAuth, requireRole, type AuthRequest } from "../auth";

const router = Router();
router.use(requireAuth);

function genOrderNo(): string { return `CO-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`; }

async function sendMsg(userId: number, category: string, title: string, content: string, link: string) { try { await query("INSERT INTO system_messages (user_id, category, title, content, link, is_read) VALUES ($1,$2,$3,$4,$5,0)", [userId, category, title, content, link]); } catch {} }

// ==== CLIENT ROUTES ====
const clientRouter = Router();
clientRouter.use(requireRole("client"));

clientRouter.get("/connections", async (req: AuthRequest, res: Response) => {
  try {
    const tab = String(req.query.tab || "");
    let where = "WHERE ic.client_id = $1";
    const params: any[] = [req.user!.userId];
    if (tab === "pending") where += " AND ic.status = 'pending'";
    else if (tab === "active") where += " AND ic.status = 'active'";
    else if (tab === "expired") where += " AND ic.status = 'expired'";
    const { rows } = await query(
      `SELECT ic.*, ipf.influencer_code, ipf.followers, ipf.category as profile_category, ipf.grade as profile_grade, ipf.gmv_sales, u.username as influencer_username FROM influencer_connections ic LEFT JOIN influencer_profiles_full ipf ON ic.influencer_profile_id = ipf.id LEFT JOIN users u ON ic.influencer_id = u.id ${where} ORDER BY ic.id DESC LIMIT 200`, params);
    res.json({ list: rows });
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

clientRouter.post("/connections", async (req: AuthRequest, res: Response) => {
  try {
    const { influencer_id, influencer_profile_id, category, grade, brief, budget } = req.body || {};
    if ((!influencer_id && !influencer_profile_id) || !category) return res.status(400).json({ error: "MISSING" });
    // 通过 profile ID 或直接传入的 user ID 确定达人
    let actualInfluencerId = influencer_id;
    if (!actualInfluencerId && influencer_profile_id) {
      const prof = await query("SELECT user_id FROM influencer_profiles_full WHERE id = $1", [influencer_profile_id]);
      if (!prof.rows[0]?.user_id) return res.status(400).json({ error: "NO_USER", message: "该达人资料未关联系统用户" });
      actualInfluencerId = prof.rows[0].user_id;
    }
    const start = new Date();
    const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
    const { rows } = await query(
      `INSERT INTO influencer_connections (client_id, influencer_id, influencer_profile_id, category, grade, brief, budget, start_date, end_date, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending') RETURNING id`,
      [req.user!.userId, actualInfluencerId, influencer_profile_id || null, category, grade || null, brief || null, budget || null, start, end]
    );
    await sendMsg(actualInfluencerId, "connection_invite", "新的建联邀请", `商家向你发起了建联邀请，类目：${category}`, "/influencer/vertical-connections/invitations?tab=pending");
    res.status(201).json({ id: rows[0].id });
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

clientRouter.post("/connections/:id/renew", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    const existing = await query("SELECT * FROM influencer_connections WHERE id = $1 AND client_id = $2", [id, req.user!.userId]);
    if (!existing.rows[0]) return res.status(404).json({ error: "NOT_FOUND" });
    const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await query("UPDATE influencer_connections SET end_date = $1, status = 'active', renewal_count = renewal_count + 1, updated_at = now() WHERE id = $2", [end, id]);
    await sendMsg(existing.rows[0].influencer_id, "connection_invite", "建联已续约", "建联已续约30天", "/influencer/vertical-connections/invitations?tab=active");
    res.json({ ok: true, end_date: end });
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

// Connection Orders - Client
clientRouter.post("/connection-orders", async (req: AuthRequest, res: Response) => {
  try {
    const { connection_id, influencer_id, title, task_requirements, delivery_standards, deadline, submission_types } = req.body || {};
    if (!connection_id || !influencer_id || !title || !task_requirements || !delivery_standards || !deadline) return res.status(400).json({ error: "MISSING" });
    // Check connection is active and not expired
    const conn = await query("SELECT * FROM influencer_connections WHERE id = $1 AND client_id = $2 AND status = 'active' AND end_date > NOW()", [connection_id, req.user!.userId]);
    if (!conn.rows[0]) return res.status(400).json({ error: "CONNECTION_EXPIRED", message: "建联已到期，请先续约" });
    // 金额自动取达人报价
    const profile = await query("SELECT quoted_price FROM influencer_profiles_full WHERE user_id = $1", [influencer_id]);
    const amount = profile.rows[0]?.quoted_price;
    if (!amount) return res.status(400).json({ error: "NO_PRICE", message: "该达人尚未设置报价" });
    const orderNo = genOrderNo();
    const { rows } = await query(
      `INSERT INTO connection_orders (connection_id, client_id, influencer_id, order_no, title, task_requirements, delivery_standards, deadline, submission_types, amount) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [connection_id, req.user!.userId, influencer_id, orderNo, title, task_requirements, delivery_standards, deadline, String(submission_types || ""), amount]
    );
    await sendMsg(influencer_id, "connection_order", "新的定向派单", `商家向你派发了新订单：${title}`, `/influencer/vertical-connections/orders`);
    res.status(201).json({ id: rows[0].id, order_no: orderNo });
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

clientRouter.get("/connection-orders", async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query("SELECT co.*, ipf.influencer_code, u.username as influencer_username FROM connection_orders co LEFT JOIN influencer_profiles_full ipf ON co.influencer_id = ipf.user_id LEFT JOIN users u ON co.influencer_id = u.id WHERE co.client_id = $1 ORDER BY co.id DESC LIMIT 200", [req.user!.userId]);
    res.json({ list: rows });
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

clientRouter.get("/connection-orders/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query("SELECT * FROM connection_orders WHERE id = $1 AND client_id = $2", [req.params.id, req.user!.userId]);
    if (!rows[0]) return res.status(404).json({ error: "NOT_FOUND" });
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

clientRouter.put("/connection-orders/:id", async (req: AuthRequest, res: Response) => {
  try {
    const existing = await query("SELECT * FROM connection_orders WHERE id = $1 AND client_id = $2", [req.params.id, req.user!.userId]);
    if (!existing.rows[0]) return res.status(404).json({ error: "NOT_FOUND" });
    if (existing.rows[0].influencer_response !== "pending") return res.status(400).json({ error: "CANNOT_EDIT", message: "达人已回应，不可编辑" });
    const { title, task_requirements, delivery_standards, deadline, submission_types, amount } = req.body || {};
    await query("UPDATE connection_orders SET title = COALESCE($1, title), task_requirements = COALESCE($2, task_requirements), delivery_standards = COALESCE($3, delivery_standards), deadline = COALESCE($4, deadline), submission_types = COALESCE($5, submission_types), amount = COALESCE($6, amount), updated_at = now() WHERE id = $7", [title || null, task_requirements || null, delivery_standards || null, deadline || null, String(submission_types || ""), amount || null, req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

clientRouter.delete("/connection-orders/:id", async (req: AuthRequest, res: Response) => {
  try {
    const existing = await query("SELECT * FROM connection_orders WHERE id = $1 AND client_id = $2", [req.params.id, req.user!.userId]);
    if (!existing.rows[0]) return res.status(404).json({ error: "NOT_FOUND" });
    if (existing.rows[0].influencer_response !== "pending") return res.status(400).json({ error: "CANNOT_DELETE", message: "达人已回应，不可删除" });
    await query("DELETE FROM connection_orders WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

clientRouter.post("/connection-orders/:id/review", async (req: AuthRequest, res: Response) => {
  try {
    const { action, review_note } = req.body || {};
    const existing = await query("SELECT * FROM connection_orders WHERE id = $1 AND client_id = $2", [req.params.id, req.user!.userId]);
    if (!existing.rows[0]) return res.status(404).json({ error: "NOT_FOUND" });
    const order = existing.rows[0];
    if (action === "approve") {
      await query("UPDATE connection_orders SET review_status = 'approved', status = 'completed', updated_at = now() WHERE id = $1", [req.params.id]);
      await sendMsg(order.influencer_id, "connection_order", "订单验收通过", `订单 ${order.order_no} 已验收通过`, `/influencer/vertical-connections/orders`);
    } else if (action === "reject") {
      if (order.review_count >= 1) return res.status(400).json({ error: "MAX_REJECT", message: "只能驳回一次" });
      if (!review_note) return res.status(400).json({ error: "MISSING_NOTE", message: "驳回必须填写修改备注" });
      await query("UPDATE connection_orders SET review_status = 'rejected', review_note = $1, review_count = review_count + 1, status = 'rejected', updated_at = now() WHERE id = $2", [review_note, req.params.id]);
      await sendMsg(order.influencer_id, "connection_order", "订单需要修改", `订单 ${order.order_no} 被驳回：${review_note}`, `/influencer/vertical-connections/orders`);
    }
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

clientRouter.get("/connection-orders/:id/payment-info", async (req: AuthRequest, res: Response) => {
  try {
    const order = await query("SELECT review_status, influencer_id FROM connection_orders WHERE id = $1 AND client_id = $2", [req.params.id, req.user!.userId]);
    if (!order.rows[0] || order.rows[0].review_status !== "approved") return res.status(400).json({ error: "NOT_APPROVED" });
    const profile = await query("SELECT payment_info FROM influencer_profiles_full WHERE user_id = $1", [order.rows[0].influencer_id]);
    res.json({ payment_info: profile.rows[0]?.payment_info || null });
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

clientRouter.post("/connection-orders/:id/confirm-payment", async (req: AuthRequest, res: Response) => {
  try {
    const { payment_voucher } = req.body || {};
    if (!payment_voucher) return res.status(400).json({ error: "MISSING_VOUCHER" });
    const order = await query("SELECT * FROM connection_orders WHERE id = $1 AND client_id = $2 AND review_status = 'approved'", [req.params.id, req.user!.userId]);
    if (!order.rows[0]) return res.status(400).json({ error: "NOT_APPROVED" });
    await query("UPDATE connection_orders SET payment_voucher = $1, payment_status = 'paid', paid_at = now(), updated_at = now() WHERE id = $2", [payment_voucher, req.params.id]);
    await sendMsg(order.rows[0].influencer_id, "connection_payment", "商家已付款", `订单 ${order.rows[0].order_no} 商家已确认付款`, `/influencer/vertical-connections/orders`);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

// ==== INFLUENCER ROUTES ====
const influencerRouter = Router();
influencerRouter.use(requireRole("influencer"));

influencerRouter.get("/connections", async (req: AuthRequest, res: Response) => {
  try {
    const tab = String(req.query.tab || "");
    let where = "WHERE ic.influencer_id = $1";
    const params: any[] = [req.user!.userId];
    if (tab === "pending") where += " AND ic.status = 'pending'";
    else if (tab === "active") where += " AND ic.status = 'active'";
    else if (tab === "rejected") where += " AND ic.status = 'rejected'";
    else if (tab === "expired") where += " AND ic.status = 'expired'";
    const { rows } = await query(
      `SELECT ic.*, u.username as client_username FROM influencer_connections ic LEFT JOIN users u ON ic.client_id = u.id ${where} ORDER BY ic.id DESC LIMIT 200`, params);
    res.json({ list: rows });
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

influencerRouter.patch("/connections/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { action } = req.body || {};
    const existing = await query("SELECT * FROM influencer_connections WHERE id = $1 AND influencer_id = $2 AND status = 'pending'", [req.params.id, req.user!.userId]);
    if (!existing.rows[0]) return res.status(404).json({ error: "NOT_FOUND" });
    const conn = existing.rows[0];
    if (action === "accept") {
      await query("UPDATE influencer_connections SET status = 'active', updated_at = now() WHERE id = $1", [req.params.id]);
      await sendMsg(conn.client_id, "connection_invite", "建联已接受", "达人已接受你的建联邀请", "/client/vertical-connections/my?tab=active");
    } else if (action === "reject") {
      await query("UPDATE influencer_connections SET status = 'rejected', updated_at = now() WHERE id = $1", [req.params.id]);
      await sendMsg(conn.client_id, "connection_invite", "建联已拒绝", "达人已拒绝你的建联邀请", "/client/vertical-connections/my");
    }
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

influencerRouter.get("/connection-orders", async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query("SELECT co.*, u.username as client_username FROM connection_orders co LEFT JOIN users u ON co.client_id = u.id WHERE co.influencer_id = $1 ORDER BY co.id DESC LIMIT 200", [req.user!.userId]);
    res.json({ list: rows });
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

influencerRouter.patch("/connection-orders/:id/respond", async (req: AuthRequest, res: Response) => {
  try {
    const { action, reject_reason } = req.body || {};
    const existing = await query("SELECT * FROM connection_orders WHERE id = $1 AND influencer_id = $2 AND influencer_response = 'pending'", [req.params.id, req.user!.userId]);
    if (!existing.rows[0]) return res.status(404).json({ error: "NOT_FOUND" });
    const order = existing.rows[0];
    if (action === "accept") {
      await query("UPDATE connection_orders SET influencer_response = 'accepted', status = 'submitted', updated_at = now() WHERE id = $1", [req.params.id]);
      await sendMsg(order.client_id, "connection_order", "达人已接受派单", `订单 ${order.order_no} 达人已接受`, `/client/vertical-connections/my`);
    } else if (action === "reject") {
      if (!reject_reason) return res.status(400).json({ error: "MISSING_REASON", message: "拒绝必须填写原因" });
      await query("UPDATE connection_orders SET influencer_response = 'rejected', influencer_reject_reason = $1, status = 'rejected', updated_at = now() WHERE id = $2", [reject_reason, req.params.id]);
      await sendMsg(order.client_id, "connection_order", "达人已拒绝派单", `订单 ${order.order_no} 达人已拒绝：${reject_reason}`, `/client/vertical-connections/my`);
    }
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

influencerRouter.post("/connection-orders/:id/submit", async (req: AuthRequest, res: Response) => {
  try {
    const { submission_content } = req.body || {};
    await query("UPDATE connection_orders SET submission_content = $1, status = 'submitted', review_status = 'pending_review', updated_at = now() WHERE id = $2 AND influencer_id = $3", [submission_content || null, req.params.id, req.user!.userId]);
    const order = await query("SELECT * FROM connection_orders WHERE id = $1", [req.params.id]);
    if (order.rows[0]) await sendMsg(order.rows[0].client_id, "connection_order", "达人已提交作品", `订单 ${order.rows[0].order_no} 达人已提交作品`, `/client/vertical-connections/my`);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

influencerRouter.post("/connection-orders/:id/revise", async (req: AuthRequest, res: Response) => {
  try {
    const { submission_content } = req.body || {};
    await query("UPDATE connection_orders SET submission_content = $1, review_status = 'pending_review', status = 'submitted', revised_at = now(), updated_at = now() WHERE id = $2 AND influencer_id = $3 AND review_status = 'rejected'", [submission_content || null, req.params.id, req.user!.userId]);
    const order = await query("SELECT * FROM connection_orders WHERE id = $1", [req.params.id]);
    if (order.rows[0]) await sendMsg(order.rows[0].client_id, "connection_order", "达人已修改重提", `订单 ${order.rows[0].order_no} 达人已修改重提`, `/client/vertical-connections/my`);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

// ==== ADMIN ROUTES ====
const adminRouter = Router();
adminRouter.use(requireRole("admin", "employee"));

adminRouter.get("/connections", async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query("SELECT ic.*, c.username as client_username, inf.username as influencer_username FROM influencer_connections ic LEFT JOIN users c ON ic.client_id = c.id LEFT JOIN users inf ON ic.influencer_id = inf.id ORDER BY ic.id DESC LIMIT 500");
    res.json({ list: rows });
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

adminRouter.patch("/connections/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ error: "MISSING_STATUS" });
    await query("UPDATE influencer_connections SET status = $1, updated_at = now() WHERE id = $2", [status, req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

adminRouter.get("/connections/stats", async (_req: AuthRequest, res: Response) => {
  try {
    const { rows: total } = await query("SELECT COUNT(*) as c FROM influencer_connections");
    const { rows: active } = await query("SELECT COUNT(*) as c FROM influencer_connections WHERE status = 'active'");
    const { rows: byCategory } = await query("SELECT category, COUNT(*) as c FROM influencer_connections GROUP BY category ORDER BY c DESC LIMIT 10");
    res.json({ total: parseInt(total[0]?.c), active: parseInt(active[0]?.c), byCategory });
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

adminRouter.get("/connection-orders", async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query("SELECT co.*, c.username as client_username, inf.username as influencer_username FROM connection_orders co LEFT JOIN users c ON co.client_id = c.id LEFT JOIN users inf ON co.influencer_id = inf.id ORDER BY co.id DESC LIMIT 500");
    res.json({ list: rows });
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

export const clientConnections = clientRouter;
export const influencerConnections = influencerRouter;
export const adminConnections = adminRouter;
export default router;
