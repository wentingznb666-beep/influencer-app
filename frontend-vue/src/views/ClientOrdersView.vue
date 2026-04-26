<template>
  <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 12px; flex-wrap: wrap">
    <div style="font-weight: 800; font-size: 18px">我的视频订单 / ออเดอร์ของฉัน</div>
    <el-button @click="loadAll" :loading="loading">刷新 / รีเฟรช</el-button>
    <el-select v-model="typeFilter" clearable placeholder="订单类型 / ประเภท" style="width: 260px">
      <el-option label="分级视频 / คลิปแบ่งเกรด" value="graded_video" />
      <el-option label="高质量 / วิดีโอคุณภาพสูง" value="high_quality_custom_video" />
      <el-option label="包月套餐 / แพ็กเกจรายเดือน" value="monthly_package" />
      <el-option label="测评带货 / รีวิวติดตะกร้า" value="creator_review_video" />
    </el-select>
    <el-input v-model="q" placeholder="搜索标题 / ค้นหา" style="width: 260px" @keyup.enter="loadAll" />
  </div>

  <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 12px; flex-wrap: wrap">
    <el-tag type="info">总数 {{ stats.total }}</el-tag>
    <el-tag type="warning">待付款 {{ stats.unpaid }}</el-tag>
    <el-tag type="success">已完成 {{ stats.completed }}</el-tag>
    <el-tag type="primary">总金额 {{ stats.amountThb }} ฿</el-tag>
  </div>

  <el-table :data="filtered" stripe style="width: 100%" @row-click="openDetail">
    <el-table-column label="订单" width="140">
      <template #default="{ row }">
        <span v-if="row.source === 'video'">#{{ row.id }}</span>
        <span v-else>{{ row.order_no }}</span>
      </template>
    </el-table-column>
    <el-table-column label="类型" width="180">
      <template #default="{ row }">
        <el-tag :type="tagType(row.type_id)" effect="dark">{{ typeLabel(row.type_id) }}</el-tag>
      </template>
    </el-table-column>
    <el-table-column label="付款" width="140">
      <template #default="{ row }">
        <span v-if="row.source === 'market'">已扣积分</span>
        <span v-else>{{ paymentLabel(row) }}</span>
      </template>
    </el-table-column>
    <el-table-column label="阶段/状态" width="160">
      <template #default="{ row }">
        <span>{{ row.source === 'market' ? row.status : row.phase }}</span>
      </template>
    </el-table-column>
    <el-table-column prop="title" label="标题" min-width="260" />
    <el-table-column label="金额" width="160">
      <template #default="{ row }">
        <span v-if="row.source === 'market'">{{ row.reward_points_total }} 积分</span>
        <span v-else>{{ row.amount_thb }} ฿</span>
      </template>
    </el-table-column>
    <el-table-column label="包月进度" width="220">
      <template #default="{ row }">
        <template v-if="row.source === 'video' && row.type_id === 'monthly_package'">
          <div>{{ row.monthly_accepted_count || 0 }}/{{ row.monthly_planned_count || 0 }}</div>
          <div style="color: #111; font-weight: 700">已结算 {{ row.monthly_settled_amount_thb || 0 }} ฿</div>
        </template>
        <span v-else style="color: #888">-</span>
      </template>
    </el-table-column>
    <el-table-column label="操作" width="380" fixed="right">
      <template #default="{ row }">
        <template v-if="row.source === 'video'">
          <el-button size="small" type="primary" :disabled="row.payment_method !== 'offline' || row.payment_status !== 'unpaid'" :loading="acting[row.id]" @click.stop="markPaid(row.id)">
            标记已付款
          </el-button>
          <el-button size="small" type="success" :disabled="!canAccept(row)" :loading="acting[row.id]" @click.stop="accept(row.id)">
            验收通过
          </el-button>
          <el-button size="small" type="danger" :disabled="!canReject(row)" :loading="acting[row.id]" @click.stop="reject(row.id)">
            验收驳回
          </el-button>
          <el-button size="small" :disabled="!canCancel(row)" :loading="acting[row.id]" @click.stop="cancel(row.id)">
            取消/退款
          </el-button>
        </template>
        <span v-else style="color: #888">点击查看详情</span>
      </template>
    </el-table-column>
  </el-table>

  <el-dialog v-model="detail.open" :title="detailTitle" width="980px">
    <template v-if="detail.row">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="类型">{{ typeLabel(detail.row.type_id) }}</el-descriptions-item>
        <el-descriptions-item label="标题">{{ detail.row.title }}</el-descriptions-item>
        <el-descriptions-item label="付款">{{ detail.row.source === 'video' ? paymentLabel(detail.row) : '已扣积分' }}</el-descriptions-item>
        <el-descriptions-item label="阶段/状态">{{ detail.row.source === 'video' ? detail.row.phase : detail.row.status }}</el-descriptions-item>
      </el-descriptions>

      <el-divider />

      <el-alert type="info" show-icon>
        <template #title>
          <div style="font-weight: 700">规则说明 / ข้อกำหนด</div>
        </template>
        <div style="line-height: 1.75; white-space: pre-wrap">{{ rulesText(detail.row) }}</div>
      </el-alert>

      <el-divider />

      <template v-if="detail.row.source === 'video'">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="需求(JSON)"><pre style="margin: 0; white-space: pre-wrap">{{ pretty(detail.row.requirements) }}</pre></el-descriptions-item>
          <el-descriptions-item label="交付链接">
            <div v-if="linksOf(detail.row.proof_links).length">
              <div v-for="u in linksOf(detail.row.proof_links)" :key="u">{{ u }}</div>
            </div>
            <span v-else style="color: #888">-</span>
          </el-descriptions-item>
          <el-descriptions-item label="发布链接">
            <div v-if="linksOf(detail.row.publish_links).length">
              <div v-for="u in linksOf(detail.row.publish_links)" :key="u">{{ u }}</div>
            </div>
            <span v-else style="color: #888">-</span>
          </el-descriptions-item>
          <el-descriptions-item label="审核备注">{{ detail.row.review_note || "-" }}</el-descriptions-item>
        </el-descriptions>
      </template>

      <template v-if="detail.row.source === 'video' && detail.row.type_id === 'monthly_package'">
        <el-divider />
        <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px; flex-wrap: wrap">
          <div style="font-weight: 800">批次验收 / ตรวจรับเป็นรอบ</div>
          <el-button @click="loadBatches" :loading="detail.loadingBatches">刷新批次</el-button>
        </div>

        <el-table :data="detail.batches" stripe style="width: 100%">
          <el-table-column prop="week_start" label="周开始" width="120" />
          <el-table-column prop="week_end" label="周结束" width="120" />
          <el-table-column prop="planned_count" label="计划" width="90" />
          <el-table-column prop="submitted_count" label="提交" width="90" />
          <el-table-column prop="accepted_count" label="已验收" width="90" />
          <el-table-column prop="status" label="状态" width="120" />
          <el-table-column label="结算" width="160">
            <template #default="{ row }">
              <span v-if="row.settlement_id">{{ row.settlement_status }} / {{ row.settlement_amount_thb }} ฿</span>
              <span v-else style="color: #888">-</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="280" fixed="right">
            <template #default="{ row }">
              <el-button size="small" type="success" :disabled="!(row.status === 'submitted' || row.status === 'pending')" :loading="detail.actingBatches[row.id]" @click="acceptBatch(row.id)">
                验收本批
              </el-button>
              <el-button
                size="small"
                type="primary"
                :disabled="!row.settlement_id || row.settlement_status !== 'pending'"
                :loading="detail.actingBatches[row.id]"
                @click="markSettlementPaid(row)"
              >
                标记已结算
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </template>

    <template #footer>
      <el-button @click="detail.open = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { listClientMarketOrders, type ClientMarketOrder } from "@/api/client";
