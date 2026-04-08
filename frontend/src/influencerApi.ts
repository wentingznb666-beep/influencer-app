/**
 * 达人端 API：任务大厅、领取、我的任务、投稿、积分。
 */
import { fetchWithAuth } from "./fetchWithAuth";

// fetchWithAuth 已统一封装在 src/fetchWithAuth.ts（含 401 自动刷新一次）

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

/** 积分与本周预计、流水 */
export async function getPoints() {
  const res = await fetchWithAuth("/api/influencer/points");
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}

/**
 * 客户端发单大厅（待领取）。
 * - q：订单号/标题/要求全文精准匹配
 * - start_date/end_date：创建日期筛选（YYYY-MM-DD）
 */
export async function getMarketOrders(params?: { q?: string; start_date?: string; end_date?: string }) {
  const q = new URLSearchParams();
  if (params?.q) q.set("q", params.q);
  if (params?.start_date) q.set("start_date", params.start_date);
  if (params?.end_date) q.set("end_date", params.end_date);
  const res = await fetchWithAuth(`/api/influencer/market-orders?${q}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}

/**
 * 我领取的客户端发单。
 * - q：订单号/标题/要求全文精准匹配
 * - start_date/end_date：创建日期筛选（YYYY-MM-DD）
 */
export async function getMyMarketOrders(params?: { q?: string; start_date?: string; end_date?: string }) {
  const q = new URLSearchParams();
  if (params?.q) q.set("q", params.q);
  if (params?.start_date) q.set("start_date", params.start_date);
  if (params?.end_date) q.set("end_date", params.end_date);
  const res = await fetchWithAuth(`/api/influencer/market-orders/my?${q}`);
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
 * 提交完成与多条交付链接（结算积分）。
 * @param orderId 订单 ID
 * @param work_links 交付链接列表（至少一条非空）
 */
export async function completeMarketOrder(orderId: number, work_links: string[]) {
  const res = await fetchWithAuth(`/api/influencer/market-orders/${orderId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ work_links }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data.message as string) || "提交失败");
  }
  return res.json();
}

/**
 * 领取人维护多条交付链接（已领取/已完成订单）。
 */
export async function updateInfluencerOrderWorkLinks(orderId: number, body: { work_links: string[] }) {
  const res = await fetchWithAuth(`/api/influencer/market-orders/${orderId}/work-links`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data.message as string) || "更新失败");
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
