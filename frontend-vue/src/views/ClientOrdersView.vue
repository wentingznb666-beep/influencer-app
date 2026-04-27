<template>
  <div class="page-wrap hc-thai" :class="{ roomy: store.roomyLayout }">
    <div class="hero-card">
      <div class="header-row">
        <div>
          <div class="title">{{ t("商家订单验收与结算") }} / {{ t("หน้าจอรับงานและชำระยอดของร้านค้า") }}</div>
          <div class="subtitle">{{ t("支持当前页直接验收、查看交付链接、管理批次记录，不再依赖弹窗。") }}</div>
        </div>
        <div class="filters">
          <el-select v-model="typeFilter" clearable :placeholder="t('订单类型筛选')" style="width: 240px" @change="persistUi">
            <el-option :label="typeLabel('graded_video')" value="graded_video" />
            <el-option :label="typeLabel('high_quality_custom_video')" value="high_quality_custom_video" />
            <el-option :label="typeLabel('monthly_package')" value="monthly_package" />
            <el-option :label="typeLabel('creator_review_video')" value="creator_review_video" />
          </el-select>
          <el-input v-model="q" :placeholder="t('搜索订单号/标题/员工')" style="width: 260px" @keyup.enter="reloadAll" @blur="persistUi" />
          <el-switch v-model="store.roomyLayout" :active-text="t('宽松布局')" :inactive-text="t('紧凑布局')" @change="persistUi" />
          <el-button class="gold-btn" @click="reloadAll" :loading="loading">{{ t("รีเฟรช") }}</el-button>
        </div>
      </div>

      <el-row :gutter="14" class="stats-row">
        <el-col :xs="24" :sm="12" :lg="6"><el-statistic :title="t('订单总数')" :value="stats.total" /></el-col>
        <el-col :xs="24" :sm="12" :lg="6"><el-statistic :title="t('待验收批次')" :value="stats.pendingBatchCount" /></el-col>
        <el-col :xs="24" :sm="12" :lg="6"><el-statistic :title="t('总金额(THB)')" :value="stats.amount" /></el-col>
        <el-col :xs="24" :sm="12" :lg="6"><el-statistic :title="t('已结算(THB)')" :value="stats.monthlySettled" /></el-col>
      </el-row>
    </div>

    <el-table
      :data="filtered"
      stripe
      row-key="row_key"
      class="order-table"
      v-loading="loading"
      @expand-change="onExpandChange"
    >
      <el-table-column type="expand" width="58">
        <template #default="{ row }">
          <div v-if="row.kind === 'offline'" class="expanded-panel">
            <div class="expanded-header">
              <div class="batch-title">{{ t("批次记录") }}</div>
              <div class="expanded-actions">
                <el-input
                  v-model="batchQuery(row.raw.id).keyword"
                  clearable
                  style="width: 220px"
                  :placeholder="t('筛选批次号/提交员工/链接')"
                  @input="resetBatchPage(row.raw.id)"
                />
                <el-select v-model="batchQuery(row.raw.id).status" clearable style="width: 180px" @change="resetBatchPage(row.raw.id)">
                  <el-option :label="t('全部状态')" value="" />
                  <el-option :label="t('待验收')" value="pending_acceptance" />
                  <el-option :label="t('已验收')" value="accepted" />
                  <el-option :label="t('已结算')" value="settled" />
                </el-select>
                <el-button link type="primary" @click="loadBatches(row.raw.id, true)">{{ t("刷新批次") }}</el-button>
              </div>
            </div>

            <el-tabs type="border-card" class="batch-tabs">
              <el-tab-pane :label="t('批次列表')">
                <el-table
                  :data="pagedBatches(row.raw.id)"
                  border
                  class="batch-table"
                  v-loading="batchLoading(row.raw.id)"
                  empty-text="暂无批次记录"
                >
                  <el-table-column prop="batch_no" :label="t('批次号')" width="90" />
                  <el-table-column prop="submitter_name" :label="t('提交员工')" width="140">
                    <template #default="{ row: batch }">{{ batch.submitter_name || t("未记录") }}</template>
                  </el-table-column>
                  <el-table-column prop="submitted_at" :label="t('提交时间')" min-width="170">
                    <template #default="{ row: batch }">{{ formatDateTime(batch.submitted_at) }}</template>
                  </el-table-column>
                  <el-table-column :label="t('交付链接')" min-width="280">
                    <template #default="{ row: batch }">
                      <div class="links-cell">
                        <template v-if="deliveryLinks(batch).length">
                          <div v-for="(link, idx) in deliveryLinks(batch)" :key="`${batch.batch_id}_${idx}`" class="link-row">
                            <el-link :href="link" target="_blank" type="primary" :underline="false">{{ shortenLink(link) }}</el-link>
                            <el-button link type="warning" @click="copyLink(link)">{{ t("复制") }}</el-button>
                          </div>
                        </template>
                        <span v-else class="muted-text">{{ t("暂无交付链接") }}</span>
                      </div>
                    </template>
                  </el-table-column>
                  <el-table-column prop="status" :label="t('验收状态')" width="130">
                    <template #default="{ row: batch }">
                      <el-tag :type="batchTagType(batch.status)" effect="dark">{{ batchStatusText(batch.status) }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="accepted_at" :label="t('验收时间')" min-width="170">
                    <template #default="{ row: batch }">{{ formatDateTime(batch.accepted_at) }}</template>
                  </el-table-column>
                  <el-table-column :label="t('验收备注')" min-width="220">
                    <template #default="{ row: batch }">
                      <el-input
                        v-model="remarkDraftMap[batchKey(row.raw.id, batch.batch_id)]"
                        clearable
                        :placeholder="t('可选备注，保存时一并提交')"
                        @focus="ensureRemarkDraft(row.raw.id, batch)"
                      />
                    </template>
                  </el-table-column>
                  <el-table-column :label="t('结算')" width="140">
                    <template #default="{ row: batch }">
                      <div class="settle-cell">
                        <span>{{ toPrice(batch.settled_amount) }} ฿</span>
                        <span class="muted-text">{{ formatDateTime(batch.settled_at) }}</span>
                      </div>
                    </template>
                  </el-table-column>
                  <el-table-column :label="t('操作')" width="400" fixed="right">
                    <template #default="{ row: batch }">
                      <div class="batch-actions">
                        <el-button
                          type="success"
                          size="small"
                          class="accept-btn"
                          :disabled="batch.status === 'accepted' || batch.status === 'settled'"
                          :loading="isBatchActing(row.raw.id, batch.batch_id)"
                          @click="acceptBatch(row.raw.id, batch)"
                        >
                          {{ t("直接验收") }}
                        </el-button>
                        <el-button
                          size="small"
                          type="warning"
                          plain
                          :disabled="batch.status === 'accepted' || batch.status === 'settled'"
                          :loading="isBatchActing(row.raw.id, batch.batch_id)"
                          @click="saveRemarkAndAccept(row.raw.id, batch)"
                        >
                          {{ t("保存并验收") }}
                        </el-button>
                        <el-button
                          size="small"
                          type="info"
                          plain
                          :disabled="batch.status === 'settled'"
                          :loading="isBatchActing(row.raw.id, batch.batch_id)"
                          @click="rejectBatch(row.raw.id, batch)"
                        >
                          {{ t("退回修改") }}
                        </el-button>
                        <el-button
                          size="small"
                          type="danger"
                          plain
                          :disabled="batch.status !== 'accepted'"
                          :loading="isBatchActing(row.raw.id, batch.batch_id)"
                          @click="settleBatch(row.raw.id, batch)"
                        >
                          {{ t("标记结算") }}
                        </el-button>
                      </div>
                    </template>
                  </el-table-column>
                </el-table>

                <div class="pager-row">
                  <el-pagination
                    background
                    layout="total, sizes, prev, pager, next"
                    :current-page="batchQuery(row.raw.id).page"
                    :page-size="batchQuery(row.raw.id).pageSize"
                    :page-sizes="[5, 10, 20]"
                    :total="filteredBatches(row.raw.id).length"
                    @current-change="setBatchPage(row.raw.id, $event)"
                    @size-change="setBatchPageSize(row.raw.id, $event)"
                  />
                </div>
              </el-tab-pane>

              <el-tab-pane :label="t('订单摘要')">
                <el-descriptions :column="2" border class="detail-desc">
                  <el-descriptions-item :label="t('订单号')">{{ row.order_no }}</el-descriptions-item>
                  <el-descriptions-item :label="t('订单类型')">{{ typeLabel(row.type_id) }}</el-descriptions-item>
                  <el-descriptions-item :label="t('标题')">{{ row.title }}</el-descriptions-item>
                  <el-descriptions-item :label="t('状态')">{{ row.phase_text }}</el-descriptions-item>
                  <el-descriptions-item :label="t('交付链接数')">{{ orderDeliveryCount(row.raw) }}</el-descriptions-item>
                  <el-descriptions-item :label="t('已验收/目标')">
                    {{ monthlyAccepted(row.raw) }}/{{ monthlyTarget(row.raw) || t("未设置") }}
                  </el-descriptions-item>
                </el-descriptions>
              </el-tab-pane>
            </el-tabs>
          </div>

          <div v-else class="expanded-panel">
            <el-empty :description="t('当前订单不需要批次管理，保留原详情浏览功能。')" />
          </div>
        </template>
      </el-table-column>

      <el-table-column prop="order_no" :label="t('订单号')" width="190" />
      <el-table-column :label="t('类型')" width="220">
        <template #default="{ row }"><el-tag :class="getOrderTypeTagClass(row.type_id)">{{ typeLabel(row.type_id) }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="payment_text" :label="t('付款/扣分')" width="130" />
      <el-table-column prop="phase_text" :label="t('状态')" width="150">
        <template #default="{ row }">
          <el-tag :type="orderPhaseTagType(row.phase_text)" effect="dark">{{ row.phase_text }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="title" :label="t('标题')" min-width="220" />
      <el-table-column prop="amount_thb" :label="t('金额(THB)')" width="130">
        <template #default="{ row }">{{ toPrice(row.amount_thb) }}</template>
      </el-table-column>
      <el-table-column :label="t('交付链接')" min-width="260">
        <template #default="{ row }">
          <div class="links-cell">
            <template v-if="row.kind === 'offline' && orderDeliveryLinks(row.raw).length">
              <div v-for="(link, idx) in orderDeliveryLinks(row.raw).slice(0, 2)" :key="`${row.row_key}_${idx}`" class="link-row">
                <el-link :href="link" target="_blank" type="primary" :underline="false">{{ shortenLink(link) }}</el-link>
                <el-button link type="warning" @click="copyLink(link)">{{ t("复制") }}</el-button>
              </div>
            </template>
            <span v-else class="muted-text">{{ t("展开后查看批次链接") }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column :label="t('批次进度')" min-width="250">
        <template #default="{ row }">
          <template v-if="row.type_id === 'monthly_package' && row.kind === 'offline'">
            {{ monthlyAccepted(row.raw) }}/{{ monthlyTarget(row.raw) || 0 }}
            | {{ t("待验收") }} {{ pendingBatchCount(row.raw) }}
            | {{ t("已结算") }} {{ monthlySettled(row.raw) }} ฿
          </template>
          <template v-else-if="row.kind === 'offline'">
            {{ t("交付链接") }} {{ orderDeliveryCount(row.raw) }} / {{ t("状态") }} {{ row.phase_text }}
          </template>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column :label="t('操作')" width="340" fixed="right">
        <template #default="{ row }">
          <div class="row-actions">
            <el-button size="small" @click="openDetail(row)">{{ t("详情") }}</el-button>
            <el-button
              v-if="row.kind === 'offline' && row.type_id !== 'monthly_package'"
              size="small"
              type="success"
              :loading="isOrderActing(row.raw.id)"
              @click="acceptOrder(row.raw.id)"
            >
              {{ t("直接验收") }}
            </el-button>
            <el-button
              v-if="row.kind === 'offline' && row.type_id !== 'monthly_package'"
              size="small"
              type="warning"
              plain
              :loading="isOrderActing(row.raw.id)"
              @click="rejectOrder(row.raw.id)"
            >
              {{ t("退回修改") }}
            </el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <el-drawer v-model="detailOpen" :title="t('订单详情')" size="60%" :close-on-click-modal="true" :lock-scroll="false">
      <template v-if="activeOrder">
        <el-alert :closable="false" :title="detailRuleTitle" type="warning" class="rule-alert" />
        <el-descriptions :column="2" border class="detail-desc">
          <el-descriptions-item :label="t('订单号')">{{ activeOrder.order_no }}</el-descriptions-item>
          <el-descriptions-item :label="t('订单类型')">{{ typeLabel(activeOrder.type_id) }}</el-descriptions-item>
          <el-descriptions-item :label="t('标题')">{{ activeOrder.title }}</el-descriptions-item>
          <el-descriptions-item :label="t('状态')">{{ activeOrder.phase_text }}</el-descriptions-item>
          <el-descriptions-item :label="t('金额')">{{ toPrice(activeOrder.amount_thb) }} ฿</el-descriptions-item>
          <el-descriptions-item :label="t('交付链接数量')">
            {{ unifiedOrderDeliveryCount(activeOrder) }}
          </el-descriptions-item>
        </el-descriptions>

        <div v-if="activeOrder.kind === 'offline' && activeOrder.type_id === 'monthly_package'" class="batch-box">
          <div class="batch-title">{{ t("类型3批次验收模块") }}</div>
          <el-table :data="store.getClientBatches(activeOrder.raw.id)" border>
            <el-table-column prop="batch_no" :label="t('批次')" width="80" />
            <el-table-column prop="video_count" :label="t('提交数量')" width="120" />
            <el-table-column prop="accepted_count" :label="t('验收数量')" width="120" />
            <el-table-column :label="t('交付链接')" min-width="260">
              <template #default="{ row: batch }">
                <div class="links-cell">
                  <template v-if="deliveryLinks(batch).length">
                    <div v-for="(link, idx) in deliveryLinks(batch).slice(0, 2)" :key="`drawer_${batch.batch_id}_${idx}`" class="link-row">
                      <el-link :href="link" target="_blank" type="primary" :underline="false">{{ shortenLink(link) }}</el-link>
                      <el-button link type="warning" @click="copyLink(link)">{{ t("复制") }}</el-button>
                    </div>
                  </template>
                  <span v-else class="muted-text">-</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="status" :label="t('状态')" width="160">
              <template #default="{ row: batch }">
                <el-tag :type="batchTagType(batch.status)">{{ batchStatusText(batch.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="settled_amount" :label="t('结算金额')" width="140">
              <template #default="{ row: batch }">{{ toPrice(batch.settled_amount) }}</template>
            </el-table-column>
            <el-table-column prop="accepted_at" :label="t('验收时间')" min-width="180">
              <template #default="{ row: batch }">{{ formatDateTime(batch.accepted_at) }}</template>
            </el-table-column>
            <el-table-column :label="t('操作')" width="330" fixed="right">
              <template #default="{ row: batch }">
                <div class="batch-actions">
                  <el-button
                    type="success"
                    size="small"
                    :disabled="batch.status === 'accepted' || batch.status === 'settled'"
                    :loading="isBatchActing(activeOrder.raw.id, batch.batch_id)"
                    @click="acceptBatch(activeOrder.raw.id, batch)"
                  >
                    {{ t("直接验收") }}
                  </el-button>
                  <el-button
                    size="small"
                    type="info"
                    plain
                    :disabled="batch.status === 'settled'"
                    :loading="isBatchActing(activeOrder.raw.id, batch.batch_id)"
                    @click="rejectBatch(activeOrder.raw.id, batch)"
                  >
                    {{ t("退回修改") }}
                  </el-button>
                  <el-button
                    size="small"
                    type="danger"
                    plain
                    :disabled="batch.status !== 'accepted'"
                    :loading="isBatchActing(activeOrder.raw.id, batch.batch_id)"
                    @click="settleBatch(activeOrder.raw.id, batch)"
                  >
                    {{ t("标记结算") }}
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import type { ClientMarketOrder } from "@/api/client";
import type { MonthlyBatchItem, OfflineVideoOrderTypeId, OrderBatchRecord, VideoOrder } from "@/api/videoOrders";
import { readLocale, tr, type Locale } from "@/utils/i18n";
import { getOrderTypeTagClass, getOrderTypeTh, getOrderTypeZh } from "@/utils/videoOrderRules";
import { useVideoOrdersStore } from "@/stores/videoOrders";
import type { UnifiedOrderType } from "@/types/videoOrderExt";

type UnifiedRow = {
  row_key: string;
  kind: "market" | "offline";
  type_id: UnifiedOrderType;
  order_no: string;
  title: string;
  amount_thb: number;
  payment_text: string;
  phase_text: string;
  raw: ClientMarketOrder | VideoOrder;
};

const locale = ref<Locale>(readLocale());
const store = useVideoOrdersStore();
const typeFilter = ref<UnifiedOrderType | "">(store.clientTypeFilter || "");
const q = ref(store.orderKeyword || "");
const detailOpen = ref(false);
const activeOrder = ref<UnifiedRow | null>(null);
const remarkDraftMap = reactive<Record<string, string>>({});

function t(text: string): string {
  return tr(text, text, locale.value);
}

function typeLabel(type: UnifiedOrderType): string {
  return `${getOrderTypeTh(type)} / ${getOrderTypeZh(type)}`;
}

function persistUi(): void {
  store.clientTypeFilter = typeFilter.value;
  store.orderKeyword = q.value;
  store.persist();
}

function monthlyBatches(row: VideoOrder): MonthlyBatchItem[] {
  return store.getClientBatches(row.id).length ? store.getClientBatches(row.id) : Array.isArray(row.batch_payload) ? row.batch_payload : [];
}

function monthlyTarget(row: VideoOrder): number {
  return Number((row.requirements as Record<string, unknown> | undefined)?.min_videos_per_month || 0) || 0;
}

function monthlyAccepted(row: VideoOrder): number {
  return monthlyBatches(row).reduce((sum, batch) => sum + Number(batch.accepted_count || 0), 0);
}

function monthlySettled(row: VideoOrder): number {
  return monthlyBatches(row).reduce((sum, batch) => sum + Number(batch.settled_amount || 0), 0);
}

function pendingBatchCount(row: VideoOrder): number {
  return monthlyBatches(row).filter((batch) => batch.status === "pending_acceptance").length;
}

function orderDeliveryLinks(row: VideoOrder): string[] {
  const direct = Array.isArray(row.publish_links) && row.publish_links.length ? row.publish_links : row.proof_links;
  const fromBatches = monthlyBatches(row).flatMap((batch) => deliveryLinks(batch));
  return [...direct, ...fromBatches].filter(Boolean);
}

function orderDeliveryCount(row: VideoOrder): number {
  return orderDeliveryLinks(row).length;
}

function unifiedOrderDeliveryCount(row: UnifiedRow): number {
  return row.kind === "offline" ? orderDeliveryCount(row.raw as VideoOrder) : 0;
}

function deliveryLinks(batch: OrderBatchRecord): string[] {
  return Array.isArray(batch.delivery_links) && batch.delivery_links.length ? batch.delivery_links : Array.isArray(batch.proof_links) ? batch.proof_links : [];
}

function toPrice(value: unknown): number {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function shortenLink(link: string): string {
  return link.length > 36 ? `${link.slice(0, 33)}...` : link;
}

async function copyLink(link: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(link);
    ElMessage.success(t("链接已复制"));
  } catch {
    ElMessage.error(t("复制失败，请手动复制"));
  }
}

function batchStatusText(status: string): string {
  if (status === "pending_acceptance") return t("待验收");
  if (status === "accepted") return t("已验收");
  if (status === "settled") return t("已结算");
  if (status === "rejected") return t("已退回");
  return status || "-";
}

function batchTagType(status: string): "success" | "warning" | "danger" | "info" {
  if (status === "accepted") return "success";
  if (status === "settled") return "info";
  if (status === "pending_acceptance") return "warning";
  return "danger";
}

function orderPhaseTagType(phase: string): "success" | "warning" | "danger" | "info" {
  if (["accepted", "completed", "settled"].includes(phase)) return "success";
  if (["pending_acceptance", "review_pending", "in_progress"].includes(phase)) return "warning";
  if (["review_rejected", "rejected"].includes(phase)) return "danger";
  return "info";
}

function batchKey(orderId: number, batchId: string | number): string {
  return `${orderId}_${batchId}`;
}

function ensureRemarkDraft(orderId: number, batch: OrderBatchRecord): void {
  const key = batchKey(orderId, batch.batch_id);
  if (key in remarkDraftMap) return;
  remarkDraftMap[key] = String(batch.remark || batch.accept_note || "");
}

function batchQuery(orderId: number) {
  store.setClientBatchQuery(orderId, {});
  return store.clientBatchQueryMap[orderId];
}

function resetBatchPage(orderId: number): void {
  store.setClientBatchQuery(orderId, { page: 1 });
}

function setBatchPage(orderId: number, page: number): void {
  store.setClientBatchQuery(orderId, { page });
}

function setBatchPageSize(orderId: number, pageSize: number): void {
  store.setClientBatchQuery(orderId, { pageSize, page: 1 });
}

function filteredBatches(orderId: number): OrderBatchRecord[] {
  const query = batchQuery(orderId);
  const keyword = query.keyword.trim().toLowerCase();
  return store.getClientBatches(orderId).filter((batch) => {
    const linkText = deliveryLinks(batch).join(" ").toLowerCase();
    const submitter = String(batch.submitter_name || "").toLowerCase();
    const batchText = String(batch.batch_no || "");
    const matchesKeyword = !keyword || `${batchText} ${submitter} ${linkText}`.includes(keyword);
    const matchesStatus = !query.status || batch.status === query.status;
    return matchesKeyword && matchesStatus;
  });
}

function pagedBatches(orderId: number): OrderBatchRecord[] {
  const query = batchQuery(orderId);
  const start = (query.page - 1) * query.pageSize;
  return filteredBatches(orderId).slice(start, start + query.pageSize);
}

function batchLoading(orderId: number): boolean {
  return Boolean(store.clientBatchLoadingMap[orderId]);
}

function isBatchActing(orderId: number, batchId: string | number): boolean {
  return store.isClientBatchActing(orderId, batchId);
}

function isOrderActing(orderId: number): boolean {
  return Boolean(store.clientOrderActionLoadingMap[orderId]);
}

const loading = computed(() => store.clientOrdersLoading);
const marketOrders = computed(() => store.clientMarketOrders);
const offlineOrders = computed(() => store.clientOfflineOrders);

const detailRuleTitle = computed(() => {
  if (!activeOrder.value) return "";
  if (activeOrder.value.type_id === "graded_video") return t("类型1：保留原有只读浏览逻辑，不增加批次验收动作。");
  if (activeOrder.value.type_id === "high_quality_custom_video") return t("类型2：支持当前页直接验收交付结果，无需弹窗。");
  if (activeOrder.value.type_id === "monthly_package") return t("类型3：按批次直接验收，联动结算字段与批次记录。");
  return t("类型4：支持查看交付链接并直接验收，保留原流程兼容。");
});

const stats = computed(() => {
  const list = filtered.value;
  const total = list.length;
  const amount = list.reduce((sum, item) => sum + Number(item.amount_thb || 0), 0);
  const pendingBatchCountAll = offlineOrders.value
    .filter((item) => item.type_id === "monthly_package")
    .reduce((sum, item) => sum + pendingBatchCount(item), 0);
  const monthlySettledAll = offlineOrders.value
    .filter((item) => item.type_id === "monthly_package")
    .reduce((sum, item) => sum + monthlySettled(item), 0);
  return {
    total,
    amount: Number(amount.toFixed(2)),
    pendingBatchCount: pendingBatchCountAll,
    monthlySettled: Number(monthlySettledAll.toFixed(2)),
  };
});

const unified = computed<UnifiedRow[]>(() => {
  const rows: UnifiedRow[] = [];
  for (const market of marketOrders.value) {
    rows.push({
      row_key: `m_${market.id}`,
      kind: "market",
      type_id: "graded_video",
      order_no: market.order_no,
      title: market.title,
      amount_thb: Number(market.reward_points_total || 0),
      payment_text: t("积分已扣"),
      phase_text: market.status,
      raw: market,
    });
  }
  for (const order of offlineOrders.value) {
    rows.push({
      row_key: `o_${order.id}`,
      kind: "offline",
      type_id: order.type_id as OfflineVideoOrderTypeId,
      order_no: `#${order.id}`,
      title: order.title,
      amount_thb: Number(order.amount_thb || 0),
      payment_text: order.payment_status,
      phase_text: order.phase,
      raw: order,
    });
  }
  return rows.sort((a, b) => Number(String(b.order_no).replace(/\D/g, "")) - Number(String(a.order_no).replace(/\D/g, "")));
});

const filtered = computed(() =>
  unified.value.filter(
    (item) =>
      (!typeFilter.value || item.type_id === typeFilter.value) &&
      (!q.value.trim() || `${item.order_no} ${item.title}`.toLowerCase().includes(q.value.trim().toLowerCase())),
  ),
);

async function reloadAll(): Promise<void> {
  persistUi();
  try {
    await store.fetchClientOrders();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : t("加载失败"));
  }
}

async function loadBatches(orderId: number, force = false): Promise<void> {
  try {
    await store.fetchClientOrderBatches(orderId, force);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : t("加载批次失败"));
  }
}

async function onExpandChange(row: UnifiedRow, expandedRows: UnifiedRow[]): Promise<void> {
  if (row.kind !== "offline") return;
  const expanded = expandedRows.some((item) => item.row_key === row.row_key);
  if (!expanded) return;
  await loadBatches((row.raw as VideoOrder).id);
}

async function acceptOrder(orderId: number): Promise<void> {
  try {
    await store.acceptClientOrder(orderId);
    ElMessage.success(t("验收成功"));
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : t("验收失败"));
  }
}

async function rejectOrder(orderId: number): Promise<void> {
  try {
    await store.rejectClientOrder(orderId, t("请根据备注调整后重新提交"));
    ElMessage.success(t("已退回修改"));
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : t("退回失败"));
  }
}

async function acceptBatch(orderId: number, batch: OrderBatchRecord): Promise<void> {
  try {
    await store.acceptClientBatch(orderId, batch, {
      accepted_count: Number(batch.accepted_count || batch.video_count || 0) || Number(batch.video_count || 0),
      remark: "",
    });
    remarkDraftMap[batchKey(orderId, batch.batch_id)] = "";
    ElMessage.success(t("批次验收成功"));
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : t("批次验收失败"));
  }
}

async function saveRemarkAndAccept(orderId: number, batch: OrderBatchRecord): Promise<void> {
  ensureRemarkDraft(orderId, batch);
  try {
    await store.acceptClientBatch(orderId, batch, {
      accepted_count: Number(batch.accepted_count || batch.video_count || 0) || Number(batch.video_count || 0),
      remark: remarkDraftMap[batchKey(orderId, batch.batch_id)] || "",
    });
    ElMessage.success(t("备注已保存并完成验收"));
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : t("保存失败"));
  }
}

