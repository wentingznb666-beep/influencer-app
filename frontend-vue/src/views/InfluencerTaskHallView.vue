<template>
  <div class="page-wrap hc-thai">
    <div class="hero-card">
      <div class="header-row">
        <div>
          <div class="title">{{ t("任务大厅（撮合模式）") }} / {{ t("ศูนย์งาน (Matching)") }}</div>
          <div class="subtitle">
            {{ t("点击查看详情可完整查看商家发布表单；招募满员后自动拦截报名。") }} / {{ t("กดดูรายละเอียดเพื่อดูข้อมูลทั้งหมด และบล็อกการสมัครเมื่อเต็ม") }}
          </div>
        </div>
        <div class="filters">
          <el-button class="gold-btn" @click="load" :loading="loading">{{ t("รีเฟรช") }}</el-button>
        </div>
      </div>
    </div>

    <el-alert v-if="error" :title="error" type="error" show-icon class="err-bar" />

    <div v-if="!loading && !list.length" class="empty-card">
      <div class="empty-title">{{ t("暂无可报名任务") }} / {{ t("ยังไม่มีงานให้สมัคร") }}</div>
    </div>

    <div class="card-grid" v-loading="loading">
      <el-card v-for="item in list" :key="item.id" class="order-card" shadow="never">
        <template #header>
          <div class="card-header">
            <div class="card-title">{{ displayTaskTitle(item) }}</div>
            <div class="card-actions">
              <el-button size="small" @click="openDetail(item)">{{ t("查看详情") }} / {{ t("ดูรายละเอียด") }}</el-button>
            </div>
          </div>
        </template>

        <div class="kv">
          <div class="kv-row">
            <div class="k">{{ t("预估收益") }} / {{ t("รายได้โดยประมาณ") }}</div>
            <div class="v">{{ toMoney(item.task_amount) }}</div>
          </div>
          <div class="kv-row">
            <div class="k">{{ t("订单编号") }} / {{ t("เลขคำสั่งงาน") }}</div>
            <div class="v">{{ item.order_no || `#${item.id}` }}</div>
          </div>
          <div class="kv-row">
            <div class="k">{{ t("商家") }} / {{ t("ร้านค้า") }}</div>
            <div class="v">{{ item.client_name || item.client_username || "-" }}</div>
          </div>
          <div class="kv-row">
            <div class="k">{{ t("招募人数") }} / {{ t("จำนวนที่รับสมัคร") }}</div>
            <div class="v">{{ recruitTotal(item) || "-" }}</div>
          </div>
          <div class="kv-row">
            <div class="k">{{ t("已报名人数") }} / {{ t("สมัครแล้ว") }}</div>
            <div class="v">{{ appliedCount(item) }}</div>
          </div>
        </div>

        <div class="card-footer">
          <el-tag v-if="isFull(item)" type="warning" effect="dark" class="full-tag">
            {{ t("招募已满") }} / {{ t("เต็มแล้ว") }}
          </el-tag>

          <div class="apply-wrap">
            <el-button
              type="success"
              class="apply-btn"
              :disabled="isFull(item)"
              :loading="!!applyingMap[item.id]"
              @click="apply(item)"
            >
              {{ t("一键报名") }} / {{ t("สมัครทันที") }}
            </el-button>
            <div v-if="isFull(item)" class="apply-mask" @click="toastFull" />
          </div>
        </div>
      </el-card>
    </div>

    <el-dialog v-model="detailOpen" width="780px" :close-on-click-modal="true" align-center class="detail-dialog">
      <template #header>
        <div class="dlg-title">
          {{ t("订单详情") }} / {{ t("รายละเอียดคำสั่งงาน") }}
        </div>
      </template>

      <el-scrollbar max-height="65vh" class="detail-scroll">
        <div v-if="activeOrder" class="detail-body">
          <div class="detail-head">
            <div class="detail-main-title">{{ displayTaskTitle(activeOrder) }}</div>
            <div class="detail-sub">
              {{ t("订单编号") }} / {{ t("เลขคำสั่งงาน") }}：{{ activeOrder.order_no || `#${activeOrder.id}` }}
            </div>
            <div class="detail-sub">
              {{ t("预估收益") }} / {{ t("รายได้โดยประมาณ") }}：{{ toMoney(activeOrder.task_amount) }}
            </div>
          </div>

          <el-divider />

          <div class="section-title">{{ t("商家基础信息") }} / {{ t("ข้อมูลร้านค้า") }}</div>
          <el-descriptions :column="1" border class="desc">
            <el-descriptions-item :label="`${t('商家')} / ${t('ร้านค้า')}`">
              {{ activeOrder.client_name || activeOrder.client_username || "-" }}
            </el-descriptions-item>
            <el-descriptions-item :label="`${t('店铺名称')} / ${t('ชื่อร้าน')}`">
              {{ merchantInfo(activeOrder).shop_name || detailText(activeOrder, "merchant_shop_name") || "-" }}
            </el-descriptions-item>
            <el-descriptions-item :label="`${t('产品类型')} / ${t('ประเภทสินค้า')}`">
              {{ merchantInfo(activeOrder).product_type || detailText(activeOrder, "merchant_product_type") || "-" }}
            </el-descriptions-item>
            <el-descriptions-item :label="`${t('店铺链接')} / ${t('ลิงก์ร้าน')}`">
              <el-link v-if="merchantShopLink(activeOrder)" :href="merchantShopLink(activeOrder)" target="_blank" type="primary" :underline="false">
                {{ merchantShopLink(activeOrder) }}
              </el-link>
              <span v-else>-</span>
            </el-descriptions-item>
            <el-descriptions-item :label="`${t('销售概述')} / ${t('สรุปยอดขาย')}`">
              <div class="long-text">{{ detailText(activeOrder, "merchant_sales_summary") || "-" }}</div>
            </el-descriptions-item>
          </el-descriptions>

          <el-divider />

          <div class="section-title">{{ t("任务基础信息") }} / {{ t("ข้อมูลงานพื้นฐาน") }}</div>
          <el-descriptions :column="1" border class="desc">
            <el-descriptions-item :label="`${t('任务名称')} / ${t('ชื่องาน')}`">
              {{ detailText(activeOrder, "task_name") || displayTaskTitle(activeOrder) }}
            </el-descriptions-item>
            <el-descriptions-item :label="`${t('任务类型')} / ${t('ประเภทงาน')}`">
              {{ detailText(activeOrder, "task_type") || "-" }}
            </el-descriptions-item>
            <el-descriptions-item :label="`${t('行业')} / ${t('อุตสาหกรรม')}`">
              {{ detailText(activeOrder, "industry") || "-" }}
            </el-descriptions-item>
            <el-descriptions-item :label="`${t('任务开始时间')} / ${t('วันเริ่มงาน')}`">
              {{ detailText(activeOrder, "start_date") || "-" }}
            </el-descriptions-item>
            <el-descriptions-item :label="`${t('接单截止时间')} / ${t('วันปิดรับสมัคร')}`">
              {{ detailText(activeOrder, "order_deadline") || "-" }}
            </el-descriptions-item>
            <el-descriptions-item :label="`${t('内容发布截止时间')} / ${t('วันส่งผลงาน')}`">
              {{ detailText(activeOrder, "publish_deadline") || "-" }}
            </el-descriptions-item>
            <el-descriptions-item :label="`${t('招募人数')} / ${t('จำนวนที่รับสมัคร')}`">
              {{ recruitTotal(activeOrder) || "-" }}
            </el-descriptions-item>
            <el-descriptions-item :label="`${t('已报名人数')} / ${t('สมัครแล้ว')}`">
              {{ appliedCount(activeOrder) }}
            </el-descriptions-item>
          </el-descriptions>

          <el-divider />

          <div class="section-title">{{ t("合作内容要求") }} / {{ t("ข้อกำหนดการร่วมงาน") }}</div>
          <el-descriptions :column="1" border class="desc">
            <el-descriptions-item :label="`${t('推广产品/品牌')} / ${t('สินค้า/แบรนด์')}`">
              {{ detailText(activeOrder, "product_name") || "-" }}
            </el-descriptions-item>
            <el-descriptions-item :label="`${t('产品核心卖点')} / ${t('จุดขายหลัก')}`">
              <div class="long-text">{{ detailText(activeOrder, "selling_points") || "-" }}</div>
            </el-descriptions-item>
            <el-descriptions-item :label="`${t('内容形式')} / ${t('รูปแบบคอนเทนต์')}`">
              {{ detailText(activeOrder, "content_form") || "-" }}
            </el-descriptions-item>
            <el-descriptions-item :label="`${t('视频时长')} / ${t('ความยาววิดีโอ')}`">
              {{ detailText(activeOrder, "video_duration") || "-" }}
            </el-descriptions-item>
            <el-descriptions-item :label="`${t('文案要求')} / ${t('ข้อกำหนดคำบรรยาย')}`">
              <div class="long-text">{{ detailText(activeOrder, "copy_requirement") || "-" }}</div>
            </el-descriptions-item>
            <el-descriptions-item :label="`${t('必须包含元素')} / ${t('ต้องมี')}`">
              <div class="chips">
                <el-tag v-for="(x, idx) in arrayText(activeOrder, 'must_elements')" :key="`${idx}`" effect="plain">
                  {{ x }}
                </el-tag>
                <span v-if="!arrayText(activeOrder, 'must_elements').length">-</span>
              </div>
            </el-descriptions-item>
            <el-descriptions-item :label="`${t('禁用内容')} / ${t('ห้ามมี')}`">
              <div class="long-text">{{ detailText(activeOrder, "forbidden_content") || "-" }}</div>
            </el-descriptions-item>
          </el-descriptions>

          <el-divider />

          <div class="section-title">{{ t("样品说明") }} / {{ t("ตัวอย่างสินค้า") }}</div>
          <el-descriptions :column="1" border class="desc">
            <el-descriptions-item :label="`${t('是否提供样品')} / ${t('มีตัวอย่างไหม')}`">
              {{ boolText(detailValue(activeOrder, "provide_sample")) }}
            </el-descriptions-item>
            <el-descriptions-item :label="`${t('样品数量')} / ${t('จำนวนตัวอย่าง')}`">
              {{ detailText(activeOrder, "sample_count") || "-" }}
            </el-descriptions-item>
            <el-descriptions-item :label="`${t('样品是否回收')} / ${t('ต้องส่งคืนไหม')}`">
              {{ boolText(detailValue(activeOrder, "sample_recycle")) }}
            </el-descriptions-item>
            <el-descriptions-item :label="`${t('运费承担方')} / ${t('ผู้รับผิดชอบค่าส่ง')}`">
              {{ detailText(activeOrder, "freight_side") || "-" }}
            </el-descriptions-item>
          </el-descriptions>

          <el-divider />

          <div class="section-title">{{ t("发货与验收标准") }} / {{ t("มาตรฐานการส่งและรับงาน") }}</div>
          <el-descriptions :column="1" border class="desc">
            <el-descriptions-item :label="`${t('准时发布')} / ${t('โพสต์ตรงเวลา')}`">
              {{ boolText(detailValue(activeOrder, "standard_publish_on_time")) }}
            </el-descriptions-item>
            <el-descriptions-item :label="`${t('无违规')} / ${t('ไม่มีการละเมิด')}`">
              {{ boolText(detailValue(activeOrder, "standard_clear_no_violation")) }}
            </el-descriptions-item>
            <el-descriptions-item :label="`${t('内容保留天数')} / ${t('เก็บโพสต์กี่วัน')}`">
              {{ detailText(activeOrder, "keep_days") || "-" }}
            </el-descriptions-item>
            <el-descriptions-item :label="`${t('修改次数')} / ${t('จำนวนครั้งแก้ไข')}`">
              {{ detailText(activeOrder, "revise_times") || "-" }}
            </el-descriptions-item>
            <el-descriptions-item :label="`${t('不合格处理')} / ${t('ถ้าไม่ผ่าน')}`">
              {{ detailText(activeOrder, "unqualified_action") || "-" }}
            </el-descriptions-item>
          </el-descriptions>

          <el-divider />

          <div class="section-title">{{ t("平台规则 / 版权协议") }} / {{ t("กฎแพลตฟอร์ม / ลิขสิทธิ์") }}</div>
          <el-descriptions :column="1" border class="desc">
            <el-descriptions-item :label="`${t('授权可用于推广')} / ${t('อนุญาตให้ใช้โปรโมท')}`">
              {{ boolText(detailValue(activeOrder, "rights_granted")) }}
            </el-descriptions-item>
            <el-descriptions-item :label="`${t('禁止作弊')} / ${t('ห้ามโกง')}`">
              {{ boolText(detailValue(activeOrder, "no_cheat")) }}
            </el-descriptions-item>
            <el-descriptions-item :label="`${t('违规处理')} / ${t('ถ้าละเมิด')}`">
              {{ detailText(activeOrder, "violation_action") || "-" }}
            </el-descriptions-item>
          </el-descriptions>

          <el-divider />

          <div class="section-title">{{ t("结算信息") }} / {{ t("การชำระเงิน") }}</div>
          <el-descriptions :column="1" border class="desc">
            <el-descriptions-item :label="`${t('单条佣金')} / ${t('ค่าคอมต่อชิ้น')}`">
              {{ toMoney(detailValue(activeOrder, "unit_commission")) }}
            </el-descriptions-item>
          </el-descriptions>

          <el-divider />

          <div class="section-title">{{ t("附件") }} / {{ t("ไฟล์แนบ") }}</div>
          <div v-if="attachments(activeOrder).length" class="attachments">
            <div v-for="(url, idx) in attachments(activeOrder)" :key="`${idx}`" class="att-item">
              <img v-if="isImageUrl(url)" class="att-img" :src="url" />
              <video v-else-if="isVideoUrl(url)" class="att-video" :src="url" controls />
              <el-link v-else :href="url" target="_blank" type="primary" :underline="false">{{ url }}</el-link>
            </div>
          </div>
          <div v-else class="muted">-</div>

          <el-divider />

          <div class="section-title">{{ t("全部字段（原始数据）") }} / {{ t("ข้อมูลทั้งหมด (Raw)") }}</div>
          <pre class="raw-json">{{ rawDetailJson(activeOrder) }}</pre>
        </div>
      </el-scrollbar>

      <template #footer>
        <el-button @click="detailOpen = false">{{ t("ปิด") }} / {{ t("关闭") }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { fetchWithAuth, resolvePublicUploadUrl } from "@/api/fetchWithAuth";
import { readLocale, tr, type Locale } from "@/utils/i18n";

type HallItem = {
  id: number;
  order_no: string | null;
  title: string | null;
  task_amount: number | string | null;
  created_at: string;
  client_name?: string | null;
  client_username?: string | null;
  detail_json?: any;
  attachment_urls?: any;
  applied_count?: number | null;
};

const locale = ref<Locale>(readLocale());
const loading = ref(false);
const error = ref<string>("");
const list = ref<HallItem[]>([]);

const detailOpen = ref(false);
const activeOrder = ref<HallItem | null>(null);
const applyingMap = reactive<Record<number, boolean>>({});

function t(text: string): string {
  return tr(text, text, locale.value);
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    const res = await fetchWithAuth("/api/matching/influencer/matching-task-hall");
    const data = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) throw new Error(String(data?.message || data?.error || t("加载失败")));
    list.value = Array.isArray(data?.list) ? (data.list as HallItem[]) : [];
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("加载失败");
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load();
});

