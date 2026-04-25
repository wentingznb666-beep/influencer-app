import { Router, Response } from "express";

import { query, withTx } from "../db";

import { requireAuth, requireRole, type AuthRequest } from "../auth";
import { COOPERATION_TYPES_CONFIG_KEY, readCooperationTypesConfig, type CooperationTypesConfig } from "../cooperationTypes";



const router = Router();

router.use(requireAuth);



/** 创建系统消息 */

async function createMessage(userId: number, category: string, title: string, content: string, relatedType?: string, relatedId?: number): Promise<void> {

  await query(

    `INSERT INTO system_messages (user_id, category, title, content, related_type, related_id)

     VALUES ($1, $2, $3, $4, $5, $6)`,

    [userId, category, title, content, relatedType ?? null, relatedId ?? null]

  );

}



/** 判断是否管理员或员工 */

function isAdminLike(role: string): boolean {

  return role === "admin" || role === "employee";

}

function normalizeCooperationTypesConfig(input: unknown): CooperationTypesConfig | null {
  if (!input || typeof input !== "object") return null;
  const v = (input as any).version;
  const types = (input as any).types;
  if (v !== 1) return null;
  if (!Array.isArray(types)) return null;
  for (const t of types) {
    if (!t || typeof t !== "object") return null;
    if (typeof (t as any).id !== "string") return null;
    const name = (t as any).name;
    if (!name || typeof name !== "object") return null;
    if (typeof (name as any).zh !== "string" || typeof (name as any).th !== "string") return null;
    const roles = (t as any).visible_roles;
    if (!Array.isArray(roles) || roles.some((r: any) => typeof r !== "string")) return null;
    const spec = (t as any).spec;
    if (!spec || typeof spec !== "object") return null;
  }
  return input as CooperationTypesConfig;
}

function normalizeCooperationPhase(input: unknown): string {
  const v = typeof input === "string" ? input.trim() : "";
  const allowed = new Set([
    "none",
    "assigned",
    "in_progress",
    "submitted",
    "review_pending",
    "review_rejected",
    "approved_to_publish",
    "published",
    "delivered",
    "completed",
  ]);
  if (!v || v.length > 50) return "";
  if (!allowed.has(v)) return "";
  return v;
}

router.get("/cooperation-types", requireRole("admin", "employee", "client"), async (_req: AuthRequest, res: Response) => {
  const config = await readCooperationTypesConfig();
  return res.json({ key: COOPERATION_TYPES_CONFIG_KEY, config });
});

router.put("/cooperation-types", requireRole("admin", "employee"), async (req: AuthRequest, res: Response) => {
  const cfg = normalizeCooperationTypesConfig(req.body?.config ?? req.body);
  if (!cfg) return res.status(400).json({ error: "INVALID_CONFIG", message: "无效的配置结构。" });
  await query(
    "INSERT INTO config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value",
    [COOPERATION_TYPES_CONFIG_KEY, JSON.stringify(cfg)]
  );
  return res.json({ ok: true });
});

router.get("/admin/cooperation-orders", requireRole("admin", "employee"), async (req: AuthRequest, res: Response) => {
  const type = String(req.query?.type || "").trim();
  const phase = String(req.query?.phase || "").trim();
  const q = String(req.query?.q || "").trim();
  const limitRaw = Number(req.query?.limit || 200);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 500) : 200;

  const where: string[] = ["mo.is_deleted=0", "COALESCE(mo.order_type,0)=1"];
  const params: any[] = [];
  let idx = 1;

  if (type) {
    where.push(`COALESCE(md.detail_json->>'cooperation_type_id','') = $${idx++}`);
    params.push(type);
  }
  if (phase) {
    where.push(`COALESCE(cs.phase,'none') = $${idx++}`);
    params.push(phase);
  }
  if (q) {
    where.push(`(mo.order_no ILIKE $${idx} OR mo.title ILIKE $${idx})`);
    params.push(`%${q}%`);
    idx++;
  }

  const rows = await query(
    `SELECT mo.id, mo.order_no, mo.title, mo.status, mo.match_status, mo.task_amount, mo.client_id, mo.influencer_id, mo.work_links, mo.created_at, mo.updated_at,
            md.detail_json, md.attachment_urls,
            COALESCE(md.detail_json->>'cooperation_type_id','') AS cooperation_type_id,
            COALESCE(cs.phase,'none') AS phase,
            COALESCE(cs.publish_links,'[]'::jsonb) AS publish_links,
            cs.review_note, cs.reviewed_by, cs.reviewed_at,
            cu.username AS client_username, COALESCE(NULLIF(cu.display_name,''),cu.username) AS client_name,
            iu.username AS influencer_username, COALESCE(NULLIF(iu.display_name,''),iu.username) AS influencer_name
       FROM client_market_orders mo
       JOIN users cu ON cu.id=mo.client_id
       LEFT JOIN users iu ON iu.id=mo.influencer_id
       LEFT JOIN matching_order_details md ON md.order_id=mo.id
       LEFT JOIN cooperation_order_states cs ON cs.order_id=mo.id
      WHERE ${where.join(" AND ")}
      ORDER BY mo.id DESC
      LIMIT ${limit}`,
    params
  );
  return res.json({ list: rows.rows });
});

