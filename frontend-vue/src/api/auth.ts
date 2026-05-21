export type RoleName = "admin" | "employee" | "client" | "influencer";

export type AuthUser = {
  userId: number;
  username: string;
  role: RoleName;
};

const STORAGE_USER = "influencer_app_user";

function getApiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL as string) || window.location.origin;
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

function setStoredUser(user: AuthUser): void {
  localStorage.setItem(STORAGE_USER, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(STORAGE_USER);
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    credentials: "include",
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.message as string) || "登录失败");
  const user = (data as any).user as AuthUser;
  setStoredUser(user);
  return user;
}

export async function refreshAccessToken(): Promise<string> {
  const res = await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.message as string) || "刷新失败");
  const accessToken = String((data as any).accessToken || "");
  if (!accessToken) throw new Error("INVALID_ACCESS_TOKEN");
  return accessToken;
}

export async function getMe(): Promise<AuthUser> {
  const res = await fetch(`${getApiBaseUrl()}/api/auth/me`, { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.message as string) || "获取用户失败");
  const user = (data as any).user as AuthUser;
  setStoredUser(user);
  return user;
}

export async function logout(): Promise<void> {
  await fetch(`${getApiBaseUrl()}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  }).catch(() => {});
  clearAuth();
}
