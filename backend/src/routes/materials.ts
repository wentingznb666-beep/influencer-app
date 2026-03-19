import { Router, Response } from "express";
import { query } from "../db";
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
  (async () => {
    let sql = "SELECT id, title, type, cloud_link, platforms, remark, status, created_at FROM materials WHERE 1=1";
    const params: any[] = [];
    let idx = 1;
    if (status === "online" || status === "offline") {
      sql += ` AND status = $${idx++}`;
      params.push(status);
    }
    if (type === "face" || type === "explain") {
      sql += ` AND type = $${idx++}`;
      params.push(type);
    }
    sql += " ORDER BY id DESC";
    const { rows } = await query(sql, params);
    res.json({ list: rows });
  })().catch((e) => {
    console.error("materials list error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
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
  (async () => {
    const created = await query<{ id: number }>(
      "INSERT INTO materials (title, type, cloud_link, platforms, remark, status) VALUES ($1, $2, $3, $4, $5, 'online') RETURNING id",
      [title.trim(), type as MaterialType, String(cloud_link), platforms ? String(platforms) : null, remark ? String(remark) : null]
    );
    res.status(201).json({ id: created.rows[0]!.id });
  })().catch((e) => {
    console.error("materials create error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
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
  (async () => {
    const existed = await query<{ id: number }>("SELECT id FROM materials WHERE id = $1", [id]);
    if (!existed.rows[0]) {
      res.status(404).json({ error: "NOT_FOUND", message: "素材不存在。" });
      return;
    }
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (typeof title === "string") {
      sets.push(`title = $${idx++}`);
      params.push(title.trim());
    }
    if ((type as string) === "face" || (type as string) === "explain") {
      sets.push(`type = $${idx++}`);
      params.push(type as MaterialType);
    }
    if (typeof cloud_link === "string") {
      sets.push(`cloud_link = $${idx++}`);
      params.push(cloud_link);
    }
    if (platforms !== undefined) {
      sets.push(`platforms = $${idx++}`);
      params.push(platforms == null ? null : String(platforms));
    }
    if (remark !== undefined) {
      sets.push(`remark = $${idx++}`);
      params.push(remark == null ? null : String(remark));
    }
    if ((status as string) === "online" || (status as string) === "offline") {
      sets.push(`status = $${idx++}`);
      params.push(status as MaterialStatus);
    }
    if (sets.length === 0) {
      res.json({ ok: true });
      return;
    }
    params.push(id);
    await query(`UPDATE materials SET ${sets.join(", ")} WHERE id = $${idx++}`, params);
    res.json({ ok: true });
  })().catch((e) => {
    console.error("materials patch error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
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
  (async () => {
    const r = await query("DELETE FROM materials WHERE id = $1", [id]);
    if (r.rowCount === 0) {
      res.status(404).json({ error: "NOT_FOUND", message: "素材不存在。" });
      return;
    }
    res.json({ ok: true });
  })().catch((e) => {
    console.error("materials delete error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

export default router;
