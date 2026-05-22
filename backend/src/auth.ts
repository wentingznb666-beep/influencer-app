import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { query } from "./db";

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV !== "production" ? "influencer-app-dev-secret" : "");
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (process.env.NODE_ENV !== "production" ? "influencer-app-dev-refresh-secret" : "");

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error("JWT_SECRET and JWT_REFRESH_SECRET must be set in environment variables for production.");
}
const ACCESS_EXP = "15m";
const REFRESH_EXP = "7d";

const ACCESS_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const isProduction = process.env.NODE_ENV === "production";

export type RoleName = "admin" | "employee" | "client" | "influencer";

export interface JwtPayload {
  userId: number;
  username: string;
  role: RoleName;
  tokenVersion?: number;
  iat?: number;
  exp?: number;
}

/** 扩展 Express Request，挂载鉴权后的用户信息 */
export interface AuthRequest extends Request {
  requestId?: string;
  user?: JwtPayload;
}

/**
 * 从 Cookie header 解析指定名称的值。
 */
function parseCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) return part.slice(idx + 1).trim();
  }
  return null;
}

/**
 * 将认证 token 设置为 httpOnly Cookie。
 */
function setCookie(res: Response, name: string, value: string, maxAgeMs: number, path: string, sameSite: "lax" | "strict"): void {
  const parts = [
    `${name}=${value}`,
    `HttpOnly`,
    `Path=${path}`,
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
    `SameSite=${sameSite === "strict" ? "Strict" : "Lax"}`,
  ];
  if (isProduction) parts.push("Secure");
  res.appendHeader("Set-Cookie", parts.join("; "));
}

/**
 * 清除指定名称的 Cookie。
 */
function clearCookie(res: Response, name: string, path: string): void {
  res.appendHeader("Set-Cookie", `${name}=; HttpOnly; Path=${path}; Max-Age=0; SameSite=Lax${isProduction ? "; Secure" : ""}`);
}

export function setAccessTokenCookie(res: Response, token: string): void {
  setCookie(res, "access_token", token, ACCESS_MAX_AGE_MS, "/", "lax");
}

export function setRefreshTokenCookie(res: Response, token: string): void {
  setCookie(res, "refresh_token", token, REFRESH_MAX_AGE_MS, "/api/auth", "strict");
}

export function clearAccessTokenCookie(res: Response): void {
  clearCookie(res, "access_token", "/");
  clearCookie(res, "access_token", "/api");
}

export function clearRefreshTokenCookie(res: Response): void {
  clearCookie(res, "refresh_token", "/api/auth");
}

/**
 * 使用 bcrypt 对明文密码哈希，用于注册或校验。
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

/**
 * 校验明文密码与哈希是否一致。
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * 签发访问令牌（短期）。
 */
export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXP });
}

/**
 * 签发刷新令牌（长期）。
 */
export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_EXP });
}

/**
 * 验证访问令牌并返回 payload。
 */
export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * 验证刷新令牌并返回 payload。
 */
export function verifyRefreshToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * 从 DB 根据 username 获取用户信息（含角色名），用于登录校验。
 */
export async function findUserByUsername(
  username: string
): Promise<{ id: number; username: string; password_hash: string; role: RoleName; disabled: number; token_version: number } | null> {
  const res = await query<{ id: number; username: string; password_hash: string; role: string; disabled: number; token_version: number }>(
    "SELECT u.id, u.username, u.password_hash, r.name AS role, u.disabled, u.token_version FROM users u JOIN roles r ON u.role_id = r.id WHERE u.username = $1",
    [username]
  );
  const row = res.rows[0];
  if (!row) return null;
  return { ...row, role: row.role as RoleName };
}

/**
 * 获取用户的 token_version，用于 refresh token 轮换校验。
 */
export async function getUserTokenVersion(userId: number): Promise<number> {
  const res = await query<{ token_version: number }>(
    "SELECT token_version FROM users WHERE id = $1",
    [userId]
  );
  return res.rows[0]?.token_version ?? 0;
}

/**
 * 递增用户的 token_version，使所有已签发的 refresh token 立即失效。
 */
export async function invalidateUserTokens(userId: number): Promise<void> {
  await query(
    "UPDATE users SET token_version = token_version + 1 WHERE id = $1",
    [userId]
  );
}

/**
 * 鉴权中间件：从 Authorization Bearer 解析 JWT，将 user 挂到 req.user。
 */
export function requireAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  let token: string | null = auth && auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) token = parseCookie(req, "access_token");
  if (!token) {
    return next(Object.assign(new Error("UNAUTHORIZED") as Error & { statusCode?: number }, { statusCode: 401 }));
  }
  const payload = verifyAccessToken(token);
  if (!payload) {
    return next(Object.assign(new Error("TOKEN_INVALID_OR_EXPIRED") as Error & { statusCode?: number }, { statusCode: 401 }));
  }
  req.user = payload;
  next();
}

/**
 * 角色校验中间件：仅允许指定角色访问。
 */
export function requireRole(...allowed: RoleName[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(Object.assign(new Error("UNAUTHORIZED") as Error & { statusCode?: number }, { statusCode: 401 }));
    }
    const role = req.user.role;
    if (!allowed.includes(role)) {
      return next(Object.assign(new Error("FORBIDDEN") as Error & { statusCode?: number }, { statusCode: 403 }));
    }
    next();
  };
}
