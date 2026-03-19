/**
 * 管理员端 API 请求封装：自动携带 JWT，统一 base URL。
 */
import { getAccessToken } from "./authApi";

function getBase(): string {
  return (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:3000";
}

async function fetchWithAuth(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${getBase()}${path}`, { ...options, headers });
}

/** 素材列表 */
export async function getMaterials(params?: { status?: string; type?: string }) {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.type) q.set("type", params.type);
  const res = await fetchWithAuth(`/api/admin/materials?${q}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}

/** 新增素材 */
export async function createMaterial(body: { title: string; type: string; cloud_link: string; platforms?: string; remark?: string }) {
  const res = await fetchWithAuth("/api/admin/materials", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "创建失败");
  return res.json();
}

/** 更新素材 */
export async function updateMaterial(id: number, body: Record<string, unknown>) {
  const res = await fetchWithAuth(`/api/admin/materials/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "更新失败");
  return res.json();
}

/** 删除素材 */
export async function deleteMaterial(id: number) {
  const res = await fetchWithAuth(`/api/admin/materials/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "删除失败");
  return res.json();
}

/** 任务列表 */
export async function getTasks(params?: { status?: string; platform?: string; type?: string }) {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.platform) q.set("platform", params.platform);
  if (params?.type) q.set("type", params.type);
  const res = await fetchWithAuth(`/api/admin/tasks?${q}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}

/** 创建任务 */
export async function createTask(body: { material_id: number; type: string; platform: string; max_claim_count?: number; point_reward: number }) {
  const res = await fetchWithAuth("/api/admin/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "创建失败");
  return res.json();
}

/** 更新任务（含发布） */
export async function updateTask(id: number, body: { status?: string; max_claim_count?: number; point_reward?: number }) {
  const res = await fetchWithAuth(`/api/admin/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "更新失败");
  return res.json();
}

/** 达人列表 */
export async function getInfluencers() {
  const res = await fetchWithAuth("/api/admin/influencers");
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}

/** 更新达人资料 */
export async function updateInfluencerProfile(userId: number, body: { show_face?: number; tags?: string; platforms?: string; blacklisted?: number; level?: number }) {
  const res = await fetchWithAuth(`/api/admin/influencers/${userId}/profile`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "更新失败");
  return res.json();
}

/** 投稿列表 */
export async function getSubmissions(params?: { status?: string }) {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  const res = await fetchWithAuth(`/api/admin/submissions?${q}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}

/** 通过投稿 */
export async function approveSubmission(id: number) {
  const res = await fetchWithAuth(`/api/admin/submissions/${id}/approve`, { method: "POST" });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "操作失败");
  return res.json();
}

/** 驳回投稿 */
export async function rejectSubmission(id: number, reason?: string) {
  const res = await fetchWithAuth(`/api/admin/submissions/${id}/reject`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "操作失败");
  return res.json();
}

/** 积分汇总与按周统计 */
export async function getPointsSummary(week?: string) {
  const q = week ? `?week=${encodeURIComponent(week)}` : "";
  const res = await fetchWithAuth(`/api/admin/points/summary${q}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}

/** 积分流水 */
export async function getPointsLedger(params?: { user_id?: number; limit?: number; offset?: number }) {
  const q = new URLSearchParams();
  if (params?.user_id != null) q.set("user_id", String(params.user_id));
  if (params?.limit != null) q.set("limit", String(params.limit));
  if (params?.offset != null) q.set("offset", String(params.offset));
  const res = await fetchWithAuth(`/api/admin/points/ledger?${q}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}

/** 结算周列表 */
export async function getSettlementWeeks() {
  const res = await fetchWithAuth("/api/admin/settlement/weeks");
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}

/** 结算汇总（指定周） */
export async function getSettlementSummary(week: string) {
  const res = await fetchWithAuth(`/api/admin/settlement/summary?week=${encodeURIComponent(week)}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}

/** 生成结算记录 */
export async function generateSettlement(week: string) {
  const res = await fetchWithAuth("/api/admin/settlement/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ week }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "操作失败");
  return res.json();
}

/** 导出结算 CSV（返回 blob 或下载） */
export async function exportSettlementCsv(week: string): Promise<Blob> {
  const token = getAccessToken();
  const base = (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:3000";
  const res = await fetch(`${base}/api/admin/settlement/export?week=${encodeURIComponent(week)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error("导出失败");
  return res.blob();
}

/** 更新打款状态 */
export async function updateSettlementStatus(id: number, body: { status: string; note?: string }) {
  const res = await fetchWithAuth(`/api/admin/settlement/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "更新失败");
  return res.json();
}

/** 巡检结果列表 */
export async function getRiskChecks(params?: { submission_id?: number; result?: string }) {
  const q = new URLSearchParams();
  if (params?.submission_id != null) q.set("submission_id", String(params.submission_id));
  if (params?.result) q.set("result", params.result);
  const res = await fetchWithAuth(`/api/admin/risk/checks?${q}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}

/** 触发单条巡检 */
export async function triggerRiskCheck(submissionId: number) {
  const res = await fetchWithAuth("/api/admin/risk/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submission_id: submissionId }) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "检查失败");
  return res.json();
}

/** 违规记录列表 */
export async function getRiskViolations(params?: { user_id?: number }) {
  const q = params?.user_id != null ? `?user_id=${params.user_id}` : "";
  const res = await fetchWithAuth(`/api/admin/risk/violations${q}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}

/** 告警列表（deleted/suspicious） */
export async function getRiskAlerts() {
  const res = await fetchWithAuth("/api/admin/risk/alerts");
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}

/**
 * 提现申请列表（管理员）。
 */
export async function getWithdrawals(params?: { status?: string; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.limit != null) q.set("limit", String(params.limit));
  const res = await fetchWithAuth(`/api/admin/withdrawals?${q}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}

/**
 * 处理提现：标记 paid 或 rejected。
 */
export async function updateWithdrawal(id: number, body: { status: "paid" | "rejected"; note?: string }) {
  const res = await fetchWithAuth(`/api/admin/withdrawals/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "操作失败");
  return res.json();
}
