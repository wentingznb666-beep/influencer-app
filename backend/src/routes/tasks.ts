import { Router, Response } from "express";
import { query, withTx } from "../db";
import { requireAuth, requireRole, type AuthRequest } from "../auth";
import { recordOperationLogTx } from "../operationLog";

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
    SELECT t.id, t.material_id, t.type, t.platform, t.max_claim_count, t.point_reward, t.status,
           t.biz_status, t.claimed_count, t.fulfilled_count, t.tiktok_link, t.product_images,
           t.created_at,
           m.title AS material_title, m.cloud_link
    FROM tasks t
    JOIN materials m ON t.material_id = m.id
    WHERE t.is_deleted = 0
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
  const { material_id, type, platform, max_claim_count, point_reward, tiktok_link, product_images, task_count } = req.body ?? {};
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
    const countRaw = task_count == null ? 1 : Number(task_count);
    const count = Number.isInteger(countRaw) ? Math.min(Math.max(countRaw, 1), 200) : 1;
    const images =
      Array.isArray(product_images) && product_images.every((x: unknown) => typeof x === "string")
        ? (product_images as string[]).map((s) => s.trim()).filter(Boolean).slice(0, 20)
        : [];
    const tiktok = tiktok_link != null ? String(tiktok_link).trim() : null;
    const ids = await withTx(async (client) => {
      const inserted = await client.query<{ id: number }>(
        `
        WITH ins AS (
          INSERT INTO tasks (material_id, type, platform, max_claim_count, point_reward, status, biz_status, claimed_count, fulfilled_count, tiktok_link, product_images)
          SELECT $1, $2, $3, $4, $5, 'draft', 'open', 0, 0, $6, $7::jsonb
          FROM generate_series(1, $8)
          RETURNING id
        )
        SELECT id FROM ins
        `,
        [Number(material_id), type, String(platform), max_claim_count != null ? Number(max_claim_count) : null, Number(point_reward), tiktok, JSON.stringify(images), count]
      );
      const idList = inserted.rows.map((r) => r.id);
      for (const id of idList) {
        await recordOperationLogTx(client, { userId: req.user!.userId, actionType: "create", targetType: "task", targetId: id });
      }
      return idList;
    });

    res.status(201).json({ ids });
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
    const row = await query<{ id: number }>("SELECT id FROM tasks WHERE id = $1 AND is_deleted = 0", [id]);
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
    const { biz_status, tiktok_link, product_images } = req.body ?? {};
    if (biz_status === "open" || biz_status === "in_progress" || biz_status === "done") {
      sets.push(`biz_status = $${idx++}`);
      params.push(biz_status);
    }
    if (tiktok_link !== undefined) {
      sets.push(`tiktok_link = $${idx++}`);
      params.push(tiktok_link == null ? null : String(tiktok_link));
    }
    if (product_images !== undefined) {
      const images =
        Array.isArray(product_images) && product_images.every((x: unknown) => typeof x === "string")
          ? (product_images as string[]).map((s) => s.trim()).filter(Boolean).slice(0, 20)
          : [];
      sets.push(`product_images = $${idx++}::jsonb`);
      params.push(JSON.stringify(images));
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
    await query(`UPDATE tasks SET ${sets.join(", ")} WHERE id = $${idx++} AND is_deleted = 0`, [...params, id]);
    // 记录操作日志
    await query("INSERT INTO operation_log (user_id, action_type, target_type, target_id) VALUES ($1, 'edit', 'task', $2)", [req.user!.userId, id]);
    res.json({ ok: true });
  })().catch((e) => {
    console.error("tasks patch error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * DELETE /api/admin/tasks/:id
 * 软删除任务。
 */
router.delete("/:id", (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的任务 ID。" });
    return;
  }
  (async () => {
    // 软删除不改业务逻辑：仅隐藏任务，不影响历史领取记录
    await query("UPDATE tasks SET is_deleted = 1, deleted_at = now() WHERE id = $1 AND is_deleted = 0", [id]);
    await query("INSERT INTO operation_log (user_id, action_type, target_type, target_id) VALUES ($1, 'delete', 'task', $2)", [req.user!.userId, id]);
    res.json({ ok: true });
  })().catch((e) => {
    console.error("tasks delete error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

export default router;