function openDetail(item: HallItem): void {
  activeOrder.value = item;
  detailOpen.value = true;
}

function displayTaskTitle(item: HallItem): string {
  const title = String(item.title || "").trim();
  const detailName = detailText(item, "task_name");
  return detailName || title || t("未命名");
}

function detailObj(item: HallItem): Record<string, unknown> {
  const d = (item as any)?.detail_json;
  return d && typeof d === "object" ? (d as Record<string, unknown>) : {};
}

function detailValue(item: HallItem, key: string): unknown {
  const d = detailObj(item);
  return (d as any)[key];
}

function detailText(item: HallItem, key: string): string {
  const v = detailValue(item, key);
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function arrayText(item: HallItem, key: string): string[] {
  const v = detailValue(item, key);
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x || "").trim()).filter(Boolean);
}

function merchantInfo(item: HallItem): { shop_name?: string; product_type?: string; shop_link?: string } {
  const v = detailValue(item, "merchant_info");
  if (!v || typeof v !== "object") return {};
  const o = v as any;
  return {
    shop_name: String(o.shop_name || "").trim() || undefined,
    product_type: String(o.product_type || "").trim() || undefined,
    shop_link: String(o.shop_link || "").trim() || undefined,
  };
}

function merchantShopLink(item: HallItem): string {
  const m = merchantInfo(item);
  const direct = String(m.shop_link || "").trim() || detailText(item, "merchant_shop_link");
  return direct ? resolvePublicUploadUrl(direct) : "";
}

