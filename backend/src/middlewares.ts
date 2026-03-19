import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { query } from "./db";
import { AuthRequest } from "./auth";

/** 内存简易限流：按 key 记录最近请求时间，超过 windowMs 内 max 次则拒绝 */
const loginAttempts: Map<string, number[]> = new Map();
const LOGIN_WINDOW_MS = 60 * 1000;
const LOGIN_MAX = 10;

/**
 * 为每个请求生成并挂载 request-id，便于审计与排障。
 */
export function requestId(req: Request & { requestId?: string }, _res: Response, next: NextFunction): void {
  const id = (req.headers["x-request-id"] as string) || randomUUID();
  req.requestId = id;
  next();
}

/**
 * 将请求信息写入审计日志（路径、方法、用户、request-id）。
 */
export function auditLog(req: Request & { requestId?: string; user?: { userId: number } }, _res: Response, next: NextFunction): void {
  next();
  query("INSERT INTO audit_log (request_id, user_id, path, method) VALUES ($1, $2, $3, $4)", [req.requestId || null, req.user?.userId ?? null, req.path, req.method])
    .catch((e) => console.error("Audit log write failed:", e));
}

/**
 * 登录接口限流：按 IP 限制每分钟请求次数。
 */
export function loginRateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  let list = loginAttempts.get(key) || [];
  list = list.filter((t) => now - t < LOGIN_WINDOW_MS);
  list.push(now);
  loginAttempts.set(key, list);
  if (list.length > LOGIN_MAX) {
    res.status(429).json({ error: "TOO_MANY_REQUESTS", message: "登录尝试过于频繁，请稍后再试。" });
    return;
  }
  next();
}
