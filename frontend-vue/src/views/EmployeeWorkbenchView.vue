<template>
  <div class="page-wrap hc-thai">
    <div class="header-row">
      <div class="title">{{ t("员工端订单处理") }} / {{ t("หน้าจอพนักงานจัดการคำสั่งงาน") }}</div>
      <div class="filters">
        <el-select v-model="typeFilter" clearable style="width: 280px" :placeholder="t('订单类型')" @change="persistUi">
          <el-option :label="typeLabel('graded_video')" value="graded_video" />
          <el-option :label="typeLabel('high_quality_custom_video')" value="high_quality_custom_video" />
          <el-option :label="typeLabel('monthly_package')" value="monthly_package" />
          <el-option :label="typeLabel('creator_review_video')" value="creator_review_video" />
        </el-select>
        <el-input v-model="q" style="width: 260px" :placeholder="t('搜索订单号/标题/商家')" @keyup.enter="reloadAll" @blur="persistUi" />
        <el-button @click="reloadAll" :loading="loading">{{ t("รีเฟรช") }}</el-button>
        <el-switch v-model="autoRefreshEnabled" :active-text="t('自动刷新')" :inactive-text="t('手动刷新')" />
        <el-input-number v-model="autoRefreshSec" :min="10" :max="120" :step="5" :disabled="!autoRefreshEnabled" />
      </div>
    </div>

    <el-table :data="filtered" row-key="row_key" stripe>
      <el-table-column prop="order_no" :label="t('订单号')" width="180" />
      <el-table-column :label="t('类型')" width="220"><template #default="{ row }"><el-tag :class="getOrderTypeTagClass(row.type_id)">{{ typeLabel(row.type_id) }}</el-tag></template></el-table-column>
      <el-table-column prop="client_text" :label="t('商家')" width="160" />
      <el-table-column prop="payment_text" :label="t('付款')" width="120" />
      <el-table-column prop="phase_text" :label="t('状态')" width="140" />
      <el-table-column prop="title" :label="t('标题')" min-width="210" />
      <el-table-column :label="t('操作')" min-width="620" fixed="right">
        <template #default="{ row }">
          <template v-if="row.kind === 'market'">
            <el-button v-if="row.raw.status === 'open'" size="small" type="primary" :loading="acting[row.raw.id]" @click="onClaimMarket(row.raw.id)">{{ t("接单") }}</el-button>
            <el-button v-if="row.raw.status === 'claimed'" size="small" :loading="acting[row.raw.id]" @click="openCompleteMarket(row.raw.id)">{{ t("分配兼职/交付作品") }}</el-button>
            <el-button v-if="row.raw.status === 'completed'" size="small" :loading="acting[row.raw.id]" @click="openPublishMarket(row.raw.id)">{{ t("提交发布链接") }}</el-button>
          </template>

          <template v-else>
            <el-button v-if="!row.raw.assigned_employee_id" size="small" type="primary" :loading="acting[`o${row.raw.id}`]" @click="onClaimOffline(row.raw.id)">{{ t("接单") }}</el-button>
            <el-button v-if="canMarkPaid(row.raw)" size="small" type="warning" :loading="acting[`o${row.raw.id}`]" @click="markPaid(row.raw.id)">{{ t("手动标记付款") }}</el-button>

            <el-button v-if="row.type_id === 'high_quality_custom_video' && row.raw.payment_status === 'paid'" size="small" @click="openSubmitOffline(row.raw.id)">{{ t("对接达人/提交初稿") }}</el-button>
            <el-button v-if="row.type_id === 'high_quality_custom_video' && row.raw.phase === 'review_rejected'" size="small" @click="openSubmitOffline(row.raw.id)">{{ t("确认修改再提交") }}</el-button>

            <el-button v-if="row.type_id === 'monthly_package' && row.raw.payment_status === 'paid'" size="small" type="success" @click="openMonthlyBatchSubmit(row.raw.id)">{{ t("批次验收/批量确认") }}</el-button>

            <el-button v-if="row.type_id === 'creator_review_video' && row.raw.payment_status === 'paid'" size="small" @click="openSubmitOffline(row.raw.id)">{{ t("提交审核") }}</el-button>
            <el-button v-if="isAdmin && row.type_id === 'creator_review_video' && row.raw.phase === 'review_pending'" size="small" type="success" @click="onReviewOffline(row.raw.id, 'approve')">{{ t("审核通过") }}</el-button>
            <el-button v-if="isAdmin && row.type_id === 'creator_review_video' && row.raw.phase === 'review_pending'" size="small" type="danger" @click="onReviewOffline(row.raw.id, 'reject')">{{ t("审核驳回") }}</el-button>
            <el-button v-if="row.type_id === 'creator_review_video' && row.raw.phase === 'approved_to_publish'" size="small" type="danger" @click="openPublishOffline(row.raw.id)">{{ t("挂车发布") }}</el-button>
          </template>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogOfflineSubmit.open" :title="t('提交交付/初稿链接')" width="520px" :lock-scroll="false">
      <el-input v-model="dialogOfflineSubmit.linksText" type="textarea" :rows="6" :placeholder="t('每行一个链接')" />
      <template #footer><el-button @click="dialogOfflineSubmit.open = false">{{ t("关闭") }}</el-button><el-button type="primary" :loading="dialogOfflineSubmit.loading" @click="submitOfflineProof">{{ t("确认") }}</el-button></template>
    </el-dialog>

    <el-dialog v-model="monthlyBatchDialog.open" :title="t('类型3批次提交')" width="520px" :lock-scroll="false">
      <el-form label-width="120px">
        <el-form-item :label="t('批次号')"><el-input-number v-model="monthlyBatchDialog.batchNo" :min="1" /></el-form-item>
        <el-form-item :label="t('视频数量')"><el-input-number v-model="monthlyBatchDialog.videoCount" :min="1" /></el-form-item>
        <el-form-item :label="t('视频链接')"><el-input v-model="monthlyBatchDialog.linksText" type="textarea" :rows="6" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="monthlyBatchDialog.open = false">{{ t("关闭") }}</el-button><el-button type="primary" :loading="monthlyBatchDialog.loading" @click="submitMonthlyBatch">{{ t("确认") }}</el-button></template>
    </el-dialog>

    <el-dialog v-model="dialogOfflinePublish.open" :title="t('挂车发布链接')" width="520px" :lock-scroll="false">
      <el-input v-model="dialogOfflinePublish.link" :placeholder="t('请输入发布链接')" />
      <template #footer><el-button @click="dialogOfflinePublish.open = false">{{ t("关闭") }}</el-button><el-button type="primary" :loading="dialogOfflinePublish.loading" @click="submitOfflinePublish">{{ t("确认") }}</el-button></template>
    </el-dialog>

    <el-dialog v-model="dialogMarketComplete.open" :title="t('类型1交付作品')" width="520px" :lock-scroll="false">
      <el-input v-model="dialogMarketComplete.linksText" type="textarea" :rows="6" />
      <template #footer><el-button @click="dialogMarketComplete.open = false">{{ t("关闭") }}</el-button><el-button type="primary" :loading="dialogMarketComplete.loading" @click="submitMarketComplete">{{ t("确认") }}</el-button></template>
    </el-dialog>

    <el-dialog v-model="dialogMarketPublish.open" :title="t('类型1提交发布链接')" width="520px" :lock-scroll="false">
      <el-input v-model="dialogMarketPublish.link" />
      <template #footer><el-button @click="dialogMarketPublish.open = false">{{ t("关闭") }}</el-button><el-button type="primary" :loading="dialogMarketPublish.loading" @click="submitMarketPublish">{{ t("确认") }}</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { claimMarketOrder, completeMarketOrder, listAdminOrders, publishMarketOrder, type AdminMarketOrder } from "@/api/employee";