router.post("/admin/cooperation-orders/:id/review", requireRole("admin", "employee"), async (req: AuthRequest, res: Response) => {
  const orderId = Number(req.params.id);
  const action = String(req.body?.action || "").trim();
  const note = String(req.body?.note || "").trim();
  if (!Number.isInteger(orderId) || orderId < 1) return res.status(400).json({ error: "INVALID_ID", message: "无效的订单ID。" });
  if (!["approve", "reject"].includes(action)) return res.status(400).json({ error: "INVALID_ACTION", message: "无效操作。" });

  try {
    const ret = await withTx(async (client) => {
      const ord = await client.query<{ id: number; status: string; influencer_id: number | null; client_id: number }>(
        `SELECT id, status, influencer_id, client_id
           FROM client_market_orders
          WHERE id=$1 AND is_deleted=0 AND COALESCE(order_type,0)=1
          FOR UPDATE`,
        [orderId]
      );
      const row = ord.rows[0];
      if (!row) return { kind: "not_found" as const };
      const detail = await client.query<{ detail_json: any }>(`SELECT detail_json FROM matching_order_details WHERE order_id=$1`, [orderId]);
      const coopTypeId = String((detail.rows[0]?.detail_json as any)?.cooperation_type_id || "").trim();
      if (coopTypeId !== "creator_review_video") return { kind: "not_supported" as const };

      await client.query(`INSERT INTO cooperation_order_states (order_id) VALUES ($1) ON CONFLICT (order_id) DO NOTHING`, [orderId]);
      const st = await client.query<{ phase: string }>(`SELECT phase FROM cooperation_order_states WHERE order_id=$1 FOR UPDATE`, [orderId]);
      const curPhase = String(st.rows[0]?.phase || "none");
      if (curPhase !== "review_pending") return { kind: "bad_phase" as const, phase: curPhase };

      if (action === "approve") {
        await client.query(
          `UPDATE cooperation_order_states
              SET phase='approved_to_publish', review_note=$2, reviewed_by=$3, reviewed_at=now(), updated_at=now()
            WHERE order_id=$1`,
          [orderId, note || null, req.user!.userId]
        );
        return { kind: "ok_approve" as const, influencerId: row.influencer_id || 0, clientId: row.client_id };
      }

      await client.query(
        `UPDATE cooperation_order_states
            SET phase='review_rejected', review_note=$2, reviewed_by=$3, reviewed_at=now(), updated_at=now()
          WHERE order_id=$1`,
        [orderId, note || null, req.user!.userId]
      );
      await client.query(`UPDATE client_market_orders SET status='claimed', work_links='[]'::jsonb, completed_at=NULL, updated_at=now() WHERE id=$1`, [orderId]);
      return { kind: "ok_reject" as const, influencerId: row.influencer_id || 0, clientId: row.client_id };
    });

    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    if (ret.kind === "not_supported") return res.status(400).json({ error: "NOT_SUPPORTED", message: "该订单不需要后台审核。" });
    if (ret.kind === "bad_phase") return res.status(409).json({ error: "BAD_STATE", message: `当前阶段不可审核（${ret.phase}）。` });

    if (ret.influencerId > 0) {
      await createMessage(
        ret.influencerId,
        action === "approve" ? "cooperation_review_ok" : "cooperation_review_reject",
        action === "approve" ? "视频审核通过" : "视频审核未通过",
        action === "approve" ? `订单 #${orderId} 已审核通过，请提交发布链接。` : `订单 #${orderId} 审核未通过，请按要求重新提交。${note ? `\n原因：${note}` : ""}`,
        "matching_order",
        orderId
      );
    }
    if (ret.clientId > 0) {
      await createMessage(
        ret.clientId,
        action === "approve" ? "cooperation_review_ok" : "cooperation_review_reject",
        action === "approve" ? "达人视频已审核通过" : "达人视频审核未通过",
        action === "approve" ? `订单 #${orderId} 视频已通过后台审核，等待达人发布。` : `订单 #${orderId} 视频审核未通过，等待达人重新提交。`,
        "matching_order",
        orderId
      );
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("admin cooperation order review error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

router.patch("/admin/cooperation-orders/:id/phase", requireRole("admin", "employee"), async (req: AuthRequest, res: Response) => {
  const orderId = Number(req.params.id);
  const phase = normalizeCooperationPhase(req.body?.phase);
  if (!Number.isInteger(orderId) || orderId < 1) return res.status(400).json({ error: "INVALID_ID", message: "无效的订单ID。" });
  if (!phase) return res.status(400).json({ error: "INVALID_PHASE", message: "无效流程阶段。" });

  try {
    const ret = await withTx(async (client) => {
      const ord = await client.query<{ id: number; client_id: number; influencer_id: number | null }>(
        `SELECT id, client_id, influencer_id
           FROM client_market_orders
          WHERE id=$1 AND is_deleted=0 AND COALESCE(order_type,0)=1
          FOR UPDATE`,
        [orderId]
      );
      const row = ord.rows[0];
      if (!row) return { kind: "not_found" as const };

      await client.query(`INSERT INTO cooperation_order_states (order_id) VALUES ($1) ON CONFLICT (order_id) DO NOTHING`, [orderId]);
      await client.query(`UPDATE cooperation_order_states SET phase=$2, updated_at=now() WHERE order_id=$1`, [orderId, phase]);
      return { kind: "ok" as const, clientId: row.client_id, influencerId: row.influencer_id || 0 };
    });

    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    return res.json({ ok: true });
  } catch (e) {
    console.error("admin cooperation order phase error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});



router.get("/client/market-orders/:id/applications", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "client") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });

  const clientId = req.user.userId;

  const orderId = Number(req.params.id);

  if (!Number.isInteger(orderId) || orderId < 1) return res.status(400).json({ error: "INVALID_ID", message: "无效的订单ID。" });

  try {

    const own = await query<{ id: number }>("SELECT id FROM client_market_orders WHERE id=$1 AND client_id=$2 AND is_deleted=0", [orderId, clientId]);

    if (!own.rows[0]) return res.status(404).json({ error: "NOT_FOUND", message: "无权限访问。" });

    const rows = await query(

      `SELECT a.id, a.status, a.note, a.created_at,

              u.id AS influencer_id, u.username AS influencer_username, COALESCE(NULLIF(u.display_name,''), u.username) AS influencer_name

       FROM market_order_applications a

       JOIN users u ON u.id = a.influencer_id

       WHERE a.market_order_id = $1

       ORDER BY a.id DESC`,

      [orderId]

    );

    return res.json({ list: rows.rows });

  } catch (e) {

    console.error("client applications list error:", e);

    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  }

});



/** 创建系统消息 */

router.post("/client/market-orders/:id/applications/:appId/select", async (req: AuthRequest, res: Response) => {

  if (req.user?.role !== "client") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });

  const clientId = req.user.userId;

  const orderId = Number(req.params.id);

  const appId = Number(req.params.appId);

  if (!Number.isInteger(orderId) || !Number.isInteger(appId) || orderId < 1 || appId < 1) return res.status(400).json({ error: "INVALID_ID", message: "无效的ID。" });

  try {

    const result = await withTx(async (client) => {

      const ord = await client.query<{ id: number; status: string }>(

        `SELECT id, status FROM client_market_orders WHERE id=$1 AND client_id=$2 AND is_deleted=0 FOR UPDATE`,

        [orderId, clientId]

      );

      if (!ord.rows[0]) return { kind: "not_found" as const };

      if (ord.rows[0].status !== "open") return { kind: "bad_state" as const };

      const app = await client.query<{ id: number; influencer_id: number }>(

        `SELECT id, influencer_id FROM market_order_applications WHERE id=$1 AND market_order_id=$2 FOR UPDATE`,

        [appId, orderId]

      );

      if (!app.rows[0]) return { kind: "app_not_found" as const };

      const influencerId = app.rows[0].influencer_id;

      await client.query(`UPDATE market_order_applications SET status='selected', updated_at=now() WHERE id=$1`, [appId]);

      await client.query(`UPDATE market_order_applications SET status='rejected', updated_at=now() WHERE market_order_id=$1 AND id<>$2 AND status='pending'`, [orderId, appId]);

      await client.query(`UPDATE client_market_orders SET influencer_id=$1, status='claimed', match_status='matched', updated_at=now() WHERE id=$2`, [influencerId, orderId]);

      return { kind: "ok" as const, influencerId };

    });

    if (result.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "无权限访问。" });

    if (result.kind === "app_not_found") return res.status(404).json({ error: "NOT_FOUND", message: "报名记录不存在。" });

    if (result.kind === "bad_state") return res.status(409).json({ error: "BAD_STATE", message: "当前状态不允许该操作。" });

    await createMessage(result.influencerId, "match", "商单已被选中", `订单 #${orderId} 的报名已被商家选中。`, "market_order", orderId);

    return res.json({ ok: true });

  } catch (e) {

    console.error("client select influencer error:", e);

    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  }

});



/** 商家驳回达人报名 */

router.post("/client/market-orders/:id/applications/:appId/reject", async (req: AuthRequest, res: Response) => {

  if (req.user?.role !== "client") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });

  const clientId = req.user.userId;

  const orderId = Number(req.params.id);

  const appId = Number(req.params.appId);

  if (!Number.isInteger(orderId) || !Number.isInteger(appId) || orderId < 1 || appId < 1) return res.status(400).json({ error: "INVALID_ID", message: "无效的ID。" });

  try {

    const updated = await query<{ influencer_id: number }>(

      `UPDATE market_order_applications a

       SET status='rejected', updated_at=now()

       FROM client_market_orders mo

       WHERE a.id=$1 AND a.market_order_id=$2 AND mo.id=$2 AND mo.client_id=$3

       RETURNING a.influencer_id`,

      [appId, orderId, clientId]

    );

    const row = updated.rows[0];

    if (!row) return res.status(404).json({ error: "NOT_FOUND", message: "无权限访问。" });

    await createMessage(row.influencer_id, "match", "商单报名被驳回", `订单 #${orderId} 的报名未通过。`, "market_order", orderId);

    return res.json({ ok: true });

  } catch (e) {

    console.error("client reject influencer error:", e);

    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  }

});



