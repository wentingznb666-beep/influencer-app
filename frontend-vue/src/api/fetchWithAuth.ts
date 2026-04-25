import { clearAuth, getAccessToken, refreshAccessToken } from "./auth";

function getBase(): string {
  return (import.meta.env.VITE_API_BASE_URL as string) || window.location.origin;
}

export function resolvePublicUploadUrl(url: string): string {
  const u = String(url || "").trim();
  if (!u) return u;
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("/")) {
    const base = getBase().replace(/\/$/, "");
    return `${base}${u}`;
  }
  return u;
}

export async function fetchWithAuth(path: string, options: RequestInit = {}): Promise<Response> {
  const doFetch = async (): Promise<Response> => {
    const token = getAccessToken();
    const headers = new Headers(options.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(`${getBase()}${path}`, { ...options, headers });
  };

  const res = await doFetch();
  if (res.status !== 401) return res;
  try {
    await refreshAccessToken();
  } catch {
    clearAuth();
    return res;
  }
  return doFetch();
}

