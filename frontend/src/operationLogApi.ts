import { fetchWithAuth } from "./fetchWithAuth";

/**
 * 获取当前用户的操作日志。
 */
export async function getMyOperationLogs(limit = 200) {
  const q = new URLSearchParams();
  q.set("limit", String(limit));
  const res = await fetchWithAuth(`/api/operation-logs/me?${q}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}

