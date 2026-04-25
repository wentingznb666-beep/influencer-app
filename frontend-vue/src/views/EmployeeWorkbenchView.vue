<template>
  <el-tabs v-model="tab">
    <el-tab-pane label="分级视频（积分单）" name="market">
      <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 12px">
        <el-input v-model="marketQ" placeholder="搜索：订单号/标题/账号" style="max-width: 360px" />
        <el-select v-model="marketStatus" placeholder="状态" style="width: 160px" clearable>
          <el-option label="open" value="open" />
          <el-option label="claimed" value="claimed" />
          <el-option label="completed" value="completed" />
        </el-select>
        <el-button @click="loadMarket" :loading="loadingMarket">刷新</el-button>
      </div>

      <el-table :data="marketOrders" stripe style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="order_no" label="订单号" width="180" />
        <el-table-column prop="tier" label="档位" width="80" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column prop="client_shop_name" label="店铺" min-width="160" />
        <el-table-column prop="title" label="标题" min-width="220" />
        <el-table-column label="发布链接" min-width="220">
          <template #default="{ row }">
            <span v-if="row.publish_link">{{ row.publish_link }}</span>
            <span v-else style="color: #888">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="320" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" v-if="row.status === 'open'" @click="onClaimMarket(row.id)" :loading="acting[row.id]">接单</el-button>
            <el-button size="small" v-if="row.status === 'claimed'" @click="openCompleteMarket(row.id)" :loading="acting[row.id]">提交交付</el-button>
            <el-button size="small" v-if="row.status === 'completed'" @click="openPublishMarket(row.id)" :loading="acting[row.id]">提交发布链接</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-tab-pane>

    <el-tab-pane label="线下支付视频单（三类）" name="offline">
      <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 12px; flex-wrap: wrap">
        <el-input v-model="offlineQ" placeholder="搜索：标题/商家" style="max-width: 360px" />
        <el-select v-model="offlineType" placeholder="类型" style="width: 220px" clearable>
          <el-option label="high_quality_custom_video" value="high_quality_custom_video" />
          <el-option label="monthly_package" value="monthly_package" />
          <el-option label="creator_review_video" value="creator_review_video" />
        </el-select>
        <el-select v-model="offlinePhase" placeholder="阶段" style="width: 200px" clearable>
          <el-option label="created" value="created" />
          <el-option label="paid" value="paid" />
          <el-option label="assigned" value="assigned" />
          <el-option label="in_progress" value="in_progress" />
          <el-option label="review_pending" value="review_pending" />
          <el-option label="approved_to_publish" value="approved_to_publish" />
          <el-option label="published" value="published" />
          <el-option label="delivered" value="delivered" />
          <el-option label="completed" value="completed" />
        </el-select>
        <el-button @click="loadOffline" :loading="loadingOffline">刷新</el-button>
      </div>

      <el-table :data="offlineOrders" stripe style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="type_id" label="类型" width="220" />
        <el-table-column prop="payment_status" label="付款" width="110" />
        <el-table-column prop="phase" label="阶段" width="150" />
        <el-table-column prop="client_username" label="商家" width="160" />
        <el-table-column prop="title" label="标题" min-width="240" />
        <el-table-column label="操作" width="560" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              type="primary"
              v-if="isEmployee && !row.assigned_employee_id"
              @click="onClaimOffline(row.id)"
              :loading="acting[`o${row.id}`]"
            >
              接单
            </el-button>
            <el-button size="small" v-if="isEmployee && row.assigned_employee_id" @click="openSubmitOffline(row.id)" :loading="acting[`o${row.id}`]">
              提交交付
            </el-button>
            <el-button
              size="small"
              v-if="isAdmin && row.type_id === 'creator_review_video' && row.phase === 'review_pending'"
              type="success"
              @click="onReviewOffline(row.id, 'approve')"
              :loading="acting[`o${row.id}`]"
            >
              审核通过
            </el-button>
            <el-button
              size="small"
              v-if="isAdmin && row.type_id === 'creator_review_video' && row.phase === 'review_pending'"
              type="danger"
              @click="onReviewOffline(row.id, 'reject')"
              :loading="acting[`o${row.id}`]"
            >
              审核驳回
            </el-button>
            <el-button
              size="small"
              v-if="isEmployee && row.type_id === 'creator_review_video' && row.phase === 'approved_to_publish'"
              @click="openPublishOffline(row.id)"
              :loading="acting[`o${row.id}`]"
            >
              提交发布链接
            </el-button>
            <el-select
              v-if="isEmployee && row.assigned_employee_id"
              v-model="phaseDraft[row.id]"
              placeholder="更新阶段"
              size="small"
              style="width: 160px"
              @change="(v: string) => onSetOfflinePhase(row.id, v)"
            >
              <el-option label="in_progress" value="in_progress" />
              <el-option label="submitted" value="submitted" />
              <el-option label="delivered" value="delivered" />
            </el-select>
          </template>
        </el-table-column>
      </el-table>
    </el-tab-pane>
  </el-tabs>

  <el-dialog v-model="dialogMarketComplete.open" title="提交交付链接" width="520px">
    <el-input v-model="dialogMarketComplete.linksText" type="textarea" :rows="6" placeholder="每行一个链接" />
    <template #footer>
      <el-button @click="dialogMarketComplete.open = false">取消</el-button>
      <el-button type="primary" :loading="dialogMarketComplete.loading" @click="submitMarketComplete">提交</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="dialogMarketPublish.open" title="提交发布链接" width="520px">
    <el-input v-model="dialogMarketPublish.link" placeholder="发布链接" />
    <template #footer>
      <el-button @click="dialogMarketPublish.open = false">取消</el-button>
      <el-button type="primary" :loading="dialogMarketPublish.loading" @click="submitMarketPublish">提交</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="dialogOfflineSubmit.open" title="提交交付链接" width="520px">
    <el-input v-model="dialogOfflineSubmit.linksText" type="textarea" :rows="6" placeholder="每行一个链接" />
    <template #footer>
      <el-button @click="dialogOfflineSubmit.open = false">取消</el-button>
      <el-button type="primary" :loading="dialogOfflineSubmit.loading" @click="submitOfflineProof">提交</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="dialogOfflinePublish.open" title="提交发布链接" width="520px">
    <el-input v-model="dialogOfflinePublish.link" placeholder="发布链接" />
    <template #footer>
      <el-button @click="dialogOfflinePublish.open = false">取消</el-button>
      <el-button type="primary" :loading="dialogOfflinePublish.loading" @click="submitOfflinePublish">提交</el-button>
    </template>
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
  submitEmployeeOfflineVideoOrderProof,
  type OfflineVideoOrderTypeId,
  type VideoOrder,
} from "@/api/videoOrders";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const isAdmin = computed(() => auth.role === "admin");
const isEmployee = computed(() => auth.role === "employee");

