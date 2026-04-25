<template>
  <el-tabs v-model="tab">
    <el-tab-pane label="分级视频（积分单）" name="market">
      <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 12px">
        <el-button @click="loadMarket" :loading="loadingMarket">刷新</el-button>
      </div>
      <el-table :data="marketOrders" stripe style="width: 100%">
        <el-table-column prop="order_no" label="订单号" width="180" />
        <el-table-column prop="tier" label="档位" width="80" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column prop="title" label="标题" min-width="260" />
        <el-table-column prop="publish_link" label="发布链接" min-width="260" />
      </el-table>
    </el-tab-pane>
    <el-tab-pane label="线下支付视频单（三类）" name="offline">
      <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 12px; flex-wrap: wrap">
        <el-button @click="loadOffline" :loading="loadingOffline">刷新</el-button>
        <el-select v-model="offlineType" clearable placeholder="类型" style="width: 240px" @change="loadOffline">
          <el-option label="高质量定制" value="high_quality_custom_video" />
          <el-option label="包月套餐" value="monthly_package" />
          <el-option label="Creator 带货测评" value="creator_review_video" />
        </el-select>
        <el-input v-model="offlineQ" placeholder="搜索标题" style="width: 260px" @keyup.enter="loadOffline" />
      </div>
      <el-table :data="offlineOrders" stripe style="width: 100%">
        <el-table-column prop="id" label="ID" width="90" />
        <el-table-column prop="type_id" label="类型" width="220" />
        <el-table-column prop="payment_status" label="付款" width="110" />
        <el-table-column prop="phase" label="阶段" width="150" />
        <el-table-column prop="title" label="标题" min-width="260" />
        <el-table-column prop="amount_thb" label="金额(฿)" width="120" />
        <el-table-column label="发布链接" min-width="260">
          <template #default="{ row }">
            <span v-if="publishLinkOfOffline(row)">{{ publishLinkOfOffline(row) }}</span>
            <span v-else style="color: #888">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="360" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              type="primary"
              :disabled="row.payment_status !== 'unpaid'"
              :loading="acting[row.id]"
              @click="markPaid(row.id)"
            >
              标记已付款
            </el-button>
            <el-button size="small" type="success" :disabled="!canAcceptOffline(row)" :loading="acting[row.id]" @click="acceptOffline(row.id)">
              验收通过
            </el-button>
            <el-button size="small" type="danger" :disabled="!canRejectOffline(row)" :loading="acting[row.id]" @click="rejectOffline(row.id)">
              验收驳回
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-tab-pane>
  </el-tabs>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { listClientMarketOrders, type ClientMarketOrder } from "@/api/client";
import {
  acceptClientOfflineVideoOrder,
  listClientOfflineVideoOrders,
  markClientOfflineVideoOrderPaid,
  rejectClientOfflineVideoOrder,
  type OfflineVideoOrderTypeId,
  type VideoOrder,
} from "@/api/videoOrders";

const tab = ref<"market" | "offline">("market");

const loadingMarket = ref(false);
const marketOrders = ref<ClientMarketOrder[]>([]);

const loadingOffline = ref(false);
const offlineOrders = ref<VideoOrder[]>([]);
const offlineType = ref<OfflineVideoOrderTypeId | "">("");
const offlineQ = ref("");

const acting = reactive<Record<number, boolean>>({});
const pollTimer = ref<number | null>(null);

function publishLinkOfOffline(row: VideoOrder): string {
  const links = row.publish_links;
  if (Array.isArray(links) && links.length) {
    const last = links[links.length - 1] as any;
    if (typeof last === "string") return last;
    if (last && typeof last === "object" && typeof (last as any).url === "string") return String((last as any).url);
  }
  return "";
}

function canAcceptOffline(row: VideoOrder): boolean {
  if (row.payment_status !== "paid") return false;
  if (row.phase === "completed") return false;
  if (row.type_id === "creator_review_video") return row.phase === "published";
  return row.phase === "delivered";
}

function canRejectOffline(row: VideoOrder): boolean {
  if (row.payment_status !== "paid") return false;
  if (row.phase === "completed") return false;
  return row.phase === "delivered" || row.phase === "published";
}

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

