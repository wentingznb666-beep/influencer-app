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

    <el-tab-pane label="合作视频单（三类）" name="coop">
      <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 12px; flex-wrap: wrap">
        <el-input v-model="coopQ" placeholder="搜索：订单号/标题" style="max-width: 360px" />
        <el-select v-model="coopType" placeholder="类型" style="width: 220px" clearable>
          <el-option label="high_quality_custom_video" value="high_quality_custom_video" />
          <el-option label="monthly_package" value="monthly_package" />
          <el-option label="creator_review_video" value="creator_review_video" />
        </el-select>
        <el-select v-model="coopPhase" placeholder="阶段" style="width: 200px" clearable>
          <el-option label="none" value="none" />
          <el-option label="assigned" value="assigned" />
          <el-option label="in_progress" value="in_progress" />
          <el-option label="submitted" value="submitted" />
          <el-option label="review_pending" value="review_pending" />
          <el-option label="approved_to_publish" value="approved_to_publish" />
          <el-option label="published" value="published" />
          <el-option label="completed" value="completed" />
        </el-select>
        <el-button @click="loadCoop" :loading="loadingCoop">刷新</el-button>
      </div>

      <el-table :data="coopOrders" stripe style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="order_no" label="订单号" width="180" />
        <el-table-column prop="cooperation_type_id" label="类型" width="220" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column prop="phase" label="阶段" width="150" />
        <el-table-column prop="client_name" label="商家" width="160" />
        <el-table-column prop="title" label="标题" min-width="240" />
        <el-table-column label="操作" width="520" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" v-if="row.status === 'open'" @click="onClaimCoop(row.id)" :loading="acting[`c${row.id}`]">接单</el-button>
            <el-button size="small" v-if="row.status === 'claimed'" @click="openSubmitCoop(row.id)" :loading="acting[`c${row.id}`]">提交交付</el-button>
            <el-button
              size="small"
              v-if="row.cooperation_type_id === 'creator_review_video' && row.phase === 'review_pending'"
              type="success"
              @click="onReview(row.id, 'approve')"
              :loading="acting[`c${row.id}`]"
            >
              审核通过
            </el-button>
            <el-button
              size="small"
              v-if="row.cooperation_type_id === 'creator_review_video' && row.phase === 'review_pending'"
              type="danger"
              @click="onReview(row.id, 'reject')"
              :loading="acting[`c${row.id}`]"
            >
              审核驳回
            </el-button>
            <el-button size="small" v-if="row.phase === 'approved_to_publish' || row.cooperation_type_id !== 'creator_review_video'" @click="openPublishCoop(row.id)" :loading="acting[`c${row.id}`]"
              >提交发布链接</el-button
            >
            <el-select v-model="phaseDraft[row.id]" placeholder="更新阶段" size="small" style="width: 160px" @change="(v: string) => onSetPhase(row.id, v)">
              <el-option label="assigned" value="assigned" />
              <el-option label="in_progress" value="in_progress" />
              <el-option label="submitted" value="submitted" />
              <el-option label="delivered" value="delivered" />
              <el-option label="completed" value="completed" />
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

  <el-dialog v-model="dialogCoopSubmit.open" title="提交交付链接" width="520px">
    <el-input v-model="dialogCoopSubmit.linksText" type="textarea" :rows="6" placeholder="每行一个链接" />
    <template #footer>
      <el-button @click="dialogCoopSubmit.open = false">取消</el-button>
      <el-button type="primary" :loading="dialogCoopSubmit.loading" @click="submitCoopProof">提交</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="dialogCoopPublish.open" title="提交发布链接" width="520px">
    <el-input v-model="dialogCoopPublish.link" placeholder="发布链接" />
    <template #footer>
      <el-button @click="dialogCoopPublish.open = false">取消</el-button>
      <el-button type="primary" :loading="dialogCoopPublish.loading" @click="submitCoopPublish">提交</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { claimMarketOrder, completeMarketOrder, listAdminOrders, publishMarketOrder, type AdminMarketOrder } from "@/api/employee";
import {
  claimAdminCooperationOrder,
  getAdminCooperationOrders,
  publishAdminCooperationOrder,
  reviewAdminCooperationOrder,
  setAdminCooperationOrderPhase,
  submitAdminCooperationOrderProof,
  type AdminCooperationOrder,
} from "@/api/cooperation";

const tab = ref<"market" | "coop">("market");

