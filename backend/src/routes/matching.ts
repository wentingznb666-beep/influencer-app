import { Router, Response } from "express";
import { query, withTx } from "../db";
import { requireAuth, type AuthRequest } from "../auth";

const router = Router();
router.use(requireAuth);

/** ?????????????????? */
async function createMessage(userId: number, category: string, title: string, content: string, relatedType?: string, relatedId?: number): Promise<void> {
  await query(
    `INSERT INTO system_messages (user_id, category, title, content, related_type, related_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, category, title, content, relatedType ?? null, relatedId ?? null]
  );
}

/** ??????????? */
function isAdminLike(role: string): boolean {
  return role === "admin" || role === "employee";
}

/** ?????????????????? */
router.get("/client/market-orders/:id/applications", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "client") return res.status(403).json({ error: "FORBIDDEN", message: "??????" });
  const clientId = req.user.userId;
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId < 1) return res.status(400).json({ error: "INVALID_ID", message: "????ID?" });
  try {
    const own = await query<{ id: number }>("SELECT id FROM client_market_orders WHERE id=$1 AND client_id=$2 AND is_deleted=0", [orderId, clientId]);
    if (!own.rows[0]) return res.status(404).json({ error: "NOT_FOUND", message: "??????" });
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
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "??????????????" });
  }
});

/** ?????????????????? */
router.post("/client/market-orders/:id/applications/:appId/select", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "client") return res.status(403).json({ error: "FORBIDDEN", message: "??????" });
  const clientId = req.user.userId;
  const orderId = Number(req.params.id);
  const appId = Number(req.params.appId);
  if (!Number.isInteger(orderId) || !Number.isInteger(appId) || orderId < 1 || appId < 1) return res.status(400).json({ error: "INVALID_ID", message: "??ID?" });
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
    if (result.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "??????" });
    if (result.kind === "app_not_found") return res.status(404).json({ error: "NOT_FOUND", message: "????????" });
    if (result.kind === "bad_state") return res.status(409).json({ error: "BAD_STATE", message: "?????????" });
    await createMessage(result.influencerId, "match", "??????", `?? #${orderId} ?????????????`, "market_order", orderId);
    return res.json({ ok: true });
  } catch (e) {
    console.error("client select influencer error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "??????????????" });
  }
});

/** ????????????? */
router.post("/client/market-orders/:id/applications/:appId/reject", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "client") return res.status(403).json({ error: "FORBIDDEN", message: "??????" });
  const clientId = req.user.userId;
  const orderId = Number(req.params.id);
  const appId = Number(req.params.appId);
  if (!Number.isInteger(orderId) || !Number.isInteger(appId) || orderId < 1 || appId < 1) return res.status(400).json({ error: "INVALID_ID", message: "??ID?" });
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
    if (!row) return res.status(404).json({ error: "NOT_FOUND", message: "??????" });
    await createMessage(row.influencer_id, "match", "?????", `?? #${orderId} ???????`, "market_order", orderId);
    return res.json({ ok: true });
  } catch (e) {
    console.error("client reject influencer error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "??????????????" });
  }
});

/** ???????????????????? */
router.get("/client/collab-pool", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "client") return res.status(403).json({ error: "FORBIDDEN", message: "??????" });
  try {
    const rows = await query(
      `SELECT d.id, d.title, d.demand_detail, d.expected_points, d.status, d.created_at,
              u.username AS influencer_username, COALESCE(NULLIF(u.display_name,''), u.username) AS influencer_name
       FROM influencer_collab_demands d
       JOIN users u ON u.id=d.influencer_id
       WHERE d.status='open'
       ORDER BY d.id DESC`
    );
    return res.json({ list: rows.rows });
  } catch (e) {
    console.error("client collab pool error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "??????????????" });
  }
});

