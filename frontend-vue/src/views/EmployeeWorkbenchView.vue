﻿<template>
  <div class="page-wrap">
    <div class="header-row">
      <div class="title">员工接单工作台 / เวิร์กเบนช์</div>
      <div class="filters">
        <el-input v-model="q" placeholder="搜索：订单号/标题/商家" style="max-width: 360px" @keyup.enter="reloadAll" />
        <el-select v-model="typeFilter" placeholder="类型" style="width: 240px" clearable>
          <el-option label="① 分级视频 A/B/C" value="graded_video" />
          <el-option label="② 高质量视频" value="high_quality_custom_video" />
          <el-option label="③ 包月合作套餐" value="monthly_package" />
          <el-option label="④ Creator带货测评" value="creator_review_video" />
        </el-select>
        <el-select v-model="stateFilter" placeholder="状态/阶段" style="width: 220px" clearable>
          <el-option label="open" value="open" />
          <el-option label="claimed" value="claimed" />
          <el-option label="completed" value="completed" />
          <el-option label="paid" value="paid" />
          <el-option label="assigned" value="assigned" />
          <el-option label="in_progress" value="in_progress" />
          <el-option label="review_pending" value="review_pending" />
          <el-option label="approved_to_publish" value="approved_to_publish" />
          <el-option label="published" value="published" />
          <el-option label="delivered" value="delivered" />
          <el-option label="rejected" value="rejected" />
        </el-select>
        <el-button @click="reloadAll" :loading="loading">刷新</el-button>
      </div>
    </div>

    <el-table :data="filtered" stripe style="width: 100%" row-key="row_key">
      <el-table-column prop="order_no" label="订单号" width="180">
        <template #default="{ row }">
          <span style="font-weight: 700">{{ row.order_no }}</span>
        </template>
      </el-table-column>
      <el-table-column label="类型" width="190">
        <template #default="{ row }">
          <el-tag :type="tagType(row.type_id)">{{ typeText(row.type_id) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="client_text" label="商家" width="160" />
      <el-table-column prop="payment_text" label="付款" width="100" />
      <el-table-column prop="phase_text" label="状态" width="130" />
      <el-table-column prop="title" label="标题" min-width="220" />
      <el-table-column label="包月进度" min-width="210">
        <template #default="{ row }">
          <template v-if="row.kind === 'offline' && row.type_id === 'monthly_package'">{{ monthlyAccepted(row.raw) }}/{{ monthlyTarget(row.raw) }} 已验收</template>
          <span v-else style="color: #94a3b8">-</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="680" fixed="right">
        <template #default="{ row }">
          <template v-if="row.kind === 'market'">
            <el-button size="small" type="primary" v-if="row.raw.status === 'open'" @click="onClaimMarket(row.raw.id)" :loading="acting[row.raw.id]">接单</el-button>
            <el-button size="small" v-if="row.raw.status === 'claimed'" @click="openCompleteMarket(row.raw.id)" :loading="acting[row.raw.id]">提交交付</el-button>
            <el-button size="small" v-if="row.raw.status === 'completed'" @click="openPublishMarket(row.raw.id)" :loading="acting[row.raw.id]">提交发布链接</el-button>
          </template>
          <template v-else>
            <el-button size="small" type="primary" v-if="isEmployee && !row.raw.assigned_employee_id" @click="onClaimOffline(row.raw.id)" :loading="acting[`o${row.raw.id}`]">接单</el-button>
            <el-button size="small" v-if="isEmployee && row.raw.assigned_employee_id && row.raw.type_id !== 'monthly_package'" @click="openSubmitOffline(row.raw.id)" :loading="acting[`o${row.raw.id}`]">提交交付</el-button>
            <el-button size="small" type="warning" v-if="isEmployee && row.raw.assigned_employee_id && row.raw.type_id === 'monthly_package'" @click="openMonthlyBatchSubmit(row.raw.id)" :loading="acting[`o${row.raw.id}`]">批次验收提交</el-button>
            <el-button size="small" v-if="isEmployee && row.raw.type_id === 'creator_review_video' && row.raw.phase === 'approved_to_publish'" @click="openPublishOffline(row.raw.id)" :loading="acting[`o${row.raw.id}`]">提交发布链接</el-button>
            <el-button size="small" type="success" v-if="isAdmin && row.raw.type_id === 'creator_review_video' && row.raw.phase === 'review_pending'" @click="onReviewOffline(row.raw.id, 'approve')" :loading="acting[`o${row.raw.id}`]">审核通过</el-button>
            <el-button size="small" type="danger" v-if="isAdmin && row.raw.type_id === 'creator_review_video' && row.raw.phase === 'review_pending'" @click="onReviewOffline(row.raw.id, 'reject')" :loading="acting[`o${row.raw.id}`]">审核驳回</el-button>
            <el-select v-if="isEmployee && row.raw.assigned_employee_id" v-model="phaseDraft[row.raw.id]" placeholder="更新阶段" size="small" style="width: 160px" @change="(v: string) => onSetOfflinePhase(row.raw.id, v)">
              <el-option label="in_progress" value="in_progress" />
              <el-option label="submitted" value="submitted" />
              <el-option label="delivered" value="delivered" />
            </el-select>
          </template>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="dialogMarketComplete.open" title="提交交付链接" width="520px">
    <el-input v-model="dialogMarketComplete.linksText" type="textarea" :rows="6" placeholder="每行一个链接" />
    <template #footer><el-button @click="dialogMarketComplete.open = false">取消</el-button><el-button type="primary" :loading="dialogMarketComplete.loading" @click="submitMarketComplete">提交</el-button></template>
  </el-dialog>
  <el-dialog v-model="dialogMarketPublish.open" title="提交发布链接" width="520px">
    <el-input v-model="dialogMarketPublish.link" placeholder="发布链接" />
    <template #footer><el-button @click="dialogMarketPublish.open = false">取消</el-button><el-button type="primary" :loading="dialogMarketPublish.loading" @click="submitMarketPublish">提交</el-button></template>
  </el-dialog>
  <el-dialog v-model="dialogOfflineSubmit.open" title="提交交付链接" width="520px">
    <el-input v-model="dialogOfflineSubmit.linksText" type="textarea" :rows="6" placeholder="每行一个链接" />
    <template #footer><el-button @click="dialogOfflineSubmit.open = false">取消</el-button><el-button type="primary" :loading="dialogOfflineSubmit.loading" @click="submitOfflineProof">提交</el-button></template>
  </el-dialog>
  <el-dialog v-model="dialogOfflinePublish.open" title="提交发布链接" width="520px">
    <el-input v-model="dialogOfflinePublish.link" placeholder="发布链接" />
    <template #footer><el-button @click="dialogOfflinePublish.open = false">取消</el-button><el-button type="primary" :loading="dialogOfflinePublish.loading" @click="submitOfflinePublish">提交</el-button></template>
  </el-dialog>

  <el-dialog v-model="monthlyBatchDialog.open" title="包月批次提交" width="520px">
    <el-form label-width="120px">
      <el-form-item label="批次号"><el-input-number v-model="monthlyBatchDialog.batchNo" :min="1" /></el-form-item>
      <el-form-item label="视频数量"><el-input-number v-model="monthlyBatchDialog.videoCount" :min="1" /></el-form-item>
      <el-form-item label="视频链接"><el-input v-model="monthlyBatchDialog.linksText" type="textarea" :rows="6" placeholder="每行一个链接" /></el-form-item>
    </el-form>
    <template #footer><el-button @click="monthlyBatchDialog.open = false">取消</el-button><el-button type="primary" :loading="monthlyBatchDialog.loading" @click="submitMonthlyBatch">提交批次</el-button></template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { claimMarketOrder, completeMarketOrder, listAdminOrders, publishMarketOrder, type AdminMarketOrder } from "@/api/employee";
import {
  claimEmployeeOfflineVideoOrder,
  listAdminOfflineVideoOrders,
  listEmployeeOfflineVideoOrders,
  publishEmployeeOfflineVideoOrder,
  reviewAdminOfflineVideoOrder,
  setEmployeeOfflineVideoOrderPhase,
  submitEmployeeMonthlyBatch,
  submitEmployeeOfflineVideoOrderProof,
  type OfflineVideoOrderTypeId,
  type VideoOrder,
} from "@/api/videoOrders";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const isAdmin = computed(() => auth.role === "admin");
const isEmployee = computed(() => auth.role === "employee");

type UnifiedTypeId = "graded_video" | OfflineVideoOrderTypeId;

type UnifiedRow =
  | {
      row_key: string;
      kind: "market";
      type_id: "graded_video";
      order_no: string;
      title: string;
      client_text: string;
      payment_text: string;
      phase_text: string;
      raw: AdminMarketOrder;
    }
  | {
      row_key: string;
      kind: "offline";
      type_id: OfflineVideoOrderTypeId;
      order_no: string;
      title: string;
      client_text: string;
      payment_text: string;
      phase_text: string;
      raw: VideoOrder;
    };

const q = ref("");
const typeFilter = ref<UnifiedTypeId | "">("");
const stateFilter = ref<string | "">("");
const marketOrders = ref<AdminMarketOrder[]>([]);
const offlineOrders = ref<VideoOrder[]>([]);
const loading = ref(false);
const acting = reactive<Record<string | number, boolean>>({});
const phaseDraft = reactive<Record<number, string>>({});
const pollTimer = ref<number | null>(null);

const dialogMarketComplete = reactive({ open: false, orderId: 0, linksText: "", loading: false });
const dialogMarketPublish = reactive({ open: false, orderId: 0, link: "", loading: false });
const dialogOfflineSubmit = reactive({ open: false, orderId: 0, linksText: "", loading: false });
const dialogOfflinePublish = reactive({ open: false, orderId: 0, link: "", loading: false });
const monthlyBatchDialog = reactive({ open: false, orderId: 0, batchNo: 1, videoCount: 1, linksText: "", loading: false });

/** 类型文案。 */
function typeText(type: UnifiedTypeId): string {
  if (type === "graded_video") return "① 分级视频 A/B/C";
  if (type === "high_quality_custom_video") return "② 高质量视频";
  if (type === "monthly_package") return "③ 包月合作套餐";
  return "④ Creator带货测评";
}

/** 类型标签色。 */
function tagType(type: UnifiedTypeId): "success" | "warning" | "danger" | "info" {
  if (type === "graded_video") return "info";
  if (type === "high_quality_custom_video") return "success";
  if (type === "monthly_package") return "warning";
  return "danger";
}

/** 拆分多行链接。 */
function splitLinks(text: string): string[] {
  return String(text || "").split(/\r?\n/g).map((s) => s.trim()).filter(Boolean).slice(0, 20);
}

/** 包月目标数量。 */
function monthlyTarget(row: VideoOrder): number {
  const req = (row.requirements || {}) as Record<string, unknown>;
  return Number(req.min_videos_per_month || 0) || 0;
}

/** 包月已验收数量。 */
function monthlyAccepted(row: VideoOrder): number {
  const list = Array.isArray(row.batch_payload) ? row.batch_payload : [];
  return list.reduce((s: number, x: any) => s + Number(x?.accepted_count || 0), 0);
}

/** 加载分级订单。 */
async function loadMarket() {
  const status = ["open", "claimed", "completed", "cancelled"].includes(stateFilter.value) ? stateFilter.value : undefined;
  marketOrders.value = await listAdminOrders({ q: q.value.trim() || undefined, status });
}

/** 接单分级订单。 */
async function onClaimMarket(orderId: number) {
  acting[orderId] = true;
  try {
    await claimMarketOrder(orderId);
    ElMessage.success("已接单");
    await loadMarket();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "接单失败");
  } finally {
    acting[orderId] = false;
  }
}

/** 打开分级交付弹窗。 */
function openCompleteMarket(orderId: number) {
  dialogMarketComplete.open = true;
  dialogMarketComplete.orderId = orderId;
  dialogMarketComplete.linksText = "";
}

/** 提交分级订单交付。 */
async function submitMarketComplete() {
  const links = splitLinks(dialogMarketComplete.linksText);
  if (!links.length) return ElMessage.error("请填写交付链接");
  dialogMarketComplete.loading = true;
  try {
    await completeMarketOrder(dialogMarketComplete.orderId, links);
    ElMessage.success("已提交");
    dialogMarketComplete.open = false;
    await loadMarket();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "提交失败");
  } finally {
    dialogMarketComplete.loading = false;
  }
}