/** 商家查看达人合作池 */

router.get("/client/collab-pool", async (req: AuthRequest, res: Response) => {

  if (req.user?.role !== "client") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });

  try {

    const rows = await query(

      `SELECT d.id, d.title, d.demand_detail, d.expected_points, d.status, d.created_at,
              a.status AS my_apply_status,
              a.merchant_shop_name, a.merchant_product_type, a.merchant_sales_summary, a.merchant_shop_link,
              u.username AS influencer_username, COALESCE(NULLIF(u.display_name,''), u.username) AS influencer_name

       FROM influencer_collab_demands d

       JOIN users u ON u.id=d.influencer_id

       LEFT JOIN influencer_demand_applications a ON a.demand_id=d.id AND a.client_id=$1

       WHERE d.status='open'

       ORDER BY d.id DESC`,
      [req.user.userId]

    );

    return res.json({ list: rows.rows });

  } catch (e) {

    console.error("client collab pool error:", e);

    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  }

});



/** 判断是否管理员或员工 */

router.post("/client/collab-pool/:demandId/apply", async (req: AuthRequest, res: Response) => {

  if (req.user?.role !== "client") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });

  const clientId = req.user.userId;

  const demandId = Number(req.params.demandId);

  const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 1000) : "";
  const merchantShopName = typeof req.body?.merchant_shop_name === "string" ? req.body.merchant_shop_name.trim().slice(0, 200) : "";
  const merchantProductType = typeof req.body?.merchant_product_type === "string" ? req.body.merchant_product_type.trim().slice(0, 200) : "";
  const merchantSalesSummary = typeof req.body?.merchant_sales_summary === "string" ? req.body.merchant_sales_summary.trim().slice(0, 200) : "";
  const merchantShopLink = typeof req.body?.merchant_shop_link === "string" ? req.body.merchant_shop_link.trim().slice(0, 500) : "";

  if (!Number.isInteger(demandId) || demandId < 1) return res.status(400).json({ error: "INVALID_ID", message: "无效的需求ID。" });

  try {

    const d = await query<{ id: number; influencer_id: number }>("SELECT id, influencer_id FROM influencer_collab_demands WHERE id=$1 AND status='open'", [demandId]);

    if (!d.rows[0]) return res.status(404).json({ error: "NOT_FOUND", message: "需求不存在。" });

    const tpl = await query<{ shop_name: string; product_type: string; shop_link: string; shop_rating: string; user_reviews: string }>(
      `SELECT shop_name, product_type, shop_link, shop_rating, user_reviews FROM client_merchant_info_templates WHERE client_id=$1`,
      [clientId]
    );
    const merchant = tpl.rows[0];

    await query(

      `INSERT INTO influencer_demand_applications (demand_id, client_id, note, merchant_shop_name, merchant_product_type, merchant_sales_summary, merchant_shop_link, merchant_shop_rating, merchant_user_reviews)

       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)

       ON CONFLICT (demand_id, client_id) DO UPDATE SET status='pending', note=EXCLUDED.note, merchant_shop_name=EXCLUDED.merchant_shop_name, merchant_product_type=EXCLUDED.merchant_product_type, merchant_sales_summary=EXCLUDED.merchant_sales_summary, merchant_shop_link=EXCLUDED.merchant_shop_link, merchant_shop_rating=EXCLUDED.merchant_shop_rating, merchant_user_reviews=EXCLUDED.merchant_user_reviews, updated_at=now()`,

      [
        demandId,
        clientId,
        note || null,
        merchantShopName || merchant?.shop_name || null,
        merchantProductType || merchant?.product_type || null,
        merchantSalesSummary || null,
        merchantShopLink || merchant?.shop_link || null,
        merchant?.shop_rating || null,
        merchant?.user_reviews || null,
      ]

    );

    await createMessage(d.rows[0].influencer_id, "demand_apply", "收到新的商家报名", `需求 #${demandId} 收到新的商家报名。`, "demand", demandId);

    return res.status(201).json({ ok: true });

  } catch (e) {

    console.error("client apply demand error:", e);

    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  }

});



/** 商家端：我的需求报名记录（模式二）。 */