import {
  claimEmployeeOfflineVideoOrder,
  listAdminOfflineVideoOrders,
  listEmployeeOfflineVideoOrders,
  markEmployeeOfflineVideoOrderPaid,
  publishEmployeeOfflineVideoOrder,
  reviewAdminOfflineVideoOrder,
  submitEmployeeMonthlyBatch,
  submitEmployeeOfflineVideoOrderProof,
  type OfflineVideoOrderTypeId,
  type VideoOrder,
} from "@/api/videoOrders";
import { useAuthStore } from "@/stores/auth";
import { useVideoOrdersStore } from "@/stores/videoOrders";
import { readLocale, tr, type Locale } from "@/utils/i18n";
import { getOrderTypeTagClass, getOrderTypeTh, getOrderTypeZh, requiresEmployeeManualPayment } from "@/utils/videoOrderRules";
import type { UnifiedOrderType } from "@/types/videoOrderExt";

const auth = useAuthStore();
const store = useVideoOrdersStore();
const locale = ref<Locale>(readLocale());
const isAdmin = computed(() => auth.role === "admin");

const q = ref(store.orderKeyword || "");
const typeFilter = ref<UnifiedOrderType | "">(store.employeeTypeFilter || "");
const marketOrders = ref<AdminMarketOrder[]>([]);
const offlineOrders = ref<VideoOrder[]>([]);
const loading = ref(false);
const acting = reactive<Record<string | number, boolean>>({});
const dialogMarketComplete = reactive({ open: false, orderId: 0, linksText: "", loading: false });
const dialogMarketPublish = reactive({ open: false, orderId: 0, link: "", loading: false });
const dialogOfflineSubmit = reactive({ open: false, orderId: 0, linksText: "", loading: false });
const dialogOfflinePublish = reactive({ open: false, orderId: 0, link: "", loading: false });
const monthlyBatchDialog = reactive({ open: false, orderId: 0, batchNo: 1, videoCount: 1, linksText: "", loading: false });
const autoRefreshEnabled = ref(true);
const autoRefreshSec = ref(20);
const autoRefreshTimer = ref<number | null>(null);

