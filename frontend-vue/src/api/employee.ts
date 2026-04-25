import { fetchWithAuth } from "./fetchWithAuth";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
  return (typeof data.message === "string" && data.message) || (typeof data.error === "string" && data.error) || fallback;
}

export type AdminMarketOrder = {
  id: number;
  order_no: string;
  title: string;
  client_id: number;
  client_username: string;
  client_display_name: string;
  client_shop_name: string;
  client_group_chat: string;
  task_count: number;
  influencer_id: number | null;
  influencer_username: string | null;
  influencer_display_name: string | null;
  tier: string;
  publish_method: string;
  publish_link?: string | null;
  published_at?: string | null;
  status: string;
  work_links: any;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export async function listAdminOrders(params?: { q?: string; status?: string }): Promise<AdminMarketOrder[]> {
  const q = new URLSearchParams();
  if (params?.q) q.set("q", params.q);
  if (params?.status) q.set("status", params.status);
  const res = await fetchWithAuth(`/api/admin/orders?${q.toString()}`);
  if (!res.ok) throw new Error(await readErrorMessage(res, "加载失败"));
  const data = (await res.json()) as any;
  return (data.list as AdminMarketOrder[]) || [];
}

export async function claimMarketOrder(orderId: number): Promise<void> {
  const res = await fetchWithAuth(`/api/influencer/market-orders/${orderId}/claim`, { method: "POST" });
  if (!res.ok) throw new Error(await readErrorMessage(res, "接单失败"));
}

export async function completeMarketOrder(orderId: number, workLinks: string[]): Promise<void> {
  const res = await fetchWithAuth(`/api/influencer/market-orders/${orderId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ work_links: workLinks }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "完单失败"));
}

export async function publishMarketOrder(orderId: number, publishLink: string): Promise<void> {
  const res = await fetchWithAuth(`/api/influencer/market-orders/${orderId}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ publish_link: publishLink }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "提交失败"));
}

