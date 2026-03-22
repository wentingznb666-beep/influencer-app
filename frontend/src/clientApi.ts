/**
 * 客户端 API：合作意向、订单、达人作品、积分与充值。
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

/** 合作意向列表 */
export async function getRequests() {
  const res = await fetchWithAuth("/api/client/requests");
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}

/** 提交合作意向 */
export async function createRequest(body: { product_info?: string; target_platform?: string; budget?: string; need_face?: boolean }) {
  const res = await fetchWithAuth("/api/client/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "提交失败");
  return res.json();
}

/** 订单列表 */
export async function getOrders() {
  const res = await fetchWithAuth("/api/client/orders");
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}

/** 创建订单 */
export async function createOrder(body: { request_id?: number; note?: string }) {
  const res = await fetchWithAuth("/api/client/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "创建失败");
  return res.json();
}

/** 更新订单 */
export async function updateOrder(id: number, body: { status?: string; note?: string }) {
  const res = await fetchWithAuth(`/api/client/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "更新失败");
  return res.json();
}

/** 达人已发布作品列表 */
export async function getWorks() {
  const res = await fetchWithAuth("/api/client/works");
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}

/** 积分余额与流水 */
export async function getPoints() {
  const res = await fetchWithAuth("/api/client/points");
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}

/** 提交充值订单（待管理员确认入账） */
export async function recharge(amount: number) {
  const res = await fetchWithAuth("/api/client/recharge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "充值失败");
  return res.json();
}

/** 达人领单：我的发单列表；q 为订单号/标题/要求全文精准匹配 */
export async function getMarketOrders(params?: { q?: string }) {
  const q = new URLSearchParams();
  if (params?.q) q.set("q", params.q);
  const res = await fetchWithAuth(`/api/client/market-orders?${q}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}

/**
 * 创建达人领单（需满足最低积分；完成后从余额扣给达人）。
 * @param body 任务要求文案与可选标题
 */
export async function createMarketOrder(body: { requirements: string; title?: string }) {
  const res = await fetchWithAuth("/api/client/market-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "创建失败");
  return res.json();
}
