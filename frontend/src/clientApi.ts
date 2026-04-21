/**

 * 商家端 API：合作意向、订单、积分与充值。

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

  const res = await fetchWithAuth("/api/client/requests", { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body) });

  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "提交失败");

  return res.json();

}



/** 编辑合作意向 */

export async function updateRequest(id: number, body: { product_info?: string; target_platform?: string; budget?: string; need_face?: boolean; status?: string }) {

  const res = await fetchWithAuth(`/api/client/requests/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body) });

  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "更新失败");

  return res.json();

}



/** 删除合作意向（软删） */

export async function deleteRequest(id: number) {

  const res = await fetchWithAuth(`/api/client/requests/${id}`, { method: "DELETE" });

  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "删除失败");

  return res.json();

}



/** 商家 SKU 列表 */

export async function getSkus() {

  const res = await fetchWithAuth("/api/client/skus");

  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");

  return res.json();

}



/** 新增 SKU */

export async function createSku(body: { sku_code: string; sku_name?: string; sku_images?: string[] }) {

  const res = await fetchWithAuth("/api/client/skus", { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body) });

  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "创建失败");

  return res.json();

}



/** 编辑 SKU */

export async function updateSku(id: number, body: { sku_code?: string; sku_name?: string; sku_images?: string[] }) {

  const res = await fetchWithAuth(`/api/client/skus/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body) });

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

  const res = await fetchWithAuth("/api/client/orders", { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body) });

  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "创建失败");

  return res.json();

}



/** 更新订单 */

export async function updateOrder(id: number, body: { status?: string; note?: string }) {

  const res = await fetchWithAuth(`/api/client/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body) });

  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "更新失败");

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

  const res = await fetchWithAuth("/api/client/recharge", { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify({ amount }) });

  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "充值失败");

  return res.json();

}



/**

 * 达人领单：我的发单列表。

 * - q：订单号/标题/要求全文精准匹配

 * - start_date/end_date：创建日期筛选（YYYY-MM-DD）

 */

export async function getMarketOrders(params?: { q?: string; start_date?: string; end_date?: string }) {

  const q = new URLSearchParams();

  if (params?.q) q.set("q", params.q);

  if (params?.start_date) q.set("start_date", params.start_date);

  if (params?.end_date) q.set("end_date", params.end_date);

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

 * @param body 订单标题（1–200 字）及档位等

 */

export async function createMarketOrder(body: {

  title: string;

  client_shop_name: string;

  client_group_chat: string;

  publish_method: "client_self_publish" | "influencer_publish_with_cart";

  tier?: "A" | "B" | "C";

  voice_link?: string;

  voice_note?: string;

  tiktok_link?: string;

  product_images?: string[];

  sku_codes?: string[];

  sku_images?: string[];

  sku_ids?: number[];

  task_count?: number;

  is_public_apply?: boolean;

}) {

  const res = await fetchWithAuth("/api/client/market-orders", {

    method: "POST",

    headers: { "Content-Type": "application/json; charset=utf-8" },

    body: JSON.stringify(body),

  });

  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "创建失败");

  return res.json();

}



/** 编辑发单（仅 open 可编辑） */

export async function updateMarketOrder(

  id: number,

  body: {

    client_shop_name?: string;

    client_group_chat?: string;

    publish_method?: "client_self_publish" | "influencer_publish_with_cart";

    title?: string;

    tier?: "A" | "B" | "C";

    voice_link?: string;

    voice_note?: string;

    tiktok_link?: string;

    product_images?: string[];

    sku_codes?: string[];

    sku_images?: string[];

    sku_ids?: number[];

    is_public_apply?: boolean;

  }

) {

  const res = await fetchWithAuth(`/api/client/market-orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body) });

  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "更新失败");

  return res.json();

}



/** 删除发单（软删，仅 open 可删） */

export async function deleteMarketOrder(id: number) {

  const res = await fetchWithAuth(`/api/client/market-orders/${id}`, { method: "DELETE" });

  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "删除失败");

  return res.json();

}



/**

 * 商家端：获取模特展示列表（仅启用状态）。

 */

export async function getClientModels(params?: { q?: string }) {

  const q = new URLSearchParams();

  if (params?.q) q.set("q", params.q);

  const res = await fetchWithAuth(`/api/client/models?${q}`);

  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");

  return res.json();

}



/**

 * 商家端：获取我的长期合作模特列表。

 */

export async function getMyCooperationModels() {

  const res = await fetchWithAuth("/api/client/models/my");

  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");

  return res.json();

}



/**

 * 商家端：设置或取消长期合作模特。

 */

export async function updateModelCooperation(id: number, selected: boolean) {

  const res = await fetchWithAuth(`/api/client/models/${id}/cooperation`, {

    method: "PUT",

    headers: { "Content-Type": "application/json; charset=utf-8" },

    body: JSON.stringify({ selected }),

  });

  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "操作失败");

  return res.json();

}



/**

 * 商家端：Influencer 展示列表（仅启用）。

 */

export async function getClientShowcaseInfluencers(params?: { q?: string }) {

  const q = new URLSearchParams();

  if (params?.q) q.set("q", params.q);

  const res = await fetchWithAuth(`/api/client/showcase-influencers?${q}`);

  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");

  return res.json();

}



/**

 * 商家端：已预约的 Influencer 列表。

 */

export async function getMyShowcaseInfluencers() {

  const res = await fetchWithAuth("/api/client/showcase-influencers/my");

  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");

  return res.json();

}



