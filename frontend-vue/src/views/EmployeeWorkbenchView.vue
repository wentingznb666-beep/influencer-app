<template>
  <div class="page-wrap hc-thai">
    <div class="header-row">
      <div class="title">{{ t("员工端订单处理") }} / {{ t("หน้าจอพนักงานจัดการคำสั่งงาน") }}</div>
      <div class="filters">
        <el-select v-model="statusFilter" size="small" clearable style="width: 180px" :placeholder="t('状态筛选')">
          <el-option :label="t('待领取')" value="open" />
          <el-option :label="t('已领取')" value="claimed" />
          <el-option :label="t('进行中')" value="in_progress" />
          <el-option :label="t('已完成')" value="completed" />
          <el-option :label="t('已取消')" value="cancelled" />
        </el-select>
        <el-date-picker
          v-model="dateRange"
          size="small"
          type="daterange"
          unlink-panels
          value-format="YYYY-MM-DD"
          range-separator="-"
          :start-placeholder="t('开始日期')"
          :end-placeholder="t('结束日期')"
          style="width: 280px"
        />
        <el-input v-model="q" size="small" style="width: 260px" :placeholder="t('搜索订单号/标题/商家')" @keyup.enter="reloadAll" @blur="persistUi" />
        <el-select v-model="sortMode" size="small" style="width: 190px">
          <el-option :label="t('创建时间：新到旧')" value="created_desc" />
          <el-option :label="t('创建时间：旧到新')" value="created_asc" />
          <el-option :label="t('金额/积分：高到低')" value="amount_desc" />
          <el-option :label="t('金额/积分：低到高')" value="amount_asc" />
          <el-option :label="t('状态：待领取到已完成')" value="status_asc" />
          <el-option :label="t('状态：已完成到待领取')" value="status_desc" />
        </el-select>
        <el-button size="small" @click="reloadAll" :loading="loading">{{ t("รีเฟรช") }}</el-button>
        <div class="auto-refresh">
          <el-switch v-model="autoRefreshEnabled" size="small" :active-text="t('自动刷新')" :inactive-text="t('手动刷新')" />
          <el-input-number v-model="autoRefreshSec" size="small" :min="10" :max="120" :step="5" :disabled="!autoRefreshEnabled" />
        </div>
      </div>
    </div>

    <div class="list-toolbar">
      <div class="list-title">{{ t("统一订单列表") }}</div>
      <div class="list-summary">{{ t("共") }} {{ filteredRows.length }} {{ t("条") }}</div>
    </div>

    <el-table v-if="filteredRows.length" :data="filteredRows" row-key="row_key" stripe v-loading="loading" size="small">
      <el-table-column prop="order_no" :label="t('订单号')" width="180" />
      <el-table-column :label="t('类型')" width="220"><template #default="{ row }"><el-tag :class="getOrderTypeTagClass(row.type_id)">{{ typeLabel(row.type_id) }}</el-tag></template></el-table-column>
      <el-table-column :label="t('订单档位')" width="140">
        <template #default="{ row }">
          <template v-if="row.kind === 'market'">
            <el-tooltip placement="top">
              <template #content>
                <div class="tier-tooltip">{{ gradedTierTooltip(row.raw.tier) }}</div>
              </template>
              <el-tag :class="gradedTierTagClass(row.raw.tier)" effect="plain">{{ normalizeGradedTier(row.raw.tier) }}</el-tag>
            </el-tooltip>
          </template>
          <span v-else style="color: #94a3b8">—</span>
        </template>
      </el-table-column>
      <el-table-column prop="client_text" :label="t('商家')" width="160" />
      <el-table-column :label="t('领取人')" width="180">
        <template #default="{ row }">
          <template v-if="row.kind === 'offline'">
            <span v-if="row.raw.assigned_employee_id">{{ row.raw.employee_username || `#${row.raw.assigned_employee_id}` }}</span>
            <span v-else style="color: #94a3b8">—</span>
          </template>
          <span v-else style="color: #94a3b8">—</span>
        </template>
      </el-table-column>
      <el-table-column prop="amount_text" :label="t('金额/积分')" width="140" />
      <el-table-column prop="created_at_text" :label="t('创建时间')" width="170" />
      <el-table-column :label="t('状态')" width="220">
        <template #default="{ row }">
          <div class="status-cell">
            <el-tag :class="statusTagClass(row.unified_status)" effect="plain">{{ row.unified_status_text }}</el-tag>
            <el-tag v-if="row.kind === 'offline'" :type="phaseTagType(row.phase_code)" effect="plain">{{ row.phase_text }}</el-tag>
            <el-tag v-if="row.kind === 'offline' && orderResubmittedMessage(row.raw)" type="info" effect="plain">{{ t("已重新提交") }}</el-tag>
            <el-tag v-else-if="row.kind === 'offline' && resubmittedBatches(row.raw).length" type="info" effect="plain">{{ t("含重提批次") }}</el-tag>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="title" :label="t('标题')" min-width="360">
        <template #default="{ row }">
          <div class="title-cell">
            <div>{{ row.title }}</div>
            <div v-if="row.kind === 'offline'">
              <el-alert
                v-if="orderRejectedMessage(row.raw)"
                type="error"
                :closable="false"
                show-icon
                class="rejection-alert"
                :title="t('被退回原因')"
                :description="orderRejectedMessage(row.raw)"
              />
              <el-alert
                v-if="orderResubmittedMessage(row.raw)"
                type="info"
                :closable="false"
                show-icon
                class="resubmit-alert"
                :title="t('修改完成重新提交')"
                :description="orderResubmittedMessage(row.raw)"
              />
              <div v-if="rejectedBatchSummaries(row.raw).length" class="rejected-batch-list">
                <div class="rejected-batch-title">{{ t("被退回批次") }}</div>
                <div v-for="item in rejectedBatchSummaries(row.raw)" :key="item" class="rejected-batch-item">{{ item }}</div>
              </div>
              <div v-if="resubmittedBatchSummaries(row.raw).length" class="resubmitted-batch-list">
                <div class="resubmitted-batch-title">{{ t("已重新提交批次") }}</div>
                <div v-for="item in resubmittedBatchSummaries(row.raw)" :key="item" class="resubmitted-batch-item">{{ item }}</div>
              </div>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column :label="t('操作')" :min-width="isNarrow ? 420 : 620" :fixed="isNarrow ? undefined : 'right'">
        <template #default="{ row }">
          <el-button size="small" type="info" plain @click="openOrderDetail(row.row_key)">{{ t("รายละเอียด") }} / {{ t("详情") }}</el-button>
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

    <div v-else class="empty-wrap" v-loading="loading">
      <el-empty :description="t('暂无匹配订单，可调整筛选条件或刷新列表')">
        <el-button type="primary" @click="reloadAll" :loading="loading">{{ t("刷新列表") }}</el-button>
      </el-empty>
    </div>

    <el-dialog v-model="dialogOfflineSubmit.open" :title="t('提交交付/初稿链接')" width="520px" :lock-scroll="false">
      <el-alert
        v-if="dialogOfflineRejectedNote"
        type="error"
        :closable="false"
        show-icon
        class="dialog-alert"
        :title="t('商家退回说明')"
        :description="dialogOfflineRejectedNote"
      />
      <el-input v-model="dialogOfflineSubmit.linksText" type="textarea" :rows="6" :placeholder="t('每行一个链接')" />
      <template #footer><el-button @click="dialogOfflineSubmit.open = false">{{ t("关闭") }}</el-button><el-button type="primary" :loading="dialogOfflineSubmit.loading" @click="submitOfflineProof">{{ t("确认") }}</el-button></template>
    </el-dialog>

    <el-dialog v-model="monthlyBatchDialog.open" :title="t('类型3批次提交')" width="520px" :lock-scroll="false">
      <el-alert
        v-if="dialogMonthlyRejectedBatchText"
        type="error"
        :closable="false"
        show-icon
        class="dialog-alert"
        :title="t('商家退回说明')"
        :description="dialogMonthlyRejectedBatchText"
      />
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
      <div v-if="currentMarketCompleteOrder" class="tier-dialog-block">
        <div class="tier-dialog-title">{{ t("ระดับคำสั่งงาน") }} / {{ t("订单档位") }}</div>
        <div class="tier-dialog-row">
          <el-tag :class="gradedTierTagClass(currentMarketCompleteOrder.tier)" effect="plain">{{ normalizeGradedTier(currentMarketCompleteOrder.tier) }}</el-tag>
          <div class="tier-dialog-text">
            <div class="tier-th">{{ gradedTierTextTh(currentMarketCompleteOrder.tier) }}</div>
            <div class="tier-remark">{{ gradedTierRemarkZhEn(currentMarketCompleteOrder.tier) }}</div>
            <div class="tier-total">{{ t("总扣除") }} {{ calcGradedPoints(normalizeGradedTier(currentMarketCompleteOrder.tier), Number(currentMarketCompleteOrder.task_count || 0) || 1) }} {{ t("积分") }}（{{ t("数量") }} {{ Number(currentMarketCompleteOrder.task_count || 0) || 1 }}）</div>
          </div>
        </div>
      </div>
      <el-input v-model="dialogMarketComplete.linksText" type="textarea" :rows="6" />
      <template #footer><el-button @click="dialogMarketComplete.open = false">{{ t("关闭") }}</el-button><el-button type="primary" :loading="dialogMarketComplete.loading" @click="submitMarketComplete">{{ t("确认") }}</el-button></template>
    </el-dialog>

    <el-dialog v-model="dialogMarketPublish.open" :title="t('类型1提交发布链接')" width="520px" :lock-scroll="false">
      <div v-if="currentMarketPublishOrder" class="tier-dialog-block">
        <div class="tier-dialog-title">{{ t("ระดับคำสั่งงาน") }} / {{ t("订单档位") }}</div>
        <div class="tier-dialog-row">
          <el-tag :class="gradedTierTagClass(currentMarketPublishOrder.tier)" effect="plain">{{ normalizeGradedTier(currentMarketPublishOrder.tier) }}</el-tag>
          <div class="tier-dialog-text">
            <div class="tier-th">{{ gradedTierTextTh(currentMarketPublishOrder.tier) }}</div>
            <div class="tier-remark">{{ gradedTierRemarkZhEn(currentMarketPublishOrder.tier) }}</div>
            <div class="tier-total">{{ t("总扣除") }} {{ calcGradedPoints(normalizeGradedTier(currentMarketPublishOrder.tier), Number(currentMarketPublishOrder.task_count || 0) || 1) }} {{ t("积分") }}（{{ t("数量") }} {{ Number(currentMarketPublishOrder.task_count || 0) || 1 }}）</div>
          </div>
        </div>
      </div>
      <el-input v-model="dialogMarketPublish.link" />
      <template #footer><el-button @click="dialogMarketPublish.open = false">{{ t("关闭") }}</el-button><el-button type="primary" :loading="dialogMarketPublish.loading" @click="submitMarketPublish">{{ t("确认") }}</el-button></template>
    </el-dialog>

    <el-dialog v-model="dialogOrderDetail.open" :title="t('รายละเอียดคำสั่งงาน') + ' / ' + t('订单详情')" width="760px" :lock-scroll="false">
      <template v-if="currentDetailRow">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item :label="t('订单号')">{{ currentDetailRow.order_no }}</el-descriptions-item>
          <el-descriptions-item :label="t('类型')">{{ typeLabel(currentDetailRow.type_id) }}</el-descriptions-item>
          <el-descriptions-item :label="t('标题')" :span="2">{{ currentDetailRow.title }}</el-descriptions-item>
          <el-descriptions-item :label="t('商家')">{{ currentDetailRow.client_text }}</el-descriptions-item>
          <el-descriptions-item :label="t('金额/积分')">{{ currentDetailRow.amount_text }}</el-descriptions-item>
          <el-descriptions-item :label="t('创建时间')">{{ currentDetailRow.created_at_text }}</el-descriptions-item>
          <el-descriptions-item :label="t('状态')">{{ currentDetailRow.unified_status_text }} / {{ currentDetailRow.phase_text }}</el-descriptions-item>
        </el-descriptions>

        <div v-if="currentDetailMarketOrder" class="tier-detail-block">
          <div class="tier-detail-title">{{ t("ระดับคำสั่งงาน (A/B/C)") }} / {{ t("订单档位(A/B/C)") }}</div>
          <div class="tier-detail-selected">
            <el-tag :class="gradedTierTagClass(currentDetailMarketOrder.tier)" effect="plain">{{ normalizeGradedTier(currentDetailMarketOrder.tier) }}</el-tag>
            <div class="tier-detail-text">
              <div class="tier-th">{{ gradedTierTextTh(currentDetailMarketOrder.tier) }}</div>
              <div class="tier-remark">{{ gradedTierRemarkZhEn(currentDetailMarketOrder.tier) }}</div>
              <div class="tier-total">
                {{ t("单条") }} {{ gradedTierPoints(normalizeGradedTier(currentDetailMarketOrder.tier)) }} {{ t("积分") }}
                ｜ {{ t("数量") }} {{ Number(currentDetailMarketOrder.task_count || 0) || 1 }}
                ｜ {{ t("本单总扣除") }} {{ calcGradedPoints(normalizeGradedTier(currentDetailMarketOrder.tier), Number(currentDetailMarketOrder.task_count || 0) || 1) }} {{ t("积分") }}
              </div>
            </div>
          </div>

          <div class="tier-detail-list">
            <div v-for="item in gradedTierOptions" :key="item.tier" class="tier-detail-item" :class="{ active: item.tier === normalizeGradedTier(currentDetailMarketOrder.tier) }">
              <el-tag :class="gradedTierTagClass(item.tier)" effect="plain">{{ item.tier }}</el-tag>
              <div class="tier-detail-item-text">
                <div class="tier-th">{{ item.th }}</div>
                <div class="tier-remark">{{ item.zh }} / {{ item.en }}</div>
              </div>
            </div>
          </div>
        </div>
      </template>
      <template #footer><el-button @click="dialogOrderDetail.open = false">{{ t("ปิด") }} / {{ t("关闭") }}</el-button></template>
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
import { calcGradedPoints, getOrderTypeTagClass, getOrderTypeTh, getOrderTypeZh, requiresEmployeeManualPayment } from "@/utils/videoOrderRules";
import { GRADED_POINT_UNIT, type GradedTier, type UnifiedOrderType } from "@/types/videoOrderExt";