const tab = ref<"market" | "offline">("market");

const marketOrders = ref<AdminMarketOrder[]>([]);
const loadingMarket = ref(false);
const marketQ = ref("");
const marketStatus = ref<string | undefined>();

const offlineOrders = ref<VideoOrder[]>([]);
const loadingOffline = ref(false);
const offlineQ = ref("");
const offlineType = ref<OfflineVideoOrderTypeId | undefined>();
const offlinePhase = ref<string | undefined>();

const acting = reactive<Record<string | number, boolean>>({});
const phaseDraft = reactive<Record<number, string>>({});
const pollTimer = ref<number | null>(null);

const dialogMarketComplete = reactive({ open: false, orderId: 0, linksText: "", loading: false });
const dialogMarketPublish = reactive({ open: false, orderId: 0, link: "", loading: false });
const dialogOfflineSubmit = reactive({ open: false, orderId: 0, linksText: "", loading: false });
const dialogOfflinePublish = reactive({ open: false, orderId: 0, link: "", loading: false });

function splitLinks(text: string): string[] {
  return String(text || "")
    .split(/\r?\n/g)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

async function loadMarket() {
  if (loadingMarket.value) return;
  loadingMarket.value = true;
  try {
    marketOrders.value = await listAdminOrders({ q: marketQ.value.trim() || undefined, status: marketStatus.value || undefined });
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    loadingMarket.value = false;
  }
}

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

function openCompleteMarket(orderId: number) {
  dialogMarketComplete.open = true;
  dialogMarketComplete.orderId = orderId;
  dialogMarketComplete.linksText = "";
}

async function submitMarketComplete() {
  const links = splitLinks(dialogMarketComplete.linksText);
  if (!links.length) {
    ElMessage.error("请填写交付链接");
    return;
  }
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

function openPublishMarket(orderId: number) {
  dialogMarketPublish.open = true;
  dialogMarketPublish.orderId = orderId;
  dialogMarketPublish.link = "";
}

async function submitMarketPublish() {
  if (!dialogMarketPublish.link.trim()) {
    ElMessage.error("请填写发布链接");
    return;
  }
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

async function loadOffline() {
  if (loadingOffline.value) return;
  loadingOffline.value = true;
  try {
    // 该页面同时用于 admin / employee，按角色选择不同接口（避免非员工“接单”能力）。
    const list = isAdmin.value
      ? await listAdminOfflineVideoOrders({
          q: offlineQ.value.trim() || undefined,
          type: offlineType.value,
          phase: offlinePhase.value,
          limit: 200,
        })
      : await listEmployeeOfflineVideoOrders({
          q: offlineQ.value.trim() || undefined,
          type: offlineType.value,
          phase: offlinePhase.value,
          limit: 200,
        });
    offlineOrders.value = list;
    for (const o of list) phaseDraft[o.id] = "";
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    loadingOffline.value = false;
  }
}

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

function openSubmitOffline(orderId: number) {
  dialogOfflineSubmit.open = true;
  dialogOfflineSubmit.orderId = orderId;
  dialogOfflineSubmit.linksText = "";
}

async function submitOfflineProof() {
  const links = splitLinks(dialogOfflineSubmit.linksText);
  if (!links.length) {
    ElMessage.error("请填写交付链接");
    return;
  }
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

function openPublishOffline(orderId: number) {
  dialogOfflinePublish.open = true;
  dialogOfflinePublish.orderId = orderId;
  dialogOfflinePublish.link = "";
}

async function submitOfflinePublish() {
  if (!dialogOfflinePublish.link.trim()) {
    ElMessage.error("请填写发布链接");
    return;
  }
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
    await reviewAdminOfflineVideoOrder(orderId, { action, note: action === "reject" ? (note || undefined) : undefined });
    ElMessage.success("已提交审核结果");
    await loadOffline();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "操作失败");
  } finally {
    acting[key] = false;
  }
}

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

function isAnyDialogOpen(): boolean {
  return !!(dialogMarketComplete.open || dialogMarketPublish.open || dialogOfflineSubmit.open || dialogOfflinePublish.open);
}

async function pollOnce() {
  if (document.hidden) return;
  if (isAnyDialogOpen()) return;
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

