import { fetchWithAuth } from "./fetchWithAuth";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
  return (typeof data.message === "string" && data.message) || (typeof data.error === "string" && data.error) || fallback;
}

export type OfflineVideoOrderTypeId = "high_quality_custom_video" | "monthly_package" | "creator_review_video";
export type VideoOrderTypeId = "graded_video" | OfflineVideoOrderTypeId;

export type VideoOrder = {
  id: number;
  client_id?: number;
  client_username?: string;
  employee_username?: string | null;
  type_id: VideoOrderTypeId;
  title: string;
  requirements?: any;
  amount_thb: string | number;
  payment_method: "offline" | "points";
  payment_status: "unpaid" | "paid" | "refunded";
  paid_at: string | null;
  assigned_employee_id: number | null;
  created_at: string;
  updated_at: string;
  phase: string;
  proof_links: any;
  publish_links: any;
  review_note: string | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  monthly_accepted_count?: number;
  monthly_planned_count?: number;
  monthly_settled_amount_thb?: string | number;
};

export async function createClientVideoOrder(body: {
  type_id: VideoOrderTypeId;
  title: string;
  amount_thb: number;
  requirements?: Record<string, unknown>;
}): Promise<{ id: number }> {
  const res = await fetchWithAuth("/api/client/video-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      type_id: body.type_id,
      title: body.title,
      amount_thb: body.amount_thb,
      requirements: body.requirements || {},
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.message as string) || "创建失败");
  return data as any;
}

export async function createClientOfflineVideoOrder(body: {
  type_id: OfflineVideoOrderTypeId;
  title: string;
  amount_thb: number;
  requirements?: Record<string, unknown>;
}): Promise<{ id: number }> {
  return createClientVideoOrder(body);
}

export async function listClientVideoOrders(): Promise<VideoOrder[]> {
  const res = await fetchWithAuth("/api/client/video-orders");
  if (!res.ok) throw new Error(await readErrorMessage(res, "加载失败"));
  const data = (await res.json()) as any;
  return (data.list as VideoOrder[]) || [];
}

export async function listClientOfflineVideoOrders(): Promise<VideoOrder[]> {
  return listClientVideoOrders();
}

export async function markClientOfflineVideoOrderPaid(orderId: number): Promise<void> {
  const res = await fetchWithAuth(`/api/client/video-orders/${orderId}/mark-paid`, { method: "POST" });
  if (!res.ok) throw new Error(await readErrorMessage(res, "操作失败"));
}

export async function acceptClientOfflineVideoOrder(orderId: number): Promise<void> {
  const res = await fetchWithAuth(`/api/client/video-orders/${orderId}/accept`, { method: "POST" });
  if (!res.ok) throw new Error(await readErrorMessage(res, "验收失败"));
}

export async function rejectClientOfflineVideoOrder(orderId: number, note?: string): Promise<void> {
  const res = await fetchWithAuth(`/api/client/video-orders/${orderId}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ note: note || "" }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "驳回失败"));
}

export async function cancelClientVideoOrder(orderId: number): Promise<void> {
  const res = await fetchWithAuth(`/api/client/video-orders/${orderId}/cancel`, { method: "POST" });
  if (!res.ok) throw new Error(await readErrorMessage(res, "取消失败"));
}

export async function listEmployeeOfflineVideoOrders(params?: {
  type?: VideoOrderTypeId;
  phase?: string;
  q?: string;
  limit?: number;
}): Promise<VideoOrder[]> {
  const q = new URLSearchParams();
  if (params?.type) q.set("type", params.type);
  if (params?.phase) q.set("phase", params.phase);
  if (params?.q) q.set("q", params.q);
  if (params?.limit != null) q.set("limit", String(params.limit));
  const res = await fetchWithAuth(`/api/employee/video-orders?${q.toString()}`);
  if (!res.ok) throw new Error(await readErrorMessage(res, "加载失败"));
  const data = (await res.json()) as any;
  return (data.list as VideoOrder[]) || [];
}

export async function claimEmployeeOfflineVideoOrder(orderId: number): Promise<void> {
  const res = await fetchWithAuth(`/api/employee/video-orders/${orderId}/claim`, { method: "POST" });
  if (!res.ok) throw new Error(await readErrorMessage(res, "接单失败"));
}

export async function setEmployeeOfflineVideoOrderPhase(orderId: number, phase: string): Promise<void> {
  const res = await fetchWithAuth(`/api/employee/video-orders/${orderId}/phase`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ phase }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "更新失败"));
}

export async function submitEmployeeOfflineVideoOrderProof(orderId: number, videoUrls: string[]): Promise<void> {
  const res = await fetchWithAuth(`/api/employee/video-orders/${orderId}/submit-proof`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ video_urls: videoUrls }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "提交失败"));
}

export async function publishEmployeeOfflineVideoOrder(orderId: number, publishLink: string): Promise<void> {
  const res = await fetchWithAuth(`/api/employee/video-orders/${orderId}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ publish_link: publishLink }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "提交失败"));
}

