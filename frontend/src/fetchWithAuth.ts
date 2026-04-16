import { clearAuth, getAccessToken, refreshAccessToken } from "./authApi";

function getBase(): string {
  return (import.meta.env.VITE_API_BASE_URL as string) || window.location.origin;
}

/**
 * 将接口返回的上传资源 URL 转为浏览器可请求的绝对地址（仅用于 img/href 展示）。
 * 原因：数据库存相对路径 /uploads/... 时，开发环境页面在 Vite 端口，直接作 src 会请求到前端端口导致 404；拼接 API 基址或依赖代理后均可正常显示。
 */
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

/**
 * 统一封装带鉴权的 fetch：
 * - 若 accessToken 过期导致 401，则自动尝试 refresh 并重放一次请求（无感刷新）。
 * - 不改变业务请求与响应结构，仅提升会话稳定性。
 */
export async function fetchWithAuth(path: string, options: RequestInit = {}): Promise<Response> {
  const doFetch = async (): Promise<Response> => {
    const token = getAccessToken();
    const headers = new Headers(options.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(`${getBase()}${path}`, { ...options, headers });
  };

  const res = await doFetch();
  if (res.status !== 401) return res;

  // accessToken 可能过期：尝试刷新并重放一次
  try {
    await refreshAccessToken();
  } catch {
    clearAuth();
    return res;
  }
  return doFetch();
}

