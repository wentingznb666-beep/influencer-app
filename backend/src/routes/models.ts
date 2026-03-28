import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { query, withTx } from "../db";
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
 * 解析前端提交的模特照片 ID 列表（最多 20 张）。
 */
function normalizePhotoIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const out: number[] = [];
  for (const v of value) {
    const n = Number(v);
    if (Number.isInteger(n) && n > 0) out.push(n);
    if (out.length >= 20) break;
  }
  return out;
}

/**
 * 根据 model_profile_photos 同步 model_profiles.photos（URL 数组 JSON）。
 */
async function syncModelPhotosJson(modelId: number): Promise<void> {
  await query(
    `UPDATE model_profiles SET photos = (
      SELECT COALESCE(jsonb_agg(url ORDER BY id), '[]'::jsonb) FROM model_profile_photos WHERE model_id = $1
    ), updated_at = now() WHERE id = $1`,
    [modelId]
  );
}

/**
 * 删除 uploads 目录下的物理文件（不存在则忽略）。
 */
async function deletePhysicalUploadFile(relPath: string | null | undefined): Promise<void> {
  if (!relPath || !String(relPath).trim()) return;
  const abs = path.resolve(process.cwd(), "uploads", String(relPath).replace(/^[/\\]+/, ""));
  const root = path.resolve(process.cwd(), "uploads");
  if (!abs.startsWith(root)) return;
  try {
    await fs.unlink(abs);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code !== "ENOENT") throw e;
  }
}

/**
 * 删除单条照片记录并同步模特 JSON；返回是否删除成功（含权限）。
 */
