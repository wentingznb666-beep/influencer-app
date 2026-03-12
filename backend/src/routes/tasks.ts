import { Router, Response } from "express";
import { getDb } from "../db";
import { requireAuth, requireRole, type AuthRequest } from "../auth";

const router = Router();
router.use(requireAuth);
router.use(requireRole("admin"));

/**
 * GET /api/admin/tasks
 * 任务列表，支持 status、platform、type 筛选。
 */
router.get("/", (req: AuthRequest, res: Response) => {
  const { status, platform, type } = req.query as { status?: string; platform?: string; type?: string };
  const database = getDb();
  let sql = `
    SELECT t.id, t.material_id, t.type, t.platform, t.max_claim_count, t.point_reward, t.status, t.created_at,
           m.title AS material_title, m.cloud_link
    FROM tasks t
    JOIN materials m ON t.material_id = m.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];
  if (status === "draft" || status === "published") {
    sql += " AND t.status = ?";
    params.push(status);
  }
  if (platform && typeof platform === "string") {
    sql += " AND t.platform = ?";
    params.push(platform);
  }
  if (type === "face" || type === "explain") {
    sql += " AND t.type = ?";
    params.push(type);
  }
  sql += " ORDER BY t.id DESC";
  const rows = database.prepare(sql).all(...params);
  res.json({ list: rows });
});

/**
 * POST /api/admin/tasks
 * 创建任务。
 */
router.post("/", (req: AuthRequest, res: Response) => {
  const { material_id, type, platform, max_claim_count, point_reward } = req.body ?? {};
  if (!material_id || !type || !platform || typeof point_reward !== "number") {
    res.status(400).json({ error: "INVALID_INPUT", message: "素材 ID、类型、平台、积分奖励为必填。" });
    return;
  }
  if ((type as string) !== "face" && (type as string) !== "explain") {
    res.status(400).json({ error: "INVALID_INPUT", message: "类型须为 face 或 explain。" });
    return;
  }
  const database = getDb();
  const mat = database.prepare("SELECT id FROM materials WHERE id = ?").get(Number(material_id)) as { id: number } | undefined;
  if (!mat) {
    res.status(400).json({ error: "INVALID_INPUT", message: "素材不存在。" });
    return;
  }
  const result = database
    .prepare(
      "INSERT INTO tasks (material_id, type, platform, max_claim_count, point_reward, status) VALUES (?, ?, ?, ?, ?, 'draft')"
    )
    .run(Number(material_id), type, String(platform), max_claim_count != null ? Number(max_claim_count) : null, Number(point_reward));
  res.status(201).json({ id: result.lastInsertRowid });
});

/**
 * PATCH /api/admin/tasks/:id
 * 更新任务或发布。
 */
router.patch("/:id", (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的任务 ID。" });
    return;
  }
  const { status, max_claim_count, point_reward } = req.body ?? {};
  const database = getDb();
  const row = database.prepare("SELECT id FROM tasks WHERE id = ?").get(id) as { id: number } | undefined;
  if (!row) {
    res.status(404).json({ error: "NOT_FOUND", message: "任务不存在。" });
    return;
  }
  const updates: string[] = [];
  const params: (string | number | null)[] = [];
  if (status === "draft" || status === "published") {
    updates.push("status = ?");
    params.push(status);
  }
  if (max_claim_count !== undefined) {
    updates.push("max_claim_count = ?");
    params.push(max_claim_count === null ? null : Number(max_claim_count));
  }
  if (typeof point_reward === "number") {
    updates.push("point_reward = ?");
    params.push(point_reward);
  }
  if (updates.length === 0) {
    res.json({ ok: true });
    return;
  }
  params.push(id);
  database.prepare(`UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`).run(...params);
  res.json({ ok: true });
});

export default router;