const auth = useAuthStore();
const store = useVideoOrdersStore();
const locale = ref<Locale>(readLocale());
const isAdmin = computed(() => auth.role === "admin");

const q = ref(store.orderKeyword || "");
const statusFilter = ref<UnifiedStatus | "">("");
const dateRange = ref<string[]>([]);
const sortMode = ref<SortMode>("created_desc");
const marketOrders = ref<AdminMarketOrder[]>([]);
const offlineOrders = ref<VideoOrder[]>([]);
const loading = ref(false);
const acting = reactive<Record<string | number, boolean>>({});
const dialogMarketComplete = reactive({ open: false, orderId: 0, linksText: "", loading: false });
const dialogMarketPublish = reactive({ open: false, orderId: 0, link: "", loading: false });
const dialogOfflineSubmit = reactive({ open: false, orderId: 0, linksText: "", loading: false });
const dialogOfflinePublish = reactive({ open: false, orderId: 0, link: "", loading: false });
const monthlyBatchDialog = reactive({ open: false, orderId: 0, batchNo: 1, videoCount: 1, linksText: "", loading: false });
const dialogOrderDetail = reactive({ open: false, rowKey: "" });
const autoRefreshEnabled = ref(true);
const autoRefreshSec = ref(20);
const autoRefreshTimer = ref<number | null>(null);
const isNarrow = ref(false);

