import { Router, Response } from "express";
import { query, normalizePhotosFromDb } from "../db";
import { requireAuth, requireRole, type AuthRequest } from "../auth";

const router = Router();
router.use(requireAuth);
router.use(requireRole("admin", "employee"));

const MAX_NAME = 100;
const MAX_INTRO = 5000;
const MAX_URL = 2000;
const MAX_TYPES = 2000;
const MAX_FEE = 500;

/** 规范化图片 URL 列表。 */
function normalizePhotos(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x) => typeof x === "string")
    .map((x) => String(x).trim())
    .filter(Boolean)
    .slice(0, 20);
}

/** 清洗可选文本字段。 */
function normText(value: unknown, max: number): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.slice(0, max);
}

/** 规范化上下架状态。 */
function normStatus(value: unknown): "enabled" | "disabled" {
  return value === "enabled" ? "enabled" : "disabled";
}

/** 规范化等级 A/B/C。 */
function normTier(value: unknown): "A" | "B" | "C" {
  const t = String(value ?? "C").trim().toUpperCase();
  if (t === "A" || t === "B" || t === "C") return t;
  return "C";
}

/**
 * GET /api/admin/showcase-content-creators
 * 管理端 Content Creator 展示列表。
 */
router.get("/", (req: AuthRequest, res: Response) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const status = req.query.status === "enabled" || req.query.status === "disabled" ? req.query.status : "";
  (async () => {
    const params: unknown[] = [];
    let idx = 1;
    let sql = `
      SELECT s.id, s.name, s.intro, s.photos, s.social_url, s.tier, s.shoot_types_text, s.fee_quote_text, s.status,
             s.created_by, uc.username AS created_by_username,
             s.updated_by, uu.username AS updated_by_username,
             s.created_at, s.updated_at
        FROM showcase_content_creators s
        LEFT JOIN users uc ON s.created_by = uc.id
        LEFT JOIN users uu ON s.updated_by = uu.id
       WHERE s.is_deleted = 0
    `;
    if (q) {
      sql += ` AND (s.name ILIKE '%' || $${idx} || '%' OR COALESCE(s.intro, '') ILIKE '%' || $${idx} || '%')`;
      params.push(q);
      idx += 1;
    }
    if (status) {
      sql += ` AND s.status = $${idx}`;
      params.push(status);
    }
    sql += ` ORDER BY s.id DESC LIMIT 500`;
    const { rows } = await query(sql, params);
    const list = rows.map((r: Record<string, unknown>) => ({
      ...r,
      photos: normalizePhotosFromDb(r.photos),
    }));
    res.json({ list });
  })().catch((e) => {
    console.error("showcase content creators list error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * POST /api/admin/showcase-content-creators
 * 新增 Content Creator 资料。
 */
router.post("/", (req: AuthRequest, res: Response) => {
  const name = String(req.body?.name ?? "").trim();
  const intro = String(req.body?.intro ?? "").trim();
  const photos = normalizePhotos(req.body?.photos);
  const socialUrl = normText(req.body?.social_url, MAX_URL);
  const tier = normTier(req.body?.tier);
  const shootTypes = normText(req.body?.shoot_types_text, MAX_TYPES);
  const fee = normText(req.body?.fee_quote_text, MAX_FEE);
  const status = normStatus(req.body?.status);
  if (!name || name.length > MAX_NAME) {
    res.status(400).json({ error: "INVALID_NAME", message: `请填写姓名/昵称（1-${MAX_NAME}）。` });
    return;
  }
  if (intro.length > MAX_INTRO) {
    res.status(400).json({ error: "INVALID_INTRO", message: `简介最长 ${MAX_INTRO} 字。` });
    return;
  }
  if (photos.length === 0) {
    res.status(400).json({ error: "INVALID_PHOTOS", message: "请至少上传一张图片。" });
    return;
  }
  (async () => {
    const { rows } = await query<{ id: number }>(
      `INSERT INTO showcase_content_creators (
         name, intro, photos, social_url, tier, shoot_types_text, fee_quote_text, status, created_by, updated_by
       ) VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $9)
       RETURNING id`,
      [
        name,
        intro || null,
        JSON.stringify(photos),
        socialUrl,
        tier,
        shootTypes,
        fee,
        status,
        req.user!.userId,
      ]
    );
    res.status(201).json({ id: rows[0]!.id });
  })().catch((e) => {
    console.error("showcase content creators create error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * PATCH /api/admin/showcase-content-creators/:id
 * 编辑 Content Creator 资料。
 */
router.patch("/:id", (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的 ID。" });
    return;
  }
  const name = req.body?.name !== undefined ? String(req.body?.name ?? "").trim() : undefined;
  const intro = req.body?.intro !== undefined ? String(req.body?.intro ?? "").trim() : undefined;
  const photos = req.body?.photos !== undefined ? normalizePhotos(req.body?.photos) : undefined;
  const socialUrl = req.body?.social_url !== undefined ? normText(req.body?.social_url, MAX_URL) : undefined;
  const tier = req.body?.tier !== undefined ? normTier(req.body?.tier) : undefined;
  const shootTypes = req.body?.shoot_types_text !== undefined ? normText(req.body?.shoot_types_text, MAX_TYPES) : undefined;
  const fee = req.body?.fee_quote_text !== undefined ? normText(req.body?.fee_quote_text, MAX_FEE) : undefined;
  const status = req.body?.status !== undefined ? normStatus(req.body?.status) : undefined;
  if (name !== undefined && (!name || name.length > MAX_NAME)) {
    res.status(400).json({ error: "INVALID_NAME", message: "姓名/昵称无效。" });
    return;
  }
  if (intro !== undefined && intro.length > MAX_INTRO) {
    res.status(400).json({ error: "INVALID_INTRO", message: "简介过长。" });
    return;
  }
  if (photos !== undefined && photos.length === 0) {
    res.status(400).json({ error: "INVALID_PHOTOS", message: "请至少保留一张图片。" });
    return;
  }
  (async () => {
    const existed = await query<{ id: number }>("SELECT id FROM showcase_content_creators WHERE id = $1 AND is_deleted = 0", [id]);
    if (!existed.rows[0]) {
      res.status(404).json({ error: "NOT_FOUND", message: "记录不存在。" });
      return;
    }
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (name !== undefined) {
      sets.push(`name = $${idx++}`);
      params.push(name);
    }
    if (intro !== undefined) {
      sets.push(`intro = $${idx++}`);
      params.push(intro || null);
    }
    if (photos !== undefined) {
      sets.push(`photos = $${idx++}::jsonb`);
      params.push(JSON.stringify(photos));
    }
    if (socialUrl !== undefined) {
      sets.push(`social_url = $${idx++}`);
      params.push(socialUrl);
    }
    if (tier !== undefined) {
      sets.push(`tier = $${idx++}`);
      params.push(tier);
    }
    if (shootTypes !== undefined) {
      sets.push(`shoot_types_text = $${idx++}`);
      params.push(shootTypes);
    }
    if (fee !== undefined) {
      sets.push(`fee_quote_text = $${idx++}`);
      params.push(fee);
    }
    if (status !== undefined) {
      sets.push(`status = $${idx++}`);
      params.push(status);
    }
    if (sets.length === 0) {
      res.json({ ok: true });
      return;
    }
    sets.push(`updated_by = $${idx++}`);
    params.push(req.user!.userId);
    sets.push(`updated_at = now()`);
    params.push(id);
    await query(`UPDATE showcase_content_creators SET ${sets.join(", ")} WHERE id = $${idx} AND is_deleted = 0`, params);
    res.json({ ok: true });
  })().catch((e) => {
    console.error("showcase content creators patch error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * DELETE /api/admin/showcase-content-creators/:id
 * 软删除 Content Creator 资料。
 */
router.delete("/:id", (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的 ID。" });
    return;
  }
  (async () => {
    const updated = await query<{ id: number }>(
      "UPDATE showcase_content_creators SET is_deleted = 1, deleted_at = now(), updated_by = $1, updated_at = now() WHERE id = $2 AND is_deleted = 0 RETURNING id",
      [req.user!.userId, id]
    );
    if (!updated.rows[0]) {
      res.status(404).json({ error: "NOT_FOUND", message: "记录不存在。" });
      return;
    }
    res.json({ ok: true });
  })().catch((e) => {
    console.error("showcase content creators delete error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

export default router;
