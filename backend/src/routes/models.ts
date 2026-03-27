import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { query } from "../db";
import { requireAuth, requireRole, type AuthRequest } from "../auth";

const router = Router();
router.use(requireAuth);
router.use(requireRole("admin", "employee"));

const MODEL_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MODEL_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const modelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MODEL_UPLOAD_MAX_BYTES, files: 20 },
});

/**
 * 获取可用于外部访问的文件 URL 根路径。
 */
function getPublicBaseUrl(req: AuthRequest): string {
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
  const host = req.get("host") || "localhost:3000";
  return `${proto}://${host}`;
}

/**
 * 按 MIME 推断图片扩展名。
 */
function extByMime(mime: string): string | null {
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  return null;
}

/**
 * 规范化模特状态，非法时回退为 disabled。
 */
function normalizeModelStatus(value: unknown): "enabled" | "disabled" {
  return value === "enabled" ? "enabled" : "disabled";
}

/**
 * 规范化图片 URL 列表。
 */
function normalizePhotos(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x) => typeof x === "string")
    .map((x) => String(x).trim())
    .filter(Boolean)
    .slice(0, 20);
}

/**
 * GET /api/admin/models
 * 管理端模特列表（管理员/员工），支持关键词、状态与提审状态筛选。
 */
router.get("/", (req: AuthRequest, res: Response) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const status = req.query.status === "enabled" || req.query.status === "disabled" ? req.query.status : "";
  const pendingStatus = req.query.pending_status === "enabled" || req.query.pending_status === "disabled" ? req.query.pending_status : "";
  (async () => {
    const params: unknown[] = [];
    let idx = 1;
    let sql = `
      SELECT m.id, m.name, m.photos, m.intro, m.cloud_link, m.status, m.pending_status,
             m.created_by, uc.username AS created_by_username,
             m.updated_by, uu.username AS updated_by_username,
             m.reviewed_by, ur.username AS reviewed_by_username,
             m.review_note, m.created_at, m.updated_at
        FROM model_profiles m
        LEFT JOIN users uc ON m.created_by = uc.id
        LEFT JOIN users uu ON m.updated_by = uu.id
        LEFT JOIN users ur ON m.reviewed_by = ur.id
       WHERE m.is_deleted = 0
    `;
    if (q) {
      sql += ` AND (m.name ILIKE '%' || $${idx} || '%' OR COALESCE(m.intro, '') ILIKE '%' || $${idx} || '%')`;
      params.push(q);
      idx += 1;
    }
    if (status) {
      sql += ` AND m.status = $${idx}`;
      params.push(status);
      idx += 1;
    }
    if (pendingStatus) {
      sql += ` AND m.pending_status = $${idx}`;
      params.push(pendingStatus);
    }
    sql += ` ORDER BY m.id DESC LIMIT 500`;
    const { rows } = await query(sql, params);
    res.json({ list: rows });
  })().catch((e) => {
    console.error("admin models list error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * POST /api/admin/models/upload
 * 管理端模特图片上传（多图）。
 */
router.post("/upload", (req: AuthRequest, res: Response) => {
  modelUpload.array("files", 20)(req as any, res as any, (uploadErr: unknown) => {
    if (uploadErr) {
      const msg = uploadErr instanceof Error ? uploadErr.message : "上传失败";
      const isSize = msg.toLowerCase().includes("file too large");
      res.status(400).json({ error: isSize ? "IMAGE_TOO_LARGE" : "INVALID_UPLOAD", message: isSize ? "单张图片不能超过 5MB。" : msg });
      return;
    }
    (async () => {
      const files = (req.files || []) as Express.Multer.File[];
      if (files.length === 0) {
        res.status(400).json({ error: "INVALID_INPUT", message: "请至少上传一张图片。" });
        return;
      }
      const uploadDir = path.resolve(process.cwd(), "uploads", "models", String(req.user!.userId));
      await fs.mkdir(uploadDir, { recursive: true });
      const base = getPublicBaseUrl(req);
      const urls: string[] = [];
      for (const file of files) {
        if (!ALLOWED_MODEL_IMAGE_MIME.has(file.mimetype)) {
          res.status(400).json({ error: "INVALID_IMAGE_TYPE", message: "仅支持 jpg/png/webp 图片。" });
          return;
        }
        if (file.size > MODEL_UPLOAD_MAX_BYTES) {
          res.status(400).json({ error: "IMAGE_TOO_LARGE", message: "单张图片不能超过 5MB。" });
          return;
        }
        const ext = extByMime(file.mimetype);
        if (!ext) {
          res.status(400).json({ error: "INVALID_IMAGE_TYPE", message: "图片格式不支持。" });
          return;
        }
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
        const filepath = path.join(uploadDir, filename);
        await fs.writeFile(filepath, file.buffer);
        urls.push(`${base}/uploads/models/${req.user!.userId}/${filename}`);
      }
      res.status(201).json({ urls });
    })().catch((e) => {
      console.error("admin models upload error:", e);
      res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
    });
  });
});

/**
 * POST /api/admin/models
 * 新增模特资料（管理员/员工均可）。
 */
router.post("/", (req: AuthRequest, res: Response) => {
  const name = String(req.body?.name ?? "").trim();
  const intro = String(req.body?.intro ?? "").trim();
  const cloudLink = String(req.body?.cloud_link ?? "").trim();
  const photos = normalizePhotos(req.body?.photos);
  const isAdmin = req.user?.role === "admin";
  const status = normalizeModelStatus(req.body?.status);
  if (!name || name.length > 100) {
    res.status(400).json({ error: "INVALID_NAME", message: "请填写模特姓名/昵称（1-100）。" });
    return;
  }
  if (intro.length > 5000) {
    res.status(400).json({ error: "INVALID_INTRO", message: "模特介绍最长 5000 字。" });
    return;
  }
  if (!cloudLink || cloudLink.length > 2000) {
    res.status(400).json({ error: "INVALID_CLOUD_LINK", message: "请填写有效云端网盘链接（1-2000）。" });
    return;
  }
  if (photos.length === 0) {
    res.status(400).json({ error: "INVALID_PHOTOS", message: "请至少上传一张模特照片。" });
    return;
  }
  (async () => {
    const targetStatus = isAdmin ? status : "disabled";
    const pendingStatus = !isAdmin && status === "enabled" ? "enabled" : null;
    const { rows } = await query<{ id: number }>(
      `INSERT INTO model_profiles (name, photos, intro, cloud_link, status, pending_status, created_by, updated_by)
       VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $7)
       RETURNING id`,
      [name, JSON.stringify(photos), intro || null, cloudLink, targetStatus, pendingStatus, req.user!.userId]
    );
    res.status(201).json({ id: rows[0]!.id });
  })().catch((e) => {
    console.error("admin models create error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * PATCH /api/admin/models/:id
 * 编辑模特资料；员工不可直接上下架，可提交待审核状态变更。
 */
router.patch("/:id", (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的模特 ID。" });
    return;
  }
  const isAdmin = req.user?.role === "admin";
  const name = req.body?.name !== undefined ? String(req.body?.name ?? "").trim() : undefined;
  const intro = req.body?.intro !== undefined ? String(req.body?.intro ?? "").trim() : undefined;
  const cloudLink = req.body?.cloud_link !== undefined ? String(req.body?.cloud_link ?? "").trim() : undefined;
  const photos = req.body?.photos !== undefined ? normalizePhotos(req.body?.photos) : undefined;
  const status = req.body?.status !== undefined ? normalizeModelStatus(req.body?.status) : undefined;
  if (name !== undefined && (!name || name.length > 100)) {
    res.status(400).json({ error: "INVALID_NAME", message: "请填写模特姓名/昵称（1-100）。" });
    return;
  }
  if (intro !== undefined && intro.length > 5000) {
    res.status(400).json({ error: "INVALID_INTRO", message: "模特介绍最长 5000 字。" });
    return;
  }
  if (cloudLink !== undefined && (!cloudLink || cloudLink.length > 2000)) {
    res.status(400).json({ error: "INVALID_CLOUD_LINK", message: "请填写有效云端网盘链接（1-2000）。" });
    return;
  }
  if (photos !== undefined && photos.length === 0) {
    res.status(400).json({ error: "INVALID_PHOTOS", message: "请至少保留一张模特照片。" });
    return;
  }
  (async () => {
    const existed = await query<{ id: number }>("SELECT id FROM model_profiles WHERE id = $1 AND is_deleted = 0", [id]);
    if (!existed.rows[0]) {
      res.status(404).json({ error: "NOT_FOUND", message: "模特资料不存在。" });
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
    if (cloudLink !== undefined) {
      sets.push(`cloud_link = $${idx++}`);
      params.push(cloudLink);
    }
    if (photos !== undefined) {
      sets.push(`photos = $${idx++}::jsonb`);
      params.push(JSON.stringify(photos));
    }
    if (status !== undefined) {
      if (isAdmin) {
        sets.push(`status = $${idx++}`);
        params.push(status);
        sets.push(`pending_status = NULL`);
      } else {
        sets.push(`pending_status = $${idx++}`);
        params.push(status);
      }
    }
    if (sets.length === 0) {
      res.json({ ok: true });
      return;
    }
    sets.push(`updated_by = $${idx++}`);
    params.push(req.user!.userId);
    sets.push(`updated_at = now()`);
    params.push(id);
    await query(`UPDATE model_profiles SET ${sets.join(", ")} WHERE id = $${idx} AND is_deleted = 0`, params);
    res.json({ ok: true });
  })().catch((e) => {
    console.error("admin models patch error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * POST /api/admin/models/:id/status-request
 * 员工提交模特上下架申请，等待管理员审核。
 */
router.post("/:id/status-request", (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "employee") {
    res.status(403).json({ error: "FORBIDDEN", message: "仅员工可提交上下架审核申请。" });
    return;
  }
  const id = Number(req.params.id);
  const targetStatus = normalizeModelStatus(req.body?.status);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的模特 ID。" });
    return;
  }
  (async () => {
    const updated = await query<{ id: number }>(
      "UPDATE model_profiles SET pending_status = $1, updated_by = $2, updated_at = now() WHERE id = $3 AND is_deleted = 0 RETURNING id",
      [targetStatus, req.user!.userId, id]
    );
    if (!updated.rows[0]) {
      res.status(404).json({ error: "NOT_FOUND", message: "模特资料不存在。" });
      return;
    }
    res.json({ ok: true });
  })().catch((e) => {
    console.error("admin models status request error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * POST /api/admin/models/:id/status-review
 * 管理员审核员工上下架申请（approve/reject）。
 */
router.post("/:id/status-review", (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "FORBIDDEN", message: "仅管理员可审核上下架申请。" });
    return;
  }
  const id = Number(req.params.id);
  const action = String(req.body?.action ?? "").trim();
  const note = String(req.body?.note ?? "").trim();
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的模特 ID。" });
    return;
  }
  if (action !== "approve" && action !== "reject") {
    res.status(400).json({ error: "INVALID_ACTION", message: "action 仅支持 approve 或 reject。" });
    return;
  }
  (async () => {
    const current = await query<{ pending_status: "enabled" | "disabled" | null }>(
      "SELECT pending_status FROM model_profiles WHERE id = $1 AND is_deleted = 0",
      [id]
    );
    const pending = current.rows[0]?.pending_status;
    if (!current.rows[0]) {
      res.status(404).json({ error: "NOT_FOUND", message: "模特资料不存在。" });
      return;
    }
    if (!pending) {
      res.status(409).json({ error: "NO_PENDING_STATUS", message: "当前无待审核上下架申请。" });
      return;
    }
    if (action === "approve") {
      await query(
        "UPDATE model_profiles SET status = pending_status, pending_status = NULL, reviewed_by = $1, review_note = $2, updated_by = $1, updated_at = now() WHERE id = $3 AND is_deleted = 0",
        [req.user!.userId, note || null, id]
      );
    } else {
      await query(
        "UPDATE model_profiles SET pending_status = NULL, reviewed_by = $1, review_note = $2, updated_by = $1, updated_at = now() WHERE id = $3 AND is_deleted = 0",
        [req.user!.userId, note || null, id]
      );
    }
    res.json({ ok: true });
  })().catch((e) => {
    console.error("admin models status review error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * DELETE /api/admin/models/:id
 * 删除模特资料（仅管理员）。
 */
router.delete("/:id", (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "FORBIDDEN", message: "员工无删除权限。" });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的模特 ID。" });
    return;
  }
  (async () => {
    const updated = await query<{ id: number }>(
      "UPDATE model_profiles SET is_deleted = 1, deleted_at = now(), updated_by = $1, updated_at = now() WHERE id = $2 AND is_deleted = 0 RETURNING id",
      [req.user!.userId, id]
    );
    if (!updated.rows[0]) {
      res.status(404).json({ error: "NOT_FOUND", message: "模特资料不存在。" });
      return;
    }
    res.json({ ok: true });
  })().catch((e) => {
    console.error("admin models delete error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

export default router;