type UnifiedStatus = "open" | "claimed" | "in_progress" | "completed" | "cancelled";
type SortMode = "created_desc" | "created_asc" | "amount_desc" | "amount_asc" | "status_asc" | "status_desc";

type BaseUnifiedOrderRow = {
  row_key: string;
  type_id: UnifiedOrderType;
  order_no: string;
  title: string;
  client_text: string;
  payment_text: string;
  phase_code: string;
  phase_text: string;
  unified_status: UnifiedStatus;
  unified_status_text: string;
  amount_value: number;
  amount_text: string;
  created_at: string;
  created_at_text: string;
};

type MarketUnifiedOrderRow = BaseUnifiedOrderRow & {
  kind: "market";
  type_id: "graded_video";
  raw: AdminMarketOrder;
};

type OfflineUnifiedOrderRow = BaseUnifiedOrderRow & {
  kind: "offline";
  type_id: OfflineVideoOrderTypeId;
  raw: VideoOrder;
};

type UnifiedOrderRow = MarketUnifiedOrderRow | OfflineUnifiedOrderRow;

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

function orderRejectedMessage(order: VideoOrder): string {
  if (String(order.phase || "") !== "review_rejected") return "";
  return String(order.review_note || "").trim() || t("商家已退回，请根据要求修改后重新提交。");
}

