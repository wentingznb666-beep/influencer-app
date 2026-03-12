import { Router, Response } from "express";
import { getDb } from "../db";
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
  const user = findUserByUsername(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ error: "LOGIN_FAILED", message: "用户名或密码错误。" });
    return;
  }
  const payload: JwtPayload = { userId: user.id, username: user.username, role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  res.json({
    accessToken,
    refreshToken,
    user: { userId: user.id, username: user.username, role: user.role },
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
  const database = getDb();
  const existing = database.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) {
    res.status(409).json({ error: "USER_EXISTS", message: "用户名已存在。" });
    return;
  }
  const password_hash = hashPassword(password);
  const result = database
    .prepare("INSERT INTO users (username, password_hash, role_id) VALUES (?, ?, ?)")
    .run(username, password_hash, roleId);
  const userId = result.lastInsertRowid as number;
  database.prepare("INSERT INTO point_accounts (user_id, balance) VALUES (?, 0)").run(userId);
  res.status(201).json({ userId, username, role: role === "admin" ? "admin" : role === "influencer" ? "influencer" : "client" });
});

export default router;
