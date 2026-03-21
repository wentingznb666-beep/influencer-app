/**
 * 达人端 API：任务大厅、领取、我的任务、投稿、积分。
 */
import { getAccessToken } from "./authApi";

function getBase(): string {
  return (import.meta.env.VITE_API_BASE_URL as string) || window.location.origin;
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

/** 客户端发单大厅（待领取） */
export async function getMarketOrders() {
  const res = await fetchWithAuth("/api/influencer/market-orders");
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}

/** 我领取的客户端发单 */
export async function getMyMarketOrders() {
  const res = await fetchWithAuth("/api/influencer/market-orders/my");
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}

/**
 * 领取客户端发单。
 * @param orderId 订单 ID
 */
export async function claimMarketOrder(orderId: number) {
  const res = await fetchWithAuth(`/api/influencer/market-orders/${orderId}/claim`, { method: "POST" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data.message as string) || "领取失败");
  }
  return res.json();
}

/**
 * 提交完成与作品链接（结算积分）。
 * @param orderId 订单 ID
 * @param work_link 交付链接
 */
export async function completeMarketOrder(orderId: number, work_link: string) {
  const res = await fetchWithAuth(`/api/influencer/market-orders/${orderId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ work_link }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data.message as string) || "提交失败");
  }
  return res.json();
}

/**
 * 提现记录列表（达人本人）。
 */
export async function getWithdrawals() {
  const res = await fetchWithAuth("/api/influencer/withdrawals");
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}

/**
 * 发起提现申请（策略 A：申请不扣余额，打款时扣）。
 */
export async function createWithdrawal(body: { amount: number; bank_account_name: string; bank_name: string; bank_account_no: string }) {
  const res = await fetchWithAuth("/api/influencer/withdrawals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "提交失败");
  return res.json();
}