/** ??????????? */
router.post("/client/collab-pool/:demandId/apply", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "client") return res.status(403).json({ error: "FORBIDDEN", message: "??????" });
  const clientId = req.user.userId;
  const demandId = Number(req.params.demandId);
  const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 1000) : "";
  if (!Number.isInteger(demandId) || demandId < 1) return res.status(400).json({ error: "INVALID_ID", message: "??ID?" });
  try {
    const d = await query<{ id: number; influencer_id: number }>("SELECT id, influencer_id FROM influencer_collab_demands WHERE id=$1 AND status='open'", [demandId]);
    if (!d.rows[0]) return res.status(404).json({ error: "NOT_FOUND", message: "??????????" });
    await query(
      `INSERT INTO influencer_demand_applications (demand_id, client_id, note)
       VALUES ($1, $2, $3)
       ON CONFLICT (demand_id, client_id) DO UPDATE SET status='pending', note=EXCLUDED.note, updated_at=now()`,
      [demandId, clientId, note || null]
    );
    await createMessage(d.rows[0].influencer_id, "demand_apply", "???????", `?????? #${demandId} ??????`, "demand", demandId);
    return res.status(201).json({ ok: true });
  } catch (e) {
    console.error("client apply demand error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "??????????????" });
  }
});

/** ????????? */
router.get("/client/messages", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "client") return res.status(403).json({ error: "FORBIDDEN", message: "??????" });
  try {
    const rows = await query(`SELECT id, category, title, content, related_type, related_id, is_read, created_at FROM system_messages WHERE user_id=$1 ORDER BY id DESC LIMIT 100`, [req.user.userId]);
    return res.json({ list: rows.rows });
  } catch (e) {
    console.error("client messages error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "??????????????" });
  }
});

/** ????????????? */
router.post("/influencer/market-orders/:id/apply", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "influencer") return res.status(403).json({ error: "FORBIDDEN", message: "??????" });
  const influencerId = req.user.userId;
  const orderId = Number(req.params.id);
  const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 1000) : "";
  if (!Number.isInteger(orderId) || orderId < 1) return res.status(400).json({ error: "INVALID_ID", message: "????ID?" });
  try {
    const ord = await query<{ id: number; client_id: number; status: string; is_public_apply: number }>(
      `SELECT id, client_id, status, is_public_apply FROM client_market_orders WHERE id=$1 AND is_deleted=0`,
      [orderId]
    );
    const row = ord.rows[0];
    if (!row || row.status !== "open") return res.status(404).json({ error: "NOT_FOUND", message: "???????????" });
    if (Number(row.is_public_apply) !== 1) return res.status(409).json({ error: "BAD_STATE", message: "???????????" });
    await query(
      `INSERT INTO market_order_applications (market_order_id, influencer_id, note)
       VALUES ($1, $2, $3)
       ON CONFLICT (market_order_id, influencer_id) DO UPDATE SET status='pending', note=EXCLUDED.note, updated_at=now()`,
      [orderId, influencerId, note || null]
    );
    await query(`UPDATE client_market_orders SET match_status='pending_selection', updated_at=now() WHERE id=$1 AND match_status='open'`, [orderId]);
    await createMessage(row.client_id, "order_apply", "???????", `?? #${orderId} ?????????`, "market_order", orderId);
    return res.status(201).json({ ok: true });
  } catch (e) {
    console.error("influencer apply market order error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "??????????????" });
  }
});

/** ??????????? */
router.get("/influencer/my-applications", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "influencer") return res.status(403).json({ error: "FORBIDDEN", message: "??????" });
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
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "??????????????" });
  }
});

/** ???????????????? */
router.get("/influencer/demands", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "influencer") return res.status(403).json({ error: "FORBIDDEN", message: "??????" });
  try {
    const profile = await query<{ is_premium: number; can_publish_demand: number }>(
      `SELECT is_premium, can_publish_demand FROM influencer_profiles WHERE user_id=$1`,
      [req.user.userId]
    );
    const canCreate = Number(profile.rows[0]?.is_premium || 0) === 1 && Number(profile.rows[0]?.can_publish_demand || 0) === 1;
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
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "??????????????" });
  }
});