function recruitTotal(item: HallItem): number {
  const n = Number(detailValue(item, "recruit_count") || 0);
  return Number.isFinite(n) ? n : 0;
}

function appliedCount(item: HallItem): number {
  const n = Number(item.applied_count || 0);
  return Number.isFinite(n) ? n : 0;
}

// 满员拦截：招募总数(recruit_count) <= 已报名人数(applied_count) 时，自动禁止报名
function isFull(item: HallItem): boolean {
  const total = recruitTotal(item);
  if (total <= 0) return false;
  return appliedCount(item) >= total;
}

function toastFull(): void {
  ElMessage.warning(t("招募数量已满"));
}

function toMoney(v: unknown): string {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return "-";
  return `${n}`;
}

function boolText(v: unknown): string {
  const s = String(v ?? "").trim();
  if (s === "是" || s === "true" || s === "1") return t("是");
  if (s === "否" || s === "false" || s === "0") return t("否");
  if (typeof v === "boolean") return v ? t("是") : t("否");
  return s || "-";
}

function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url);
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v|avi)(\?|$)/i.test(url);
}

function attachments(item: HallItem): string[] {
  const raw = (item as any)?.attachment_urls;
  const arr: unknown[] = Array.isArray(raw) ? (raw as unknown[]) : Array.isArray(raw?.urls) ? (raw.urls as unknown[]) : [];
  return arr.map((x: unknown) => resolvePublicUploadUrl(String(x || "").trim())).filter(Boolean);
}

