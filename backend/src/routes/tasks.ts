import { Router, Response } from "express";
import { query } from "../db";
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
  (async () => {
    let sql = `
    SELECT t.id, t.material_id, t.type, t.platform, t.max_claim_count, t.point_reward, t.status, t.created_at,
           m.title AS material_title, m.cloud_link
    FROM tasks t
    JOIN materials m ON t.material_id = m.id
    WHERE 1=1
  `;
    const params: any[] = [];
    let idx = 1;
    if (status === "draft" || status === "published") {
      sql += ` AND t.status = $${idx++}`;
      params.push(status);
    }
    if (platform && typeof platform === "string") {
      sql += ` AND t.platform = $${idx++}`;
      params.push(platform);
    }
    if (type === "face" || type === "explain") {
      sql += ` AND t.type = $${idx++}`;
      params.push(type);
    }
    sql += " ORDER BY t.id DESC";
    const { rows } = await query(sql, params);
    res.json({ list: rows });
  })().catch((e) => {
    console.error("tasks list error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
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
  (async () => {
    const mat = await query<{ id: number }>("SELECT id FROM materials WHERE id = $1", [Number(material_id)]);
    if (!mat.rows[0]) {
      res.status(400).json({ error: "INVALID_INPUT", message: "素材不存在。" });
      return;
    }
    const created = await query<{ id: number }>(
      "INSERT INTO tasks (material_id, type, platform, max_claim_count, point_reward, status) VALUES ($1, $2, $3, $4, $5, 'draft') RETURNING id",
      [Number(material_id), type, String(platform), max_claim_count != null ? Number(max_claim_count) : null, Number(point_reward)]
    );
    res.status(201).json({ id: created.rows[0]!.id });
  })().catch((e) => {
    console.error("tasks create error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
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
  (async () => {
    const row = await query<{ id: number }>("SELECT id FROM tasks WHERE id = $1", [id]);
    if (!row.rows[0]) {
      res.status(404).json({ error: "NOT_FOUND", message: "任务不存在。" });
      return;
    }
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (status === "draft" || status === "published") {
      sets.push(`status = $${idx++}`);
      params.push(status);
    }
    if (max_claim_count !== undefined) {
      sets.push(`max_claim_count = $${idx++}`);
      params.push(max_claim_count === null ? null : Number(max_claim_count));
    }
    if (typeof point_reward === "number") {
      sets.push(`point_reward = $${idx++}`);
      params.push(point_reward);
    }
    if (sets.length === 0) {
      res.json({ ok: true });
      return;
    }
    params.push(id);
    await query(`UPDATE tasks SET ${sets.join(", ")} WHERE id = $${idx++}`, params);
    res.json({ ok: true });
  })().catch((e) => {
    console.error("tasks patch error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

export default router;