async function rejectBatch(orderId: number, batch: OrderBatchRecord): Promise<void> {
  ensureRemarkDraft(orderId, batch);
  try {
    await store.rejectClientBatch(orderId, batch, remarkDraftMap[batchKey(orderId, batch.batch_id)] || t("请补充本批次内容后重新提交"));
    ElMessage.success(t("批次已退回修改"));
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : t("退回失败"));
  }
}

async function settleBatch(orderId: number, batch: OrderBatchRecord): Promise<void> {
  try {
    await store.settleClientBatch(orderId, batch, Number(batch.settled_amount || 0));
    ElMessage.success(t("批次已标记结算"));
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : t("结算失败"));
  }
}

function openDetail(row: UnifiedRow): void {
  activeOrder.value = row;
  detailOpen.value = true;
  if (row.kind === "offline") {
    void loadBatches((row.raw as VideoOrder).id);
  }
}

onMounted(() => {
  void reloadAll();
});
</script>

<style scoped>
.page-wrap { padding: 16px 12px 24px; background: linear-gradient(180deg, #fff9e8 0%, #fffdf7 48%, #fff7fb 100%); min-height: 100%; }
.roomy :deep(.el-table__cell) { padding-top: 16px; padding-bottom: 16px; }
.hero-card { padding: 16px; border-radius: 20px; background: linear-gradient(135deg, rgba(255, 224, 130, 0.38), rgba(225, 190, 231, 0.32)); box-shadow: 0 10px 28px rgba(93, 58, 0, 0.08); margin-bottom: 16px; }
.header-row { display: flex; gap: 12px; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; flex-wrap: wrap; }
.title { font-size: 22px; font-weight: 800; color: #4a2f00; letter-spacing: 0.04em; }
.subtitle { margin-top: 6px; font-size: 13px; color: #7c5872; letter-spacing: 0.05em; }
.filters { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.stats-row { margin-bottom: 4px; }
.order-table { border-radius: 18px; overflow: hidden; }
.expanded-panel { padding: 10px 6px 14px; background: #fffdf8; }
.expanded-header { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 10px; flex-wrap: wrap; align-items: center; }
.expanded-actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.batch-tabs { border-radius: 16px; overflow: hidden; }
.batch-table { margin-top: 4px; }
.batch-box { margin-top: 14px; }
.batch-title { font-size: 15px; font-weight: 800; color: #6a1b9a; letter-spacing: 0.04em; }
.rule-alert { margin: 8px 0 14px; }
.detail-desc { margin-top: 10px; }
.links-cell { display: flex; flex-direction: column; gap: 8px; }
.link-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.muted-text { color: #8a7d6a; font-size: 12px; }
.batch-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.row-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.settle-cell { display: flex; flex-direction: column; gap: 4px; }
.pager-row { display: flex; justify-content: flex-end; margin-top: 12px; }
.hc-thai { line-height: 1.95; letter-spacing: 0.02em; }
.gold-btn { --el-button-bg-color: #ffca28; --el-button-border-color: #ffca28; --el-button-text-color: #4a2f00; --el-button-hover-bg-color: #ffd54f; --el-button-hover-border-color: #ffd54f; }
.accept-btn { --el-button-bg-color: #8e24aa; --el-button-border-color: #8e24aa; --el-button-hover-bg-color: #9c27b0; --el-button-hover-border-color: #9c27b0; }
:deep(.tag-gold){ background:#ffe082;color:#5d3a00;border-color:#ffb300;font-weight:700; }
:deep(.tag-yellow){ background:#fff59d;color:#5d4a00;border-color:#fbc02d;font-weight:700; }
:deep(.tag-purple){ background:#e1bee7;color:#4a148c;border-color:#ab47bc;font-weight:700; }
:deep(.tag-red){ background:#ffcdd2;color:#b71c1c;border-color:#ef5350;font-weight:700; }

@media (max-width: 900px) {
  .header-row,
  .expanded-header,
  .expanded-actions { align-items: stretch; }
  .filters,
  .expanded-actions,
  .row-actions,
  .batch-actions { width: 100%; }
}
</style>