function orderResubmittedMessage(order: VideoOrder): string {
  const phase = String(order.phase || "");
  const note = String(order.review_note || "").trim();
  if (!note) return "";
  if (!["delivered", "review_pending"].includes(phase)) return "";
  return t("已按退回意见重新提交，等待商家复核。");
}

function rejectedBatches(order: VideoOrder): Array<{ batch_no: number; note: string }> {
  if (!Array.isArray(order.batch_payload)) return [];
  return order.batch_payload
    .filter((batch) => String(batch.status || "") === "rejected")
    .map((batch) => ({
      batch_no: Number(batch.batch_no || 0),
      note: String(batch.remark || batch.accept_note || "").trim() || t("商家已退回该批次，请补充内容后重新提交。"),
    }))
    .sort((a, b) => a.batch_no - b.batch_no);
}

function rejectedBatchSummaries(order: VideoOrder): string[] {
  return rejectedBatches(order).map((batch) => `${t("批次")} ${batch.batch_no}: ${batch.note}`);
}

function resubmittedBatches(order: VideoOrder): Array<{ batch_no: number; note: string }> {
  if (!Array.isArray(order.batch_payload)) return [];
  return order.batch_payload
    .filter((batch) => String(batch.status || "") === "pending_acceptance" && String(batch.remark || batch.accept_note || "").trim())
    .map((batch) => ({
      batch_no: Number(batch.batch_no || 0),
      note: String(batch.remark || batch.accept_note || "").trim(),
    }))
    .sort((a, b) => a.batch_no - b.batch_no);
}

