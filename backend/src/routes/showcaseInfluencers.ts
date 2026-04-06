import { Router, Response } from "express";
import { query, normalizePhotosFromDb } from "../db";
import { requireAuth, requireRole, type AuthRequest } from "../auth";

const router = Router();
router.use(requireAuth);
router.use(requireRole("admin", "employee"));

const MAX_NAME = 100;
const MAX_INTRO = 5000;
const MAX_TEXT = 500;
const MAX_TYPES = 2000;
const MAX_SKILLS_INF = 2000;
const MAX_VIDEO_URL = 2000;

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

/**
 * GET /api/admin/showcase-influencers
 * 管理端 Influencer 展示列表（含关键词、状态筛选）。
 */
router.get("/", (req: AuthRequest, res: Response) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const status = req.query.status === "enabled" || req.query.status === "disabled" ? req.query.status : "";
  (async () => {
    const params: unknown[] = [];
    let idx = 1;
    let sql = `
      SELECT s.id, s.name, s.intro, s.photos, s.tiktok_followers_text, s.sales_text,
             s.sellable_types_text, s.skills_text, s.video_url, s.status,
             s.created_by, uc.username AS created_by_username,
             s.updated_by, uu.username AS updated_by_username,
             s.created_at, s.updated_at
        FROM showcase_influencers s
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
    console.error("showcase influencers list error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * POST /api/admin/showcase-influencers
 * 新增 Influencer 资料。
 */
router.post("/", (req: AuthRequest, res: Response) => {
  const name = String(req.body?.name ?? "").trim();
  const intro = String(req.body?.intro ?? "").trim();
  const photos = normalizePhotos(req.body?.photos);
  const followers = normText(req.body?.tiktok_followers_text, MAX_TEXT);
  const sales = normText(req.body?.sales_text, MAX_TEXT);
  const types = normText(req.body?.sellable_types_text, MAX_TYPES);
  const skills = normText(req.body?.skills_text, MAX_SKILLS_INF);
  const videoUrl = normText(req.body?.video_url, MAX_VIDEO_URL);
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
      `INSERT INTO showcase_influencers (
         name, intro, photos, tiktok_followers_text, sales_text, sellable_types_text, skills_text, video_url, status, created_by, updated_by
       ) VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $10)
       RETURNING id`,
      [
        name,
        intro || null,
        JSON.stringify(photos),
        followers,
        sales,
        types,
        skills,
        videoUrl,
        status,
        req.user!.userId,
      ]
    );
    res.status(201).json({ id: rows[0]!.id });
  })().catch((e) => {
    console.error("showcase influencers create error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * PATCH /api/admin/showcase-influencers/:id
 * 编辑 Influencer 资料。
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
  const followers =
    req.body?.tiktok_followers_text !== undefined ? normText(req.body?.tiktok_followers_text, MAX_TEXT) : undefined;
  const sales = req.body?.sales_text !== undefined ? normText(req.body?.sales_text, MAX_TEXT) : undefined;
  const types = req.body?.sellable_types_text !== undefined ? normText(req.body?.sellable_types_text, MAX_TYPES) : undefined;
  const skills = req.body?.skills_text !== undefined ? normText(req.body?.skills_text, MAX_SKILLS_INF) : undefined;
  const videoUrl = req.body?.video_url !== undefined ? normText(req.body?.video_url, MAX_VIDEO_URL) : undefined;
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
    const existed = await query<{ id: number }>("SELECT id FROM showcase_influencers WHERE id = $1 AND is_deleted = 0", [id]);
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
    if (followers !== undefined) {
      sets.push(`tiktok_followers_text = $${idx++}`);
      params.push(followers);
    }
    if (sales !== undefined) {
      sets.push(`sales_text = $${idx++}`);
      params.push(sales);
    }
    if (types !== undefined) {
      sets.push(`sellable_types_text = $${idx++}`);
      params.push(types);
    }
    if (skills !== undefined) {
      sets.push(`skills_text = $${idx++}`);
      params.push(skills);
    }
    if (videoUrl !== undefined) {
      sets.push(`video_url = $${idx++}`);
      params.push(videoUrl);
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
    await query(`UPDATE showcase_influencers SET ${sets.join(", ")} WHERE id = $${idx} AND is_deleted = 0`, params);
    res.json({ ok: true });
  })().catch((e) => {
    console.error("showcase influencers patch error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * DELETE /api/admin/showcase-influencers/:id
 * 软删除 Influencer 资料。
 */
router.delete("/:id", (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的 ID。" });
    return;
  }
  (async () => {
    const updated = await query<{ id: number }>(
      "UPDATE showcase_influencers SET is_deleted = 1, deleted_at = now(), updated_by = $1, updated_at = now() WHERE id = $2 AND is_deleted = 0 RETURNING id",
      [req.user!.userId, id]
    );
    if (!updated.rows[0]) {
      res.status(404).json({ error: "NOT_FOUND", message: "记录不存在。" });
      return;
    }
    res.json({ ok: true });
  })().catch((e) => {
    console.error("showcase influencers delete error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

export default router;