import {
  acceptClientOfflineVideoOrder,
  acceptClientMonthlyBatch,
  cancelClientVideoOrder,
  listClientOfflineVideoOrders,
  listClientMonthlyBatches,
  markClientOfflineVideoOrderPaid,
  markClientMonthlySettlementPaid,
  rejectClientOfflineVideoOrder,
  type MonthlyBatch,
  type VideoOrder,
  type VideoOrderTypeId,
} from "@/api/videoOrders";

type Row =
  | (VideoOrder & { source: "video" })
  | (ClientMarketOrder & { source: "market"; type_id: "graded_video"; phase: string; payment_method: "points"; payment_status: "paid" });

const loading = ref(false);
const typeFilter = ref<VideoOrderTypeId | "">("");
const q = ref("");

const marketOrders = ref<ClientMarketOrder[]>([]);
const videoOrders = ref<VideoOrder[]>([]);

const acting = reactive<Record<number, boolean>>({});
const pollTimer = ref<number | null>(null);

const all = computed<Row[]>(() => {
  const v: Row[] = videoOrders.value.map((x) => ({ ...(x as any), source: "video" }));
  const m: Row[] = marketOrders.value.map((x) => ({ ...(x as any), source: "market", type_id: "graded_video", phase: x.status, payment_method: "points", payment_status: "paid" }));
  return [...v, ...m].sort((a: any, b: any) => {
    const at = new Date((a as any).created_at || (a as any).updated_at || 0).getTime();
    const bt = new Date((b as any).created_at || (b as any).updated_at || 0).getTime();
    return bt - at;
  });
});

