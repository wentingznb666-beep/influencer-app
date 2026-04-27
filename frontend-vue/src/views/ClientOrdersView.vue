<template>
  <div class="page-wrap hc-thai">
    <div class="header-row">
      <div class="title">{{ t("商家订单列表") }} / {{ t("รายการคำสั่งงานฝั่งร้านค้า") }}</div>
      <div class="filters">
        <el-select v-model="typeFilter" clearable :placeholder="t('订单类型筛选')" style="width: 280px" @change="persistUi">
          <el-option :label="typeLabel('graded_video')" value="graded_video" />
          <el-option :label="typeLabel('high_quality_custom_video')" value="high_quality_custom_video" />
          <el-option :label="typeLabel('monthly_package')" value="monthly_package" />
          <el-option :label="typeLabel('creator_review_video')" value="creator_review_video" />
        </el-select>
        <el-input v-model="q" :placeholder="t('搜索订单号/标题')" style="width: 260px" @keyup.enter="reloadAll" @blur="persistUi" />
        <el-button @click="reloadAll" :loading="loading">{{ t("รีเฟรช") }}</el-button>
      </div>
    </div>

    <el-row :gutter="12" style="margin-bottom: 12px">
      <el-col :span="6"><el-statistic :title="t('订单总数')" :value="stats.total" /></el-col>
      <el-col :span="6"><el-statistic :title="t('总金额(THB)')" :value="stats.amount" /></el-col>
      <el-col :span="6"><el-statistic :title="t('完成率')" :value="stats.finishRate" suffix="%" /></el-col>
      <el-col :span="6"><el-statistic :title="t('包月已结算(THB)')" :value="stats.monthlySettled" /></el-col>
    </el-row>

    <el-table :data="filtered" stripe row-key="row_key">
      <el-table-column prop="order_no" :label="t('订单号')" width="190" />
      <el-table-column :label="t('类型')" width="220">
        <template #default="{ row }"><el-tag :class="getOrderTypeTagClass(row.type_id)">{{ typeLabel(row.type_id) }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="payment_text" :label="t('付款/扣分')" width="130" />
      <el-table-column prop="phase_text" :label="t('状态')" width="150" />
      <el-table-column prop="title" :label="t('标题')" min-width="230" />
      <el-table-column prop="amount_thb" :label="t('金额(THB)')" width="130" />
      <el-table-column :label="t('类型3进度')" min-width="260">
        <template #default="{ row }">
          <template v-if="row.type_id === 'monthly_package' && row.kind === 'offline'">
            {{ monthlyAccepted(row.raw) }}/{{ monthlyTarget(row.raw) }} | {{ t("已结算") }} {{ monthlySettled(row.raw) }}฿ | {{ t("合作月数") }} {{ monthlyMonths(row.raw) }}
          </template>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column :label="t('操作')" width="140" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="openDetail(row)">{{ t("详情") }}</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-drawer v-model="detailOpen" :title="t('订单详情')" size="60%" :close-on-click-modal="true" :lock-scroll="false">
      <template v-if="activeOrder">
        <el-alert :closable="false" :title="detailRuleTitle" type="warning" class="rule-alert" />
        <el-descriptions :column="2" border>
          <el-descriptions-item :label="t('订单号')">{{ activeOrder.order_no }}</el-descriptions-item>
          <el-descriptions-item :label="t('订单类型')">{{ typeLabel(activeOrder.type_id) }}</el-descriptions-item>
          <el-descriptions-item :label="t('标题')">{{ activeOrder.title }}</el-descriptions-item>
          <el-descriptions-item :label="t('状态')">{{ activeOrder.phase_text }}</el-descriptions-item>
        </el-descriptions>

        <div v-if="activeOrder.kind === 'offline' && activeOrder.type_id === 'monthly_package'" class="batch-box">
          <div class="batch-title">{{ t("类型3批次验收模块") }}</div>
          <el-table :data="monthlyBatches(activeOrder.raw)" border>
            <el-table-column prop="batch_no" :label="t('批次')" width="80" />
            <el-table-column prop="video_count" :label="t('提交数量')" width="120" />
            <el-table-column prop="accepted_count" :label="t('验收数量')" width="120" />
            <el-table-column prop="status" :label="t('状态')" width="160" />
            <el-table-column prop="settled_amount" :label="t('结算金额')" width="140" />
            <el-table-column prop="settled_at" :label="t('时间')" min-width="180" />
          </el-table>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { listClientMarketOrders, type ClientMarketOrder } from "@/api/client";
import { listClientOfflineVideoOrders, type MonthlyBatchItem, type OfflineVideoOrderTypeId, type VideoOrder } from "@/api/videoOrders";
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
  raw: any;
};

const locale = ref<Locale>(readLocale());
const store = useVideoOrdersStore();
const loading = ref(false);
const marketOrders = ref<ClientMarketOrder[]>([]);
const offlineOrders = ref<VideoOrder[]>([]);
const typeFilter = ref<UnifiedOrderType | "">(store.clientTypeFilter || "");
const q = ref(store.orderKeyword || "");
const detailOpen = ref(false);
const activeOrder = ref<UnifiedRow | null>(null);

/** 翻译工具。 */
function t(text: string): string {
  return tr(text, text, locale.value);
}

