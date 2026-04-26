import { fetchWithAuth } from "./fetchWithAuth";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
  return (typeof data.message === "string" && data.message) || (typeof data.error === "string" && data.error) || fallback;
}

export type MerchantTemplate = {
  shop_name: string;
  product_type: string;
  shop_link: string;
  shop_rating: string;
  user_reviews: string;
};

export async function getClientMerchantTemplate(): Promise<MerchantTemplate | null> {
  const res = await fetchWithAuth("/api/matching/client/merchant-info-template");
  if (!res.ok) throw new Error(await readErrorMessage(res, "加载失败"));
  const data = (await res.json()) as any;
  return (data.template as MerchantTemplate | null) || null;
}

export async function saveClientMerchantTemplate(body: MerchantTemplate): Promise<void> {
  const res = await fetchWithAuth("/api/matching/client/merchant-info-template", {
    method: "PUT",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "保存失败"));
}

export async function createClientMatchingOrder(body: {
  title: string;
  task_amount: number;
  requirement?: string;
  cooperation_type_id: string;
}): Promise<{ id: number; order_no: string }> {
  const res = await fetchWithAuth("/api/matching/client/matching-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      title: body.title,
      task_amount: body.task_amount,
      requirement: body.requirement || "",
      detail: { cooperation_type_id: body.cooperation_type_id },
      allow_apply: false,
      attachments: [],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.message as string) || "创建失败");
  return data as any;
}

export type ClientMatchingOrder = {
  id: number;
  order_no: string;
  title: string;
  status: string;
  match_status: string;
  order_type: number;
  allow_apply: number;
  task_amount: string | number | null;
  deposit_frozen: string | number | null;
  influencer_id: number | null;
  work_links: any;
  created_at: string;
  updated_at: string;
  detail_json: any;
  attachment_urls: any;
  cooperation_type_id: string;
  coop_phase: string;
  coop_publish_links: any;
};

export async function listClientMatchingOrders(): Promise<ClientMatchingOrder[]> {
  const res = await fetchWithAuth("/api/matching/client/matching-orders");
  if (!res.ok) throw new Error(await readErrorMessage(res, "加载失败"));
  const data = (await res.json()) as any;
  return (data.list as ClientMatchingOrder[]) || [];
}

export async function acceptClientMatchingOrder(orderId: number): Promise<void> {
  const res = await fetchWithAuth(`/api/matching/client/matching-orders/${orderId}/accept`, { method: "POST" });
  if (!res.ok) throw new Error(await readErrorMessage(res, "验收失败"));
}

export async function rejectClientMatchingOrder(orderId: number, reason?: string): Promise<void> {
  const res = await fetchWithAuth(`/api/matching/client/matching-orders/${orderId}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ reason: reason || "" }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "驳回失败"));
}

export async function createClientMarketOrder(body: {
  title: string;
  tier: "A" | "B" | "C";
  task_count: number;
  client_shop_name: string;
  client_group_chat: string;
  publish_method: "client_self_publish" | "influencer_publish_with_cart";
  voice_link?: string;
  voice_note?: string;
  tiktok_link?: string;
}): Promise<{ id: number; order_no: string }> {
  const res = await fetchWithAuth("/api/client/market-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      title: body.title,
      tier: body.tier,
      task_count: body.task_count,
      client_shop_name: body.client_shop_name,
      client_group_chat: body.client_group_chat,
      publish_method: body.publish_method,
      voice_link: body.voice_link || "",
      voice_note: body.voice_note || "",
      tiktok_link: body.tiktok_link || "",
      product_images: [],
      sku_codes: [],
      sku_images: [],
      sku_ids: [],
      is_public_apply: false,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.message as string) || "创建失败");
  return data as any;
}

export type ClientMarketOrder = {
  id: number;
  order_no: string;
  title: string;
  reward_points: number;
  tier: string;
  publish_method: string;
  is_public_apply: number;
  match_status: string;
  task_count: number;
  reward_points_total: number;
  status: string;
  influencer_id: number | null;
  work_links: any;
  client_shop_name: string;
  client_group_chat: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  publish_link?: string | null;
};

export async function listClientMarketOrders(): Promise<ClientMarketOrder[]> {
  const res = await fetchWithAuth("/api/client/market-orders");
  if (!res.ok) throw new Error(await readErrorMessage(res, "加载失败"));
  const data = (await res.json()) as any;
  return (data.list as ClientMarketOrder[]) || [];
}
