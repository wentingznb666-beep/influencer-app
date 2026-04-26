import { fetchWithAuth } from "./fetchWithAuth";

export type EmployeeVideoOrderTypeId = "high_quality_custom_video" | "monthly_package" | "creator_review_video";

export type EmployeeVideoOrderPhase =
  | "created"
  | "paid"
  | "assigned"
  | "in_progress"
  | "submitted"
  | "review_pending"
  | "review_rejected"
  | "approved_to_publish"
  | "published"
  | "delivered"
  | "completed"
  | "rejected";

export type EmployeeVideoOrder = {
  id: number;
  client_id: number;
  client_username: string;
  type_id: EmployeeVideoOrderTypeId;
  title: string;
  requirements: Record<string, unknown>;
  amount_thb: number;
  payment_method: string;
  payment_status: "unpaid" | "paid";
  paid_at: string | null;
  assigned_employee_id: number | null;
  phase: EmployeeVideoOrderPhase;
  proof_links: unknown[];
  publish_links: unknown[];
  batch_payload: unknown[];
  created_at: string;
  updated_at: string;
  review_note?: string | null;
  reviewed_by?: number | null;
  reviewed_at?: string | null;
};

export async function getEmployeeVideoOrders(params?: { type?: EmployeeVideoOrderTypeId; phase?: EmployeeVideoOrderPhase; q?: string; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.type) q.set("type", params.type);
  if (params?.phase) q.set("phase", params.phase);
  if (params?.q) q.set("q", params.q);
  if (params?.limit) q.set("limit", String(params.limit));
  const res = await fetchWithAuth(`/api/employee/video-orders?${q}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json() as Promise<{ list: EmployeeVideoOrder[] }>;
}

export async function claimEmployeeVideoOrder(id: number) {
  const res = await fetchWithAuth(`/api/employee/video-orders/${id}/claim`, { method: "POST" });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "接单失败");
  return res.json();
}

export async function setEmployeeVideoOrderPhase(id: number, phase: EmployeeVideoOrderPhase) {
  const res = await fetchWithAuth(`/api/employee/video-orders/${id}/phase`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ phase }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "更新失败");
  return res.json();
}

export async function submitEmployeeVideoOrderProof(id: number, video_urls: string[]) {
  const res = await fetchWithAuth(`/api/employee/video-orders/${id}/submit-proof`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ video_urls }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "提交失败");
  return res.json();
}

export async function publishEmployeeVideoOrder(id: number, publish_link: string) {
  const res = await fetchWithAuth(`/api/employee/video-orders/${id}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ publish_link }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "提交失败");
  return res.json();
}

export async function submitEmployeeMonthlyBatch(id: number, body: { batch_no: number; video_count: number; video_urls: string[] }) {
  const res = await fetchWithAuth(`/api/employee/video-orders/${id}/monthly-batches/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "提交失败");
  return res.json();
}