async function deleteModelPhotoById(photoId: number, userId: number, role: "admin" | "employee"): Promise<{ ok: true } | { ok: false; status: number; code: string; message: string }> {
  const rowRes = await query<{ id: number; model_id: number | null; uploader_id: number; rel_path: string | null }>(
    "SELECT id, model_id, uploader_id, rel_path FROM model_profile_photos WHERE id = $1",
    [photoId]
  );
  const row = rowRes.rows[0];
  if (!row) {
    return { ok: false, status: 404, code: "NOT_FOUND", message: "照片不存在或已删除。" };
  }
  if (role === "employee" && row.uploader_id !== userId) {
    return { ok: false, status: 403, code: "FORBIDDEN", message: "只能删除自己上传的照片。" };
  }
  try {
    await query("DELETE FROM model_profile_photos WHERE id = $1", [photoId]);
  } catch (e) {
    console.error("delete model_profile_photos error:", e);
    return { ok: false, status: 500, code: "DATABASE_ERROR", message: "删除数据库记录失败，请稍后重试。" };
  }
  await deletePhysicalUploadFile(row.rel_path);
  if (row.model_id != null) {
    try {
      await syncModelPhotosJson(row.model_id);
    } catch (e) {
      console.error("syncModelPhotosJson error:", e);
    }
  }
  return { ok: true };
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
      SELECT m.id, m.name,
             COALESCE((
               SELECT jsonb_agg(jsonb_build_object('id', ph.id, 'url', ph.url, 'uploader_id', ph.uploader_id) ORDER BY ph.id)
               FROM model_profile_photos ph WHERE ph.model_id = m.id
             ), '[]'::jsonb) AS photos,
             m.intro, m.cloud_link, m.status, m.pending_status,
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
      const items: { id: number; url: string }[] = [];
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
        const relPath = `models/${req.user!.userId}/${filename}`;
        const publicUrl = `${base}/uploads/${relPath}`;
        const ins = await query<{ id: number }>(
          `INSERT INTO model_profile_photos (model_id, uploader_id, url, rel_path) VALUES (NULL, $1, $2, $3) RETURNING id`,
          [req.user!.userId, publicUrl, relPath]
        );
        urls.push(publicUrl);
        items.push({ id: ins.rows[0]!.id, url: publicUrl });
      }
      res.status(201).json({ urls, items });
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
  const photoIds = normalizePhotoIds(req.body?.photo_ids);
  const legacyPhotos = normalizePhotos(req.body?.photos);
  const isAdmin = req.user?.role === "admin";
  const status = normalizeModelStatus(req.body?.status);
  const uid = req.user!.userId;
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
  if (photoIds.length === 0 && legacyPhotos.length === 0) {
    res.status(400).json({ error: "INVALID_PHOTOS", message: "请至少上传一张模特照片。" });
    return;
  }
  (async () => {
    const targetStatus = isAdmin ? status : "disabled";
    const pendingStatus = !isAdmin && status === "enabled" ? "enabled" : null;
    if (photoIds.length > 0) {
      const newId = await withTx(async (client) => {
        const ins = await client.query<{ id: number }>(
          `INSERT INTO model_profiles (name, photos, intro, cloud_link, status, pending_status, created_by, updated_by)
           VALUES ($1, '[]'::jsonb, $2, $3, $4, $5, $6, $6)
           RETURNING id`,
          [name, intro || null, cloudLink, targetStatus, pendingStatus, uid]
        );
        const mid = ins.rows[0]!.id;
        const upd = await client.query<{ id: number }>(
          `UPDATE model_profile_photos
              SET model_id = $1
            WHERE id = ANY($2::int[])
              AND uploader_id = $3
              AND model_id IS NULL
              RETURNING id`,
          [mid, photoIds, uid]
        );
        if (upd.rowCount !== photoIds.length) {
          throw new Error("PHOTO_ATTACH_FAILED");
        }
        await client.query(
          `UPDATE model_profiles SET photos = (
            SELECT COALESCE(jsonb_agg(url ORDER BY id), '[]'::jsonb) FROM model_profile_photos WHERE model_id = $1
          ), updated_at = now() WHERE id = $1`,
          [mid]
        );
        return mid;
      });
      res.status(201).json({ id: newId });
      return;
    }
    const { rows } = await query<{ id: number }>(
      `INSERT INTO model_profiles (name, photos, intro, cloud_link, status, pending_status, created_by, updated_by)
       VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $7)
       RETURNING id`,
      [name, JSON.stringify(legacyPhotos), intro || null, cloudLink, targetStatus, pendingStatus, uid]
    );
    res.status(201).json({ id: rows[0]!.id });
  })().catch((e) => {
    console.error("admin models create error:", e);
    if (e instanceof Error && e.message === "PHOTO_ATTACH_FAILED") {
      res.status(400).json({ error: "INVALID_PHOTO_IDS", message: "照片 ID 无效或不属于当前账号。" });
      return;
    }
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
  const uid = req.user!.userId;
  const name = req.body?.name !== undefined ? String(req.body?.name ?? "").trim() : undefined;
  const intro = req.body?.intro !== undefined ? String(req.body?.intro ?? "").trim() : undefined;
  const cloudLink = req.body?.cloud_link !== undefined ? String(req.body?.cloud_link ?? "").trim() : undefined;
  const photos = req.body?.photos !== undefined ? normalizePhotos(req.body?.photos) : undefined;
  const photoIdsPatch = req.body?.photo_ids !== undefined ? normalizePhotoIds(req.body?.photo_ids) : undefined;
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
  if (photoIdsPatch !== undefined && photoIdsPatch.length === 0) {
    res.status(400).json({ error: "INVALID_PHOTOS", message: "请至少保留一张模特照片。" });
    return;
  }
  (async () => {
    const existed = await query<{ id: number }>("SELECT id FROM model_profiles WHERE id = $1 AND is_deleted = 0", [id]);
    if (!existed.rows[0]) {
      res.status(404).json({ error: "NOT_FOUND", message: "模特资料不存在。" });
      return;
    }
    if (photoIdsPatch !== undefined) {
      const curRes = await query<{ id: number }>("SELECT id FROM model_profile_photos WHERE model_id = $1", [id]);
      const curIds = new Set(curRes.rows.map((r) => r.id));
      const newSet = new Set(photoIdsPatch);
      for (const cid of curIds) {
        if (!newSet.has(cid)) {
          const del = await deleteModelPhotoById(cid, uid, isAdmin ? "admin" : "employee");
          if (!del.ok) {
            res.status(del.status).json({ error: del.code, message: del.message });
            return;
          }
        }
      }
      const toAdd = photoIdsPatch.filter((pid) => !curIds.has(pid));
      if (toAdd.length > 0) {
        const upd = await query(
          `UPDATE model_profile_photos
              SET model_id = $1
            WHERE id = ANY($2::int[])
              AND uploader_id = $3
              AND (model_id IS NULL OR model_id = $1)
            RETURNING id`,
          [id, toAdd, uid]
        );
        if (upd.rowCount !== toAdd.length) {
          res.status(400).json({ error: "INVALID_PHOTO_IDS", message: "部分照片无法关联到该模特。" });
          return;
        }
      }
      await syncModelPhotosJson(id);
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
    if (photos !== undefined && photoIdsPatch === undefined) {
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
    if (sets.length === 0 && photoIdsPatch === undefined) {
      res.json({ ok: true });
      return;
    }
    if (sets.length > 0) {
      sets.push(`updated_by = $${idx++}`);
      params.push(uid);
      sets.push(`updated_at = now()`);
      params.push(id);
      await query(`UPDATE model_profiles SET ${sets.join(", ")} WHERE id = $${idx} AND is_deleted = 0`, params);
    }
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

/**
 * 员工端子路由：DELETE /api/employee/photos/:photoId（仅删除本人上传）。
 */
export const employeePhotosRouter = Router();
employeePhotosRouter.use(requireAuth);
employeePhotosRouter.use(requireRole("employee"));
employeePhotosRouter.delete("/photos/:photoId", (req: AuthRequest, res: Response) => {
  const photoId = Number(req.params.photoId);
  if (!Number.isInteger(photoId) || photoId < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的照片 ID。" });
    return;
  }
  (async () => {
    const r = await deleteModelPhotoById(photoId, req.user!.userId, "employee");
    if (!r.ok) {
      res.status(r.status).json({ error: r.code, message: r.message });
      return;
    }
    res.json({ ok: true });
  })().catch((e) => {
    console.error("employee photos delete error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * 管理员端照片删除子路由（挂载在 app.use("/api/admin", adminPhotosRouter)）：
 *
 * - DELETE /api/admin/photos/batch — JSON 体 `{ "ids": number[] }`，删除多条；任一条失败则返回对应状态码并中止。
 * - DELETE /api/admin/photos/:photoId — 单条删除。
 *
 * 员工端见 employeePhotosRouter：DELETE /api/employee/photos/:photoId。
 *
 * 手动回归建议：① 员工删他人照片 → 403；② 管理员单删/批量删成功 → 200，列表无该图且文件已删；③ 无效 id → 400；④ 已删 id → 404。
 */
export const adminPhotosRouter = Router();
adminPhotosRouter.use(requireAuth);
adminPhotosRouter.use(requireRole("admin"));
/** 批量删除须注册在 /photos/:photoId 之前，避免 "batch" 被当作 photoId。 */
adminPhotosRouter.delete("/photos/batch", (req: AuthRequest, res: Response) => {
  if (!Array.isArray(req.body?.ids)) {
    res.status(400).json({ error: "INVALID_INPUT", message: "请求体需包含 ids 数组。" });
    return;
  }
  const ids = normalizePhotoIds(req.body.ids);
  if (ids.length === 0) {
    res.status(400).json({ error: "INVALID_INPUT", message: "请提供至少一个有效的照片 ID。" });
    return;
  }
  (async () => {
    for (const pid of ids) {
      const r = await deleteModelPhotoById(pid, req.user!.userId, "admin");
      if (!r.ok) {
        res.status(r.status).json({ error: r.code, message: r.message });
        return;
      }
    }
    res.json({ ok: true, deleted: ids.length });
  })().catch((e) => {
    console.error("admin photos batch delete error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});
adminPhotosRouter.delete("/photos/:photoId", (req: AuthRequest, res: Response) => {
  const photoId = Number(req.params.photoId);
  if (!Number.isInteger(photoId) || photoId < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的照片 ID。" });
    return;
  }
  (async () => {
    const r = await deleteModelPhotoById(photoId, req.user!.userId, "admin");
    if (!r.ok) {
      res.status(r.status).json({ error: r.code, message: r.message });
      return;
    }
    res.json({ ok: true });
  })().catch((e) => {
    console.error("admin photos delete error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

export default router;

