/**
 * 达人分发 APP 鉴权相关 API：登录、刷新令牌、获取当前用户。
 * 使用 localStorage 存储 accessToken / refreshToken，请求时自动携带。
 */

export type RoleName = "admin" | "client" | "influencer";

export interface AuthUser {
  userId: number;
  username: string;
  role: RoleName;
}

const STORAGE_ACCESS = "influencer_app_access_token";
const STORAGE_REFRESH = "influencer_app_refresh_token";
const STORAGE_USER = "influencer_app_user";

function getApiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:3000";
}

/**
 * 获取当前存储的 accessToken，用于请求头。
 */
export function getAccessToken(): string | null {
  return localStorage.getItem(STORAGE_ACCESS);
}

/**
 * 登录成功后保存令牌与用户信息。
 */
export function setAuth(accessToken: string, refreshToken: string, user: AuthUser): void {
  localStorage.setItem(STORAGE_ACCESS, accessToken);
  localStorage.setItem(STORAGE_REFRESH, refreshToken);
  localStorage.setItem(STORAGE_USER, JSON.stringify(user));
}

/**
 * 登出：清除本地存储的令牌与用户。
 */
export function clearAuth(): void {
  localStorage.removeItem(STORAGE_ACCESS);
  localStorage.removeItem(STORAGE_REFRESH);
  localStorage.removeItem(STORAGE_USER);
}

/**
 * 从本地存储读取用户信息（不发起请求）。
 */
export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(STORAGE_USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

/**
 * 调用登录接口，成功时写入本地存储并返回用户信息。
 */
export async function login(username: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.message as string) || "登录失败");
  const { accessToken, refreshToken, user } = data;
  setAuth(accessToken, refreshToken, user);
  return user;
}

/**
 * 使用 refreshToken 刷新 accessToken。
 */
export async function refreshAccessToken(): Promise<string> {
  const refreshToken = localStorage.getItem(STORAGE_REFRESH);
  if (!refreshToken) throw new Error("未登录");
  const res = await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.message as string) || "刷新失败");
  const accessToken = data.accessToken as string;
  localStorage.setItem(STORAGE_ACCESS, accessToken);
  return accessToken;
}

/**
 * 获取当前用户（需已登录），请求头携带 accessToken。
 */
export async function fetchMe(): Promise<AuthUser> {
  const token = getAccessToken();
  if (!token) throw new Error("未登录");
  const res = await fetch(`${getApiBaseUrl()}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    clearAuth();
    throw new Error("未登录或已过期");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.message as string) || "获取用户信息失败");
  return data.user as AuthUser;
}
