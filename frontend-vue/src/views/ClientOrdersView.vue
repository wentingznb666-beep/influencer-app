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
    <el-tab-pane label="合作视频单（三类）" name="coop">
      <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 12px">
        <el-button @click="loadCoop" :loading="loadingCoop">刷新</el-button>
      </div>
      <el-table :data="coopOrders" stripe style="width: 100%">
        <el-table-column prop="order_no" label="订单号" width="180" />
        <el-table-column prop="cooperation_type_id" label="类型" width="220" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column prop="match_status" label="流转" width="140" />
        <el-table-column prop="coop_phase" label="阶段" width="150" />
        <el-table-column prop="title" label="标题" min-width="240" />
        <el-table-column label="发布链接" min-width="260">
          <template #default="{ row }">
            <span v-if="publishLinkOf(row)">{{ publishLinkOf(row) }}</span>
            <span v-else style="color: #888">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="success" :disabled="!canAccept(row)" :loading="acting[row.id]" @click="accept(row.id)">验收通过</el-button>
            <el-button size="small" type="danger" :disabled="!canReject(row)" :loading="acting[row.id]" @click="reject(row.id)">验收驳回</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-tab-pane>
  </el-tabs>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  acceptClientMatchingOrder,
  listClientMarketOrders,
  listClientMatchingOrders,
  rejectClientMatchingOrder,
  type ClientMarketOrder,
  type ClientMatchingOrder,
} from "@/api/client";

const tab = ref<"market" | "coop">("market");

const loadingMarket = ref(false);
const marketOrders = ref<ClientMarketOrder[]>([]);

const loadingCoop = ref(false);
const coopOrders = ref<ClientMatchingOrder[]>([]);

const acting = reactive<Record<number, boolean>>({});
const pollTimer = ref<number | null>(null);

function publishLinkOf(row: ClientMatchingOrder): string {
  const links = row.coop_publish_links;
  if (Array.isArray(links) && links.length) return String(links[links.length - 1] || "");
  return "";
}

function canAccept(row: ClientMatchingOrder): boolean {
  if (row.match_status === "completed") return false;
  if (row.status !== "completed") return false;
  if (row.cooperation_type_id === "creator_review_video" && row.coop_phase !== "published") return false;
  return true;
}

function canReject(row: ClientMatchingOrder): boolean {
  if (row.match_status === "completed") return false;
  if (row.status !== "completed") return false;
  return true;
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

async function loadCoop() {
  if (loadingCoop.value) return;
  loadingCoop.value = true;
  try {
    coopOrders.value = await listClientMatchingOrders();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    loadingCoop.value = false;
  }
}

async function accept(orderId: number) {
  acting[orderId] = true;
  try {
    await acceptClientMatchingOrder(orderId);
    ElMessage.success("已验收通过");
    await loadCoop();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "验收失败");
  } finally {
    acting[orderId] = false;
  }
}

async function reject(orderId: number) {
  const reason = await ElMessageBox.prompt("请输入驳回原因（可留空）", "验收驳回", { confirmButtonText: "提交", cancelButtonText: "取消", inputType: "textarea" })
    .then((r) => String(r.value || "").trim())
    .catch(() => null);
  if (reason === null) return;

  acting[orderId] = true;
  try {
    await rejectClientMatchingOrder(orderId, reason || "");
    ElMessage.success("已驳回");
    await loadCoop();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "驳回失败");
  } finally {
    acting[orderId] = false;
  }
}

async function pollOnce() {
  if (document.hidden) return;
  if (tab.value === "market") return loadMarket();
  return loadCoop();
}

onMounted(() => {
  loadMarket();
  loadCoop();
  pollTimer.value = window.setInterval(pollOnce, 5000);
});

onBeforeUnmount(() => {
  if (pollTimer.value != null) {
    window.clearInterval(pollTimer.value);
    pollTimer.value = null;
  }
});
</script>