/** 打开分级发布弹窗。 */
function openPublishMarket(orderId: number) {
  dialogMarketPublish.open = true;
  dialogMarketPublish.orderId = orderId;
  dialogMarketPublish.link = "";
}

/** 提交分级订单发布链接。 */
async function submitMarketPublish() {
  if (!dialogMarketPublish.link.trim()) return ElMessage.error("请填写发布链接");
  dialogMarketPublish.loading = true;
  try {
    await publishMarketOrder(dialogMarketPublish.orderId, dialogMarketPublish.link.trim());
    ElMessage.success("已提交");
    dialogMarketPublish.open = false;
    await loadMarket();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "提交失败");
  } finally {
    dialogMarketPublish.loading = false;
  }
}

/** 加载线下订单。 */
async function loadOffline() {
  const type = typeFilter.value && typeFilter.value !== "graded_video" ? (typeFilter.value as OfflineVideoOrderTypeId) : undefined;
  const phase = stateFilter.value && !["open", "claimed", "completed", "cancelled"].includes(stateFilter.value) ? stateFilter.value : undefined;
  const list = isAdmin.value
    ? await listAdminOfflineVideoOrders({ q: q.value.trim() || undefined, type, phase, limit: 200 })
    : await listEmployeeOfflineVideoOrders({ q: q.value.trim() || undefined, type, phase, limit: 200 });
  offlineOrders.value = list;
  for (const o of list) phaseDraft[o.id] = "";
}