/** 商家咨询达人需求。 */
router.post("/client/collab-pool/:demandId/consult", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "client") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  const demandId = Number(req.params.demandId);
  const note = String(req.body?.note || "").trim();
  if (!Number.isInteger(demandId) || demandId < 1) return res.status(400).json({ error: "INVALID_ID", message: "无效的需求ID。" });
  if (!note) return res.status(400).json({ error: "INVALID_NOTE", message: "咨询内容不能为空。" });
  try {
    const d = await query<{ influencer_id: number }>(
      `SELECT influencer_id FROM influencer_collab_demands WHERE id=$1 AND status='open'`,
      [demandId]
    );
    const row = d.rows[0];
    if (!row) return res.status(404).json({ error: "NOT_FOUND", message: "需求不存在。" });
    await createMessage(row.influencer_id, "demand_consult", "商家咨询了您的需求", `需求 #${demandId} 收到咨询：${note}`, "demand", demandId);
    return res.status(201).json({ ok: true });
  } catch (e) {
    console.error("client consult demand error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

router.get("/client/collab-pool/my-applies", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "client") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  try {
    const rows = await query(
      `SELECT a.id, a.status, a.note, a.merchant_shop_name, a.merchant_product_type, a.merchant_sales_summary, a.merchant_shop_link, a.created_at, a.updated_at,
              d.id AS demand_id, d.title, d.status AS demand_status, d.expected_points,
              u.username AS influencer_username, COALESCE(NULLIF(u.display_name,''), u.username) AS influencer_name
       FROM influencer_demand_applications a
       JOIN influencer_collab_demands d ON d.id=a.demand_id
       JOIN users u ON u.id=d.influencer_id
       WHERE a.client_id=$1
       ORDER BY a.id DESC`,
      [req.user.userId]
    );
    return res.json({ list: rows.rows });
  } catch (e) {
    console.error("client collab my applies error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

/** 查看消息列表 */

router.get("/client/messages", async (req: AuthRequest, res: Response) => {

  if (req.user?.role !== "client") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });

  try {

    const rows = await query(`SELECT id, category, title, content, related_type, related_id, is_read, created_at FROM system_messages WHERE user_id=$1 ORDER BY id DESC LIMIT 100`, [req.user.userId]);

    return res.json({ list: rows.rows });

  } catch (e) {

    console.error("client messages error:", e);

    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  }

});



/** 商家驳回达人报名 */

router.post("/influencer/market-orders/:id/apply", async (req: AuthRequest, res: Response) => {

  if (req.user?.role !== "influencer") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });

  const influencerId = req.user.userId;

  const orderId = Number(req.params.id);

  const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 1000) : "";

  if (!Number.isInteger(orderId) || orderId < 1) return res.status(400).json({ error: "INVALID_ID", message: "无效的订单ID。" });

  try {

    const ord = await query<{ id: number; client_id: number; status: string; is_public_apply: number }>(

      `SELECT id, client_id, status, is_public_apply FROM client_market_orders WHERE id=$1 AND is_deleted=0`,

      [orderId]

    );

    const row = ord.rows[0];

    if (!row || row.status !== "open") return res.status(404).json({ error: "NOT_FOUND", message: "该订单暂不可报名。" });

    if (Number(row.is_public_apply) !== 1) return res.status(409).json({ error: "BAD_STATE", message: "该订单暂不可报名。" });

    await query(

      `INSERT INTO market_order_applications (market_order_id, influencer_id, note)

       VALUES ($1, $2, $3)

       ON CONFLICT (market_order_id, influencer_id) DO UPDATE SET status='pending', note=EXCLUDED.note, updated_at=now()`,

      [orderId, influencerId, note || null]

    );

    await query(`UPDATE client_market_orders SET match_status='pending_selection', updated_at=now() WHERE id=$1 AND match_status='open'`, [orderId]);

    await createMessage(row.client_id, "order_apply", "商单有新报名", `订单 #${orderId} 收到新的达人报名。`, "market_order", orderId);

    return res.status(201).json({ ok: true });

  } catch (e) {

    console.error("influencer apply market order error:", e);

    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  }

});



/** 判断是否管理员或员工 */

router.get("/influencer/my-applications", async (req: AuthRequest, res: Response) => {

  if (req.user?.role !== "influencer") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });

  try {

    const rows = await query(

      `SELECT a.id, a.status, a.note, a.created_at,

              mo.id AS market_order_id, mo.order_no, mo.title, mo.match_status,

              u.username AS client_username, COALESCE(NULLIF(u.display_name,''), u.username) AS client_name

       FROM market_order_applications a

       JOIN client_market_orders mo ON mo.id=a.market_order_id

       JOIN users u ON u.id=mo.client_id

       WHERE a.influencer_id=$1

       ORDER BY a.id DESC`,

      [req.user.userId]

    );

    return res.json({ list: rows.rows });

  } catch (e) {

    console.error("influencer my applications error:", e);

    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  }

});



/** 达人查看自己的合作需求列表 */

router.get("/influencer/demands", async (req: AuthRequest, res: Response) => {

  if (req.user?.role !== "influencer") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });

  try {

    const permission = await query<{ influencer_status: string }>(

      `SELECT influencer_status FROM users WHERE id=$1`,

      [req.user.userId]

    );

    const canCreate = permission.rows[0]?.influencer_status === "approved";

    const rows = await query(

      `SELECT id, title, demand_detail, expected_points, status, selected_client_id, review_note, reviewed_at, created_at, updated_at

       FROM influencer_collab_demands

       WHERE influencer_id=$1

       ORDER BY id DESC`,

      [req.user.userId]

    );

    return res.json({ can_create: canCreate, list: rows.rows });

  } catch (e) {

    console.error("influencer demands list error:", e);

    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  }

});



/** 商家查看达人合作池 */

