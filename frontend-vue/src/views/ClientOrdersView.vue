﻿﻿<template>
  <div class="page-wrap">
    <div class="header-row">
      <div class="title">视频分级订单 / คำสั่งวิดีโอแบบแบ่งระดับ</div>
      <div class="filters">
        <el-button @click="reloadAll" :loading="loading">刷新</el-button>
        <el-select v-model="typeFilter" clearable placeholder="订单类型 / ประเภท" style="width: 260px">
          <el-option label="① 分级视频 A/B/C" value="graded_video" />
          <el-option label="② 高质量视频" value="high_quality_custom_video" />
          <el-option label="③ 包月合作套餐" value="monthly_package" />
          <el-option label="④ Creator带货测评" value="creator_review_video" />
        </el-select>
        <el-input v-model="q" placeholder="搜索：订单号/标题" style="width: 280px" @keyup.enter="reloadAll" />
      </div>
    </div>

    <el-row :gutter="10" style="margin-bottom: 10px">
      <el-col :span="6"><el-statistic title="订单总数" :value="stats.total" /></el-col>
      <el-col :span="6"><el-statistic title="总金额(THB)" :value="stats.amount" /></el-col>
      <el-col :span="6"><el-statistic title="完成率" :value="stats.finishRate" suffix="%" /></el-col>
      <el-col :span="6"><el-statistic title="包月已结算(THB)" :value="stats.monthlySettled" /></el-col>
    </el-row>

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
      <el-table-column prop="payment_text" label="付款/扣分" width="120" />
      <el-table-column prop="phase_text" label="状态" width="130" />
      <el-table-column prop="title" label="标题" min-width="220" />
      <el-table-column prop="amount_thb" label="金额(฿)" width="130">
        <template #default="{ row }">{{ formatAmount(row.amount_thb) }}</template>
      </el-table-column>
      <el-table-column label="包月进度" min-width="240">
        <template #default="{ row }">
          <template v-if="row.type_id === 'monthly_package' && row.kind === 'offline'">
            {{ monthlyAccepted(row.raw) }}/{{ monthlyTarget(row.raw) }} ｜ 已结算 {{ monthlySettled(row.raw) }}฿
          </template>
          <span v-else style="color: #94a3b8">-</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="480" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="openDetail(row)">详情</el-button>
          <template v-if="row.kind === 'offline'">
            <el-button size="small" type="primary" :disabled="row.raw.payment_status !== 'unpaid'" :loading="acting[row.raw.id]" @click="markPaid(row.raw.id)">标记已付款</el-button>
            <el-button size="small" type="success" :disabled="!canAcceptOffline(row.raw)" :loading="acting[row.raw.id]" @click="acceptOffline(row.raw.id)">验收通过</el-button>
            <el-button size="small" type="danger" :disabled="!canRejectOffline(row.raw)" :loading="acting[row.raw.id]" @click="rejectOffline(row.raw.id)">验收驳回</el-button>
          </template>
          <span v-else style="color: #64748b; font-size: 12px">积分单无需额外操作</span>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-drawer v-model="detailOpen" title="订单详情" size="58%">
    <template v-if="activeOrder">
      <template v-if="activeOrder.kind === 'market'">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="订单号">{{ activeOrder.order_no }}</el-descriptions-item>
          <el-descriptions-item label="订单类型">① 分级视频 A/B/C</el-descriptions-item>
          <el-descriptions-item label="标题">{{ activeOrder.raw.title }}</el-descriptions-item>
          <el-descriptions-item label="档位">{{ activeOrder.raw.tier }}</el-descriptions-item>
          <el-descriptions-item label="数量（条）">{{ activeOrder.raw.task_count }}</el-descriptions-item>
          <el-descriptions-item label="扣除积分">{{ activeOrder.raw.reward_points_total }}（≈{{ activeOrder.raw.reward_points_total }}฿）</el-descriptions-item>
          <el-descriptions-item label="发布方式">{{ activeOrder.raw.publish_method }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ activeOrder.raw.status }}</el-descriptions-item>
        </el-descriptions>
        <el-alert style="margin-top: 12px" type="info" :closable="false" show-icon title="分级视频：拍摄剪辑线下完成" description="兼职仅负责拍摄剪辑，无TikTok账号、不发布视频，需到我方办公室拍摄；视频不露脸、不提供脚本、不支持修改；发布方式可选：商家自行发布 / 我方Creator发布并通过TAP挂购物车。" />
      </template>

      <template v-else>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="订单ID">{{ activeOrder.raw.id }}</el-descriptions-item>
          <el-descriptions-item label="订单类型">{{ typeText(activeOrder.raw.type_id) }}</el-descriptions-item>
          <el-descriptions-item label="标题">{{ activeOrder.raw.title }}</el-descriptions-item>
          <el-descriptions-item label="金额">{{ activeOrder.raw.amount_thb }} ฿</el-descriptions-item>
          <el-descriptions-item label="付款状态">{{ activeOrder.raw.payment_status }}</el-descriptions-item>
          <el-descriptions-item label="流程阶段">{{ activeOrder.raw.phase }}</el-descriptions-item>
        </el-descriptions>

        <el-alert style="margin-top: 12px" type="info" :closable="false" show-icon :title="detailRuleTitle" :description="detailRuleDesc" />

        <div v-if="activeOrder.raw.type_id === 'monthly_package'" style="margin-top: 12px">
          <div style="font-weight: 700; margin-bottom: 8px">批次验收 / 结算</div>
          <el-table :data="monthlyBatches(activeOrder.raw)" border>
            <el-table-column prop="batch_no" label="批次" width="80" />
            <el-table-column prop="video_count" label="提交数量" width="120" />
            <el-table-column prop="accepted_count" label="验收数量" width="120" />
            <el-table-column prop="status" label="状态" width="150" />
            <el-table-column prop="settled_amount" label="结算金额(฿)" width="140" />
            <el-table-column label="操作" width="240">
              <template #default="{ row }">
                <el-button size="small" type="success" :disabled="row.status !== 'pending_acceptance'" @click="openBatchAccept(row.batch_no)">验收</el-button>
                <el-button size="small" type="primary" :disabled="row.status !== 'accepted'" @click="openBatchSettle(row.batch_no)">结算</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </template>
    </template>
  </el-drawer>

  <el-dialog v-model="batchAcceptOpen" title="批次验收" width="420px">
    <el-input-number v-model="batchAcceptedCount" :min="0" />
    <el-input v-model="batchAcceptNote" type="textarea" :rows="3" placeholder="验收备注（可选）" style="margin-top:8px" />
    <template #footer>
      <el-button @click="batchAcceptOpen = false">取消</el-button>
      <el-button type="primary" :loading="batchLoading" @click="submitBatchAccept">确认验收</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="batchSettleOpen" title="批次结算" width="420px">
    <el-input-number v-model="batchSettledAmount" :min="0" :precision="2" />
    <template #footer>
      <el-button @click="batchSettleOpen = false">取消</el-button>
      <el-button type="primary" :loading="batchLoading" @click="submitBatchSettle">确认结算</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { listClientMarketOrders, type ClientMarketOrder } from "@/api/client";
