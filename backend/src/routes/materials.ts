import { Router, Response } from "express";
import { getDb } from "../db";
import { requireAuth, requireRole, type AuthRequest } from "../auth";

const router = Router();
router.use(requireAuth);
router.use(requireRole("admin"));

type MaterialType = "face" | "explain";
type MaterialStatus = "online" | "offline";

/**
 * GET /api/admin/materials
 * 列表，支持 status、type 筛选。
 */
router.get("/", (req: AuthRequest, res: Response) => {
  const { status, type } = req.query as { status?: string; type?: string };
  const database = getDb();
  let sql = "SELECT id, title, type, cloud_link, platforms, remark, status, created_at FROM materials WHERE 1=1";
  const params: (string | number)[] = [];
  if (status === "online" || status === "offline") {
    sql += " AND status = ?";
    params.push(status);
  }
  if (type === "face" || type === "explain") {
    sql += " AND type = ?";
    params.push(type);
  }
  sql += " ORDER BY id DESC";
  const rows = database.prepare(sql).all(...params);
  res.json({ list: rows });
});

/**
 * POST /api/admin/materials
 * 新增素材。
 */
router.post("/", (req: AuthRequest, res: Response) => {
  const { title, type, cloud_link, platforms, remark } = req.body ?? {};
  if (!title || typeof title !== "string" || !type || !cloud_link || typeof cloud_link !== "string") {
    res.status(400).json({ error: "INVALID_INPUT", message: "标题、类型、云盘链接为必填。" });
    return;
  }
  if ((type as string) !== "face" && (type as string) !== "explain") {
    res.status(400).json({ error: "INVALID_INPUT", message: "类型须为 face 或 explain。" });
    return;
  }
  const database = getDb();
  const result = database
    .prepare(
      "INSERT INTO materials (title, type, cloud_link, platforms, remark, status) VALUES (?, ?, ?, ?, ?, 'online')"
    )
    .run(title.trim(), type as MaterialType, String(cloud_link), platforms ? String(platforms) : null, remark ? String(remark) : null);
  res.status(201).json({ id: result.lastInsertRowid });
});

/**
 * PATCH /api/admin/materials/:id
 * 更新素材（含上下架）。
 */
router.patch("/:id", (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的素材 ID。" });
    return;
  }
  const { title, type, cloud_link, platforms, remark, status } = req.body ?? {};
  const database = getDb();
  const row = database.prepare("SELECT id FROM materials WHERE id = ?").get(id) as { id: number } | undefined;
  if (!row) {
    res.status(404).json({ error: "NOT_FOUND", message: "素材不存在。" });
    return;
  }
  const updates: string[] = [];
  const params: (string | number | null)[] = [];
  if (typeof title === "string") {
    updates.push("title = ?");
    params.push(title.trim());
  }
  if ((type as string) === "face" || (type as string) === "explain") {
    updates.push("type = ?");
    params.push(type as MaterialType);
  }
  if (typeof cloud_link === "string") {
    updates.push("cloud_link = ?");
    params.push(cloud_link);
  }
  if (platforms !== undefined) {
    updates.push("platforms = ?");
    params.push(platforms == null ? null : String(platforms));
  }
  if (remark !== undefined) {
    updates.push("remark = ?");
    params.push(remark == null ? null : String(remark));
  }
  if ((status as string) === "online" || (status as string) === "offline") {
    updates.push("status = ?");
    params.push(status as MaterialStatus);
  }
  if (updates.length === 0) {
    res.json({ ok: true });
    return;
  }
  params.push(id);
  database.prepare(`UPDATE materials SET ${updates.join(", ")} WHERE id = ?`).run(...params);
  res.json({ ok: true });
});

/**
 * DELETE /api/admin/materials/:id
 * 删除素材（可选，也可仅下架）。
 */
router.delete("/:id", (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的素材 ID。" });
    return;
  }
  const database = getDb();
  const result = database.prepare("DELETE FROM materials WHERE id = ?").run(id);
  if (result.changes === 0) {
    res.status(404).json({ error: "NOT_FOUND", message: "素材不存在。" });
    return;
  }
  res.json({ ok: true });
});

export default router;
