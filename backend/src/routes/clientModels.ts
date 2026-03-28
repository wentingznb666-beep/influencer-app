import { Router, Response } from "express";
import { query } from "../db";
import { requireAuth, requireRole, type AuthRequest } from "../auth";

const router = Router();
router.use(requireAuth);
router.use(requireRole("client"));

/**
 * GET /api/client/models
 * 客户端查看已启用模特资料（支持关键词搜索）。
 */
router.get("/", (req: AuthRequest, res: Response) => {
  const clientId = req.user!.userId;
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  (async () => {
    const params: unknown[] = [clientId];
    let idx = 2;
    let sql = `
      SELECT m.id, m.name,
             COALESCE(
               (SELECT jsonb_agg(ph.url ORDER BY ph.id) FROM model_profile_photos ph WHERE ph.model_id = m.id),
               m.photos,
               '[]'::jsonb
             ) AS photos,
             m.intro, m.cloud_link, m.status, m.updated_at,
             CASE WHEN cfm.id IS NULL THEN 0 ELSE 1 END AS selected
        FROM model_profiles m
        LEFT JOIN client_model_favorites cfm
          ON cfm.model_id = m.id AND cfm.client_id = $1 AND cfm.is_deleted = 0
       WHERE m.is_deleted = 0 AND m.status = 'enabled'
    `;
    if (q) {
      sql += ` AND (m.name ILIKE '%' || $${idx} || '%' OR COALESCE(m.intro, '') ILIKE '%' || $${idx} || '%')`;
      params.push(q);
    }
    sql += ` ORDER BY m.id DESC`;
    const { rows } = await query(sql, params);
    res.json({ list: rows });
  })().catch((e) => {
    console.error("client models list error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * GET /api/client/models/my
 * 客户端我的长期合作模特列表（仅当前客户自己的选择）。
 */
router.get("/my", (req: AuthRequest, res: Response) => {
  const clientId = req.user!.userId;
  (async () => {
    const { rows } = await query(
      `SELECT m.id, m.name,
              COALESCE(
                (SELECT jsonb_agg(ph.url ORDER BY ph.id) FROM model_profile_photos ph WHERE ph.model_id = m.id),
                m.photos,
                '[]'::jsonb
              ) AS photos,
              m.intro, m.cloud_link, m.updated_at
         FROM client_model_favorites cfm
         JOIN model_profiles m ON cfm.model_id = m.id
        WHERE cfm.client_id = $1
          AND cfm.is_deleted = 0
          AND m.is_deleted = 0
        ORDER BY cfm.id DESC`,
      [clientId]
    );
    res.json({ list: rows });
  })().catch((e) => {
    console.error("client my models list error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * PUT /api/client/models/:id/cooperation
 * 客户标记或取消“长期合作”模特。
 */
router.put("/:id/cooperation", (req: AuthRequest, res: Response) => {
  const clientId = req.user!.userId;
  const modelId = Number(req.params.id);
  const selected = !!req.body?.selected;
  if (!Number.isInteger(modelId) || modelId < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的模特 ID。" });
    return;
  }
  (async () => {
    const model = await query<{ id: number }>("SELECT id FROM model_profiles WHERE id = $1 AND is_deleted = 0 AND status = 'enabled'", [modelId]);
    if (!model.rows[0]) {
      res.status(404).json({ error: "NOT_FOUND", message: "模特不存在或未启用。" });
      return;
    }
    if (selected) {
      await query(
        `INSERT INTO client_model_favorites (client_id, model_id, is_deleted, created_at, updated_at)
         VALUES ($1, $2, 0, now(), now())
         ON CONFLICT (client_id, model_id)
         DO UPDATE SET is_deleted = 0, updated_at = now()`,
        [clientId, modelId]
      );
    } else {
      await query(
        "UPDATE client_model_favorites SET is_deleted = 1, updated_at = now() WHERE client_id = $1 AND model_id = $2 AND is_deleted = 0",
        [clientId, modelId]
      );
    }
    res.json({ ok: true });
  })().catch((e) => {
    console.error("client models cooperation update error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

export default router;