router.post("/influencer/demands", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "influencer") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });

  const specialty = String(req.body?.specialty || "").trim();
  const fansLevel = String(req.body?.fans_level || "").trim();
  const taskTypes = Array.isArray(req.body?.task_types)
    ? (req.body.task_types as unknown[]).map((x) => String(x || "").trim()).filter(Boolean).slice(0, 10)
    : [];
  const categoriesCanDo = String(req.body?.categories_can_do || "").trim();
  const categoriesNotDo = String(req.body?.categories_not_do || "").trim();
  const needSample = String(req.body?.need_sample || "").trim();
  const unitPrice = Number(req.body?.unit_price);
  const deliveryDays = Number(req.body?.delivery_days);
  const reviseTimes = Number(req.body?.revise_times);
  const intro = String(req.body?.intro || "").trim();

  if (!specialty || !fansLevel || taskTypes.length === 0 || !categoriesCanDo || !categoriesNotDo || (needSample !== "是" && needSample !== "否") || !Number.isFinite(unitPrice) || unitPrice <= 0 || !Number.isInteger(deliveryDays) || deliveryDays < 1 || !Number.isInteger(reviseTimes) || reviseTimes < 0 || !intro) {
    return res.status(400).json({ error: "INVALID_INPUT", message: "请完整填写需求信息。" });
  }

  try {
    const permission = await query<{ influencer_status: string }>(
      `SELECT influencer_status FROM users WHERE id=$1`,
      [req.user.userId]
    );
    const canCreate = permission.rows[0]?.influencer_status === "approved";
    if (!canCreate) return res.status(403).json({ error: "FORBIDDEN", message: "当前账号没有发布权限。" });

    const detail = {
      fans_level: fansLevel,
      task_types: taskTypes,
      categories_can_do: categoriesCanDo,
      categories_not_do: categoriesNotDo,
      need_sample: needSample,
      delivery_days: deliveryDays,
      revise_times: reviseTimes,
      intro,
    };

    const created = await query<{ id: number }>(
      `INSERT INTO influencer_collab_demands (influencer_id, title, demand_detail, expected_points, status)
       VALUES ($1, $2, $3, $4, 'open') RETURNING id`,
      [req.user.userId, specialty, JSON.stringify(detail), Math.round(unitPrice)]
    );

    return res.status(201).json({ id: created.rows[0]?.id });
  } catch (e) {
    console.error("influencer create demand error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

/** 达人编辑已发布需求（仅 open/rejected 可编辑）。 */
router.put("/influencer/demands/:id", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "influencer") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  const demandId = Number(req.params.id);
  if (!Number.isInteger(demandId) || demandId < 1) return res.status(400).json({ error: "INVALID_ID", message: "无效的需求ID。" });

  const specialty = String(req.body?.specialty || "").trim();
  const fansLevel = String(req.body?.fans_level || "").trim();
  const taskTypes = Array.isArray(req.body?.task_types)
    ? (req.body.task_types as unknown[]).map((x) => String(x || "").trim()).filter(Boolean).slice(0, 10)
    : [];
  const categoriesCanDo = String(req.body?.categories_can_do || "").trim();
  const categoriesNotDo = String(req.body?.categories_not_do || "").trim();
  const needSample = String(req.body?.need_sample || "").trim();
  const unitPrice = Number(req.body?.unit_price);
  const deliveryDays = Number(req.body?.delivery_days);
  const reviseTimes = Number(req.body?.revise_times);
  const intro = String(req.body?.intro || "").trim();

  if (!specialty || !fansLevel || taskTypes.length === 0 || !categoriesCanDo || !categoriesNotDo || (needSample !== "是" && needSample !== "否") || !Number.isFinite(unitPrice) || unitPrice <= 0 || !Number.isInteger(deliveryDays) || deliveryDays < 1 || !Number.isInteger(reviseTimes) || reviseTimes < 0 || !intro) {
    return res.status(400).json({ error: "INVALID_INPUT", message: "请完整填写需求信息。" });
  }

  try {
    const permission = await query<{ influencer_status: string }>(
      `SELECT influencer_status FROM users WHERE id=$1`,
      [req.user.userId]
    );
    const canCreate = permission.rows[0]?.influencer_status === "approved";
    if (!canCreate) return res.status(403).json({ error: "FORBIDDEN", message: "当前账号没有发布权限。" });

    const detail = {
      fans_level: fansLevel,
      task_types: taskTypes,
      categories_can_do: categoriesCanDo,
      categories_not_do: categoriesNotDo,
      need_sample: needSample,
      delivery_days: deliveryDays,
      revise_times: reviseTimes,
      intro,
    };

    const updated = await query<{ id: number }>(
      `UPDATE influencer_collab_demands
          SET title=$2,
              demand_detail=$3,
              expected_points=$4,
              status='open',
              review_note=NULL,
              reviewed_by=NULL,
              reviewed_at=NULL,
              updated_at=now()
        WHERE id=$1 AND influencer_id=$5 AND status IN ('open','rejected')
        RETURNING id`,
      [demandId, specialty, JSON.stringify(detail), Math.round(unitPrice), req.user.userId]
    );

    if (!updated.rows[0]) {
      return res.status(409).json({ error: "BAD_STATE", message: "当前需求状态不可编辑。" });
    }

    return res.json({ ok: true, id: updated.rows[0].id });
  } catch (e) {
    console.error("influencer update demand error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});
/** 创建系统消息 */
router.post("/admin/cooperation-orders/:id/claim", requireRole("admin", "employee"), async (req: AuthRequest, res: Response) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId < 1) return res.status(400).json({ error: "INVALID_ID", message: "无效的订单ID。" });
  try {
    const ret = await withTx(async (client) => {
      const ord = await client.query<{ id: number; status: string; influencer_id: number | null; client_id: number }>(
        `SELECT id, status, influencer_id, client_id
           FROM client_market_orders
          WHERE id=$1 AND is_deleted=0 AND COALESCE(order_type,0)=1
          FOR UPDATE`,
        [orderId]
      );
      const row = ord.rows[0];
      if (!row) return { kind: "not_found" as const };
      if (row.status !== "open") return { kind: "locked" as const, status: row.status };
      if (row.influencer_id) return { kind: "already_claimed" as const };

      await client.query(
        `UPDATE client_market_orders
            SET influencer_id=$2,
                status='claimed',
                match_status=CASE WHEN match_status IN ('open','pending_selection') THEN 'matched' ELSE match_status END,
                allow_apply=0,
                updated_at=now()
          WHERE id=$1`,
        [orderId, req.user!.userId]
      );

      await client.query(`INSERT INTO cooperation_order_states (order_id) VALUES ($1) ON CONFLICT (order_id) DO NOTHING`, [orderId]);
      await client.query(`UPDATE cooperation_order_states SET phase='assigned', updated_at=now() WHERE order_id=$1`, [orderId]);
      return { kind: "ok" as const, clientId: row.client_id };
    });

    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    if (ret.kind === "locked") return res.status(409).json({ error: "LOCKED", message: `当前订单不可接单（${ret.status}）。` });
    if (ret.kind === "already_claimed") return res.status(409).json({ error: "ALREADY_CLAIMED", message: "订单已被接单。" });

    await createMessage(ret.clientId, "cooperation_claim", "订单已接单", `订单 #${orderId} 已由员工接单并开始处理。`, "matching_order", orderId);
    return res.json({ ok: true });
  } catch (e) {
    console.error("admin cooperation order claim error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

router.post("/admin/cooperation-orders/:id/submit-proof", requireRole("admin", "employee"), async (req: AuthRequest, res: Response) => {
  const orderId = Number(req.params.id);
  const urlsRaw = Array.isArray(req.body?.video_urls) ? (req.body.video_urls as unknown[]) : null;
  const videoUrl = String(req.body?.video_url || "").trim();
  const videoUrls =
    urlsRaw && urlsRaw.length
      ? urlsRaw.map((u) => String(u || "").trim()).filter(Boolean).slice(0, 20)
      : videoUrl
      ? [videoUrl]
      : [];
  if (!Number.isInteger(orderId) || orderId < 1) return res.status(400).json({ error: "INVALID_ID", message: "无效的订单ID。" });
  if (!videoUrls.length) return res.status(400).json({ error: "INVALID_VIDEO", message: "请填写回传短视频链接。" });
  try {
    const ret = await withTx(async (client) => {
      const ord = await client.query<{ id: number; status: string; influencer_id: number | null; client_id: number }>(
        `SELECT id, status, influencer_id, client_id
           FROM client_market_orders
          WHERE id=$1 AND is_deleted=0 AND COALESCE(order_type,0)=1
          FOR UPDATE`,
        [orderId]
      );
      const row = ord.rows[0];
      if (!row) return { kind: "not_found" as const };
      if (!row.influencer_id || row.influencer_id !== req.user!.userId) return { kind: "not_owner" as const };
      if (row.status !== "claimed") return { kind: "bad_status" as const, status: row.status };

      const detail = await client.query<{ detail_json: any }>(`SELECT detail_json FROM matching_order_details WHERE order_id=$1`, [orderId]);
      const coopTypeId = String((detail.rows[0]?.detail_json as any)?.cooperation_type_id || "").trim();

      await client.query(`UPDATE client_market_orders SET status='completed', work_links=$2::jsonb, updated_at=now(), completed_at=now() WHERE id=$1`, [
        orderId,
        JSON.stringify(videoUrls),
      ]);

      await client.query(`INSERT INTO cooperation_order_states (order_id) VALUES ($1) ON CONFLICT (order_id) DO NOTHING`, [orderId]);
      if (coopTypeId === "creator_review_video") {
        await client.query(
          `UPDATE cooperation_order_states
              SET phase='review_pending', publish_links='[]'::jsonb, review_note=NULL, reviewed_by=NULL, reviewed_at=NULL, updated_at=now()
            WHERE order_id=$1`,
          [orderId]
        );
      } else {
        await client.query(`UPDATE cooperation_order_states SET phase='submitted', updated_at=now() WHERE order_id=$1`, [orderId]);
      }

      return { kind: "ok" as const, clientId: row.client_id, coopTypeId };
    });

    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    if (ret.kind === "not_owner") return res.status(403).json({ error: "FORBIDDEN", message: "无权限操作该订单。" });
    if (ret.kind === "bad_status") return res.status(409).json({ error: "BAD_STATE", message: `当前状态不可提交（${ret.status}）。` });

    await createMessage(ret.clientId, "cooperation_submit", "已提交交付", `订单 #${orderId} 已提交交付链接，等待后续处理。`, "matching_order", orderId);
    return res.json({ ok: true });
  } catch (e) {
    console.error("admin cooperation order submit proof error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

router.post("/admin/cooperation-orders/:id/publish", requireRole("admin", "employee"), async (req: AuthRequest, res: Response) => {
  const orderId = Number(req.params.id);
  const publishLink = String(req.body?.publish_link || "").trim();
  if (!Number.isInteger(orderId) || orderId < 1) return res.status(400).json({ error: "INVALID_ID", message: "无效的订单ID。" });
  if (!publishLink) return res.status(400).json({ error: "INVALID_LINK", message: "请填写发布链接。" });
  try {
    const ret = await withTx(async (client) => {
      const ord = await client.query<{ id: number; influencer_id: number | null; client_id: number }>(
        `SELECT id, influencer_id, client_id
           FROM client_market_orders
          WHERE id=$1 AND is_deleted=0 AND COALESCE(order_type,0)=1
          FOR UPDATE`,
        [orderId]
      );
      const row = ord.rows[0];
      if (!row) return { kind: "not_found" as const };
      if (!row.influencer_id || row.influencer_id !== req.user!.userId) return { kind: "not_owner" as const };

      const detail = await client.query<{ detail_json: any }>(`SELECT detail_json FROM matching_order_details WHERE order_id=$1`, [orderId]);
      const coopTypeId = String((detail.rows[0]?.detail_json as any)?.cooperation_type_id || "").trim();

      await client.query(`INSERT INTO cooperation_order_states (order_id) VALUES ($1) ON CONFLICT (order_id) DO NOTHING`, [orderId]);
      const st = await client.query<{ phase: string }>(`SELECT phase FROM cooperation_order_states WHERE order_id=$1 FOR UPDATE`, [orderId]);
      const curPhase = String(st.rows[0]?.phase || "none");
      if (coopTypeId === "creator_review_video" && curPhase !== "approved_to_publish") return { kind: "bad_phase" as const, phase: curPhase };

      await client.query(
        `UPDATE cooperation_order_states
            SET phase='published',
                publish_links = COALESCE(publish_links,'[]'::jsonb) || to_jsonb(ARRAY[$2]::text[]),
                updated_at=now()
          WHERE order_id=$1`,
        [orderId, publishLink]
      );

      return { kind: "ok" as const, clientId: row.client_id, coopTypeId };
    });

    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    if (ret.kind === "not_owner") return res.status(403).json({ error: "FORBIDDEN", message: "无权限操作该订单。" });
    if (ret.kind === "bad_phase") return res.status(409).json({ error: "BAD_STATE", message: `当前阶段不可提交发布链接（${ret.phase}）。` });

    await createMessage(ret.clientId, "cooperation_publish", "已提交发布链接", `订单 #${orderId} 已提交发布链接。`, "matching_order", orderId);
    return res.json({ ok: true });
  } catch (e) {
    console.error("admin cooperation order publish error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});


router.get("/influencer/demands/:id/applications", async (req: AuthRequest, res: Response) => {

  if (req.user?.role !== "influencer") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });

  if (req.user?.role !== "influencer") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });

  const demandId = Number(req.params.id);

  if (!Number.isInteger(demandId) || demandId < 1) return res.status(400).json({ error: "INVALID_ID", message: "无效的需求ID。" });

  try {

    const own = await query<{ id: number }>("SELECT id FROM influencer_collab_demands WHERE id=$1 AND influencer_id=$2", [demandId, req.user.userId]);

    if (!own.rows[0]) return res.status(404).json({ error: "NOT_FOUND", message: "无权限访问。" });

    const rows = await query(

      `SELECT a.id, a.status, a.note, a.merchant_shop_name, a.merchant_product_type, a.merchant_sales_summary, a.merchant_shop_link,
              a.merchant_shop_rating, a.merchant_user_reviews, a.created_at,
              u.id AS client_id, u.username AS client_username, COALESCE(NULLIF(u.display_name,''), u.username) AS client_name
       FROM influencer_demand_applications a
       JOIN users u ON u.id = a.client_id
       WHERE a.demand_id = $1
       ORDER BY a.id DESC`,
      [demandId]

    );

    return res.json({ list: rows.rows });

  } catch (e) {

    console.error("influencer demand applications list error:", e);

    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  }

});



/** 判断是否管理员或员工 */

router.post("/influencer/demands/:id/applications/:appId/select", async (req: AuthRequest, res: Response) => {

  if (req.user?.role !== "influencer") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });

  const demandId = Number(req.params.id);

  const appId = Number(req.params.appId);

  if (!Number.isInteger(demandId) || demandId < 1) return res.status(400).json({ error: "INVALID_ID", message: "无效的需求ID。" });

  try {

    const result = await withTx(async (client) => {

      const demand = await client.query<{ id: number; status: string }>(

        `SELECT id, status FROM influencer_collab_demands WHERE id=$1 AND influencer_id=$2 FOR UPDATE`,

        [demandId, req.user!.userId]

      );

      if (!demand.rows[0]) return { kind: "not_found" as const };

      if (demand.rows[0].status !== "open") return { kind: "bad_state" as const };

      const app = await client.query<{ id: number; client_id: number }>(

        `SELECT id, client_id FROM influencer_demand_applications WHERE id=$1 AND demand_id=$2 FOR UPDATE`,

        [appId, demandId]

      );

      if (!app.rows[0]) return { kind: "app_not_found" as const };

      await client.query(`UPDATE influencer_demand_applications SET status='selected', updated_at=now() WHERE id=$1`, [appId]);

      await client.query(`UPDATE influencer_demand_applications SET status='rejected', updated_at=now() WHERE demand_id=$1 AND id<>$2 AND status='pending'`, [demandId, appId]);

      await client.query(`UPDATE influencer_collab_demands SET status='matched', selected_client_id=$1, updated_at=now() WHERE id=$2`, [app.rows[0].client_id, demandId]);

      return { kind: "ok" as const, clientId: app.rows[0].client_id };

    });

    if (result.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "无权限访问。" });

    if (result.kind === "app_not_found") return res.status(404).json({ error: "NOT_FOUND", message: "无权限访问。" });

    if (result.kind === "bad_state") return res.status(409).json({ error: "BAD_STATE", message: "当前状态不允许该操作。" });

    await createMessage(result.clientId, "demand_match", "合作需求已匹配", `需求 #${demandId} 的报名已被达人选中。`, "demand", demandId);

    return res.json({ ok: true });

  } catch (e) {

    console.error("influencer select client error:", e);

    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  }

});



/** 达人拒绝客户端报名 */

router.post("/influencer/demands/:id/applications/:appId/reject", async (req: AuthRequest, res: Response) => {

  if (req.user?.role !== "influencer") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });

  const demandId = Number(req.params.id);

  const appId = Number(req.params.appId);

  if (!Number.isInteger(demandId) || demandId < 1) return res.status(400).json({ error: "INVALID_ID", message: "无效的需求ID。" });

  try {

    const updated = await query<{ client_id: number }>(

      `UPDATE influencer_demand_applications a

       SET status='rejected', updated_at=now()

       FROM influencer_collab_demands d

       WHERE a.id=$1 AND a.demand_id=$2 AND d.id=$2 AND d.influencer_id=$3

       RETURNING a.client_id`,

      [appId, demandId, req.user.userId]

    );

    if (!updated.rows[0]) return res.status(404).json({ error: "NOT_FOUND", message: "无权限访问。" });

    await createMessage(updated.rows[0].client_id, "demand_reject", "合作需求报名被拒绝", `需求 #${demandId} 的报名未通过。`, "demand", demandId);

    return res.json({ ok: true });

  } catch (e) {

    console.error("influencer reject client error:", e);

    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  }

});



/** 查看消息列表 */

router.get("/influencer/messages", async (req: AuthRequest, res: Response) => {

  if (req.user?.role !== "influencer") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });

  try {

    const rows = await query(`SELECT id, category, title, content, related_type, related_id, is_read, created_at FROM system_messages WHERE user_id=$1 ORDER BY id DESC LIMIT 100`, [req.user.userId]);

    return res.json({ list: rows.rows });

  } catch (e) {

    console.error("influencer messages error:", e);

    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  }

});



/** 商家驳回达人报名 */

router.get("/admin/demands", async (req: AuthRequest, res: Response) => {

  if (!isAdminLike(req.user?.role || "")) return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });

  const status = typeof req.query.status === "string" ? req.query.status.trim() : "";

  try {

    const rows = await query(

      `SELECT d.id, d.title, d.demand_detail, d.expected_points, d.status, d.review_note, d.created_at,

              u.username AS influencer_username, COALESCE(NULLIF(u.display_name,''), u.username) AS influencer_name

       FROM influencer_collab_demands d

       JOIN users u ON u.id=d.influencer_id

       WHERE ($1='' OR d.status=$1)

       ORDER BY d.id DESC`,

      [status]

    );

    return res.json({ list: rows.rows });

  } catch (e) {

    console.error("admin demands list error:", e);

    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  }

});



/** 管理员审核需求（通过/驳回） */

router.post("/admin/demands/:id/review", async (req: AuthRequest, res: Response) => {

  if (!isAdminLike(req.user?.role || "")) return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });

  const demandId = Number(req.params.id);

  const action = String(req.body?.action || "").trim();

  const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 1000) : "";

  if (!Number.isInteger(demandId) || demandId < 1) return res.status(400).json({ error: "INVALID_ID", message: "无效的需求ID。" });

  if (action !== "approve" && action !== "reject") return res.status(400).json({ error: "INVALID_ACTION", message: "无效的操作参数。" });

  try {

    const nextStatus = action === "approve" ? "open" : "rejected";

    const updated = await query<{ influencer_id: number }>(

      `UPDATE influencer_collab_demands

       SET status=$1, review_note=$2, reviewed_by=$3, reviewed_at=now(), updated_at=now()

       WHERE id=$4

       RETURNING influencer_id`,

      [nextStatus, note || null, req.user!.userId, demandId]

    );

    if (!updated.rows[0]) return res.status(404).json({ error: "NOT_FOUND", message: "无权限访问。" });

    await createMessage(updated.rows[0].influencer_id, "demand_review", action === "approve" ? "合作需求审核通过" : "合作需求审核驳回", `需求 #${demandId} 审核结果：${action === "approve" ? "通过" : "驳回"}。`, "demand", demandId);

    return res.json({ ok: true });

  } catch (e) {

    console.error("admin review demand error:", e);

    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  }

});