/** ???????????????????? */
router.post("/influencer/demands", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "influencer") return res.status(403).json({ error: "FORBIDDEN", message: "??????" });
  const title = String(req.body?.title || "").trim();
  const demandDetail = String(req.body?.demand_detail || "").trim();
  const expected = Number(req.body?.expected_points);
  if (!title || title.length > 200) return res.status(400).json({ error: "INVALID_TITLE", message: "????????1-200???" });
  if (!Number.isInteger(expected) || expected < 1) return res.status(400).json({ error: "INVALID_POINTS", message: "???????????" });
  try {
    const profile = await query<{ is_premium: number; can_publish_demand: number }>(
      `SELECT is_premium, can_publish_demand FROM influencer_profiles WHERE user_id=$1`,
      [req.user.userId]
    );
    const canCreate = Number(profile.rows[0]?.is_premium || 0) === 1 && Number(profile.rows[0]?.can_publish_demand || 0) === 1;
    if (!canCreate) return res.status(403).json({ error: "FORBIDDEN", message: "?????????????" });
    const created = await query<{ id: number }>(
      `INSERT INTO influencer_collab_demands (influencer_id, title, demand_detail, expected_points, status)
       VALUES ($1, $2, $3, $4, 'pending_review') RETURNING id`,
      [req.user.userId, title, demandDetail || null, expected]
    );
    return res.status(201).json({ id: created.rows[0]?.id });
  } catch (e) {
    console.error("influencer create demand error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "??????????????" });
  }
});

/** ?????????????????? */
router.get("/influencer/demands/:id/applications", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "influencer") return res.status(403).json({ error: "FORBIDDEN", message: "??????" });
  const demandId = Number(req.params.id);
  if (!Number.isInteger(demandId) || demandId < 1) return res.status(400).json({ error: "INVALID_ID", message: "??ID?" });
  try {
    const own = await query<{ id: number }>("SELECT id FROM influencer_collab_demands WHERE id=$1 AND influencer_id=$2", [demandId, req.user.userId]);
    if (!own.rows[0]) return res.status(404).json({ error: "NOT_FOUND", message: "??????" });
    const rows = await query(
      `SELECT a.id, a.status, a.note, a.created_at,
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
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "??????????????" });
  }
});

/** ??????????? */
router.post("/influencer/demands/:id/applications/:appId/select", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "influencer") return res.status(403).json({ error: "FORBIDDEN", message: "??????" });
  const demandId = Number(req.params.id);
  const appId = Number(req.params.appId);
  if (!Number.isInteger(demandId) || !Number.isInteger(appId) || demandId < 1 || appId < 1) return res.status(400).json({ error: "INVALID_ID", message: "??ID?" });
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
    if (result.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "??????" });
    if (result.kind === "app_not_found") return res.status(404).json({ error: "NOT_FOUND", message: "??????" });
    if (result.kind === "bad_state") return res.status(409).json({ error: "BAD_STATE", message: "?????????" });
    await createMessage(result.clientId, "demand_match", "??????", `?? #${demandId} ???????`, "demand", demandId);
    return res.json({ ok: true });
  } catch (e) {
    console.error("influencer select client error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "??????????????" });
  }
});

/** ???????????? */
router.post("/influencer/demands/:id/applications/:appId/reject", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "influencer") return res.status(403).json({ error: "FORBIDDEN", message: "??????" });
  const demandId = Number(req.params.id);
  const appId = Number(req.params.appId);
  if (!Number.isInteger(demandId) || !Number.isInteger(appId) || demandId < 1 || appId < 1) return res.status(400).json({ error: "INVALID_ID", message: "??ID?" });
  try {
    const updated = await query<{ client_id: number }>(
      `UPDATE influencer_demand_applications a
       SET status='rejected', updated_at=now()
       FROM influencer_collab_demands d
       WHERE a.id=$1 AND a.demand_id=$2 AND d.id=$2 AND d.influencer_id=$3
       RETURNING a.client_id`,
      [appId, demandId, req.user.userId]
    );
    if (!updated.rows[0]) return res.status(404).json({ error: "NOT_FOUND", message: "??????" });
    await createMessage(updated.rows[0].client_id, "demand_reject", "?????????", `?? #${demandId} ??????`, "demand", demandId);
    return res.json({ ok: true });
  } catch (e) {
    console.error("influencer reject client error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "??????????????" });
  }
});

