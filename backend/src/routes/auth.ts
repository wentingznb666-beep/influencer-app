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

  getUserTokenVersion,
  invalidateUserTokens,
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAccessTokenCookie,
  clearRefreshTokenCookie,
  type AuthRequest,

  type JwtPayload,

} from "../auth";
import { getUserFriendlyError } from "../userFriendlyError";



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

    if (Number(user.disabled) === 1) {

      res.status(403).json({ error: "ACCOUNT_DISABLED", message: "账号已被禁用，请联系管理员。" });

      return;

    }

    const payload: JwtPayload = { userId: user.id, username: user.username, role: user.role };

    const accessToken = signAccessToken(payload);

    const refreshToken = signRefreshToken({ ...payload, tokenVersion: user.token_version });

    console.info(`[auth.login] username=${username} outcome=ok dbMs=${dbCostMs} bcryptMs=${bcryptCostMs} totalMs=${Date.now() - startedAt}`);

    setAccessTokenCookie(res, accessToken);
    setRefreshTokenCookie(res, refreshToken);
    res.json({

      accessToken,

      user: { userId: user.id, username: user.username, role: user.role },

    });

  })().catch((e) => {

    console.error("Login error:", e);

    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });

  });

});



/**

 * POST /api/auth/refresh

 * 请求体: { refreshToken }

 * 返回: { accessToken }

 */

router.post("/refresh", (req, res: Response) => {

  const { refreshToken } = req.body ?? {};
  const tokenFromCookie = (() => {
    const header = req.headers.cookie;
    if (!header) return null;
    for (const part of header.split(";")) {
      const idx = part.indexOf("=");
      if (idx === -1) continue;
      const key = part.slice(0, idx).trim();
      if (key === "refresh_token") return part.slice(idx + 1).trim();
    }
    return null;
  })();
  const token = (typeof refreshToken === "string" ? refreshToken : "").trim() || tokenFromCookie;

  if (!token) {
    res.status(400).json({ error: "INVALID_INPUT", message: "请提供 refreshToken。" });
    return;
  }

  (async () => {
    const payload = verifyRefreshToken(token);

    if (!payload) {
      clearRefreshTokenCookie(res);
      res.status(401).json({ error: "TOKEN_INVALID_OR_EXPIRED", message: "刷新令牌无效或已过期。" });
      return;
    }

    const currentVersion = await getUserTokenVersion(payload.userId);
    if ((payload.tokenVersion ?? -1) !== currentVersion) {
      clearRefreshTokenCookie(res);
      res.status(401).json({ error: "TOKEN_REVOKED", message: "刷新令牌已失效，请重新登录。" });
      return;
    }

    // 删除旧 token 的 exp/iat，避免 jwt.sign 冲突
    const { exp, iat, ...rest } = payload as JwtPayload & { exp?: number; iat?: number };
    const accessToken = signAccessToken(rest as JwtPayload);
    setAccessTokenCookie(res, accessToken);
    res.json({ accessToken });
  })().catch((e) => {
    console.error("Refresh error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });
  });

});



/**

 * POST /api/auth/logout

 * 清除认证 Cookie。

 */

router.post("/logout", (req, res: Response) => {
  const { refreshToken } = req.body ?? {};
  const tokenFromCookie = (() => {
    const header = req.headers.cookie;
    if (!header) return null;
    for (const part of header.split(";")) {
      const idx = part.indexOf("=");
      if (idx === -1) continue;
      const key = part.slice(0, idx).trim();
      if (key === "refresh_token") return part.slice(idx + 1).trim();
    }
    return null;
  })();
  const token = (typeof refreshToken === "string" ? refreshToken : "").trim() || tokenFromCookie;

  (async () => {
    const payload = token ? verifyRefreshToken(token) : null;
    if (payload) await invalidateUserTokens(payload.userId);
    clearAccessTokenCookie(res);
    clearRefreshTokenCookie(res);
    res.json({ ok: true });
  })().catch((e) => {
    console.error("Logout error:", e);
    clearAccessTokenCookie(res);
    clearRefreshTokenCookie(res);
    res.json({ ok: true });
  });
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

 * 将公开注册角色映射到角色 ID，仅允许商家端/达人自助注册。

 */

function mapPublicRegisterRoleToId(role: string): number | null {

  if (role === "client") return 2;

  if (role === "influencer") return 3;

  return null;

}



/**

 * POST /api/auth/register（公开注册）

 * 请求体: { username, password, role }，role 仅允许 client | influencer

 */

router.post("/register", (req, res: Response) => {

  const { username, password, role } = req.body ?? {};

  if (!username || !password || typeof username !== "string" || typeof password !== "string") {

    res.status(400).json({ error: "INVALID_INPUT", message: "请提供用户名和密码。" });

    return;

  }

  const roleName = typeof role === "string" ? role : "";

  const roleId = mapPublicRegisterRoleToId(roleName);

  if (!roleId) {

    res.status(400).json({ error: "INVALID_ROLE", message: "公开注册仅支持 client 或 influencer。" });

    return;

  }

  (async () => {

    const existing = await query<{ id: number }>("SELECT id FROM users WHERE username = $1", [username]);

    if (existing.rows[0]) {

      res.status(409).json({ error: "USER_EXISTS", message: "用户名已存在。" });

      return;

    }

    const requiresApproval = roleName === "influencer" || roleName === "client";
    const password_hash = await hashPassword(password);

    const created = await query<{ id: number }>(

      "INSERT INTO users (username, password_hash, role_id, disabled) VALUES ($1, $2, $3, $4) RETURNING id",

      [username, password_hash, roleId, requiresApproval ? 1 : 0]

    );

    const userId = created.rows[0]!.id;

    await query("INSERT INTO point_accounts (user_id, balance) VALUES ($1, 0) ON CONFLICT (user_id) DO NOTHING", [userId]);

    res.status(201).json({

      userId,

      username,

      role: roleName,

      requiresApproval,

      message: requiresApproval ? "账号已提交，需管理员/员工审核通过后方可登录。" : "注册成功，请登录。",
    });

  })().catch((e) => {

    console.error("Register error:", e);

    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });

  });

});



export default router;