export async function listAdminOfflineVideoOrders(params?: {
  type?: VideoOrderTypeId;
  phase?: string;
  q?: string;
  limit?: number;
}): Promise<VideoOrder[]> {
  const q = new URLSearchParams();
  if (params?.type) q.set("type", params.type);
  if (params?.phase) q.set("phase", params.phase);
  if (params?.q) q.set("q", params.q);
  if (params?.limit != null) q.set("limit", String(params.limit));
  const res = await fetchWithAuth(`/api/admin/video-orders?${q.toString()}`);
  if (!res.ok) throw new Error(await readErrorMessage(res, "加载失败"));
  const data = (await res.json()) as any;
  return (data.list as VideoOrder[]) || [];
}

export async function reviewAdminOfflineVideoOrder(orderId: number, body: { action: "approve" | "reject"; note?: string }): Promise<void> {
  const res = await fetchWithAuth(`/api/admin/video-orders/${orderId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ action: body.action, note: body.note || "" }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "审核失败"));
}

export type MonthlyBatch = {
  id: number;
  order_id: number;
  week_start: string;
  week_end: string;
  planned_count: number;
  submitted_count: number;
  accepted_count: number;
  status: string;
  proof_links: any;
  review_note: string | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  settlement_id?: number;
  settlement_status?: string;
  settlement_amount_thb?: string | number;
  settlement_paid_at?: string | null;
};

export async function listClientMonthlyBatches(orderId: number): Promise<MonthlyBatch[]> {
  const res = await fetchWithAuth(`/api/client/video-orders/${orderId}/monthly/batches`);
  if (!res.ok) throw new Error(await readErrorMessage(res, "加载失败"));
  const data = (await res.json()) as any;
  return (data.list as MonthlyBatch[]) || [];
}

export async function acceptClientMonthlyBatch(orderId: number, batchId: number, acceptedCount?: number): Promise<void> {
  const res = await fetchWithAuth(`/api/client/video-orders/${orderId}/monthly/batches/${batchId}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ accepted_count: acceptedCount }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "验收失败"));
}

export async function markClientMonthlySettlementPaid(orderId: number, settlementId: number): Promise<void> {
  const res = await fetchWithAuth(`/api/client/video-orders/${orderId}/monthly/settlements/${settlementId}/mark-paid`, { method: "POST" });
  if (!res.ok) throw new Error(await readErrorMessage(res, "结算失败"));
}

export async function listEmployeeMonthlyBatches(orderId: number): Promise<MonthlyBatch[]> {
  const res = await fetchWithAuth(`/api/employee/video-orders/${orderId}/monthly/batches`);
  if (!res.ok) throw new Error(await readErrorMessage(res, "加载失败"));
  const data = (await res.json()) as any;
  return (data.list as MonthlyBatch[]) || [];
}

export async function submitEmployeeMonthlyBatch(
  orderId: number,
  body: { week_start: string; week_end: string; planned_count?: number; submitted_count?: number; video_urls: string[] }
): Promise<{ id: number }> {
  const res = await fetchWithAuth(`/api/employee/video-orders/${orderId}/monthly/batches`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.message as string) || "提交失败");
  return data as any;
}

export async function patchEmployeeVideoOrderRequirements(orderId: number, patch: Record<string, unknown>): Promise<void> {
  const res = await fetchWithAuth(`/api/employee/video-orders/${orderId}/requirements`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ patch }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "更新失败"));
}
