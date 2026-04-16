import { Router, Response } from "express";
import { query } from "../db";
import { requireAuth, type AuthRequest } from "../auth";

const router = Router();
router.use(requireAuth);

/**
 * GET /api/operation-logs/me
 * 获取当前用户的操作日志（时间倒序）。
 */
router.get("/me", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const limitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : 200;
  const limit = Number.isInteger(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200;

  (async () => {
    const { rows } = await query<{
      id: number;
      user_id: number;
      action_type: string;
      target_type: string;
      target_id: number;
      create_time: string;
    }>(
      "SELECT id, user_id, action_type, target_type, target_id, create_time FROM operation_log WHERE user_id = $1 ORDER BY create_time DESC, id DESC LIMIT $2",
      [userId, limit]
    );
    res.json({ list: rows });
  })().catch((e) => {
    console.error("operation logs me error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

export default router;