function normalizeText(v: unknown): string {
  return String(v || "").trim().toLowerCase();
}

const unified = computed<UnifiedRow[]>(() => {
  const rows: UnifiedRow[] = [];
  for (const mo of marketOrders.value) {
    rows.push({
      row_key: `m_${mo.id}`,
      kind: "market",
      type_id: "graded_video",
      order_no: mo.order_no,
      title: mo.title,
      client_text: mo.client_shop_name || mo.client_display_name || mo.client_username,
      payment_text: "积分单",
      phase_text: mo.status,
      raw: mo,
    });
  }
  for (const o of offlineOrders.value) {
    rows.push({
      row_key: `o_${o.id}`,
      kind: "offline",
      type_id: o.type_id,
      order_no: `#${o.id}`,
      title: o.title,
      client_text: o.client_username || "-",
      payment_text: o.payment_status,
      phase_text: o.phase,
      raw: o,
    });
  }
  return rows.sort((a, b) => {
    const ak = a.kind === "market" ? a.raw.id : a.raw.id;
    const bk = b.kind === "market" ? b.raw.id : b.raw.id;
    return bk - ak;
  });
});

const filtered = computed(() => {
  const tf = typeFilter.value;
  const qq = q.value.trim().toLowerCase();
  const sf = stateFilter.value;
  return unified.value.filter((row) => {
    if (tf && row.type_id !== tf) return false;
    if (sf) {
      if (row.kind === "market" && row.raw.status !== sf) return false;
      if (row.kind === "offline" && row.raw.phase !== sf) return false;
    }
    if (!qq) return true;
    const hay = `${normalizeText(row.order_no)} ${normalizeText(row.title)} ${normalizeText(row.client_text)}`;
    return hay.includes(qq);
  });
});

