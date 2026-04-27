import { fetchWithAuth } from "./fetchWithAuth";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
  return (typeof data.message === "string" && data.message) || (typeof data.error === "string" && data.error) || fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeBatchRecord(input: any, index = 0): OrderBatchRecord {
  const batchId = input?.batch_id ?? input?.id ?? input?.batch_no ?? index + 1;
  const deliveryLinks = toStringList(input?.delivery_links ?? input?.proof_links ?? input?.video_urls ?? input?.links);
  return {
    batch_id: batchId,
    batch_no: asNumber(input?.batch_no ?? input?.batchNo ?? index + 1, index + 1),
    status: String(input?.status || "pending_acceptance"),
    video_count: asNumber(input?.video_count ?? input?.videoCount, deliveryLinks.length),
    accepted_count: asNumber(input?.accepted_count ?? input?.acceptedCount, 0),
    settled_amount: asNumber(input?.settled_amount ?? input?.settlement_amount, 0),
    delivery_links: deliveryLinks,
    proof_links: deliveryLinks,
    submitted_at: typeof input?.submitted_at === "string" ? input.submitted_at : null,
    accepted_at: typeof input?.accepted_at === "string" ? input.accepted_at : null,
    settled_at: typeof input?.settled_at === "string" ? input.settled_at : null,
    accept_note: typeof input?.accept_note === "string" ? input.accept_note : typeof input?.remark === "string" ? input.remark : null,
    remark: typeof input?.remark === "string" ? input.remark : typeof input?.accept_note === "string" ? input.accept_note : null,
    submitter_name:
      typeof input?.submitter_name === "string"
        ? input.submitter_name
        : typeof input?.employee_username === "string"
          ? input.employee_username
          : typeof input?.submitted_by_name === "string"
            ? input.submitted_by_name
            : null,
    raw: input || {},
  };
}

function normalizeBatchList(value: unknown): OrderBatchRecord[] {
  if (Array.isArray(value)) {
    return value.map((item, index) => normalizeBatchRecord(item, index));
  }
  if (value && typeof value === "object") {
    const data = value as { list?: unknown; batches?: unknown };
    if (Array.isArray(data.list)) return data.list.map((item, index) => normalizeBatchRecord(item, index));
    if (Array.isArray(data.batches)) return data.batches.map((item, index) => normalizeBatchRecord(item, index));
  }
  return [];
}

function normalizeVideoOrder(input: any): VideoOrder {
  return {
    ...input,
    batch_payload: normalizeBatchList(input?.batch_payload),
    proof_links: toStringList(input?.proof_links),
    publish_links: toStringList(input?.publish_links),
  } as VideoOrder;
}

export type OfflineVideoOrderTypeId = "high_quality_custom_video" | "monthly_package" | "creator_review_video";

export type MonthlyBatchStatus = "pending_acceptance" | "accepted" | "settled" | "rejected";

export type OrderBatchRecord = {
  batch_id: string | number;
  batch_no: number;
  status: MonthlyBatchStatus | string;
  video_count: number;
  accepted_count?: number;
  settled_amount?: number;
  delivery_links: string[];
  proof_links?: string[];
  submitted_at?: string | null;
  accepted_at?: string | null;
  settled_at?: string | null;
  accept_note?: string | null;
  remark?: string | null;
  submitter_name?: string | null;
  raw?: Record<string, unknown>;
};

export type MonthlyBatchItem = OrderBatchRecord;

export type VideoOrder = {
  id: number;
  client_id?: number;
  client_username?: string;
  employee_username?: string | null;
  type_id: OfflineVideoOrderTypeId;
  title: string;
  requirements?: Record<string, unknown>;
  batch_payload?: MonthlyBatchItem[];
  amount_thb: string | number;
  payment_method: "offline";
  payment_status: "unpaid" | "paid";
  paid_at: string | null;
  assigned_employee_id: number | null;
  created_at: string;
  updated_at: string;
  phase: string;
  proof_links: string[];
  publish_links: string[];
  review_note: string | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
};