/** 翻译工具。 */
function t(text: string): string {
  return tr(text, text, locale.value);
}

/** 类型双语标签。 */
function typeLabel(type: UnifiedOrderType): string {
  return `${getOrderTypeTh(type)} / ${getOrderTypeZh(type)}`;
}

/** 保存筛选条件。 */
function persistUi(): void {
  store.employeeTypeFilter = typeFilter.value;
  store.orderKeyword = q.value;
  store.persist();
}

/** 拆分多行链接。 */
function splitLinks(text: string): string[] {
  return String(text || "").split(/\r?\n/g).map((x) => x.trim()).filter(Boolean).slice(0, 30);
}

/** 是否展示手动标记付款按钮。 */
function canMarkPaid(order: VideoOrder): boolean {
  if (!requiresEmployeeManualPayment(order.type_id as UnifiedOrderType)) return false;
  if (order.payment_status === "paid") return false;
  return !order.assigned_employee_id || Number(order.assigned_employee_id) === Number(auth.user?.userId || 0);
}

const unified = computed(() => {
  const rows: Array<any> = [];
  for (const mo of marketOrders.value) rows.push({ row_key: `m_${mo.id}`, kind: "market", type_id: "graded_video", order_no: mo.order_no, title: mo.title, client_text: mo.client_shop_name || mo.client_display_name || mo.client_username, payment_text: t("积分单"), phase_text: mo.status, raw: mo });
  for (const o of offlineOrders.value) rows.push({ row_key: `o_${o.id}`, kind: "offline", type_id: o.type_id as OfflineVideoOrderTypeId, order_no: `#${o.id}`, title: o.title, client_text: o.client_username || "-", payment_text: o.payment_status, phase_text: o.phase, raw: o });
  return rows;
});

const filtered = computed(() => unified.value.filter((x) => (!typeFilter.value || x.type_id === typeFilter.value) && (!q.value.trim() || `${x.order_no} ${x.title} ${x.client_text}`.toLowerCase().includes(q.value.trim().toLowerCase()))));

/** 加载全部订单。 */
async function reloadAll(): Promise<void> {
  persistUi();
  loading.value = true;
  try {
    const [m, o] = await Promise.all([
      listAdminOrders({ q: q.value.trim() || undefined }),
      isAdmin.value ? listAdminOfflineVideoOrders({ q: q.value.trim() || undefined, type: typeFilter.value && typeFilter.value !== "graded_video" ? (typeFilter.value as OfflineVideoOrderTypeId) : undefined }) : listEmployeeOfflineVideoOrders({ q: q.value.trim() || undefined, type: typeFilter.value && typeFilter.value !== "graded_video" ? (typeFilter.value as OfflineVideoOrderTypeId) : undefined }),
    ]);
    marketOrders.value = m;
    offlineOrders.value = o;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : t("加载失败"));
  } finally {
    loading.value = false;
  }
}

