import { fetchWithAuth } from "./fetchWithAuth";



async function readError(res: Response, fallback: string): Promise<string> {

  const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };

  return (data.message || data.error || fallback) as string;

}



export async function getClientMarketOrderApplications(orderId: number) {

  const res = await fetchWithAuth(`/api/matching/client/market-orders/${orderId}/applications`);

  if (!res.ok) throw new Error(await readError(res, "Request failed"));

  return res.json();

}



export async function selectClientMarketOrderApplication(orderId: number, appId: number) {

  const res = await fetchWithAuth(`/api/matching/client/market-orders/${orderId}/applications/${appId}/select`, { method: "POST" });

  if (!res.ok) throw new Error(await readError(res, "Action failed"));

  return res.json();

}



export async function rejectClientMarketOrderApplication(orderId: number, appId: number) {

  const res = await fetchWithAuth(`/api/matching/client/market-orders/${orderId}/applications/${appId}/reject`, { method: "POST" });

  if (!res.ok) throw new Error(await readError(res, "Action failed"));

  return res.json();

}



export async function getClientCollabPool() {

  const res = await fetchWithAuth("/api/matching/client/collab-pool");

  if (!res.ok) throw new Error(await readError(res, "Request failed"));

  return res.json();

}




export async function getClientCollabMyApplies() {

  const res = await fetchWithAuth("/api/matching/client/collab-pool/my-applies");

  if (!res.ok) throw new Error(await readError(res, "Request failed"));

  return res.json();

}

export async function applyClientCollabPool(
  demandId: number,
  payload?: {
    note?: string;
    merchant_shop_name?: string;
    merchant_product_type?: string;
    merchant_sales_summary?: string;
    merchant_shop_link?: string;
  },
) {

  const res = await fetchWithAuth(`/api/matching/client/collab-pool/${demandId}/apply`, {

    method: "POST",

    headers: { "Content-Type": "application/json; charset=utf-8" },

    body: JSON.stringify(payload || {}),

  });

  if (!res.ok) throw new Error(await readError(res, "Apply failed"));

  return res.json();

}



export async function applyInfluencerMarketOrder(orderId: number, note?: string) {

  const res = await fetchWithAuth(`/api/matching/influencer/market-orders/${orderId}/apply`, {

    method: "POST",

    headers: { "Content-Type": "application/json; charset=utf-8" },

    body: JSON.stringify({ note }),

  });

  if (!res.ok) throw new Error(await readError(res, "Apply failed"));

  return res.json();

}



export async function getInfluencerMyApplications() {

  const res = await fetchWithAuth("/api/matching/influencer/my-applications");

  if (!res.ok) throw new Error(await readError(res, "Request failed"));

  return res.json();

}



export async function getInfluencerDemands() {

  const res = await fetchWithAuth("/api/matching/influencer/demands");

  if (!res.ok) throw new Error(await readError(res, "Request failed"));

  return res.json();

}



export async function createInfluencerDemand(body: {
  specialty: string;
  fans_level: string;
  task_types: string[];
  categories_can_do: string;
  categories_not_do: string;
  need_sample: "是" | "否";
  unit_price: number;
  delivery_days: number;
  revise_times: number;
  intro: string;
  tiktok_account: string;
  tiktok_fans: number;
}) {

  const res = await fetchWithAuth("/api/matching/influencer/demands", {

    method: "POST",

    headers: { "Content-Type": "application/json; charset=utf-8" },

    body: JSON.stringify(body),

  });

  if (!res.ok) throw new Error(await readError(res, "Create failed"));

  return res.json();

}



export async function getInfluencerDemandApplications(demandId: number) {

  const res = await fetchWithAuth(`/api/matching/influencer/demands/${demandId}/applications`);

  if (!res.ok) throw new Error(await readError(res, "Request failed"));

  return res.json();

}



export async function selectInfluencerDemandApplication(demandId: number, appId: number) {

  const res = await fetchWithAuth(`/api/matching/influencer/demands/${demandId}/applications/${appId}/select`, { method: "POST" });

  if (!res.ok) throw new Error(await readError(res, "Action failed"));

  return res.json();

}



export async function rejectInfluencerDemandApplication(demandId: number, appId: number) {

  const res = await fetchWithAuth(`/api/matching/influencer/demands/${demandId}/applications/${appId}/reject`, { method: "POST" });

  if (!res.ok) throw new Error(await readError(res, "Action failed"));

  return res.json();

}



export async function getAdminDemands(status?: string) {

  const q = status ? `?status=${encodeURIComponent(status)}` : "";

  const res = await fetchWithAuth(`/api/matching/admin/demands${q}`);

  if (!res.ok) throw new Error(await readError(res, "Request failed"));

  return res.json();

}



export async function reviewAdminDemand(id: number, action: "approve" | "reject", note?: string) {

  const res = await fetchWithAuth(`/api/matching/admin/demands/${id}/review`, {

    method: "POST",

    headers: { "Content-Type": "application/json; charset=utf-8" },

    body: JSON.stringify({ action, note }),

  });

  if (!res.ok) throw new Error(await readError(res, "Review failed"));

  return res.json();

}



export async function getAdminPremiumCreators() {

  const res = await fetchWithAuth("/api/matching/admin/premium-creators");

  if (!res.ok) throw new Error(await readError(res, "Request failed"));

  return res.json();

}



export async function updateAdminPremiumCreator(id: number, can_publish_demand: boolean) {

  const res = await fetchWithAuth(`/api/matching/admin/premium-creators/${id}`, {

    method: "PATCH",

    headers: { "Content-Type": "application/json; charset=utf-8" },

    body: JSON.stringify({ can_publish_demand }),

  });

  if (!res.ok) throw new Error(await readError(res, "Update failed"));

  return res.json();

}


export async function getInfluencerPermissionStatus() {
  const res = await fetchWithAuth('/api/matching/influencer/permission-status');
  if (!res.ok) throw new Error(await readError(res, 'Request failed'));
  return res.json();
}

export async function applyInfluencerPermission(body: {
  tiktok_account: string;
  tiktok_fans: string;
  category: string;
  bio: string;
}) {
  const res = await fetchWithAuth('/api/matching/influencer/permission-apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res, 'Apply failed'));
  return res.json();
}

export async function getInfluencerTaskHall() {
  const res = await fetchWithAuth('/api/matching/influencer/task-hall');
  if (!res.ok) throw new Error(await readError(res, 'Request failed'));
  return res.json();
}

export async function getAdminInfluencerPermissions() {
  const res = await fetchWithAuth('/api/matching/admin/influencer-permissions');
  if (!res.ok) throw new Error(await readError(res, 'Request failed'));
  return res.json();
}

export async function reviewAdminInfluencerPermission(id: number, action: 'approve' | 'reject', note?: string) {
  const res = await fetchWithAuth(`/api/matching/admin/influencer-permissions/${id}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ action, note }),
  });
  if (!res.ok) throw new Error(await readError(res, 'Review failed'));
  return res.json();
}

export async function toggleAdminInfluencerPermission(id: number, enabled: boolean) {
  const res = await fetchWithAuth(`/api/matching/admin/influencer-permissions/${id}/toggle`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error(await readError(res, 'Toggle failed'));
  return res.json();
}


/** 商家咨询达人需求。 */
export async function consultClientCollabPool(demandId: number, note: string) {
  const res = await fetchWithAuth(`/api/matching/client/collab-pool/${demandId}/consult`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ note }),
  });
  if (!res.ok) throw new Error(await readError(res, "Consult failed"));
  return res.json();
}