async function reloadAll() {
  if (loading.value) return;
  loading.value = true;
  try {
    await Promise.all([loadMarket(), loadOffline()]);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    loading.value = false;
  }
}

/** 员工接单。 */
async function onClaimOffline(orderId: number) {
  const key = `o${orderId}`;
  acting[key] = true;
  try {
    await claimEmployeeOfflineVideoOrder(orderId);
    ElMessage.success("已接单");
    await loadOffline();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "接单失败");
  } finally {
    acting[key] = false;
  }
}

/** 打开线下交付弹窗。 */
function openSubmitOffline(orderId: number) {
  dialogOfflineSubmit.open = true;
  dialogOfflineSubmit.orderId = orderId;
  dialogOfflineSubmit.linksText = "";
}

/** 提交线下交付证明。 */
async function submitOfflineProof() {
  const links = splitLinks(dialogOfflineSubmit.linksText);
  if (!links.length) return ElMessage.error("请填写交付链接");
  dialogOfflineSubmit.loading = true;
  try {
    await submitEmployeeOfflineVideoOrderProof(dialogOfflineSubmit.orderId, links);
    ElMessage.success("已提交");
    dialogOfflineSubmit.open = false;
    await loadOffline();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "提交失败");
  } finally {
    dialogOfflineSubmit.loading = false;
  }
}