export async function createClientOfflineVideoOrder(body: {
  type_id: OfflineVideoOrderTypeId;
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

export async function listClientOfflineVideoOrders(): Promise<VideoOrder[]> {
  const res = await fetchWithAuth("/api/client/video-orders");
  if (!res.ok) throw new Error(await readErrorMessage(res, "加载失败"));
  const data = (await res.json()) as any;
  return Array.isArray(data.list) ? data.list.map((item: any) => normalizeVideoOrder(item)) : [];
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

export async function listEmployeeOfflineVideoOrders(params?: {
  type?: OfflineVideoOrderTypeId;
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
  return Array.isArray(data.list) ? data.list.map((item: any) => normalizeVideoOrder(item)) : [];
}



/** 员工手动标记线下订单付款。 */
export async function markEmployeeOfflineVideoOrderPaid(orderId: number): Promise<void> {
  const res = await fetchWithAuth(`/api/employee/video-orders/${orderId}/mark-paid`, { method: "POST" });
  if (!res.ok) throw new Error(await readErrorMessage(res, "操作失败"));
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
  type?: OfflineVideoOrderTypeId;
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
  return Array.isArray(data.list) ? data.list.map((item: any) => normalizeVideoOrder(item)) : [];
}

export async function reviewAdminOfflineVideoOrder(orderId: number, body: { action: "approve" | "reject"; note?: string }): Promise<void> {
  const res = await fetchWithAuth(`/api/admin/video-orders/${orderId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ action: body.action, note: body.note || "" }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "审核失败"));
}



export async function submitEmployeeMonthlyBatch(orderId: number, body: {
  batch_no: number;
  video_count: number;
  video_urls: string[];
}): Promise<void> {
  const res = await fetchWithAuth(`/api/employee/video-orders/${orderId}/monthly-batches/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "提交失败"));
}

/**
 * 获取订单下所有批次记录。
 * GET /api/client/video-orders/{orderId}/batches
 */
export async function listClientOrderBatches(orderId: number): Promise<OrderBatchRecord[]> {
  const res = await fetchWithAuth(`/api/client/video-orders/${orderId}/batches`);
  if (!res.ok) throw new Error(await readErrorMessage(res, "加载批次记录失败"));
  const data = await res.json().catch(() => ({}));
  return normalizeBatchList((data as any).list ?? (data as any).batches ?? data);
}

/**
 * 直接验收批次。
 * POST /api/client/video-orders/{orderId}/monthly-batches/{batchId}/accept
 * body: { accepted_count?: number; remark?: string }
 */
export async function acceptClientOrderBatch(orderId: number, batchId: string | number, body?: {
  accepted_count?: number;
  remark?: string;
}): Promise<OrderBatchRecord | null> {
  const res = await fetchWithAuth(`/api/client/video-orders/${orderId}/monthly-batches/${batchId}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      accepted_count: body?.accepted_count,
      remark: body?.remark || "",
    }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "验收失败"));
  const data = await res.json().catch(() => null);
  if (!data || typeof data !== "object") return null;
  const source = (data as any).batch ?? data;
  if (!source || typeof source !== "object") return null;
  return normalizeBatchRecord(source);
}

export async function acceptClientMonthlyBatch(orderId: number, batchNo: number, body: {
  accepted_count: number;
  note?: string;
}): Promise<void> {
  const res = await fetchWithAuth(`/api/client/video-orders/${orderId}/monthly-batches/${batchNo}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "验收失败"));
}

export async function rejectClientMonthlyBatch(orderId: number, batchNo: number, body?: {
  remark?: string;
  note?: string;
}): Promise<OrderBatchRecord | null> {
  const res = await fetchWithAuth(`/api/client/video-orders/${orderId}/monthly-batches/${batchNo}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      remark: body?.remark || body?.note || "",
    }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "退回修改失败"));
  const data = await res.json().catch(() => null);
  if (!data || typeof data !== "object") return null;
  const source = (data as any).batch ?? data;
  if (!source || typeof source !== "object") return null;
  return normalizeBatchRecord(source);
}

export async function settleClientMonthlyBatch(orderId: number, batchNo: number, body: {
  settled_amount: number;
}): Promise<OrderBatchRecord | null> {
  const res = await fetchWithAuth(`/api/client/video-orders/${orderId}/monthly-batches/${batchNo}/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "结算失败"));
  const data = await res.json().catch(() => null);
  if (!data || typeof data !== "object") return null;
  const source = (data as any).batch ?? data;
  if (!source || typeof source !== "object") return null;
  return normalizeBatchRecord(source);
}