/** 类型1接单。 */
async function onClaimMarket(orderId: number): Promise<void> {
  acting[orderId] = true;
  try {
    await claimMarketOrder(orderId);
    ElMessage.success(t("接单成功，自动进入制作中"));
    await reloadAll();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : t("接单失败"));
  } finally {
    acting[orderId] = false;
  }
}

/** 接单类型2/3/4。 */
async function onClaimOffline(orderId: number): Promise<void> {
  const key = `o${orderId}`;
  acting[key] = true;
  try {
    await claimEmployeeOfflineVideoOrder(orderId);
    ElMessage.success(t("接单成功"));
    await reloadAll();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : t("接单失败"));
  } finally {
    acting[key] = false;
  }
}

/** 手动标记付款。 */
async function markPaid(orderId: number): Promise<void> {
  const key = `o${orderId}`;
  acting[key] = true;
  try {
    await markEmployeeOfflineVideoOrderPaid(orderId);
    ElMessage.success(t("已标记付款并进入制作中"));
    await reloadAll();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : t("操作失败"));
  } finally {
    acting[key] = false;
  }
}

/** 打开类型1交付弹窗。 */
function openCompleteMarket(orderId: number): void {
  dialogMarketComplete.open = true;
  dialogMarketComplete.orderId = orderId;
  dialogMarketComplete.linksText = "";
}

/** 提交类型1交付。 */
async function submitMarketComplete(): Promise<void> {
  const links = splitLinks(dialogMarketComplete.linksText);
  if (!links.length) {
    ElMessage.error(t("请填写交付链接"));
    return;
  }
  dialogMarketComplete.loading = true;
  try {
    await completeMarketOrder(dialogMarketComplete.orderId, links);
    dialogMarketComplete.open = false;
    ElMessage.success(t("提交成功"));
    await reloadAll();
  } finally {
    dialogMarketComplete.loading = false;
  }
}

/** 打开类型1发布弹窗。 */
function openPublishMarket(orderId: number): void {
  dialogMarketPublish.open = true;
  dialogMarketPublish.orderId = orderId;
  dialogMarketPublish.link = "";
}

/** 提交类型1发布链接。 */
async function submitMarketPublish(): Promise<void> {
  if (!dialogMarketPublish.link.trim()) {
    ElMessage.error(t("请填写发布链接"));
    return;
  }
  dialogMarketPublish.loading = true;
  try {
    await publishMarketOrder(dialogMarketPublish.orderId, dialogMarketPublish.link.trim());
    dialogMarketPublish.open = false;
    ElMessage.success(t("提交成功"));
    await reloadAll();
  } finally {
    dialogMarketPublish.loading = false;
  }
}

/** 打开线下交付弹窗。 */
function openSubmitOffline(orderId: number): void {
  dialogOfflineSubmit.open = true;
  dialogOfflineSubmit.orderId = orderId;
  dialogOfflineSubmit.linksText = "";
}

/** 提交线下交付/初稿。 */
async function submitOfflineProof(): Promise<void> {
  const links = splitLinks(dialogOfflineSubmit.linksText);
  if (!links.length) {
    ElMessage.error(t("请填写交付链接"));
    return;
  }
  dialogOfflineSubmit.loading = true;
  try {
    await submitEmployeeOfflineVideoOrderProof(dialogOfflineSubmit.orderId, links);
    dialogOfflineSubmit.open = false;
    ElMessage.success(t("提交成功"));
    await reloadAll();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : t("提交失败"));
  } finally {
    dialogOfflineSubmit.loading = false;
  }
}

/** 打开类型3批次提交。 */
function openMonthlyBatchSubmit(orderId: number): void {
  monthlyBatchDialog.open = true;
  monthlyBatchDialog.orderId = orderId;
  monthlyBatchDialog.batchNo = 1;
  monthlyBatchDialog.videoCount = 1;
  monthlyBatchDialog.linksText = "";
}

