import { fetchWithAuth } from "./fetchWithAuth";

export type CooperationTypeId = "graded_video" | "high_quality_custom_video" | "monthly_package" | "creator_review_video";

export type CooperationTypesConfig = {
  version: 1;
  types: Array<{
    id: CooperationTypeId | string;
    name: { zh: string; th: string };
    visible_roles: string[];
    spec: Record<string, unknown>;
  }>;
};

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
  return (typeof data.message === "string" && data.message) || (typeof data.error === "string" && data.error) || fallback;
}

export async function getCooperationTypes(): Promise<{ key: string; config: CooperationTypesConfig }> {
  const res = await fetchWithAuth("/api/matching/cooperation-types");
  if (!res.ok) throw new Error(await readErrorMessage(res, "加载失败"));
  return res.json();
}

export async function updateCooperationTypes(config: CooperationTypesConfig): Promise<void> {
  const res = await fetchWithAuth("/api/matching/cooperation-types", {
    method: "PUT",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ config }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "保存失败"));
}

export type AdminCooperationOrder = {
  id: number;
  order_no: string;
  title: string;
  status: string;
  match_status: string;
  task_amount: string | number | null;
  client_id: number;
  influencer_id: number | null;
  work_links: unknown;
  created_at: string;
  updated_at: string;
  detail_json: any;
  attachment_urls: any;
  cooperation_type_id: string;
  phase: string;
  publish_links: any;
  review_note: string | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  client_username: string;
  client_name: string;
  influencer_username: string | null;
  influencer_name: string | null;
};

export async function getAdminCooperationOrders(params?: { type?: string; phase?: string; q?: string; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.type) q.set("type", params.type);
  if (params?.phase) q.set("phase", params.phase);
  if (params?.q) q.set("q", params.q);
  if (params?.limit) q.set("limit", String(params.limit));
  const res = await fetchWithAuth(`/api/matching/admin/cooperation-orders?${q.toString()}`);
  if (!res.ok) throw new Error(await readErrorMessage(res, "加载失败"));
  return res.json() as Promise<{ list: AdminCooperationOrder[] }>;
}

export async function reviewAdminCooperationOrder(orderId: number, body: { action: "approve" | "reject"; note?: string }) {
  const res = await fetchWithAuth(`/api/matching/admin/cooperation-orders/${orderId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "操作失败"));
}

export async function setAdminCooperationOrderPhase(orderId: number, phase: string) {
  const res = await fetchWithAuth(`/api/matching/admin/cooperation-orders/${orderId}/phase`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ phase }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "更新失败"));
}

export async function claimAdminCooperationOrder(orderId: number) {
  const res = await fetchWithAuth(`/api/matching/admin/cooperation-orders/${orderId}/claim`, { method: "POST" });
  if (!res.ok) throw new Error(await readErrorMessage(res, "接单失败"));
}

export async function submitAdminCooperationOrderProof(orderId: number, videoUrls: string[]) {
  const res = await fetchWithAuth(`/api/matching/admin/cooperation-orders/${orderId}/submit-proof`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ video_urls: videoUrls }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "提交失败"));
}

export async function publishAdminCooperationOrder(orderId: number, publishLink: string) {
  const res = await fetchWithAuth(`/api/matching/admin/cooperation-orders/${orderId}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ publish_link: publishLink }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "提交失败"));
}

