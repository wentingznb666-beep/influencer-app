import { Router, Response } from "express";
import { query } from "../db";
import { hashPassword, requireAuth, requireRole, type AuthRequest } from "../auth";

const router = Router();
router.use(requireAuth);
router.use(requireRole("admin", "employee"));

type UserRole = "admin" | "employee" | "influencer" | "client";

/**
 * GET /api/admin/users
 * 管理员查看账号列表，支持按角色与关键词筛选。
 */
router.get("/", (req: AuthRequest, res: Response) => {
  const role = typeof req.query.role === "string" ? req.query.role : "";
  const keyword = typeof req.query.keyword === "string" ? req.query.keyword.trim() : "";
  const disabled = typeof req.query.disabled === "string" ? req.query.disabled : "";
  (async () => {
    const { rows } = await query<{
      id: number;
      username: string;
      display_name: string | null;
      role: string;
      disabled: number;
      created_at: string;
    }>(
      `
      SELECT u.id, u.username, u.display_name, r.name AS role, u.disabled, u.created_at
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE ($1 = '' OR r.name = $1)
        AND ($2 = '' OR u.username ILIKE '%' || $2 || '%' OR COALESCE(u.display_name, '') ILIKE '%' || $2 || '%')
        AND ($3 = '' OR u.disabled = CASE WHEN $3 = '1' THEN 1 ELSE 0 END)
      ORDER BY u.id DESC
      `,
      [role, keyword, disabled]
    );
    res.json({ list: rows });
  })().catch((e) => {
    console.error("admin users list error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * 将角色名映射到角色 ID，用于管理员开通账号。
 */
function mapRoleToId(role: string): number | null {
  if (role === "admin") return 1;
  if (role === "client") return 2;
  if (role === "influencer") return 3;
  if (role === "employee") return 4;
  return null;
}

/**
 * 校验并标准化角色值，避免动态字符串污染。
 */
function normalizeRole(value: string): UserRole | null {
  if (value === "admin" || value === "employee" || value === "influencer" || value === "client") return value;
  return null;
}

/**
 * POST /api/admin/users
 * 管理员开通账号（可创建管理员/员工/达人/客户端）。
 */
router.post("/", (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "FORBIDDEN", message: "员工无账号创建权限。" });
    return;
  }
  const { username, password, role, display_name } = req.body ?? {};
  if (!username || !password || typeof username !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "INVALID_INPUT", message: "请提供用户名和密码。" });
    return;
  }
  const roleName = normalizeRole(typeof role === "string" ? role : "");
  if (!roleName) {
    res.status(400).json({ error: "INVALID_ROLE", message: "角色无效，支持：admin / employee / influencer / client。" });
    return;
  }
  const roleId = mapRoleToId(roleName);
  if (!roleId) {
    res.status(400).json({ error: "INVALID_ROLE", message: "角色无效，支持：admin / employee / influencer / client。" });
    return;
  }
  (async () => {
    const existed = await query<{ id: number }>("SELECT id FROM users WHERE username = $1", [username.trim()]);
    if (existed.rows[0]) {
      res.status(409).json({ error: "USER_EXISTS", message: "用户名已存在。" });
      return;
    }
    const passwordHash = await hashPassword(password);
    const created = await query<{ id: number }>(
      "INSERT INTO users (username, password_hash, role_id, display_name) VALUES ($1, $2, $3, $4) RETURNING id",
      [username.trim(), passwordHash, roleId, display_name ? String(display_name) : null]
    );
    const userId = created.rows[0]!.id;
    await query("INSERT INTO point_accounts (user_id, balance) VALUES ($1, 0) ON CONFLICT (user_id) DO NOTHING", [userId]);
    res.status(201).json({ userId, username: username.trim(), role: roleName });
  })().catch((e) => {
    console.error("admin users create error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * PATCH /api/admin/users/:id/password
 * 管理员重置账号密码。
 */
router.patch("/:id/password", (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "FORBIDDEN", message: "员工无账号编辑权限。" });
    return;
  }
  const id = Number(req.params.id);
  const { new_password } = req.body ?? {};
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的用户 ID。" });
    return;
  }
  if (!new_password || typeof new_password !== "string" || new_password.length < 6) {
    res.status(400).json({ error: "INVALID_PASSWORD", message: "新密码至少 6 位。" });
    return;
  }
  (async () => {
    const existed = await query<{ id: number }>("SELECT id FROM users WHERE id = $1", [id]);
    if (!existed.rows[0]) {
      res.status(404).json({ error: "NOT_FOUND", message: "账号不存在。" });
      return;
    }
    const passwordHash = await hashPassword(new_password);
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, id]);
    res.json({ ok: true });
  })().catch((e) => {
    console.error("admin users reset password error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * PATCH /api/admin/users/:id/status
 * 管理员启用/禁用账号（禁止禁用自己，防止误锁）。
 */
router.patch("/:id/status", (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "FORBIDDEN", message: "员工无账号编辑权限。" });
    return;
  }
  const id = Number(req.params.id);
  const { disabled } = req.body ?? {};
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的用户 ID。" });
    return;
  }
  if (typeof disabled !== "boolean") {
    res.status(400).json({ error: "INVALID_INPUT", message: "disabled 必须为布尔值。" });
    return;
  }
  if (req.user?.userId === id && disabled) {
    res.status(400).json({ error: "INVALID_OPERATION", message: "不能禁用当前登录账号。" });
    return;
  }
  (async () => {
    const existed = await query<{ id: number }>("SELECT id FROM users WHERE id = $1", [id]);
    if (!existed.rows[0]) {
      res.status(404).json({ error: "NOT_FOUND", message: "账号不存在。" });
      return;
    }
    await query("UPDATE users SET disabled = $1 WHERE id = $2", [disabled ? 1 : 0, id]);
    res.json({ ok: true });
  })().catch((e) => {
    console.error("admin users update status error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

export default router;
