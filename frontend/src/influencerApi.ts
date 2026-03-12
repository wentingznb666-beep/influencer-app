/**
 * 达人端 API：任务大厅、领取、我的任务、投稿、积分。
 */
import { getAccessToken } from "./authApi";

function getBase(): string {
  return (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:3000";
}

async function fetchWithAuth(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${getBase()}${path}`, { ...options, headers });
}

/** 任务大厅 */
export async function getTasks(params?: { platform?: string; type?: string }) {
  const q = new URLSearchParams();
  if (params?.platform) q.set("platform", params.platform);
  if (params?.type) q.set("type", params.type);
  const res = await fetchWithAuth(`/api/influencer/tasks?${q}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}

/** 领取任务 */
export async function claimTask(taskId: number) {
  const res = await fetchWithAuth(`/api/influencer/tasks/${taskId}/claim`, { method: "POST" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data.message as string) || "领取失败");
  }
  return res.json();
}

/** 我的任务列表 */
export async function getMyClaims() {
  const res = await fetchWithAuth("/api/influencer/my-claims");
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}

/** 单条领取详情（含下载链接） */
export async function getMyClaimDetail(claimId: number) {
  const res = await fetchWithAuth(`/api/influencer/my-claims/${claimId}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}

/** 投稿 */
export async function submitWork(body: { task_claim_id: number; work_link: string; note?: string }) {
  const res = await fetchWithAuth("/api/influencer/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "提交失败");
  return res.json();
}

/** 积分与本周预计、流水 */
export async function getPoints() {
  const res = await fetchWithAuth("/api/influencer/points");
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}