/** 提交类型3批次。 */
async function submitMonthlyBatch(): Promise<void> {
  const links = splitLinks(monthlyBatchDialog.linksText);
  if (!links.length) {
    ElMessage.error(t("请填写视频链接"));
    return;
  }
  monthlyBatchDialog.loading = true;
  try {
    await submitEmployeeMonthlyBatch(monthlyBatchDialog.orderId, { batch_no: monthlyBatchDialog.batchNo, video_count: monthlyBatchDialog.videoCount, video_urls: links });
    monthlyBatchDialog.open = false;
    ElMessage.success(t("批次提交成功"));
    await reloadAll();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : t("提交失败"));
  } finally {
    monthlyBatchDialog.loading = false;
  }
}

/** 打开类型4挂车发布弹窗。 */
function openPublishOffline(orderId: number): void {
  dialogOfflinePublish.open = true;
  dialogOfflinePublish.orderId = orderId;
  dialogOfflinePublish.link = "";
}

/** 提交类型4挂车发布。 */
async function submitOfflinePublish(): Promise<void> {
  if (!dialogOfflinePublish.link.trim()) {
    ElMessage.error(t("请填写发布链接"));
    return;
  }
  dialogOfflinePublish.loading = true;
  try {
    await publishEmployeeOfflineVideoOrder(dialogOfflinePublish.orderId, dialogOfflinePublish.link.trim());
    dialogOfflinePublish.open = false;
    ElMessage.success(t("发布成功"));
    await reloadAll();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : t("提交失败"));
  } finally {
    dialogOfflinePublish.loading = false;
  }
}

/** 管理员审核类型4。 */
async function onReviewOffline(orderId: number, action: "approve" | "reject"): Promise<void> {
  const key = `o${orderId}`;
  let note = "";
  if (action === "reject") {
    const ret = await ElMessageBox.prompt(t("请输入驳回原因"), t("审核操作"), { inputType: "textarea" }).catch(() => null);
    if (!ret) return;
    note = String(ret.value || "").trim();
  }
  acting[key] = true;
  try {
    await reviewAdminOfflineVideoOrder(orderId, { action, note: note || undefined });
    ElMessage.success(t("审核已提交"));
    await reloadAll();
  } finally {
    acting[key] = false;
  }
}

/** 清理自动刷新定时器。 */
function clearAutoRefreshTimer(): void {
  if (autoRefreshTimer.value) {
    window.clearInterval(autoRefreshTimer.value);
    autoRefreshTimer.value = null;
  }
}

/** 重建自动刷新定时器。 */
function setupAutoRefreshTimer(): void {
  clearAutoRefreshTimer();
  if (!autoRefreshEnabled.value) return;
  const ms = Math.max(10, Number(autoRefreshSec.value || 20)) * 1000;
  autoRefreshTimer.value = window.setInterval(() => {
    void reloadAll();
  }, ms);
}

watch([autoRefreshEnabled, autoRefreshSec], () => {
  setupAutoRefreshTimer();
});

onMounted(() => {
  void reloadAll();
  setupAutoRefreshTimer();
});

onBeforeUnmount(() => {
  clearAutoRefreshTimer();
});
</script>

<style scoped>
.page-wrap { padding: 14px 10px; }
.header-row { display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap; margin-bottom: 12px; }
.filters { display: flex; gap: 10px; flex-wrap: wrap; }
.title { font-size: 21px; font-weight: 800; color: #3d2a00; }
.hc-thai { line-height: 1.9; }
:deep(.tag-gold){ background:#ffe082;color:#5d3a00;border-color:#ffb300;font-weight:700; }
:deep(.tag-yellow){ background:#fff59d;color:#5d4a00;border-color:#fbc02d;font-weight:700; }
:deep(.tag-purple){ background:#e1bee7;color:#4a148c;border-color:#ab47bc;font-weight:700; }
:deep(.tag-red){ background:#ffcdd2;color:#b71c1c;border-color:#ef5350;font-weight:700; }
</style>
