<template>
  <el-tabs v-model="tab">
    <el-tab-pane label="分级视频（积分单）" name="market">
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px">
        <el-button @click="loadMarket" :loading="loadingMarket">刷新</el-button>
      </div>
      <el-table :data="marketOrders" stripe style="width:100%">
        <el-table-column prop="order_no" label="订单号" width="180" />
        <el-table-column prop="tier" label="档位" width="80" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column prop="title" label="标题" min-width="260" />
      </el-table>
    </el-tab-pane>

    <el-tab-pane label="视频订单（4类）" name="offline">
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
        <el-button @click="loadOffline" :loading="loadingOffline">刷新</el-button>
        <el-select v-model="offlineType" clearable placeholder="订单类型" style="width:240px" @change="loadOffline">
          <el-option label="② 高质量视频" value="high_quality_custom_video" />
          <el-option label="③ 包月合作套餐" value="monthly_package" />
          <el-option label="④ Creator带货测评" value="creator_review_video" />
        </el-select>
        <el-input v-model="offlineQ" placeholder="搜索标题" style="width:260px" @keyup.enter="loadOffline" />
      </div>

      <el-row :gutter="10" style="margin-bottom:10px">
        <el-col :span="6"><el-statistic title="订单总数" :value="stats.total" /></el-col>
        <el-col :span="6"><el-statistic title="总金额(THB)" :value="stats.amount" /></el-col>
        <el-col :span="6"><el-statistic title="完成率" :value="stats.finishRate" suffix="%" /></el-col>
        <el-col :span="6"><el-statistic title="包月已结算(THB)" :value="stats.monthlySettled" /></el-col>
      </el-row>

      <el-table :data="offlineOrders" stripe style="width:100%">
        <el-table-column prop="id" label="ID" width="90" />
        <el-table-column label="类型" width="180">
          <template #default="{ row }"><el-tag :type="tagType(row.type_id)">{{ typeText(row.type_id) }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="payment_status" label="付款" width="100" />
        <el-table-column prop="phase" label="阶段" width="130" />
        <el-table-column prop="title" label="标题" min-width="220" />
        <el-table-column prop="amount_thb" label="金额(฿)" width="120" />
        <el-table-column label="包月进度" min-width="220">
          <template #default="{ row }">
            <template v-if="row.type_id === 'monthly_package'">
              {{ monthlyAccepted(row) }}/{{ monthlyTarget(row) }} ｜ 已结算 {{ monthlySettled(row) }}฿
            </template>
            <span v-else style="color:#94a3b8">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="460" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openDetail(row)">详情</el-button>
            <el-button size="small" type="primary" :disabled="row.payment_status !== 'unpaid'" :loading="acting[row.id]" @click="markPaid(row.id)">标记已付款</el-button>
            <el-button size="small" type="success" :disabled="!canAcceptOffline(row)" :loading="acting[row.id]" @click="acceptOffline(row.id)">验收通过</el-button>
            <el-button size="small" type="danger" :disabled="!canRejectOffline(row)" :loading="acting[row.id]" @click="rejectOffline(row.id)">验收驳回</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-tab-pane>
  </el-tabs>

  <el-drawer v-model="detailOpen" title="订单详情" size="58%">
    <template v-if="activeOrder">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="订单ID">{{ activeOrder.id }}</el-descriptions-item>
        <el-descriptions-item label="订单类型">{{ typeText(activeOrder.type_id) }}</el-descriptions-item>
        <el-descriptions-item label="标题">{{ activeOrder.title }}</el-descriptions-item>
        <el-descriptions-item label="金额">{{ activeOrder.amount_thb }} ฿</el-descriptions-item>
        <el-descriptions-item label="付款状态">{{ activeOrder.payment_status }}</el-descriptions-item>
        <el-descriptions-item label="流程阶段">{{ activeOrder.phase }}</el-descriptions-item>
      </el-descriptions>

      <el-alert style="margin-top:12px" type="info" :closable="false" show-icon :title="detailRuleTitle" :description="detailRuleDesc" />

      <div v-if="activeOrder.type_id === 'monthly_package'" style="margin-top:12px">
        <div style="font-weight:700;margin-bottom:8px">批次验收 / 结算</div>
        <el-table :data="monthlyBatches(activeOrder)" border>
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

const tab = ref<"market" | "offline">("offline");
const loadingMarket = ref(false);
const marketOrders = ref<ClientMarketOrder[]>([]);
const loadingOffline = ref(false);
const offlineOrders = ref<VideoOrder[]>([]);
const offlineType = ref<OfflineVideoOrderTypeId | "">("");
const offlineQ = ref("");
const acting = reactive<Record<number, boolean>>({});
const pollTimer = ref<number | null>(null);