/** ????????? */
router.get("/influencer/messages", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "influencer") return res.status(403).json({ error: "FORBIDDEN", message: "??????" });
  try {
    const rows = await query(`SELECT id, category, title, content, related_type, related_id, is_read, created_at FROM system_messages WHERE user_id=$1 ORDER BY id DESC LIMIT 100`, [req.user.userId]);
    return res.json({ list: rows.rows });
  } catch (e) {
    console.error("influencer messages error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "??????????????" });
  }
});

/** ????????????? */
router.get("/admin/demands", async (req: AuthRequest, res: Response) => {
  if (!isAdminLike(req.user?.role || "")) return res.status(403).json({ error: "FORBIDDEN", message: "??????" });
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
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "??????????????" });
  }
});

/** ?????????????/???? */
router.post("/admin/demands/:id/review", async (req: AuthRequest, res: Response) => {
  if (!isAdminLike(req.user?.role || "")) return res.status(403).json({ error: "FORBIDDEN", message: "??????" });
  const demandId = Number(req.params.id);
  const action = String(req.body?.action || "").trim();
  const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 1000) : "";
  if (!Number.isInteger(demandId) || demandId < 1) return res.status(400).json({ error: "INVALID_ID", message: "??ID?" });
  if (action !== "approve" && action !== "reject") return res.status(400).json({ error: "INVALID_ACTION", message: "???????" });
  try {
    const nextStatus = action === "approve" ? "open" : "rejected";
    const updated = await query<{ influencer_id: number }>(
      `UPDATE influencer_collab_demands
       SET status=$1, review_note=$2, reviewed_by=$3, reviewed_at=now(), updated_at=now()
       WHERE id=$4
       RETURNING influencer_id`,
      [nextStatus, note || null, req.user!.userId, demandId]
    );
    if (!updated.rows[0]) return res.status(404).json({ error: "NOT_FOUND", message: "??????" });
    await createMessage(updated.rows[0].influencer_id, "demand_review", action === "approve" ? "????????" : "????????", `?? #${demandId} ?????${action === "approve" ? "??" : "??"}?`, "demand", demandId);
    return res.json({ ok: true });
  } catch (e) {
    console.error("admin review demand error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "??????????????" });
  }
});

/** ????????????? */
router.get("/admin/premium-creators", async (req: AuthRequest, res: Response) => {
  if (!isAdminLike(req.user?.role || "")) return res.status(403).json({ error: "FORBIDDEN", message: "??????" });
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
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "??????????????" });
  }
});

/** ??????????????????????? */
router.patch("/admin/premium-creators/:id", async (req: AuthRequest, res: Response) => {
  if (!isAdminLike(req.user?.role || "")) return res.status(403).json({ error: "FORBIDDEN", message: "??????" });
  const influencerId = Number(req.params.id);
  const canPublish = !!req.body?.can_publish_demand;
  if (!Number.isInteger(influencerId) || influencerId < 1) return res.status(400).json({ error: "INVALID_ID", message: "??ID?" });
  try {
    await query(
      `INSERT INTO influencer_profiles (user_id, is_premium, can_publish_demand)
       VALUES ($1, $2, $2)
       ON CONFLICT (user_id)
       DO UPDATE SET is_premium = EXCLUDED.is_premium, can_publish_demand = EXCLUDED.can_publish_demand, updated_at = now()`,
      [influencerId, canPublish ? 1 : 0]
    );
    await createMessage(influencerId, "permission", "????????", canPublish ? "?????????????" : "??????????????", "permission", influencerId);
    return res.json({ ok: true });
  } catch (e) {
    console.error("admin update premium creator error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "??????????????" });
  }
});

/** ????????? */
router.get("/admin/messages", async (req: AuthRequest, res: Response) => {
  if (!isAdminLike(req.user?.role || "")) return res.status(403).json({ error: "FORBIDDEN", message: "??????" });
  try {
    const rows = await query(`SELECT id, category, title, content, related_type, related_id, is_read, created_at FROM system_messages ORDER BY id DESC LIMIT 100`);
    return res.json({ list: rows.rows });
  } catch (e) {
    console.error("admin messages error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "??????????????" });
  }
});

export default router;
