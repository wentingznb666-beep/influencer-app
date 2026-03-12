import { Router, Response } from "express";
import { getDb } from "../db";
import { requireAuth, requireRole, type AuthRequest } from "../auth";

const router = Router();
router.use(requireAuth);
router.use(requireRole("admin"));

/**
 * GET /api/admin/influencers
 * 达人列表（仅 role=influencer 的用户），含 profile 与黑名单状态。
 */
router.get("/", (_req: AuthRequest, res: Response) => {
  const database = getDb();
  const rows = database
    .prepare(
      `
    SELECT u.id, u.username, u.display_name, u.created_at,
           p.show_face, p.tags, p.platforms, p.blacklisted, p.level
    FROM users u
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN influencer_profiles p ON u.id = p.user_id
    WHERE r.name = 'influencer'
    ORDER BY u.id DESC
  `
    )
    .all() as Array<{
    id: number;
    username: string;
    display_name: string | null;
    created_at: string;
    show_face: number | null;
    tags: string | null;
    platforms: string | null;
    blacklisted: number | null;
    level: number | null;
  }>;
  const list = rows.map((r) => ({
    id: r.id,
    username: r.username,
    display_name: r.display_name,
    created_at: r.created_at,
    show_face: r.show_face ?? 0,
    tags: r.tags,
    platforms: r.platforms,
    blacklisted: r.blacklisted ?? 0,
    level: r.level ?? 1,
  }));
  res.json({ list });
});

/**
 * PUT /api/admin/influencers/:userId/profile
 * 更新达人资料：审核通过后设置 show_face、tags、platforms、blacklisted、level。
 */
router.put("/:userId/profile", (req: AuthRequest, res: Response) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的用户 ID。" });
    return;
  }
  const { show_face, tags, platforms, blacklisted, level } = req.body ?? {};
  const database = getDb();
  const user = database.prepare("SELECT id, role_id FROM users WHERE id = ?").get(userId) as { id: number; role_id: number } | undefined;
  if (!user || user.role_id !== 3) {
    res.status(404).json({ error: "NOT_FOUND", message: "达人不存在。" });
    return;
  }
  const existing = database.prepare("SELECT user_id, show_face, tags, platforms, blacklisted, level FROM influencer_profiles WHERE user_id = ?").get(userId) as
    | { user_id: number; show_face: number; tags: string | null; platforms: string | null; blacklisted: number; level: number }
    | undefined;
  const sf = show_face != null ? Number(show_face) : existing?.show_face ?? 0;
  const tg = tags !== undefined ? (tags == null ? null : String(tags)) : existing?.tags ?? null;
  const pl = platforms !== undefined ? (platforms == null ? null : String(platforms)) : existing?.platforms ?? null;
  const bl = blacklisted != null ? Number(blacklisted) : existing?.blacklisted ?? 0;
  const lv = level != null ? Number(level) : existing?.level ?? 1;
  if (existing) {
    database.prepare("UPDATE influencer_profiles SET show_face = ?, tags = ?, platforms = ?, blacklisted = ?, level = ?, updated_at = datetime('now') WHERE user_id = ?").run(sf, tg, pl, bl, lv, userId);
  } else {
    database.prepare("INSERT INTO influencer_profiles (user_id, show_face, tags, platforms, blacklisted, level, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))").run(userId, sf, tg, pl, bl, lv);
  }
  res.json({ ok: true });
});

export default router;