/** 商家驳回达人报名 */

router.get("/admin/premium-creators", async (req: AuthRequest, res: Response) => {

  if (!isAdminLike(req.user?.role || "")) return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });

  try {

    const rows = await query(

      `SELECT u.id, u.username, COALESCE(NULLIF(u.display_name,''), u.username) AS display_name,

              COALESCE(p.is_premium, 0) AS is_premium,

              COALESCE(p.can_publish_demand, 0) AS can_publish_demand

       FROM users u

       LEFT JOIN influencer_profiles p ON p.user_id = u.id

       JOIN roles r ON r.id = u.role_id

       WHERE r.name='influencer'

       ORDER BY u.id DESC`

    );

    return res.json({ list: rows.rows });

  } catch (e) {

    console.error("admin premium creators error:", e);

    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  }

});



/** 管理员设置达人发布权限 */

router.patch("/admin/premium-creators/:id", async (req: AuthRequest, res: Response) => {

  if (!isAdminLike(req.user?.role || "")) return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });

  const influencerId = Number(req.params.id);

  const canPublish = !!req.body?.can_publish_demand;

  if (!Number.isInteger(influencerId) || influencerId < 1) return res.status(400).json({ error: "INVALID_ID", message: "无效的ID。" });

  try {

    await query(

      `INSERT INTO influencer_profiles (user_id, is_premium, can_publish_demand)

       VALUES ($1, $2, $2)

       ON CONFLICT (user_id)

       DO UPDATE SET is_premium = EXCLUDED.is_premium, can_publish_demand = EXCLUDED.can_publish_demand, updated_at = now()`,

      [influencerId, canPublish ? 1 : 0]

    );

    await createMessage(influencerId, "permission", "合作需求发布权限变更", canPublish ? "您已获得发布合作需求权限。" : "您的合作需求发布权限已关闭。", "permission", influencerId);

    return res.json({ ok: true });

  } catch (e) {

    console.error("admin update premium creator error:", e);

    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  }

});