import {
  acceptClientMonthlyBatch,
  acceptClientOfflineVideoOrder,
  listClientOfflineVideoOrders,
  markClientOfflineVideoOrderPaid,
  rejectClientOfflineVideoOrder,
  settleClientMonthlyBatch,
  type MonthlyBatchItem,
  type OfflineVideoOrderTypeId,
  type VideoOrder,
} from "@/api/videoOrders";

type UnifiedTypeId = "graded_video" | OfflineVideoOrderTypeId;

type UnifiedMarketOrder = ClientMarketOrder & {
  reward_points_total: number;
};

type UnifiedRow =
  | {
      row_key: string;
      kind: "market";
      type_id: "graded_video";
      order_no: string;
      title: string;
      amount_thb: number;
      payment_text: string;
      phase_text: string;
      raw: UnifiedMarketOrder;
    }
  | {
      row_key: string;
      kind: "offline";
      type_id: OfflineVideoOrderTypeId;
      order_no: string;
      title: string;
      amount_thb: number;
      payment_text: string;
      phase_text: string;
      raw: VideoOrder;
    };

const loading = ref(false);
const marketOrders = ref<UnifiedMarketOrder[]>([]);
const offlineOrders = ref<VideoOrder[]>([]);
const typeFilter = ref<UnifiedTypeId | "">("");
const q = ref("");
const acting = reactive<Record<number, boolean>>({});
const pollTimer = ref<number | null>(null);