/** 类型双语标签。 */
function typeLabel(type: UnifiedOrderType): string {
  return `${getOrderTypeTh(type)} / ${getOrderTypeZh(type)}`;
}

/** 持久化筛选条件。 */
function persistUi(): void {
  store.clientTypeFilter = typeFilter.value;
  store.orderKeyword = q.value;
  store.persist();
}

/** 类型3批次数组。 */
function monthlyBatches(row: VideoOrder): MonthlyBatchItem[] {
  return Array.isArray(row.batch_payload) ? row.batch_payload : [];
}

/** 类型3每月目标。 */
function monthlyTarget(row: VideoOrder): number {
  return Number((row.requirements as any)?.min_videos_per_month || 0) || 0;
}

/** 类型3已验收数量。 */
function monthlyAccepted(row: VideoOrder): number {
  return monthlyBatches(row).reduce((s, b) => s + Number(b.accepted_count || 0), 0);
}

/** 类型3已结算金额。 */
function monthlySettled(row: VideoOrder): number {
  return monthlyBatches(row).reduce((s, b) => s + Number(b.settled_amount || 0), 0);
}

/** 类型3合作月数。 */
function monthlyMonths(row: VideoOrder): number {
  return Number((row.requirements as any)?.contract_months || 0) || 0;
}

/** 详情规则标题。 */
const detailRuleTitle = computed(() => {
  if (!activeOrder.value) return "";
  if (activeOrder.value.type_id === "graded_video") return t("类型1：下单扣积分，取消/退款自动返还，固定备注不可编辑。");
  if (activeOrder.value.type_id === "high_quality_custom_video") return t("类型2：员工标记付款后，进入对接达人与多轮修改流程。");
  if (activeOrder.value.type_id === "monthly_package") return t("类型3：按周批次验收、分批结算，展示已验收/总数与结算记录。");
  return t("类型4：先审核后挂车发布，支持后台价格字段配置。");
});

/** 列表统计。 */
const stats = computed(() => {
  const list = filtered.value;
  const total = list.length;
  const amount = list.reduce((s, x) => s + Number(x.amount_thb || 0), 0);
  const completed = list.filter((x) => x.phase_text === "completed").length;
  const finishRate = total ? Number(((completed / total) * 100).toFixed(1)) : 0;
  const monthlySettledAll = list.filter((x) => x.kind === "offline" && x.type_id === "monthly_package").reduce((s, x) => s + monthlySettled(x.raw as VideoOrder), 0);
  return { total, amount: Number(amount.toFixed(2)), finishRate, monthlySettled: Number(monthlySettledAll.toFixed(2)) };
});

/** 合并订单源。 */
const unified = computed<UnifiedRow[]>(() => {
  const rows: UnifiedRow[] = [];
  for (const mo of marketOrders.value) {
    rows.push({ row_key: `m_${mo.id}`, kind: "market", type_id: "graded_video", order_no: mo.order_no, title: mo.title, amount_thb: Number(mo.reward_points_total || 0), payment_text: t("积分已扣"), phase_text: mo.status, raw: mo });
  }
  for (const o of offlineOrders.value) {
    rows.push({ row_key: `o_${o.id}`, kind: "offline", type_id: o.type_id as OfflineVideoOrderTypeId, order_no: `#${o.id}`, title: o.title, amount_thb: Number(o.amount_thb || 0), payment_text: o.payment_status, phase_text: o.phase, raw: o });
  }
  return rows.sort((a, b) => Number(String(b.order_no).replace(/\D/g, "")) - Number(String(a.order_no).replace(/\D/g, "")));
});

/** 应用筛选。 */
const filtered = computed(() => unified.value.filter((x) => (!typeFilter.value || x.type_id === typeFilter.value) && (!q.value.trim() || `${x.order_no} ${x.title}`.toLowerCase().includes(q.value.trim().toLowerCase()))));

/** 加载订单数据。 */
async function reloadAll(): Promise<void> {
  persistUi();
  loading.value = true;
  try {
    const [m, o] = await Promise.all([listClientMarketOrders(), listClientOfflineVideoOrders()]);
    marketOrders.value = m;
    offlineOrders.value = o;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : t("加载失败"));
  } finally {
    loading.value = false;
  }
}

/** 打开详情。 */
function openDetail(row: UnifiedRow): void {
  activeOrder.value = row;
  detailOpen.value = true;
}

onMounted(() => {
  void reloadAll();
});
</script>

<style scoped>
.page-wrap { padding: 14px 10px; }
.header-row { display: flex; gap: 12px; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
.title { font-size: 21px; font-weight: 800; color: #3d2a00; }
.filters { display: flex; gap: 10px; flex-wrap: wrap; }
.hc-thai { line-height: 1.9; }
:deep(.tag-gold){ background:#ffe082;color:#5d3a00;border-color:#ffb300;font-weight:700; }
:deep(.tag-yellow){ background:#fff59d;color:#5d4a00;border-color:#fbc02d;font-weight:700; }
:deep(.tag-purple){ background:#e1bee7;color:#4a148c;border-color:#ab47bc;font-weight:700; }
:deep(.tag-red){ background:#ffcdd2;color:#b71c1c;border-color:#ef5350;font-weight:700; }
.batch-box { margin-top: 12px; }
.batch-title { margin-bottom: 8px; font-weight: 700; color: #4a148c; }
.rule-alert { margin: 8px 0 12px; }
</style>