/** 查看消息列表 */

router.get("/admin/messages", async (req: AuthRequest, res: Response) => {

  if (!isAdminLike(req.user?.role || "")) return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });

  try {

    const rows = await query(`SELECT id, category, title, content, related_type, related_id, is_read, created_at FROM system_messages ORDER BY id DESC LIMIT 100`);

    return res.json({ list: rows.rows });

  } catch (e) {

    console.error("admin messages error:", e);

    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  }

});

/** 读取达人撮合权限状态。 */
router.get("/influencer/permission-status", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "influencer") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  try {
    const ret = await query<{
      influencer_status: string;
      is_influencer_verified: number;
      tiktok_account: string | null;
      tiktok_fans: string | null;
      category: string | null;
    }>(`SELECT influencer_status, is_influencer_verified, tiktok_account, tiktok_fans, category FROM users WHERE id=$1`, [req.user.userId]);
    const row = ret.rows[0];
    if (!row) return res.status(404).json({ error: "NOT_FOUND", message: "用户不存在。" });
    return res.json({ status: row.influencer_status, profile: row });
  } catch (e) {
    console.error("influencer permission status error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

/** 达人提交/重提撮合权限申请。 */
router.post("/influencer/permission-apply", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "influencer") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  const tiktokAccount = String(req.body?.tiktok_account || "").trim();
  const tiktokFans = String(req.body?.tiktok_fans || "").trim();
  const category = String(req.body?.category || "").trim();
  const bio = String(req.body?.bio || "").trim();
  if (!tiktokAccount || !tiktokFans || !category || !bio) return res.status(400).json({ error: "INVALID_INPUT", message: "请完整填写申请资料。" });
  try {
    await query(`UPDATE users SET influencer_status='pending', is_influencer_verified=0, tiktok_account=$2, tiktok_fans=$3, category=$4, display_name=COALESCE(display_name, username) WHERE id=$1`, [req.user.userId, tiktokAccount, tiktokFans, `${category} | ${bio}`]);
    const admins = await query<{ id: number }>(`SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id WHERE r.name='admin' AND u.disabled=0`);
    await Promise.all(admins.rows.map((a) => createMessage(a.id, "permission_apply", "达人撮合权限待审核", `达人 #${req.user!.userId} 提交了撮合权限申请。`, "permission", req.user!.userId)));
    return res.status(201).json({ ok: true, status: "pending" });
  } catch (e) {
    console.error("influencer permission apply error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

/** 模式一任务大厅（仅开放报名任务）。 */
router.get("/influencer/task-hall", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "influencer") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  try {
    const rows = await query(`SELECT mo.id, mo.order_no, mo.title, mo.reward_points, mo.status, mo.match_status, mo.created_at, mo.client_shop_name, mo.client_group_chat, mo.is_public_apply, mo.allow_apply, u.username AS client_username, COALESCE(NULLIF(u.display_name,''),u.username) AS client_name FROM client_market_orders mo JOIN users u ON u.id=mo.client_id WHERE mo.is_deleted=0 AND mo.status='open' AND COALESCE(mo.allow_apply,1)=1 AND COALESCE(mo.is_public_apply,0)=1 ORDER BY mo.id DESC`);
    return res.json({ list: rows.rows });
  } catch (e) {
    console.error("influencer task hall error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

/** 管理端：达人撮合权限审核列表。 */
router.get("/admin/influencer-permissions", async (req: AuthRequest, res: Response) => {
  if (!isAdminLike(req.user?.role || "")) return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  try {
    const rows = await query(`SELECT u.id, u.username, COALESCE(NULLIF(u.display_name,''),u.username) AS display_name, u.influencer_status, u.is_influencer_verified, u.tiktok_account, u.tiktok_fans, u.category, u.real_name, u.bank_name, u.bank_branch, u.bank_card, u.disabled FROM users u JOIN roles r ON r.id=u.role_id WHERE r.name='influencer' ORDER BY u.id DESC`);
    return res.json({ list: rows.rows });
  } catch (e) {
    console.error("admin influencer permissions error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

/** 管理端：审核达人撮合权限。 */
router.post("/admin/influencer-permissions/:id/review", async (req: AuthRequest, res: Response) => {
  if (!isAdminLike(req.user?.role || "")) return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  const userId = Number(req.params.id);
  const action = String(req.body?.action || "").trim();
  const note = String(req.body?.note || "").trim();
  if (!Number.isInteger(userId) || userId < 1) return res.status(400).json({ error: "INVALID_ID", message: "无效的用户ID。" });
  if (action !== "approve" && action !== "reject") return res.status(400).json({ error: "INVALID_ACTION", message: "无效的审核动作。" });
  try {
    const status = action === "approve" ? "approved" : "rejected";
    await query(`UPDATE users SET influencer_status=$2, is_influencer_verified=$3 WHERE id=$1`, [userId, status, action === "approve" ? 1 : 0]);
    await createMessage(userId, "permission_review", action === "approve" ? "达人撮合权限审核通过" : "达人撮合权限审核驳回", note || (action === "approve" ? "您已可使用撮合功能。" : "审核未通过，可重新申请。"), "permission", userId);
    return res.json({ ok: true });
  } catch (e) {
    console.error("admin review influencer permission error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

/** 管理端：手动开关达人撮合权限。 */
router.patch("/admin/influencer-permissions/:id/toggle", async (req: AuthRequest, res: Response) => {
  if (!isAdminLike(req.user?.role || "")) return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  const userId = Number(req.params.id);
  const enabled = Boolean(req.body?.enabled);
  if (!Number.isInteger(userId) || userId < 1) return res.status(400).json({ error: "INVALID_ID", message: "无效的用户ID。" });
  try {
    await query(`UPDATE users SET influencer_status=$2, is_influencer_verified=$3 WHERE id=$1`, [userId, enabled ? "approved" : "disabled", enabled ? 1 : 0]);
    await createMessage(userId, "permission_toggle", "达人撮合权限状态变更", enabled ? "管理员已手动开启您的撮合权限。" : "管理员已手动关闭您的撮合权限。", "permission", userId);
    return res.json({ ok: true });
  } catch (e) {
    console.error("admin toggle influencer permission error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

export default router;