const detailOpen = ref(false);
const activeOrder = ref<UnifiedRow | null>(null);
const batchAcceptOpen = ref(false);
const batchSettleOpen = ref(false);
const activeBatchNo = ref(0);
const batchAcceptedCount = ref(0);
const batchAcceptNote = ref("");
const batchSettledAmount = ref(0);
const batchLoading = ref(false);

/** 类型文本。 */
function typeText(type: UnifiedTypeId): string {
  if (type === "graded_video") return "① 分级视频 A/B/C";
  if (type === "high_quality_custom_video") return "② 高质量视频";
  if (type === "monthly_package") return "③ 包月合作套餐";
  return "④ Creator带货测评";
}

/** 类型标签颜色。 */
function tagType(type: UnifiedTypeId): "success" | "warning" | "danger" | "info" {
  if (type === "graded_video") return "info";
  if (type === "high_quality_custom_video") return "success";
  if (type === "monthly_package") return "warning";
  return "danger";
}

/** 包月批次列表。 */
function monthlyBatches(row: VideoOrder): MonthlyBatchItem[] {
  return Array.isArray(row.batch_payload) ? row.batch_payload : [];
}

/** 包月目标数量。 */
function monthlyTarget(row: VideoOrder): number {
  const req = (row.requirements || {}) as Record<string, unknown>;
  return Number(req.min_videos_per_month || 0) || 0;
}

/** 包月已验收数量。 */
function monthlyAccepted(row: VideoOrder): number {
  return monthlyBatches(row).reduce((s, b) => s + Number(b.accepted_count || 0), 0);
}

/** 包月已结算金额。 */
function monthlySettled(row: VideoOrder): number {
  return monthlyBatches(row).reduce((s, b) => s + Number(b.settled_amount || 0), 0);
}

/** 当前详情规则标题。 */
const detailRuleTitle = computed(() => {
  if (!activeOrder.value || activeOrder.value.kind !== "offline") return "";
  if (activeOrder.value.raw.type_id === "high_quality_custom_video") return "高质量视频：可脚本/可露脸/支持1-2次修改";
  if (activeOrder.value.raw.type_id === "monthly_package") return "包月合作：按周批次验收与结算";
  return "Creator测评：先审后发，支持TAP挂车";
});

/** 当前详情规则描述。 */
const detailRuleDesc = computed(() => {
  if (!activeOrder.value || activeOrder.value.kind !== "offline") return "";
  if (activeOrder.value.raw.type_id === "high_quality_custom_video") return "流程：付款 → 员工对接Influencer拍摄 → 初稿交付 → 修改 → 定稿发布。";
  if (activeOrder.value.raw.type_id === "monthly_package") return "要求：>=20条/月，前1-4条支持修改，交付成品+原始素材，商家自发。";
  return "流程：付款 → 对接Creator拍摄 → 审核通过 → 发布 → 结算。";
});

/** 列表统计信息。 */
const stats = computed(() => {
  const list = filtered.value;
  const total = list.length;
  const amount = list.reduce((s, x) => s + Number(x.amount_thb || 0), 0);
  const completed = list.filter((x) => (x.kind === "market" ? x.raw.status === "completed" : x.raw.phase === "completed")).length;
  const finishRate = total > 0 ? Number(((completed / total) * 100).toFixed(1)) : 0;
  const monthlySettledTotal = list
    .filter((x) => x.kind === "offline" && x.type_id === "monthly_package")
    .reduce((s, x) => s + monthlySettled((x as any).raw), 0);
  return { total, amount: Number(amount.toFixed(2)), finishRate, monthlySettled: Number(monthlySettledTotal.toFixed(2)) };
});

/** 是否允许整单验收通过。 */
function canAcceptOffline(row: VideoOrder): boolean {
  if (row.payment_status !== "paid") return false;
  if (row.type_id === "monthly_package") return monthlyTarget(row) > 0 && monthlyAccepted(row) >= monthlyTarget(row);
  if (row.type_id === "creator_review_video") return row.phase === "published";
  return row.phase === "delivered";
}

/** 是否允许驳回。 */
function canRejectOffline(row: VideoOrder): boolean {
  if (row.payment_status !== "paid") return false;
  return row.phase === "delivered" || row.phase === "published";
}

