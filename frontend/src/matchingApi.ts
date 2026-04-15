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

export async function applyClientCollabPool(demandId: number, note?: string) {
  const res = await fetchWithAuth(`/api/matching/client/collab-pool/${demandId}/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });
  if (!res.ok) throw new Error(await readError(res, "Apply failed"));
  return res.json();
}

export async function applyInfluencerMarketOrder(orderId: number, note?: string) {
  const res = await fetchWithAuth(`/api/matching/influencer/market-orders/${orderId}/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

export async function createInfluencerDemand(body: { title: string; demand_detail?: string; expected_points: number }) {
  const res = await fetchWithAuth("/api/matching/influencer/demands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
    headers: { "Content-Type": "application/json" },
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ can_publish_demand }),
  });
  if (!res.ok) throw new Error(await readError(res, "Update failed"));
  return res.json();
}