const detailOpen = ref(false);
const activeOrder = ref<VideoOrder | null>(null);
const batchAcceptOpen = ref(false);
const batchSettleOpen = ref(false);
const activeBatchNo = ref(0);
const batchAcceptedCount = ref(0);
const batchAcceptNote = ref("");
const batchSettledAmount = ref(0);
const batchLoading = ref(false);

/** 类型文本。 */
function typeText(type: OfflineVideoOrderTypeId): string {
  if (type === "high_quality_custom_video") return "② 高质量视频";
  if (type === "monthly_package") return "③ 包月合作套餐";
  return "④ Creator带货测评";
}

/** 类型标签颜色。 */
function tagType(type: OfflineVideoOrderTypeId): "success" | "warning" | "danger" {
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
  if (!activeOrder.value) return "";
  if (activeOrder.value.type_id === "high_quality_custom_video") return "高质量视频：可脚本/可露脸/支持1-2次修改";
  if (activeOrder.value.type_id === "monthly_package") return "包月合作：按周批次验收与结算";
  return "Creator测评：先审后发，支持TAP挂车";
});

/** 当前详情规则描述。 */
const detailRuleDesc = computed(() => {
  if (!activeOrder.value) return "";
  if (activeOrder.value.type_id === "high_quality_custom_video") return "流程：付款 → 员工对接Influencer拍摄 → 初稿交付 → 修改 → 定稿发布。";
  if (activeOrder.value.type_id === "monthly_package") return "要求：>=20条/月，前1-4条支持修改，交付成品+原始素材，商家自发。";
  return "流程：付款 → 对接Creator拍摄 → 审核通过 → 发布 → 结算。";
});

/** 列表统计信息。 */
const stats = computed(() => {
  const total = offlineOrders.value.length;
  const amount = offlineOrders.value.reduce((s, x) => s + Number(x.amount_thb || 0), 0);
  const completed = offlineOrders.value.filter((x) => x.phase === "completed").length;
  const finishRate = total > 0 ? Number(((completed / total) * 100).toFixed(1)) : 0;
  const monthlySettledTotal = offlineOrders.value.filter((x) => x.type_id === "monthly_package").reduce((s, x) => s + monthlySettled(x), 0);
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
  if (loadingMarket.value) return;
  loadingMarket.value = true;
  try {
    marketOrders.value = await listClientMarketOrders();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    loadingMarket.value = false;
  }
}

/** 加载线下订单并应用筛选。 */
async function loadOffline() {
  if (loadingOffline.value) return;
  loadingOffline.value = true;
  try {
    const list = await listClientOfflineVideoOrders();
    offlineOrders.value = list.filter((x) => {
      if (offlineType.value && x.type_id !== offlineType.value) return false;
      if (offlineQ.value.trim() && !String(x.title || "").toLowerCase().includes(offlineQ.value.trim().toLowerCase())) return false;
      return true;
    });
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    loadingOffline.value = false;
  }
}

/** 商家标记已付款。 */
async function markPaid(orderId: number) {
  acting[orderId] = true;
  try {
    await markClientOfflineVideoOrderPaid(orderId);
    ElMessage.success("已标记已付款");
    await loadOffline();
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
    await loadOffline();
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
    await loadOffline();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "驳回失败");
  } finally {
    acting[orderId] = false;
  }
}

/** 打开订单详情。 */
function openDetail(row: VideoOrder) {
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
  if (!activeOrder.value) return;
  batchLoading.value = true;
  try {
    await acceptClientMonthlyBatch(activeOrder.value.id, activeBatchNo.value, {
      accepted_count: batchAcceptedCount.value,
      note: batchAcceptNote.value.trim() || undefined,
    });
    batchAcceptOpen.value = false;
    ElMessage.success("批次已验收");
    await loadOffline();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "批次验收失败");
  } finally {
    batchLoading.value = false;
  }
}

/** 提交批次结算。 */
async function submitBatchSettle() {
  if (!activeOrder.value) return;
  batchLoading.value = true;
  try {
    await settleClientMonthlyBatch(activeOrder.value.id, activeBatchNo.value, {
      settled_amount: batchSettledAmount.value,
    });
    batchSettleOpen.value = false;
    ElMessage.success("批次已结算");
    await loadOffline();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "批次结算失败");
  } finally {
    batchLoading.value = false;
  }
}

/** 轮询更新当前标签页列表。 */
async function pollOnce() {
  if (document.hidden) return;
  if (tab.value === "market") return loadMarket();
  return loadOffline();
}

onMounted(() => {
  loadMarket();
  loadOffline();
  pollTimer.value = window.setInterval(pollOnce, 5000);
});

onBeforeUnmount(() => {
  if (pollTimer.value != null) {
    window.clearInterval(pollTimer.value);
    pollTimer.value = null;
  }
});
</script>