function rawDetailJson(item: HallItem): string {
  // 保底兜底：弹窗末尾展示 Raw JSON，确保“商家发布表单里的全部字段”不会漏展示
  const d = detailObj(item);
  const payload = {
    ...d,
    recruit_total: recruitTotal(item),
    applied_count: appliedCount(item),
  };
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

async function apply(item: HallItem): Promise<void> {
  // 先做前端拦截：满员时直接提示，不发请求；避免出现“可点但后端报错”的体验
  if (isFull(item)) {
    toastFull();
    return;
  }
  applyingMap[item.id] = true;
  try {
    const res = await fetchWithAuth(`/api/matching/influencer/matching-orders/${item.id}/apply`, { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) throw new Error(String(data?.message || data?.error || t("报名失败")));
    ElMessage.success(t("报名成功"));
    await load();
  } catch (e) {
    const msg = e instanceof Error ? e.message : t("报名失败");
    if (String(msg).includes("招募数量已满")) toastFull();
    else ElMessage.error(msg);
  } finally {
    applyingMap[item.id] = false;
  }
}
</script>

<style scoped>
.page-wrap { display: flex; flex-direction: column; gap: 14px; }
.hero-card { background: #fff; border-radius: 14px; border: 1px solid #f4d08f; padding: 14px; }
.header-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.title { font-weight: 800; color: #4e342e; letter-spacing: 0.2px; }
.subtitle { margin-top: 4px; color: #6d4c41; font-size: 13px; }
.gold-btn { background: #fbc02d; border-color: #fbc02d; color: #4e342e; font-weight: 700; }
.err-bar { border-radius: 12px; }
.empty-card { background: #fff; border-radius: 14px; border: 1px dashed #f4d08f; padding: 22px; text-align: center; color: #6d4c41; }
.empty-title { font-weight: 700; }
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
.order-card { border-radius: 14px; border: 1px solid #f4d08f; background: #fff; }
.card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.card-title { font-weight: 800; color: #4e342e; line-height: 1.3; }
.kv { display: grid; gap: 8px; }
.kv-row { display: grid; grid-template-columns: 140px 1fr; gap: 10px; align-items: start; }
.k { color: #6d4c41; font-weight: 700; }
.v { color: #3e2723; word-break: break-word; }
.card-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 12px; flex-wrap: wrap; }
.full-tag { border-radius: 10px; }
.apply-wrap { position: relative; }
.apply-btn { font-weight: 800; border-radius: 10px; }
.apply-mask { position: absolute; inset: 0; cursor: not-allowed; }
.detail-dialog :deep(.el-dialog) { border-radius: 14px; overflow: hidden; }
.detail-body { display: flex; flex-direction: column; gap: 12px; }
.detail-head { background: #fffde7; border: 1px solid #f4d08f; border-radius: 12px; padding: 12px; }
.detail-main-title { font-weight: 900; color: #4e342e; }
.detail-sub { margin-top: 6px; color: #5d4037; }
.section-title { font-weight: 800; color: #4e342e; margin-bottom: 8px; }
.desc { border-radius: 12px; overflow: hidden; }
.long-text { white-space: pre-wrap; word-break: break-word; line-height: 1.55; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.attachments { display: grid; gap: 10px; }
.att-item { border: 1px solid #f4d08f; border-radius: 12px; padding: 10px; background: #fff; }
.att-img { width: 100%; max-height: 320px; object-fit: contain; border-radius: 10px; background: #fffef7; }
.att-video { width: 100%; max-height: 380px; border-radius: 10px; background: #000; }
.muted { color: #8d6e63; }
.raw-json { background: #1f2937; color: #e5e7eb; padding: 12px; border-radius: 12px; overflow: auto; font-size: 12px; line-height: 1.45; }
</style>