const filtered = computed<Row[]>(() => {
  const t = typeFilter.value;
  const kw = q.value.trim().toLowerCase();
  return all.value.filter((r: any) => {
    if (t && r.type_id !== t) return false;
    if (kw && !String(r.title || "").toLowerCase().includes(kw)) return false;
    return true;
  });
});

const stats = computed(() => {
  const list = filtered.value as any[];
  const total = list.length;
  const unpaid = list.filter((x) => x.source === "video" && x.payment_method === "offline" && x.payment_status === "unpaid").length;
  const completed = list.filter((x) => (x.source === "video" ? x.phase === "completed" : x.status === "completed")).length;
  const amountThb = list
    .filter((x) => x.source === "video")
    .reduce((sum, x) => sum + Number(x.amount_thb || 0), 0);
  return { total, unpaid, completed, amountThb };
});

async function markPaid(orderId: number) {
  acting[orderId] = true;
  try {
    await markClientOfflineVideoOrderPaid(orderId);
    ElMessage.success("已标记已付款");
    await loadAll();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "操作失败");
  } finally {
    acting[orderId] = false;
  }
}

async function accept(orderId: number) {
  acting[orderId] = true;
  try {
    await acceptClientOfflineVideoOrder(orderId);
    ElMessage.success("已验收通过");
    await loadAll();
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
    await rejectClientOfflineVideoOrder(orderId, reason || "");
    ElMessage.success("已驳回");
    await loadAll();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "驳回失败");
  } finally {
    acting[orderId] = false;
  }
}

async function cancel(orderId: number) {
  const ok = await ElMessageBox.confirm("确认取消该订单？积分单将自动退款。", "取消订单", { confirmButtonText: "确认", cancelButtonText: "取消", type: "warning" })
    .then(() => true)
    .catch(() => false);
  if (!ok) return;
  acting[orderId] = true;
  try {
    await cancelClientVideoOrder(orderId);
    ElMessage.success("已取消");
    await loadAll();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "取消失败");
  } finally {
    acting[orderId] = false;
  }
}

function tagType(typeId: VideoOrderTypeId): "success" | "warning" | "info" | "primary" | "danger" {
  if (typeId === "graded_video") return "warning";
  if (typeId === "high_quality_custom_video") return "primary";
  if (typeId === "monthly_package") return "success";
  return "danger";
}

function typeLabel(typeId: VideoOrderTypeId): string {
  if (typeId === "graded_video") return "分级视频 / เกรด";
  if (typeId === "high_quality_custom_video") return "高质量 / คุณภาพสูง";
  if (typeId === "monthly_package") return "包月 / รายเดือน";
  return "测评带货 / รีวิว";
}

function paymentLabel(row: any): string {
  if (row.payment_method === "points") return row.payment_status === "refunded" ? "已退款" : "积分已扣";
  return row.payment_status === "paid" ? "已付款" : row.payment_status === "refunded" ? "已退款" : "未付款";
}

function canAccept(row: any): boolean {
  if (row.payment_status !== "paid") return false;
  if (row.phase === "completed") return false;
  if (row.type_id === "creator_review_video") return row.phase === "published";
  return row.phase === "delivered";
}

function canReject(row: any): boolean {
  if (row.payment_status !== "paid") return false;
  if (row.phase === "completed") return false;
  return row.phase === "delivered" || row.phase === "published";
}

function canCancel(row: any): boolean {
  if (row.payment_method !== "points") return false;
  if (row.payment_status !== "paid") return false;
  if (row.phase === "completed") return false;
  return true;
}

function linksOf(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : x && typeof x === "object" ? String((x as any).url || "") : "")).filter(Boolean);
  return [];
}