/** 打开包月批次提交弹窗。 */
function openMonthlyBatchSubmit(orderId: number) {
  monthlyBatchDialog.open = true;
  monthlyBatchDialog.orderId = orderId;
  monthlyBatchDialog.batchNo = 1;
  monthlyBatchDialog.videoCount = 1;
  monthlyBatchDialog.linksText = "";
}

/** 提交包月批次交付。 */
async function submitMonthlyBatch() {
  const links = splitLinks(monthlyBatchDialog.linksText);
  if (!links.length) return ElMessage.error("请填写该批次视频链接");
  monthlyBatchDialog.loading = true;
  try {
    await submitEmployeeMonthlyBatch(monthlyBatchDialog.orderId, {
      batch_no: monthlyBatchDialog.batchNo,
      video_count: monthlyBatchDialog.videoCount,
      video_urls: links,
    });
    ElMessage.success("已提交批次，待商家验收");
    monthlyBatchDialog.open = false;
    await loadOffline();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "批次提交失败");
  } finally {
    monthlyBatchDialog.loading = false;
  }
}

/** 打开发布链接弹窗。 */
function openPublishOffline(orderId: number) {
  dialogOfflinePublish.open = true;
  dialogOfflinePublish.orderId = orderId;
  dialogOfflinePublish.link = "";
}

/** 提交发布链接。 */
async function submitOfflinePublish() {
  if (!dialogOfflinePublish.link.trim()) return ElMessage.error("请填写发布链接");
  dialogOfflinePublish.loading = true;
  try {
    await publishEmployeeOfflineVideoOrder(dialogOfflinePublish.orderId, dialogOfflinePublish.link.trim());
    ElMessage.success("已提交");
    dialogOfflinePublish.open = false;
    await loadOffline();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "提交失败");
  } finally {
    dialogOfflinePublish.loading = false;
  }
}

/** 管理员审核 Creator 类型订单。 */
async function onReviewOffline(orderId: number, action: "approve" | "reject") {
  const key = `o${orderId}`;
  const note =
    action === "reject"
      ? await ElMessageBox.prompt("请输入驳回原因（可留空）", "审核驳回", { confirmButtonText: "提交", cancelButtonText: "取消", inputType: "textarea" })
          .then((r) => String(r.value || "").trim())
          .catch(() => null)
      : "";
  if (action === "reject" && note === null) return;

  acting[key] = true;
  try {
    await reviewAdminOfflineVideoOrder(orderId, { action, note: action === "reject" ? note || undefined : undefined });
    ElMessage.success("已提交审核结果");
    await loadOffline();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "操作失败");
  } finally {
    acting[key] = false;
  }
}

/** 更新线下订单阶段。 */
async function onSetOfflinePhase(orderId: number, phase: string) {
  const key = `o${orderId}`;
  acting[key] = true;
  try {
    await setEmployeeOfflineVideoOrderPhase(orderId, phase);
    ElMessage.success("已更新");
    await loadOffline();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "更新失败");
  } finally {
    acting[key] = false;
    phaseDraft[orderId] = "";
  }
}

/** 检查是否有弹窗打开，避免轮询打断输入。 */
function isAnyDialogOpen(): boolean {
  return !!(dialogMarketComplete.open || dialogMarketPublish.open || dialogOfflineSubmit.open || dialogOfflinePublish.open || monthlyBatchDialog.open);
}

/** 轮询刷新。 */
async function pollOnce() {
  if (document.hidden) return;
  if (isAnyDialogOpen()) return;
  return reloadAll();
}

onMounted(() => {
  reloadAll();
  pollTimer.value = window.setInterval(pollOnce, 5000);
});

onBeforeUnmount(() => {
  if (pollTimer.value != null) {
    window.clearInterval(pollTimer.value);
    pollTimer.value = null;
  }
});
</script>

<style scoped>
.page-wrap {
  padding: 8px 4px;
}

.header-row {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.title {
  font-weight: 800;
  font-size: 18px;
  color: #0f172a;
  letter-spacing: 0.2px;
}

.filters {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
</style>
