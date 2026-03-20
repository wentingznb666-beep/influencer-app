import { Router, Response } from "express";
import { query } from "../db";
import {
  hashPassword,
  verifyPassword,
  findUserByUsername,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  requireAuth,
  type AuthRequest,
  type JwtPayload,
} from "../auth";

const router = Router();

/**
 * POST /api/auth/login
 * 请求体: { username, password }
 * 返回: { accessToken, refreshToken, user: { userId, username, role } }
 */
router.post("/login", (req, res: Response) => {
  const { username, password } = req.body ?? {};
  if (!username || !password || typeof username !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "INVALID_INPUT", message: "请提供用户名和密码。" });
    return;
  }
  (async () => {
    const startedAt = Date.now();
    const dbStartedAt = Date.now();
    const user = await findUserByUsername(username);
    const dbCostMs = Date.now() - dbStartedAt;
    if (!user) {
      console.info(`[auth.login] username=${username} outcome=user_not_found dbMs=${dbCostMs} totalMs=${Date.now() - startedAt}`);
      res.status(401).json({ error: "LOGIN_FAILED", message: "用户名或密码错误。" });
      return;
    }
    const bcryptStartedAt = Date.now();
    const passwordOk = await verifyPassword(password, user.password_hash);
    const bcryptCostMs = Date.now() - bcryptStartedAt;
    if (!passwordOk) {
      console.info(`[auth.login] username=${username} outcome=invalid_password dbMs=${dbCostMs} bcryptMs=${bcryptCostMs} totalMs=${Date.now() - startedAt}`);
      res.status(401).json({ error: "LOGIN_FAILED", message: "用户名或密码错误。" });
      return;
    }
    const payload: JwtPayload = { userId: user.id, username: user.username, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    console.info(`[auth.login] username=${username} outcome=ok dbMs=${dbCostMs} bcryptMs=${bcryptCostMs} totalMs=${Date.now() - startedAt}`);
    res.json({
      accessToken,
      refreshToken,
      user: { userId: user.id, username: user.username, role: user.role },
    });
  })().catch((e) => {
    console.error("Login error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * POST /api/auth/refresh
 * 请求体: { refreshToken }
 * 返回: { accessToken }
 */
router.post("/refresh", (req, res: Response) => {
  const { refreshToken } = req.body ?? {};
  if (!refreshToken || typeof refreshToken !== "string") {
    res.status(400).json({ error: "INVALID_INPUT", message: "请提供 refreshToken。" });
    return;
  }
  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    res.status(401).json({ error: "TOKEN_INVALID_OR_EXPIRED", message: "刷新令牌无效或已过期。" });
    return;
  }
  const accessToken = signAccessToken(payload);
  res.json({ accessToken });
});

/**
 * GET /api/auth/me
 * 需鉴权。返回当前用户信息及角色。
 */
router.get("/me", requireAuth, (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "未登录。" });
    return;
  }
  res.json({ user: req.user });
});

/**
 * POST /api/auth/register（可选，用于创建测试账号）
 * 请求体: { username, password, role }，role 为 admin | client | influencer
 */
router.post("/register", (req, res: Response) => {
  const { username, password, role } = req.body ?? {};
  if (!username || !password || typeof username !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "INVALID_INPUT", message: "请提供用户名和密码。" });
    return;
  }
  const roleMap: Record<string, number> = { admin: 1, client: 2, influencer: 3 };
  const roleId = roleMap[role as string] ?? 2;
  (async () => {
    const existing = await query<{ id: number }>("SELECT id FROM users WHERE username = $1", [username]);
    if (existing.rows[0]) {
      res.status(409).json({ error: "USER_EXISTS", message: "用户名已存在。" });
      return;
    }
    const password_hash = await hashPassword(password);
    const created = await query<{ id: number }>(
      "INSERT INTO users (username, password_hash, role_id) VALUES ($1, $2, $3) RETURNING id",
      [username, password_hash, roleId]
    );
    const userId = created.rows[0]!.id;
    await query("INSERT INTO point_accounts (user_id, balance) VALUES ($1, 0) ON CONFLICT (user_id) DO NOTHING", [userId]);
    res.status(201).json({ userId, username, role: role === "admin" ? "admin" : role === "influencer" ? "influencer" : "client" });
  })().catch((e) => {
    console.error("Register error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

export default router;