/** 加载分级订单。 */
async function loadMarket() {
  try {
    const list = await listClientMarketOrders();
    marketOrders.value = list.map((x) => ({ ...x, reward_points_total: Number(x.reward_points || 0) * Math.max(Number(x.task_count || 1), 1) }));
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  }
}

/** 加载线下订单并应用筛选。 */
async function loadOffline() {
  try {
    const list = await listClientOfflineVideoOrders();
    offlineOrders.value = list;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  }
}

function normalizeText(v: unknown): string {
  return String(v || "").trim().toLowerCase();
}

function formatAmount(v: number): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "-";
  return n.toFixed(2);
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
      amount_thb: Number(mo.reward_points_total || 0),
      payment_text: "已扣积分",
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
      amount_thb: Number(o.amount_thb || 0),
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
  return unified.value.filter((row) => {
    if (tf && row.type_id !== tf) return false;
    if (!qq) return true;
    const hay = `${normalizeText(row.order_no)} ${normalizeText(row.title)}`;
    return hay.includes(qq);
  });
});

async function reloadAll() {
  if (loading.value) return;
  loading.value = true;
  try {
    await Promise.all([loadMarket(), loadOffline()]);
  } finally {
    loading.value = false;
  }
}

/** 商家标记已付款。 */
async function markPaid(orderId: number) {
  acting[orderId] = true;
  try {
    await markClientOfflineVideoOrderPaid(orderId);
    ElMessage.success("已标记已付款");
    await reloadAll();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "操作失败");
  } finally {
    acting[orderId] = false;
  }
}

/** 商家整单验收通过。 */
async function acceptOffline(orderId: number) {
  acting[orderId] = true;
  try {
    await acceptClientOfflineVideoOrder(orderId);
    ElMessage.success("已验收通过");
    await reloadAll();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "验收失败");
  } finally {
    acting[orderId] = false;
  }
}

/** 商家整单驳回。 */
async function rejectOffline(orderId: number) {
  const reason = await ElMessageBox.prompt("请输入驳回原因（可留空）", "验收驳回", { confirmButtonText: "提交", cancelButtonText: "取消", inputType: "textarea" })
    .then((r) => String(r.value || "").trim())
    .catch(() => null);
  if (reason === null) return;

  acting[orderId] = true;
  try {
    await rejectClientOfflineVideoOrder(orderId, reason || "");
    ElMessage.success("已驳回");
    await reloadAll();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "驳回失败");
  } finally {
    acting[orderId] = false;
  }
}

/** 打开订单详情。 */
function openDetail(row: UnifiedRow) {
  activeOrder.value = row;
  detailOpen.value = true;
}

/** 打开批次验收弹窗。 */
function openBatchAccept(batchNo: number) {
  activeBatchNo.value = batchNo;
  batchAcceptedCount.value = 0;
  batchAcceptNote.value = "";
  batchAcceptOpen.value = true;
}

/** 打开批次结算弹窗。 */
function openBatchSettle(batchNo: number) {
  activeBatchNo.value = batchNo;
  batchSettledAmount.value = 0;
  batchSettleOpen.value = true;
}

/** 提交批次验收。 */
async function submitBatchAccept() {
  if (!activeOrder.value || activeOrder.value.kind !== "offline") return;
  batchLoading.value = true;
  try {
    await acceptClientMonthlyBatch(activeOrder.value.raw.id, activeBatchNo.value, {
      accepted_count: batchAcceptedCount.value,
      note: batchAcceptNote.value.trim() || undefined,
    });
    batchAcceptOpen.value = false;
    ElMessage.success("批次已验收");
    await reloadAll();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "批次验收失败");
  } finally {
    batchLoading.value = false;
  }
}

/** 提交批次结算。 */
async function submitBatchSettle() {
  if (!activeOrder.value || activeOrder.value.kind !== "offline") return;
  batchLoading.value = true;
  try {
    await settleClientMonthlyBatch(activeOrder.value.raw.id, activeBatchNo.value, {
      settled_amount: batchSettledAmount.value,
    });
    batchSettleOpen.value = false;
    ElMessage.success("批次已结算");
    await reloadAll();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "批次结算失败");
  } finally {
    batchLoading.value = false;
  }
}

/** 轮询更新当前标签页列表。 */
async function pollOnce() {
  if (document.hidden) return;
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
