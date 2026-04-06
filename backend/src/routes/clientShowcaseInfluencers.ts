import { Router, Response } from "express";
import { query, normalizePhotosFromDb } from "../db";
import { requireAuth, requireRole, type AuthRequest } from "../auth";

const router = Router();
router.use(requireAuth);
router.use(requireRole("client"));

/**
 * GET /api/client/showcase-influencers
 * 客户端浏览已启用的 Influencer（含本人是否已预约）。
 */
router.get("/", (req: AuthRequest, res: Response) => {
  const clientId = req.user!.userId;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  (async () => {
    const params: unknown[] = [clientId];
    let idx = 2;
    let sql = `
      SELECT s.id, s.name, s.intro, s.photos, s.tiktok_url, s.tiktok_followers_text, s.sales_text,
             s.sellable_types_text, s.fee_quote_text, s.status, s.updated_at,
             CASE WHEN c.id IS NULL THEN 0 ELSE 1 END AS selected
        FROM showcase_influencers s
        LEFT JOIN client_showcase_influencer_favorites c
          ON c.showcase_influencer_id = s.id AND c.client_id = $1 AND c.is_deleted = 0
       WHERE s.is_deleted = 0 AND s.status = 'enabled'
    `;
    if (q) {
      sql += ` AND (s.name ILIKE '%' || $${idx} || '%' OR COALESCE(s.intro, '') ILIKE '%' || $${idx} || '%')`;
      params.push(q);
    }
    sql += ` ORDER BY s.id DESC`;
    const { rows } = await query(sql, params);
    const list = rows.map((r: Record<string, unknown>) => ({
      ...r,
      photos: normalizePhotosFromDb(r.photos),
    }));
    res.json({ list });
  })().catch((e) => {
    console.error("client showcase influencers list error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * GET /api/client/showcase-influencers/my
 * 客户端已预约的 Influencer 列表。
 */
router.get("/my", (req: AuthRequest, res: Response) => {
  const clientId = req.user!.userId;
  (async () => {
    const { rows } = await query(
      `SELECT s.id, s.name, s.intro, s.photos, s.tiktok_url, s.tiktok_followers_text, s.sales_text,
              s.sellable_types_text, s.fee_quote_text, s.updated_at
         FROM client_showcase_influencer_favorites c
         JOIN showcase_influencers s ON c.showcase_influencer_id = s.id
        WHERE c.client_id = $1
          AND c.is_deleted = 0
          AND s.is_deleted = 0
        ORDER BY c.id DESC`,
      [clientId]
    );
    const list = rows.map((r: Record<string, unknown>) => ({
      ...r,
      photos: normalizePhotosFromDb(r.photos),
    }));
    res.json({ list });
  })().catch((e) => {
    console.error("client my showcase influencers error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * PUT /api/client/showcase-influencers/:id/selection
 * 预约或取消预约 Influencer（仅切换状态，无表单编辑）。
 */
router.put("/:id/selection", (req: AuthRequest, res: Response) => {
  const clientId = req.user!.userId;
  const showcaseId = Number(req.params.id);
  const selected = !!req.body?.selected;
  if (!Number.isInteger(showcaseId) || showcaseId < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的 ID。" });
    return;
  }
  (async () => {
    const row = await query<{ id: number }>(
      "SELECT id FROM showcase_influencers WHERE id = $1 AND is_deleted = 0 AND status = 'enabled'",
      [showcaseId]
    );
    if (!row.rows[0]) {
      res.status(404).json({ error: "NOT_FOUND", message: "记录不存在或未启用。" });
      return;
    }
    if (selected) {
      await query(
        `INSERT INTO client_showcase_influencer_favorites (client_id, showcase_influencer_id, is_deleted, created_at, updated_at)
         VALUES ($1, $2, 0, now(), now())
         ON CONFLICT (client_id, showcase_influencer_id)
         DO UPDATE SET is_deleted = 0, updated_at = now()`,
        [clientId, showcaseId]
      );
    } else {
      await query(
        "UPDATE client_showcase_influencer_favorites SET is_deleted = 1, updated_at = now() WHERE client_id = $1 AND showcase_influencer_id = $2 AND is_deleted = 0",
        [clientId, showcaseId]
      );
    }
    res.json({ ok: true });
  })().catch((e) => {
    console.error("client showcase influencer selection error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

export default router;