/**

 * 商家端：预约或取消预约 Influencer。

 */

export async function updateShowcaseInfluencerSelection(id: number, selected: boolean) {

  const res = await fetchWithAuth(`/api/client/showcase-influencers/${id}/selection`, {

    method: "PUT",

    headers: { "Content-Type": "application/json; charset=utf-8" },

    body: JSON.stringify({ selected }),

  });

  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "操作失败");

  return res.json();

}



/**

 * 商家端：Content Creator 展示列表（仅启用）。

 */

export async function getClientShowcaseContentCreators(params?: { q?: string }) {

  const q = new URLSearchParams();

  if (params?.q) q.set("q", params.q);

  const res = await fetchWithAuth(`/api/client/showcase-content-creators?${q}`);

  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");

  return res.json();

}



/**

 * 商家端：已预约的 Content Creator 列表。

 */

export async function getMyShowcaseContentCreators() {

  const res = await fetchWithAuth("/api/client/showcase-content-creators/my");

  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");

  return res.json();

}



/**

 * 商家端：预约或取消预约 Content Creator。

 */

export async function updateShowcaseContentCreatorSelection(id: number, selected: boolean) {

  const res = await fetchWithAuth(`/api/client/showcase-content-creators/${id}/selection`, {

    method: "PUT",

    headers: { "Content-Type": "application/json; charset=utf-8" },

    body: JSON.stringify({ selected }),

  });

  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "操作失败");

  return res.json();

}




/** 读取商家会员与保证金信息。 */
export async function getClientMemberProfile() {
  const res = await fetchWithAuth('/api/matching/client/member');
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || '请求失败');
  return res.json();
}

/** 购买或续费商家会员。 */
export async function purchaseClientMember(level: 1 | 2 | 3, months = 1) {
  const res = await fetchWithAuth('/api/matching/client/member/purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ level, months }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || '购买失败');
  return res.json();
}

/** 商家保证金充值。 */
export async function topupClientDeposit(amount: number) {
  const res = await fetchWithAuth('/api/matching/client/deposit/topup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ amount }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || '充值失败');
  return res.json();
}

/** 新建撮合免积分订单。 */
export async function createMatchingOrder(body: { title: string; task_amount: number; requirement?: string; allow_apply?: boolean; detail?: Record<string, unknown>; attachments?: string[] }) {
  const res = await fetchWithAuth('/api/matching/client/matching-orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || '创建失败');
  return res.json();
}

/** 商家端读取撮合免积分订单列表。 */
export async function getMatchingOrders() {
  const res = await fetchWithAuth('/api/matching/client/matching-orders');
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || '请求失败');
  return res.json();
}


/** 商家端读取撮合订单报名列表。 */
/** ???????????? */
export async function getClientMerchantInfoTemplate() {
  const res = await fetchWithAuth('/api/matching/client/merchant-info-template');
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || '????');
  return res.json();
}

/** ???????????? */
export async function saveClientMerchantInfoTemplate(body: {
  shop_name: string;
  product_type: string;
  shop_link: string;
  shop_rating: string;
  user_reviews: string;
}) {
  const res = await fetchWithAuth('/api/matching/client/merchant-info-template', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || '????');
  return res.json();
}

export async function getMatchingOrderApplicants(orderId: number) {
  const res = await fetchWithAuth(`/api/matching/client/matching-orders/${orderId}/applicants`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || '请求失败');
  return res.json();
}

/** 商家端选中撮合报名达人。 */
export async function selectMatchingOrderApplicant(orderId: number, appId: number) {
  const res = await fetchWithAuth(`/api/matching/client/matching-orders/${orderId}/applicants/${appId}/select`, { method: 'POST' });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || '操作失败');
  return res.json();
}

/** 商家端驳回撮合报名达人。 */
export async function rejectMatchingOrderApplicant(orderId: number, appId: number) {
  const res = await fetchWithAuth(`/api/matching/client/matching-orders/${orderId}/applicants/${appId}/reject`, { method: 'POST' });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || '操作失败');
  return res.json();
}


/** 商家端验收驳回并退回任务。 */
export async function rejectMatchingOrderAccept(orderId: number) {
  const res = await fetchWithAuth(`/api/matching/client/matching-orders/${orderId}/reject`, { method: 'POST' });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || '驳回失败');
  return res.json();
}

/** 商家端验收通过并获取达人收款信息。 */
export async function acceptMatchingOrder(orderId: number) {
  const res = await fetchWithAuth(`/api/matching/client/matching-orders/${orderId}/accept`, { method: 'POST' });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || '验收失败');
  return res.json();
}


/** 商家端上传撮合任务图片/短视频。 */
export async function uploadMatchingOrderAssets(files: File[]) {
  const fd = new FormData();
  for (const file of files) fd.append('files', file);
  const res = await fetchWithAuth('/api/matching/client/matching-orders/upload', {
    method: 'POST',
    body: fd,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || '上传失败');
  return res.json();
}

/** 读取当前账号消息列表。 */
export async function getSystemMessages() {
  const res = await fetchWithAuth('/api/matching/messages');
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || '请求失败');
  return res.json();
}

/** 标记消息为已读。 */
export async function markSystemMessageRead(messageId: number) {
  const res = await fetchWithAuth(`/api/matching/messages/${messageId}/read`, { method: 'POST' });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || '操作失败');
  return res.json();
}
