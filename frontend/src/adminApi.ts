/**
 * 管理员端 API 请求封装：自动携带 JWT，统一 base URL。
 */
import { getAccessToken } from "./authApi";
import { fetchWithAuth } from "./fetchWithAuth";

export type AdminCreatableRole = "admin" | "employee" | "influencer" | "client";

/**
 * 解析失败响应中的可读文案（兼容仅有 message 或仅有 error 字段）。
 */
async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
  return (typeof data.message === "string" && data.message) || (typeof data.error === "string" && data.error) || fallback;
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
export async function createTask(body: {
  material_id: number;
  type: string;
  platform: string;
  max_claim_count?: number;
  point_reward: number;
  task_count?: number;
  tiktok_link?: string;
  product_images?: string[];
  sku_codes?: string[];
  sku_images?: string[];
}) {
  const res = await fetchWithAuth("/api/admin/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "创建失败");
  return res.json();
}

/** 更新任务（含发布） */
export async function updateTask(
  id: number,
  body: { status?: string; biz_status?: "open" | "in_progress" | "done"; max_claim_count?: number; point_reward?: number; tiktok_link?: string; product_images?: string[]; sku_codes?: string[]; sku_images?: string[] }
) {
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

/** 充值订单列表（管理员） */
export async function getRechargeOrders(params?: { status?: string; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.limit != null) q.set("limit", String(params.limit));
  const res = await fetchWithAuth(`/api/admin/points/recharge-orders?${q}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json();
}

/** 审核充值订单（approved/rejected） */
export async function updateRechargeOrder(id: number, body: { status: "approved" | "rejected"; note?: string }) {
  const res = await fetchWithAuth(`/api/admin/points/recharge-orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "操作失败");
  return res.json();
}

/**
 * 管理员手动积分调整：达人/商家均可加分；扣分同样适用于达人或商家（余额不足时接口返回错误）。
 */
export async function manualRecharge(body: { user_id: number; amount: number; note?: string; mode?: "add" | "deduct" }) {
  const res = await fetchWithAuth("/api/admin/points/manual-recharge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "充值失败");
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

/**
 * 达人领单订单列表（全量）：
 * - q：订单号/标题/要求全文精准匹配
 * - start_date/end_date：创建日期筛选（YYYY-MM-DD）
 */
export async function getAdminMarketOrders(params?: { q?: string; start_date?: string; end_date?: string }) {
  const q = new URLSearchParams();
  if (params?.q) q.set("q", params.q);
  if (params?.start_date) q.set("start_date", params.start_date);
  if (params?.end_date) q.set("end_date", params.end_date);
  const res = await fetchWithAuth(`/api/admin/market-orders?${q}`);
  if (!res.ok) throw new Error(await readErrorMessage(res, "请求失败"));
  return res.json();
}

/**
 * 管理员：客户订单列表（达人领单订单）。
 * 支持按订单号/标题/要求/客户/达人搜索，按状态筛选。
 */
export async function getAdminOrders(params?: { q?: string; status?: "open" | "claimed" | "completed" | "cancelled" | "" }) {
  const q = new URLSearchParams();
  if (params?.q) q.set("q", params.q);
  if (params?.status) q.set("status", params.status);
  const res = await fetchWithAuth(`/api/admin/orders?${q}`);
  if (!res.ok) throw new Error(await readErrorMessage(res, "请求失败"));
  return res.json();
}

/**
 * 管理员/员工：更新订单客户基础信息（店铺名称、对接群聊）。
 */
export async function updateAdminOrderClientInfo(id: number, body: { client_shop_name: string; client_group_chat: string }) {
  const res = await fetchWithAuth(`/api/admin/orders/${id}/client-info`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "更新失败"));
  return res.json();
}

/**
 * 管理员：利润统计摘要（按月或按时间区间）。
 */
export async function getProfitSummary(params?: { month?: string; start?: string; end?: string }) {
  const q = new URLSearchParams();
  if (params?.month) q.set("month", params.month);
  if (params?.start) q.set("start", params.start);
  if (params?.end) q.set("end", params.end);
  const res = await fetchWithAuth(`/api/admin/profit/summary?${q}`);
  if (!res.ok) throw new Error(await readErrorMessage(res, "请求失败"));
  return res.json();
}

/**
 * 管理员：获取利润统计排除账号列表。
 */
export async function getProfitExclusions() {
  const res = await fetchWithAuth("/api/admin/profit/exclusions");
  if (!res.ok) throw new Error(await readErrorMessage(res, "请求失败"));
  return res.json();
}

/**
 * 管理员：保存利润统计排除账号（全量覆盖）。
 */
export async function updateProfitExclusions(user_ids: number[]) {
  const res = await fetchWithAuth("/api/admin/profit/exclusions", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_ids }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "更新失败"));
  return res.json();
}

/**
 * 获取全量账号列表（管理员/员工/达人/客户端）。
 */
export async function getUsers(params?: { role?: string; keyword?: string; disabled?: "0" | "1" | "" }) {
  const q = new URLSearchParams();
  if (params?.role) q.set("role", params.role);
  if (params?.keyword) q.set("keyword", params.keyword);
  if (params?.disabled !== undefined && params.disabled !== "") q.set("disabled", params.disabled);
  const queryString = q.toString();
  const finalRes = await fetchWithAuth(queryString ? `/api/admin/users?${queryString}` : "/api/admin/users");
  if (!finalRes.ok) throw new Error(await readErrorMessage(finalRes, "请求失败"));
  return finalRes.json();
}

/**
 * 管理员开通账号。
 */
export async function createUserByAdmin(body: { username: string; password: string; role: AdminCreatableRole; display_name?: string }) {
  const res = await fetchWithAuth("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "创建失败");
  return res.json();
}

/**
 * 管理员重置指定账号密码。
 */
export async function resetUserPassword(id: number, newPassword: string) {
  const res = await fetchWithAuth(`/api/admin/users/${id}/password`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ new_password: newPassword }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "重置密码失败");
  return res.json();
}

/**
 * 管理员启用或禁用指定账号。
 */
export async function updateUserStatus(id: number, disabled: boolean) {
  const res = await fetchWithAuth(`/api/admin/users/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ disabled }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "更新状态失败");
  return res.json();
}

/**
 * 管理员/员工：客户 SKU 列表，支持关键词与客户 ID 搜索。
 */
export async function getAdminSkus(params?: { q?: string; client_id?: number }) {
  const q = new URLSearchParams();
  if (params?.q) q.set("q", params.q);
  if (params?.client_id != null) q.set("client_id", String(params.client_id));
  const res = await fetchWithAuth(`/api/admin/skus?${q}`);
  if (!res.ok) throw new Error(await readErrorMessage(res, "请求失败"));
  return res.json();
}

/**
 * 管理员/员工：拉取客户下拉选项（用于 SKU 精准筛选）。
 */
export async function getAdminSkuClients() {
  const res = await fetchWithAuth("/api/admin/skus/clients");
  if (!res.ok) throw new Error(await readErrorMessage(res, "请求失败"));
  return res.json();
}


/**
 * 管理员/员工：模特展示列表。
 */
export async function getAdminModels(params?: { q?: string; status?: "enabled" | "disabled"; talent_type?: "influencer" | "content_creator" }) {
  const q = new URLSearchParams();
  if (params?.q) q.set("q", params.q);
  if (params?.status) q.set("status", params.status);
  if (params?.talent_type) q.set("talent_type", params.talent_type);
  const res = await fetchWithAuth(`/api/admin/models?${q}`);
  if (!res.ok) throw new Error(await readErrorMessage(res, "请求失败"));
  return res.json();
}

/** 模特资料扩展：达人类型与 Content Creator 档位（与后端 model_profiles 一致）。 */
export type AdminModelTalentFields = {
  talent_type?: "influencer" | "content_creator";
  tiktok_link?: string;
  content_creator_tier?: "A" | "B" | "C" | null;
};

/**
 * 管理员/员工：上传模特图片（多图）。
 */
export async function uploadAdminModelImages(files: File[]): Promise<string[]> {
  if (files.length === 0) return [];
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  const res = await fetchWithAuth("/api/admin/models/upload", { method: "POST", body: fd });
  if (!res.ok) throw new Error(await readErrorMessage(res, "上传失败"));
  const data = (await res.json().catch(() => ({}))) as { urls?: string[] };
  return Array.isArray(data.urls) ? data.urls : [];
}

/**
 * 管理员/员工：新增模特资料。
 */
export async function createAdminModel(
  body: { name: string; photos: string[]; intro?: string; cloud_link: string; status?: "enabled" | "disabled"; tiktok_followers_text?: string; tiktok_sales_text?: string; sellable_product_types?: string } & AdminModelTalentFields
) {
  const res = await fetchWithAuth("/api/admin/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await readErrorMessage(res, "创建失败"));
  return res.json();
}

/**
 * 管理员/员工：编辑模特资料。
 */
export async function updateAdminModel(
  id: number,
  body: { name?: string; photos?: string[]; intro?: string; cloud_link?: string; status?: "enabled" | "disabled"; tiktok_followers_text?: string; tiktok_sales_text?: string; sellable_product_types?: string } & AdminModelTalentFields
) {
  const res = await fetchWithAuth(`/api/admin/models/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await readErrorMessage(res, "更新失败"));
  return res.json();
}

/**
 * 员工：提交模特上下架审核申请。
 */
export async function requestAdminModelStatus(id: number, status: "enabled" | "disabled") {
  const res = await fetchWithAuth(`/api/admin/models/${id}/status-request`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
  if (!res.ok) throw new Error(await readErrorMessage(res, "提交失败"));
  return res.json();
}

/**
 * 管理员：审核员工上下架申请。
 */
export async function reviewAdminModelStatus(id: number, action: "approve" | "reject", note?: string) {
  const res = await fetchWithAuth(`/api/admin/models/${id}/status-review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, note }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "审核失败"));
  return res.json();
}

/**
 * 管理员：删除模特资料。
 */
export async function deleteAdminModel(id: number) {
  const res = await fetchWithAuth(`/api/admin/models/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await readErrorMessage(res, "删除失败"));
  return res.json();
}

/**
 * 管理员：按 photo_id 删除单张模特照片（DELETE /api/admin/photos/:photoId）。
 * 仍兼容旧路径 DELETE /api/admin/models/photos/:photoId（后端双挂）。
 */
export async function deleteAdminModelPhoto(photoId: string) {
  const id = encodeURIComponent(photoId);
  const res = await fetchWithAuth(`/api/admin/photos/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await readErrorMessage(res, "删除照片失败"));
  return res.json();
}

/**
 * 员工：按 photo_id 删除本人上传的模特照片（DELETE /api/employee/photos/:photoId）。
 */
export async function deleteEmployeeModelPhoto(photoId: string) {
  const id = encodeURIComponent(photoId);
  const res = await fetchWithAuth(`/api/employee/photos/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await readErrorMessage(res, "删除照片失败"));
  return res.json();
}

/**
 * 管理员：批量删除模特照片（DELETE /api/admin/photos/batch，仅管理员）。
 */
export async function deleteAdminModelPhotosBatch(ids: string[]) {
  const res = await fetchWithAuth("/api/admin/photos/batch", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, "批量删除照片失败"));
  return res.json();
}
