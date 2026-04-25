export type RoleName = "admin" | "employee" | "client" | "influencer";

export type AuthUser = {
  userId: number;
  username: string;
  role: RoleName;
};

const STORAGE_ACCESS = "influencer_app_access_token";
const STORAGE_REFRESH = "influencer_app_refresh_token";
const STORAGE_USER = "influencer_app_user";

function getApiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL as string) || window.location.origin;
}

export function getAccessToken(): string | null {
  return localStorage.getItem(STORAGE_ACCESS);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(STORAGE_REFRESH);
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(STORAGE_USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setAuth(accessToken: string, refreshToken: string, user: AuthUser): void {
  localStorage.setItem(STORAGE_ACCESS, accessToken);
  localStorage.setItem(STORAGE_REFRESH, refreshToken);
  localStorage.setItem(STORAGE_USER, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(STORAGE_ACCESS);
  localStorage.removeItem(STORAGE_REFRESH);
  localStorage.removeItem(STORAGE_USER);
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.message as string) || "登录失败");
  const { accessToken, refreshToken, user } = data as any;
  setAuth(accessToken, refreshToken, user);
  return user as AuthUser;
}

export async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error("NO_REFRESH_TOKEN");
  const res = await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ refreshToken }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.message as string) || "刷新失败");
  const accessToken = String((data as any).accessToken || "");
  if (!accessToken) throw new Error("INVALID_ACCESS_TOKEN");
  localStorage.setItem(STORAGE_ACCESS, accessToken);
  return accessToken;
}

export async function getMe(): Promise<AuthUser> {
  const token = getAccessToken();
  if (!token) throw new Error("NO_ACCESS_TOKEN");
  const res = await fetch(`${getApiBaseUrl()}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.message as string) || "获取用户失败");
  const user = (data as any).user as AuthUser;
  localStorage.setItem(STORAGE_USER, JSON.stringify(user));
  return user;
}