function resubmittedBatchSummaries(order: VideoOrder): string[] {
  return resubmittedBatches(order).map((batch) => `${t("批次")} ${batch.batch_no}: ${t("已按退回意见重新提交，等待商家复核。")}`);
}

function phaseTagType(phase: string): "success" | "warning" | "danger" | "info" {
  if (["approved_to_publish", "published", "completed", "settled", "accepted"].includes(phase)) return "success";
  if (["review_rejected", "rejected"].includes(phase)) return "danger";
  if (["assigned", "in_progress", "submitted", "review_pending", "delivered", "pending_acceptance"].includes(phase)) return "warning";
  return "info";
}

function statusTagClass(status: UnifiedStatus): string {
  if (status === "open") return "tag-status-open";
  if (status === "claimed") return "tag-status-claimed";
  if (status === "in_progress") return "tag-status-progress";
  if (status === "completed") return "tag-status-completed";
  return "tag-status-cancelled";
}

function unifiedStatusText(status: UnifiedStatus): string {
  if (status === "open") return t("待领取");
  if (status === "claimed") return t("已领取");
  if (status === "in_progress") return t("进行中");
  if (status === "completed") return t("已完成");
  return t("已取消");
}

function unifiedStatusRank(status: UnifiedStatus): number {
  if (status === "open") return 1;
  if (status === "claimed") return 2;
  if (status === "in_progress") return 3;
  if (status === "completed") return 4;
  return 5;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function marketPhaseText(status: string): string {
  if (status === "open") return t("待领取");
  if (status === "claimed") return t("已领取");
  if (status === "completed") return t("已完成");
  if (status === "cancelled") return t("已取消");
  return status || "-";
}

function offlinePhaseText(order: VideoOrder): string {
  if (!order.assigned_employee_id) return t("待领取");
  const phase = String(order.phase || "");
  if (phase === "assigned") return t("已领取");
  if (phase === "in_progress") return t("进行中");
  if (phase === "submitted") return t("已提交");
  if (phase === "review_pending") return t("待审核");
  if (phase === "review_rejected") return t("退回修改");
  if (phase === "approved_to_publish") return t("待发布");
  if (phase === "published") return t("已发布");
  if (phase === "delivered") return t("已交付");
  if (phase === "pending_acceptance") return t("待验收");
  if (phase === "accepted") return t("已验收");
  if (phase === "settled") return t("已结算");
  if (phase === "rejected") return t("已取消");
  return phase || "-";
}

function marketUnifiedStatus(order: AdminMarketOrder): UnifiedStatus {
  const status = String(order.status || "");
  if (status === "open") return "open";
  if (status === "claimed") return "claimed";
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  return "in_progress";
}

function offlineUnifiedStatus(order: VideoOrder): UnifiedStatus {
  if (!order.assigned_employee_id) return "open";
  const phase = String(order.phase || "");
  if (phase === "assigned") return "claimed";
  if (["accepted", "completed", "settled"].includes(phase)) return "completed";
  if (["rejected", "cancelled"].includes(phase)) return "cancelled";
  return "in_progress";
}

function marketAmountValue(order: AdminMarketOrder): number {
  const tier = ["A", "B", "C"].includes(String(order.tier || "")) ? (order.tier as GradedTier) : "C";
  return calcGradedPoints(tier, Number(order.task_count || 0) || 1);
}

const gradedTierOptions = [
  {
    tier: "C" as GradedTier,
    th: "ระดับ C: ใช้ 20 พอยท์, มีเพลงประกอบ + สติกเกอร์ข้อความ",
    zh: "C类：消耗20积分，包含背景音乐、文字贴纸",
    en: "Tier C: 20 points, background music + text stickers",
  },
  {
    tier: "B" as GradedTier,
    th: "ระดับ B: ใช้ 40 พอยท์, มีระดับ C + เปลี่ยนฉาก + ทรานซิชันเอฟเฟกต์",
    zh: "B类：消耗40积分，含C类功能+场景切换+特效转场",
    en: "Tier B: 40 points, Tier C + scene switching + effect transitions",
  },
  {
    tier: "A" as GradedTier,
    th: "ระดับ A: ใช้ 60 พอยท์, มีระดับ B + บริการพากย์เสียง",
    zh: "A类：消耗60积分，含B类功能+配音服务",
    en: "Tier A: 60 points, Tier B + voice-over service",
  },
];

function normalizeGradedTier(value: unknown): GradedTier {
  const v = String(value || "").toUpperCase();
  if (v === "A" || v === "B" || v === "C") return v;
  return "C";
}

function gradedTierPoints(tier: GradedTier): number {
  return Number(GRADED_POINT_UNIT[tier] || 0);
}

function gradedTierTagClass(tierOrValue: unknown): string {
  const tier = normalizeGradedTier(tierOrValue);
  if (tier === "A") return "tag-tier-a";
  if (tier === "B") return "tag-tier-b";
  return "tag-tier-c";
}

function gradedTierTextTh(tierOrValue: unknown): string {
  const tier = normalizeGradedTier(tierOrValue);
  return gradedTierOptions.find((x) => x.tier === tier)?.th || "";
}

function gradedTierRemarkZhEn(tierOrValue: unknown): string {
  const tier = normalizeGradedTier(tierOrValue);
  const item = gradedTierOptions.find((x) => x.tier === tier);
  if (!item) return "";
  return `${item.zh} / ${item.en}`;
}

function gradedTierTooltip(tierOrValue: unknown): string {
  const tier = normalizeGradedTier(tierOrValue);
  const item = gradedTierOptions.find((x) => x.tier === tier);
  if (!item) return "";
  return `${item.th}\n${item.zh}\n${item.en}`;
}

function inDateRange(value: string): boolean {
  if (dateRange.value.length !== 2) return true;
  const [start, end] = dateRange.value;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;
  const startTime = start ? new Date(`${start}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
  const endTime = end ? new Date(`${end}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
  return time >= startTime && time <= endTime;
}

const currentOfflineDialogOrder = computed(() => offlineOrders.value.find((item) => Number(item.id) === Number(dialogOfflineSubmit.orderId)) || null);
const currentMonthlyDialogOrder = computed(() => offlineOrders.value.find((item) => Number(item.id) === Number(monthlyBatchDialog.orderId)) || null);
const dialogOfflineRejectedNote = computed(() => (currentOfflineDialogOrder.value ? orderRejectedMessage(currentOfflineDialogOrder.value) : ""));
const dialogMonthlyRejectedBatchText = computed(() => (currentMonthlyDialogOrder.value ? rejectedBatchSummaries(currentMonthlyDialogOrder.value).join("\n") : ""));
const currentMarketCompleteOrder = computed(() => marketOrders.value.find((item) => Number(item.id) === Number(dialogMarketComplete.orderId)) || null);
const currentMarketPublishOrder = computed(() => marketOrders.value.find((item) => Number(item.id) === Number(dialogMarketPublish.orderId)) || null);

const currentDetailRow = computed<UnifiedOrderRow | null>(() => {
  if (!dialogOrderDetail.rowKey) return null;
  return unified.value.find((item) => String(item.row_key) === String(dialogOrderDetail.rowKey)) || null;
});

const currentDetailMarketOrder = computed<AdminMarketOrder | null>(() => {
  const row = currentDetailRow.value;
  if (!row || row.kind !== "market") return null;
  return row.raw;
});

function openOrderDetail(rowKey: string): void {
  dialogOrderDetail.rowKey = rowKey;
  dialogOrderDetail.open = true;
}

const unified = computed<UnifiedOrderRow[]>(() => {
  const rows: UnifiedOrderRow[] = [];
  for (const mo of marketOrders.value) {
    const status = marketUnifiedStatus(mo);
    const amount = marketAmountValue(mo);
    rows.push({
      row_key: `m_${mo.id}`,
      kind: "market",
      type_id: "graded_video",
      order_no: mo.order_no,
      title: mo.title,
      client_text: mo.client_shop_name || mo.client_display_name || mo.client_username || "-",
      payment_text: t("积分单"),
      phase_code: String(mo.status || ""),
      phase_text: marketPhaseText(String(mo.status || "")),
      unified_status: status,
      unified_status_text: unifiedStatusText(status),
      amount_value: amount,
      amount_text: `${amount} ${t("积分")}`,
      created_at: mo.created_at,
      created_at_text: formatDateTime(mo.created_at),
      raw: mo,
    });
  }
  for (const o of offlineOrders.value) {
    const status = offlineUnifiedStatus(o);
    const amount = Number(o.amount_thb || 0);
    rows.push({
      row_key: `o_${o.id}`,
      kind: "offline",
      type_id: o.type_id as OfflineVideoOrderTypeId,
      order_no: `#${o.id}`,
      title: o.title,
      client_text: o.client_username || "-",
      payment_text: o.payment_status === "paid" ? t("已付款") : t("待付款"),
      phase_code: String(o.phase || ""),
      phase_text: offlinePhaseText(o),
      unified_status: status,
      unified_status_text: unifiedStatusText(status),
      amount_value: amount,
      amount_text: `${amount.toFixed(2)} THB`,
      created_at: o.created_at,
      created_at_text: formatDateTime(o.created_at),
      raw: o,
    });
  }
  return rows;
});

const filteredRows = computed<UnifiedOrderRow[]>(() => {
  const keyword = q.value.trim().toLowerCase();
  const rows = unified.value.filter((row) => {
    if (statusFilter.value && row.unified_status !== statusFilter.value) return false;
    if (!inDateRange(row.created_at)) return false;
    if (!keyword) return true;
    return `${row.order_no} ${row.title} ${row.client_text} ${row.phase_text} ${row.amount_text}`.toLowerCase().includes(keyword);
  });
  const sorted = [...rows];
  if (sortMode.value === "created_desc") sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  if (sortMode.value === "created_asc") sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  if (sortMode.value === "amount_desc") sorted.sort((a, b) => b.amount_value - a.amount_value);
  if (sortMode.value === "amount_asc") sorted.sort((a, b) => a.amount_value - b.amount_value);
  if (sortMode.value === "status_asc") sorted.sort((a, b) => unifiedStatusRank(a.unified_status) - unifiedStatusRank(b.unified_status) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  if (sortMode.value === "status_desc") sorted.sort((a, b) => unifiedStatusRank(b.unified_status) - unifiedStatusRank(a.unified_status) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return sorted;
});

/** 加载全部订单。 */
async function reloadAll(): Promise<void> {
  persistUi();
  loading.value = true;
  try {
    const [m, o] = await Promise.all([
      listAdminOrders({ q: q.value.trim() || undefined }),
      isAdmin.value ? listAdminOfflineVideoOrders({ q: q.value.trim() || undefined }) : listEmployeeOfflineVideoOrders({ q: q.value.trim() || undefined }),
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
  const isResubmitted = !!dialogOfflineRejectedNote.value;
  try {
    await submitEmployeeOfflineVideoOrderProof(dialogOfflineSubmit.orderId, links);
    dialogOfflineSubmit.open = false;
    ElMessage.success(isResubmitted ? t("已按退回意见重新提交，等待商家复核") : t("提交成功"));
    await reloadAll();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : t("提交失败"));
  } finally {
    dialogOfflineSubmit.loading = false;
  }
}

/** 打开类型3批次提交。 */
function openMonthlyBatchSubmit(orderId: number): void {
  const order = offlineOrders.value.find((item) => Number(item.id) === Number(orderId));
  const firstRejected = order ? rejectedBatches(order)[0] : null;
  monthlyBatchDialog.open = true;
  monthlyBatchDialog.orderId = orderId;
  monthlyBatchDialog.batchNo = firstRejected?.batch_no || 1;
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
  const currentOrder = currentMonthlyDialogOrder.value;
  const isResubmitted = !!currentOrder?.batch_payload?.some((batch) => Number(batch.batch_no || 0) === Number(monthlyBatchDialog.batchNo) && String(batch.status || "") === "rejected");
  try {
    await submitEmployeeMonthlyBatch(monthlyBatchDialog.orderId, { batch_no: monthlyBatchDialog.batchNo, video_count: monthlyBatchDialog.videoCount, video_urls: links });
    monthlyBatchDialog.open = false;
    ElMessage.success(isResubmitted ? t("批次已按退回意见重新提交，等待商家复核") : t("批次提交成功"));
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

function refreshLayoutState(): void {
  isNarrow.value = typeof window !== "undefined" && window.innerWidth < 1280;
}

onMounted(() => {
  void reloadAll();
  setupAutoRefreshTimer();
  refreshLayoutState();
  window.addEventListener("resize", refreshLayoutState);
});

onBeforeUnmount(() => {
  clearAutoRefreshTimer();
  window.removeEventListener("resize", refreshLayoutState);
});
</script>

<style scoped>
.page-wrap { padding: 14px 10px; }
.header-row { display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap; margin-bottom: 12px; }
.filters { display: flex; gap: 10px; flex-wrap: wrap; }
.auto-refresh { display: flex; gap: 10px; align-items: center; }
.title { font-size: 21px; font-weight: 800; color: #3d2a00; }
.hc-thai { line-height: 1.9; }
.list-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.list-title { font-size: 18px; font-weight: 800; color: #3d2a00; }
.list-summary { font-size: 13px; color: #64748b; font-weight: 700; }
.status-cell { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
.title-cell { display: flex; flex-direction: column; gap: 8px; }
.tier-tooltip { white-space: pre-line; max-width: 360px; line-height: 1.6; }
.tier-dialog-block { border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 10px; padding: 10px 12px; margin-bottom: 10px; }
.tier-dialog-title { font-weight: 800; color: #334155; margin-bottom: 6px; }
.tier-dialog-row { display: flex; gap: 10px; align-items: flex-start; }
.tier-dialog-text { display: flex; flex-direction: column; gap: 2px; }
.tier-detail-block { margin-top: 14px; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; background: #fff; }
.tier-detail-title { font-weight: 900; color: #0f172a; margin-bottom: 10px; }
.tier-detail-selected { display: flex; gap: 10px; align-items: flex-start; padding: 10px 10px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; }
.tier-detail-text { display: flex; flex-direction: column; gap: 2px; }
.tier-th { font-weight: 800; color: #0f172a; }
.tier-remark { font-size: 12px; color: #475569; line-height: 1.6; }
.tier-total { font-size: 12px; color: #334155; margin-top: 2px; font-weight: 700; }
.tier-detail-list { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
.tier-detail-item { display: flex; gap: 10px; align-items: flex-start; padding: 10px; border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; }
.tier-detail-item.active { border-color: rgba(234, 88, 12, 0.35); background: rgba(234, 88, 12, 0.06); }
.tier-detail-item-text { display: flex; flex-direction: column; gap: 2px; }
.rejection-alert { margin-top: 4px; }
.resubmit-alert { margin-top: 4px; }
.rejected-batch-list { border: 1px solid #f5c2c7; background: #fff5f5; border-radius: 8px; padding: 8px 10px; color: #8a1f11; }
.rejected-batch-title { font-weight: 800; margin-bottom: 4px; }
.rejected-batch-item { line-height: 1.6; }
.resubmitted-batch-list { border: 1px solid #b6d4fe; background: #f4f8ff; border-radius: 8px; padding: 8px 10px; color: #114a8a; }
.resubmitted-batch-title { font-weight: 800; margin-bottom: 4px; }
.resubmitted-batch-item { line-height: 1.6; }
.dialog-alert { margin-bottom: 12px; white-space: pre-line; }
.empty-wrap { padding: 32px 0 20px; background: #fff; border-radius: 12px; border: 1px solid #eef2f7; }
:deep(.tag-tier-a){ background:rgba(239,68,68,0.12); color:#b91c1c; border-color:rgba(239,68,68,0.35); font-weight:900; }
:deep(.tag-tier-b){ background:rgba(245,158,11,0.14); color:#b45309; border-color:rgba(245,158,11,0.40); font-weight:900; }
:deep(.tag-tier-c){ background:rgba(59,130,246,0.12); color:#1d4ed8; border-color:rgba(59,130,246,0.35); font-weight:900; }
:deep(.tag-gold){ background:#ffe082;color:#5d3a00;border-color:#ffb300;font-weight:700; }
:deep(.tag-yellow){ background:#fff59d;color:#5d4a00;border-color:#fbc02d;font-weight:700; }
:deep(.tag-purple){ background:#e1bee7;color:#4a148c;border-color:#ab47bc;font-weight:700; }
:deep(.tag-red){ background:#ffcdd2;color:#b71c1c;border-color:#ef5350;font-weight:700; }
:deep(.tag-status-open){ background:rgba(59,130,246,0.10); color:#1d4ed8; border-color:rgba(59,130,246,0.30); font-weight:700; }
:deep(.tag-status-claimed){ background:rgba(15,118,110,0.10); color:#0f766e; border-color:rgba(15,118,110,0.30); font-weight:700; }
:deep(.tag-status-progress){ background:rgba(245,158,11,0.12); color:#b45309; border-color:rgba(245,158,11,0.35); font-weight:700; }
:deep(.tag-status-completed){ background:rgba(234,88,12,0.10); color:#ea580c; border-color:rgba(234,88,12,0.30); font-weight:700; }
:deep(.tag-status-cancelled){ background:rgba(239,68,68,0.10); color:#b91c1c; border-color:rgba(239,68,68,0.30); font-weight:700; }

@media (max-width: 980px) {
  .filters { width: 100%; }
  .auto-refresh { width: 100%; justify-content: flex-start; }
  .filters > :deep(.el-input),
  .filters > :deep(.el-select),
  .filters > :deep(.el-date-editor),
  .filters > :deep(.el-button) { width: 100% !important; }
}
</style>
