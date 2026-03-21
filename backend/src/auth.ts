import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { query } from "./db";

const JWT_SECRET = process.env.JWT_SECRET || "influencer-app-secret-change-in-production";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "influencer-app-refresh-secret";
const ACCESS_EXP = "15m";
const REFRESH_EXP = "7d";

export type RoleName = "admin" | "employee" | "client" | "influencer";

export interface JwtPayload {
  userId: number;
  username: string;
  role: RoleName;
  iat?: number;
  exp?: number;
}

/** 扩展 Express Request，挂载鉴权后的用户信息 */
export interface AuthRequest extends Request {
  requestId?: string;
  user?: JwtPayload;
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
): Promise<{ id: number; username: string; password_hash: string; role: RoleName; disabled: number } | null> {
  const res = await query<{ id: number; username: string; password_hash: string; role: string; disabled: number }>(
    "SELECT u.id, u.username, u.password_hash, r.name AS role, u.disabled FROM users u JOIN roles r ON u.role_id = r.id WHERE u.username = $1",
    [username]
  );
  const row = res.rows[0];
  if (!row) return null;
  return { ...row, role: row.role as RoleName };
}

/**
 * 鉴权中间件：从 Authorization Bearer 解析 JWT，将 user 挂到 req.user。
 */
export function requireAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  const token = auth && auth.startsWith("Bearer ") ? auth.slice(7) : null;
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
    const isEmployeeWithAdminPermission = role === "employee" && allowed.includes("admin");
    if (!allowed.includes(role) && !isEmployeeWithAdminPermission) {
      return next(Object.assign(new Error("FORBIDDEN") as Error & { statusCode?: number }, { statusCode: 403 }));
    }
    next();
  };
}
