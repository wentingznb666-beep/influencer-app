/**
 * 客户端 API：合作意向、订单、达人作品、积分与充值。
 */
import { fetchWithAuth } from "./fetchWithAuth";
import { getAccessToken, refreshAccessToken } from "./authApi";

// fetchWithAuth 已统一封装在 src/fetchWithAuth.ts（含 401 自动刷新一次）

/** 合作意向列表 */
export async function getRequests() {
  const res = await fetchWithAuth("/api/client/requests");
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}

/** 合作意向详情 */
export async function getRequestDetail(id: number) {
  const res = await fetchWithAuth(`/api/client/requests/${id}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}

/** 提交合作意向 */
export async function createRequest(body: { product_info?: string; target_platform?: string; budget?: string; need_face?: boolean }) {
  const res = await fetchWithAuth("/api/client/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "提交失败");
  return res.json();
}

/** 编辑合作意向 */
export async function updateRequest(id: number, body: { product_info?: string; target_platform?: string; budget?: string; need_face?: boolean; status?: string }) {
  const res = await fetchWithAuth(`/api/client/requests/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "更新失败");
  return res.json();
}

/** 删除合作意向（软删） */
export async function deleteRequest(id: number) {
  const res = await fetchWithAuth(`/api/client/requests/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "删除失败");
  return res.json();
}

/** 客户 SKU 列表 */
export async function getSkus() {
  const res = await fetchWithAuth("/api/client/skus");
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}

/** 新增 SKU */
export async function createSku(body: { sku_code: string; sku_name?: string; sku_images?: string[] }) {
  const res = await fetchWithAuth("/api/client/skus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "创建失败");
  return res.json();
}

/** 编辑 SKU */
export async function updateSku(id: number, body: { sku_code?: string; sku_name?: string; sku_images?: string[] }) {
  const res = await fetchWithAuth(`/api/client/skus/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "更新失败");
  return res.json();
}

/** 删除 SKU（软删） */
export async function deleteSku(id: number) {
  const res = await fetchWithAuth(`/api/client/skus/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "删除失败");
  return res.json();
}

/**
 * 上传 SKU 图片（本地文件），支持进度回调。
 */
export async function uploadSkuImages(files: File[], onProgress?: (percent: number) => void): Promise<string[]> {
  if (files.length === 0) return [];
  /** 读取 API 基础地址。 */
  const getBase = () => ((import.meta.env.VITE_API_BASE_URL as string) || window.location.origin);
  /** 发送一次上传请求。 */
  const doUpload = (token: string | null) =>
    new Promise<{ status: number; body: any }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${getBase()}/api/client/skus/upload`);
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (evt) => {
        if (!onProgress) return;
        if (!evt.lengthComputable) return;
        onProgress(Math.min(100, Math.round((evt.loaded / evt.total) * 100)));
      };
      xhr.onerror = () => reject(new Error("上传失败"));
      xhr.onload = () => {
        let body: any = {};
        try {
          body = JSON.parse(xhr.responseText || "{}");
        } catch {
          body = {};
        }
        resolve({ status: xhr.status, body });
      };
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      xhr.send(fd);
    });

  let token = getAccessToken();
  let first = await doUpload(token);
  if (first.status === 401) {
    try {
      await refreshAccessToken();
      token = getAccessToken();
      first = await doUpload(token);
    } catch {
      throw new Error("登录已过期，请重新登录");
    }
  }
  if (first.status < 200 || first.status >= 300) {
    throw new Error((first.body?.message as string) || "上传失败");
  }
  const urls = Array.isArray(first.body?.urls) ? (first.body.urls as string[]) : [];
  return urls;
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

/** 发单详情 */
export async function getMarketOrderDetail(id: number) {
  const res = await fetchWithAuth(`/api/client/market-orders/${id}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}

/**
 * 创建达人领单（需满足最低积分；完成后从余额扣给达人）。
 * @param body 任务要求文案与可选标题
 */
export async function createMarketOrder(body: {
  requirements: string;
  title?: string;
  tier?: "A" | "B" | "C";
  voice_link?: string;
  voice_note?: string;
  tiktok_link?: string;
  product_images?: string[];
  sku_codes?: string[];
  sku_images?: string[];
  sku_ids?: number[];
  task_count?: number;
}) {
  const res = await fetchWithAuth("/api/client/market-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "创建失败");
  return res.json();
}

/** 编辑发单（仅 open 可编辑） */
export async function updateMarketOrder(
  id: number,
  body: {
    title?: string;
    requirements?: string;
    tier?: "A" | "B" | "C";
    voice_link?: string;
    voice_note?: string;
    tiktok_link?: string;
    product_images?: string[];
    sku_codes?: string[];
    sku_images?: string[];
    sku_ids?: number[];
  }
) {
  const res = await fetchWithAuth(`/api/client/market-orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "更新失败");
  return res.json();
}

/** 删除发单（软删，仅 open 可删） */
export async function deleteMarketOrder(id: number) {
  const res = await fetchWithAuth(`/api/client/market-orders/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "删除失败");
  return res.json();
}