function pretty(v: any): string {
  try {
    return JSON.stringify(v ?? {}, null, 2);
  } catch {
    return String(v ?? "");
  }
}

function rulesText(row: any): string {
  if (row.type_id === "graded_video") {
    return "兼职仅负责拍摄剪辑，无TikTok账号、不发布视频，需到我方办公室拍摄；视频不露脸、不提供脚本、不支持修改。\nพนักงานพาร์ทไทม์รับผิดชอบเฉพาะถ่ายทำ/ตัดต่อ ไม่มีบัญชี TikTok และไม่โพสต์ ต้องมาถ่ายที่ออฟฟิศของเรา; ไม่โชว์หน้า ไม่ทำสคริปต์ และไม่รับแก้ไข";
  }
  if (row.type_id === "high_quality_custom_video") {
    return "可提供脚本/参考视频；可露脸；支持 1-2 次合理修改；Influencer 在 TikTok 发布，支持广告投放。\nสามารถให้สคริปต์/คลิปอ้างอิง โชว์หน้าได้ แก้ไขได้ 1-2 ครั้ง และโพสต์โดย Influencer";
  }
  if (row.type_id === "monthly_package") {
    return "单价 650฿/条；每月不少于 20 条；前 1-4 条可修改；交付包含成品+原始素材；商家自行发布；按周分批验收结算。\n650฿/คลิป อย่างน้อย 20 คลิป/เดือน แก้ได้ 1-4 คลิปแรก ส่งไฟล์สำเร็จ + ฟุตเทจ ร้านค้าโพสต์เอง ตรวจรับ/ชำระรายสัปดาห์";
  }
  return "8-10 条/单；可露脸；需 TikTok 发布并 TAP 挂车；先提交审核，通过后才可发布。\n8-10 คลิป/งาน โชว์หน้าได้ ต้องโพสต์ TikTok และติดตะกร้า ส่งตรวจอนุมัติก่อนโพสต์";
}

const detail = reactive({
  open: false,
  row: null as any,
  loadingBatches: false,
  batches: [] as MonthlyBatch[],
  actingBatches: {} as Record<number, boolean>,
});

const detailTitle = computed(() => {
  if (!detail.row) return "订单详情";
  return detail.row.source === "video" ? `订单详情 #${detail.row.id}` : `订单详情 ${detail.row.order_no}`;
});

function openDetail(row: any) {
  detail.open = true;
  detail.row = row;
  detail.batches = [];
  detail.actingBatches = {};
  if (row.source === "video" && row.type_id === "monthly_package") {
    loadBatches();
  }
}

async function loadBatches() {
  if (!detail.row) return;
  if (detail.loadingBatches) return;
  detail.loadingBatches = true;
  try {
    detail.batches = await listClientMonthlyBatches(detail.row.id);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    detail.loadingBatches = false;
  }
}

async function acceptBatch(batchId: number) {
  if (!detail.row) return;
  detail.actingBatches[batchId] = true;
  try {
    await acceptClientMonthlyBatch(detail.row.id, batchId);
    ElMessage.success("已验收");
    await loadBatches();
    await loadAll();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "验收失败");
  } finally {
    detail.actingBatches[batchId] = false;
  }
}

async function markSettlementPaid(b: MonthlyBatch) {
  if (!detail.row) return;
  if (!b.settlement_id) return;
  detail.actingBatches[b.id] = true;
  try {
    await markClientMonthlySettlementPaid(detail.row.id, Number(b.settlement_id));
    ElMessage.success("已结算");
    await loadBatches();
    await loadAll();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "结算失败");
  } finally {
    detail.actingBatches[b.id] = false;
  }
}

async function loadAll() {
  if (loading.value) return;
  loading.value = true;
  try {
    const [m, v] = await Promise.all([listClientMarketOrders().catch(() => [] as ClientMarketOrder[]), listClientOfflineVideoOrders()]);
    marketOrders.value = m;
    videoOrders.value = v;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    loading.value = false;
  }
}

async function pollOnce() {
  if (document.hidden) return;
  if (detail.open) return;
  return loadAll();
}

onMounted(() => {
  loadAll();
  pollTimer.value = window.setInterval(pollOnce, 5000);
});

onBeforeUnmount(() => {
  if (pollTimer.value != null) {
    window.clearInterval(pollTimer.value);
    pollTimer.value = null;
  }
});
</script>