const marketOrders = ref<AdminMarketOrder[]>([]);
const loadingMarket = ref(false);
const marketQ = ref("");
const marketStatus = ref<string | undefined>();

const coopOrders = ref<AdminCooperationOrder[]>([]);
const loadingCoop = ref(false);
const coopQ = ref("");
const coopType = ref<string | undefined>();
const coopPhase = ref<string | undefined>();

const acting = reactive<Record<string | number, boolean>>({});
const phaseDraft = reactive<Record<number, string>>({});
const pollTimer = ref<number | null>(null);

const dialogMarketComplete = reactive({ open: false, orderId: 0, linksText: "", loading: false });
const dialogMarketPublish = reactive({ open: false, orderId: 0, link: "", loading: false });
const dialogCoopSubmit = reactive({ open: false, orderId: 0, linksText: "", loading: false });
const dialogCoopPublish = reactive({ open: false, orderId: 0, link: "", loading: false });

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

async function loadCoop() {
  if (loadingCoop.value) return;
  loadingCoop.value = true;
  try {
    const ret = await getAdminCooperationOrders({
      q: coopQ.value.trim() || undefined,
      type: coopType.value || undefined,
      phase: coopPhase.value || undefined,
      limit: 200,
    });
    coopOrders.value = ret.list;
    for (const o of ret.list) phaseDraft[o.id] = "";
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    loadingCoop.value = false;
  }
}

async function onClaimCoop(orderId: number) {
  const key = `c${orderId}`;
  acting[key] = true;
  try {
    await claimAdminCooperationOrder(orderId);
    ElMessage.success("已接单");
    await loadCoop();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "接单失败");
  } finally {
    acting[key] = false;
  }
}

function openSubmitCoop(orderId: number) {
  dialogCoopSubmit.open = true;
  dialogCoopSubmit.orderId = orderId;
  dialogCoopSubmit.linksText = "";
}

async function submitCoopProof() {
  const links = splitLinks(dialogCoopSubmit.linksText);
  if (!links.length) {
    ElMessage.error("请填写交付链接");
    return;
  }
  dialogCoopSubmit.loading = true;
  try {
    await submitAdminCooperationOrderProof(dialogCoopSubmit.orderId, links);
    ElMessage.success("已提交");
    dialogCoopSubmit.open = false;
    await loadCoop();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "提交失败");
  } finally {
    dialogCoopSubmit.loading = false;
  }
}

function openPublishCoop(orderId: number) {
  dialogCoopPublish.open = true;
  dialogCoopPublish.orderId = orderId;
  dialogCoopPublish.link = "";
}

async function submitCoopPublish() {
  if (!dialogCoopPublish.link.trim()) {
    ElMessage.error("请填写发布链接");
    return;
  }
  dialogCoopPublish.loading = true;
  try {
    await publishAdminCooperationOrder(dialogCoopPublish.orderId, dialogCoopPublish.link.trim());
    ElMessage.success("已提交");
    dialogCoopPublish.open = false;
    await loadCoop();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "提交失败");
  } finally {
    dialogCoopPublish.loading = false;
  }
}

async function onReview(orderId: number, action: "approve" | "reject") {
  const key = `c${orderId}`;
  const note =
    action === "reject"
      ? await ElMessageBox.prompt("请输入驳回原因（可留空）", "审核驳回", { confirmButtonText: "提交", cancelButtonText: "取消", inputType: "textarea" })
          .then((r) => String(r.value || "").trim())
          .catch(() => null)
      : "";
  if (action === "reject" && note === null) return;

  acting[key] = true;
  try {
    await reviewAdminCooperationOrder(orderId, { action, note: action === "reject" ? (note || undefined) : undefined });
    ElMessage.success("已提交审核结果");
    await loadCoop();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "操作失败");
  } finally {
    acting[key] = false;
  }
}

async function onSetPhase(orderId: number, phase: string) {
  const key = `c${orderId}`;
  acting[key] = true;
  try {
    await setAdminCooperationOrderPhase(orderId, phase);
    ElMessage.success("已更新");
    await loadCoop();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "更新失败");
  } finally {
    acting[key] = false;
    phaseDraft[orderId] = "";
  }
}

function isAnyDialogOpen(): boolean {
  return !!(dialogMarketComplete.open || dialogMarketPublish.open || dialogCoopSubmit.open || dialogCoopPublish.open);
}

async function pollOnce() {
  if (document.hidden) return;
  if (isAnyDialogOpen()) return;
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

