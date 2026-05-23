/**

 * 达人分发 APP 鉴权相关 API：登录、刷新令牌、获取当前用户。

 * refreshToken 仅由后端 httpOnly Cookie 保存，前端只在内存中保留短期 accessToken。

 */



import { normalizeAccountText } from "./utils/accountText";



export type RoleName = "admin" | "employee" | "client" | "influencer";



export interface AuthUser {

  userId: number;

  username: string;

  role: RoleName;

}



export type PublicRegisterRole = "client" | "influencer";

export type RegisterAccountResult = {

  requiresApproval: boolean;

  message: string;

};



const STORAGE_ACCESS = "influencer_app_access_token";

const STORAGE_REFRESH = "influencer_app_refresh_token";

const STORAGE_USER = "influencer_app_user";

let accessTokenMemory: string | null = null;

function stopAutoRefresh(): void {
  // Token auto-refresh is not implemented yet; stub for future use.
}

localStorage.removeItem(STORAGE_ACCESS);
localStorage.removeItem(STORAGE_REFRESH);
  stopAutoRefresh();



/**

 * 统一标准化用户名文本，避免转义串和乱码。

 */

function normalizeAuthUsername(input: unknown): string {

  return normalizeAccountText(input);

}



/**

 * 标准化用户对象中的可显示文本字段。

 */

function normalizeAuthUser(user: AuthUser): AuthUser {

  return {

    ...user,

    username: normalizeAuthUsername(user.username),

  };

}





function getApiBaseUrl(): string {

  return (import.meta.env.VITE_API_BASE_URL as string) || window.location.origin;

}



/**

 * 获取当前存储的 accessToken，用于请求头。

 */

export function getAccessToken(): string | null {

  return accessTokenMemory;

}



/**

 * 登录成功后保存令牌与用户信息。

 */

export function setAuth(accessToken: string, _refreshToken: string | undefined, user: AuthUser): void {

  accessTokenMemory = accessToken;

  localStorage.setItem(STORAGE_USER, JSON.stringify(normalizeAuthUser(user)));

}



/**

 * 登出：清除本地存储的令牌与用户。

 */

export function clearAuth(): void {

  accessTokenMemory = null;

  localStorage.removeItem(STORAGE_ACCESS);

  localStorage.removeItem(STORAGE_REFRESH);
  stopAutoRefresh();

  localStorage.removeItem(STORAGE_USER);

  void fetch(`${getApiBaseUrl()}/api/auth/logout`, { method: "POST", credentials: "include" }).catch(() => undefined);

}



/**

 * 从本地存储读取用户信息（不发起请求）。

 */

export function getStoredUser(): AuthUser | null {

  const raw = localStorage.getItem(STORAGE_USER);

  if (!raw) return null;

  try {

    return normalizeAuthUser(JSON.parse(raw) as AuthUser);

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

    headers: { "Content-Type": "application/json; charset=utf-8" },
    credentials: "include",

    body: JSON.stringify({ username, password }),

  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error((data.message as string) || "登录失败");

  const { accessToken, refreshToken, user } = data;

  const safeUser = normalizeAuthUser(user);

  setAuth(accessToken, refreshToken, safeUser);

  return safeUser;

}



/**

 * 使用 httpOnly refresh cookie 刷新 accessToken。

 */

export async function refreshAccessToken(): Promise<string> {

  const res = await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {

    method: "POST",

    headers: { "Content-Type": "application/json; charset=utf-8" },
    credentials: "include",

  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error((data.message as string) || "刷新失败");

  const accessToken = data.accessToken as string;

  accessTokenMemory = accessToken;

  return accessToken;

}



/**

 * 获取当前用户（需已登录），请求头携带 accessToken。

 */

export async function fetchMe(): Promise<AuthUser> {

  const token = getAccessToken();

  const res = await fetch(`${getApiBaseUrl()}/api/auth/me`, {
    credentials: "include",

    headers: token ? { Authorization: `Bearer ${token}` } : undefined,

  });

  if (res.status === 401) {

    clearAuth();

    throw new Error("未登录或已过期");

  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error((data.message as string) || "获取用户信息失败");

  return normalizeAuthUser(data.user as AuthUser);

}



/**

 * 公开注册账号，仅支持商家端或达人角色。

 */

export async function registerAccount(username: string, password: string, role: PublicRegisterRole): Promise<RegisterAccountResult> {

  const res = await fetch(`${getApiBaseUrl()}/api/auth/register`, {

    method: "POST",

    headers: { "Content-Type": "application/json; charset=utf-8" },

    body: JSON.stringify({ username, password, role }),

  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error((data.message as string) || "注册失败");

  return {

    requiresApproval: Boolean(data.requiresApproval),

    message: (data.message as string) || "注册成功，请登录。",

  };

}
