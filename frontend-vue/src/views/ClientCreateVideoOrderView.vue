<template>
  <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px; flex-wrap: wrap">
    <div style="font-weight: 800; font-size: 18px">发布视频订单 / สร้างออเดอร์วิดีโอ</div>
    <el-button @click="reloadPickers" :loading="loadingPickers">刷新列表 / รีเฟรช</el-button>
  </div>

  <el-form label-width="170px" style="max-width: 900px">
    <el-form-item label="订单类型 / ประเภท">
      <el-radio-group v-model="typeId" style="display: flex; gap: 14px; flex-wrap: wrap">
        <el-radio-button label="graded_video">分级视频 / คลิปแบ่งเกรด</el-radio-button>
        <el-radio-button label="high_quality_custom_video">高质量 / วิดีโอคุณภาพสูง</el-radio-button>
        <el-radio-button label="monthly_package">包月套餐 / แพ็กเกจรายเดือน</el-radio-button>
        <el-radio-button label="creator_review_video">测评带货 / รีวิวติดตะกร้า</el-radio-button>
      </el-radio-group>
    </el-form-item>

    <el-alert v-if="typeId === 'graded_video'" type="warning" show-icon style="margin-bottom: 12px">
      <template #title>
        <div style="font-weight: 700">下单即扣积分（1 积分 = 1 THB）/ หักพอยท์ทันที (1 พอยท์ = 1 บาท)</div>
      </template>
      <div style="line-height: 1.7">
        A：60 积分/条｜B：40 积分/条｜C：20 积分/条<br />
        兼职结算（参考）：A 15฿/条｜B 10฿/条｜C 5฿/条
      </div>
    </el-alert>

    <el-alert v-else type="info" show-icon style="margin-bottom: 12px">
      <template #title>
        <div style="font-weight: 700">支付方式：线下支付 / ชำระเงินออฟไลน์</div>
      </template>
      <div style="line-height: 1.7">创建后请到列表中标记“已付款”，员工端才可接单。</div>
    </el-alert>

    <el-form-item label="标题 / ชื่อออเดอร์">
      <el-input v-model="title" placeholder="1-200 字 / 1-200 ตัวอักษร" />
    </el-form-item>

    <template v-if="typeId === 'graded_video'">
      <el-form-item label="分级档位 / เกรด">
        <el-radio-group v-model="tier">
          <el-radio-button label="A">A</el-radio-button>
          <el-radio-button label="B">B</el-radio-button>
          <el-radio-button label="C">C</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="数量(条) / จำนวนคลิป">
        <el-input-number v-model="taskCount" :min="1" :max="100" />
        <div style="margin-left: 10px; font-weight: 700">扣除：{{ pointsTotal }} 积分</div>
      </el-form-item>

      <el-form-item label="店铺名称 / ชื่อร้าน">
        <el-input v-model="shopName" />
      </el-form-item>

      <el-form-item label="对接群聊 / กลุ่มแชท">
        <el-input v-model="groupChat" />
      </el-form-item>

      <el-form-item label="发布方式 / วิธีโพสต์">
        <el-select v-model="publishMethod" style="width: 360px">
          <el-option label="商家自行发布 / ร้านค้าโพสต์เอง" value="client_self_publish" />
          <el-option label="平台提供 Creator 发布并 TAP 挂车 / Creator โพสต์และติดตะกร้า" value="tap_creator_publish" />
        </el-select>
      </el-form-item>

      <el-form-item label="自动备注 / หมายเหตุอัตโนมัติ">
        <el-input v-model="autoNote" type="textarea" :rows="4" readonly />
      </el-form-item>
    </template>

    <template v-else-if="typeId === 'high_quality_custom_video'">
      <el-form-item label="Influencer / อินฟลูเอนเซอร์">
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap">
          <el-input v-model="influencerQ" placeholder="搜索 / ค้นหา" style="width: 260px" @keyup.enter="loadInfluencers" />
          <el-button @click="loadInfluencers" :loading="loadingInfluencers">搜索</el-button>
          <el-select v-model="selectedInfluencerId" filterable placeholder="选择 / เลือก" style="width: 360px">
            <el-option v-for="p in influencers" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
        </div>
      </el-form-item>

      <el-form-item label="单价(฿) / ราคาต่อคลิป">
        <el-input-number v-model="taskAmount" :min="4000" :max="5000" :precision="0" />
      </el-form-item>

      <el-form-item label="脚本/参考 / สคริปต์">
        <el-input v-model="requirement" type="textarea" :rows="4" placeholder="可填写脚本或参考视频链接 / ใส่สคริปต์หรือคลิปลิงก์อ้างอิง" />
      </el-form-item>
    </template>

    <template v-else-if="typeId === 'monthly_package'">
      <el-form-item label="合作周期(月) / ระยะเวลา(เดือน)">
        <el-select v-model="monthlyMonths" style="width: 220px">
          <el-option label="1" :value="1" />
          <el-option label="3" :value="3" />
          <el-option label="6" :value="6" />
        </el-select>
      </el-form-item>

      <el-form-item label="每月数量 / จำนวนต่อเดือน">
        <el-input-number v-model="monthlyCount" :min="20" :max="200" />
        <div style="margin-left: 10px; font-weight: 700">单价：650฿/条</div>
      </el-form-item>

      <el-form-item label="模特/Creator / โมเดล/Creator">
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap">
          <el-input v-model="modelQ" placeholder="搜索模特 / ค้นหาโมเดล" style="width: 260px" @keyup.enter="loadModels" />
          <el-button @click="loadModels" :loading="loadingModels">搜索</el-button>
          <el-select v-model="selectedModelId" filterable placeholder="选择模特 / เลือกโมเดล" style="width: 360px">
            <el-option v-for="m in models" :key="m.id" :label="m.name" :value="m.id" />
          </el-select>
        </div>
      </el-form-item>

      <el-form-item label="备注 / หมายเหตุ">
        <el-input v-model="requirement" type="textarea" :rows="4" placeholder="交付：成品视频+原始素材；前 1-4 条可修改 / ส่งไฟล์สำเร็จ + ฟุตเทจ; แก้ได้ 1-4 คลิปแรก" />
      </el-form-item>
    </template>

    <template v-else>
      <el-form-item label="Creator / Creator">
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap">
          <el-input v-model="creatorQ" placeholder="搜索 / ค้นหา" style="width: 260px" @keyup.enter="loadCreators" />
          <el-button @click="loadCreators" :loading="loadingCreators">搜索</el-button>
          <el-select v-model="selectedCreatorId" filterable clearable placeholder="可选：不选则平台匹配" style="width: 360px">
            <el-option v-for="p in creators" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
        </div>
      </el-form-item>

      <el-form-item label="数量(条) / จำนวนคลิป">
        <el-input-number v-model="creatorReviewCount" :min="8" :max="10" />
      </el-form-item>

      <el-form-item label="单价(฿) / ราคา">
        <el-input v-model="creatorPricePlaceholder" disabled />
      </el-form-item>

      <el-form-item label="备注 / หมายเหตุ">
        <el-input v-model="requirement" type="textarea" :rows="4" placeholder="需先提交审核，通过后才可发布 / ต้องส่งตรวจอนุมัติก่อนโพสต์" />
      </el-form-item>
    </template>

    <el-form-item>
      <el-button type="primary" :loading="creating" @click="create">创建订单 / สร้าง</el-button>
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { listClientModels, listClientShowcaseContentCreators, listClientShowcaseInfluencers } from "@/api/client";
import { createClientVideoOrder, type VideoOrderTypeId } from "@/api/videoOrders";

const typeId = ref<VideoOrderTypeId>("graded_video");
const title = ref("");

const tier = ref<"A" | "B" | "C">("C");
const taskCount = ref(1);
const shopName = ref("");
const groupChat = ref("");
const publishMethod = ref<"client_self_publish" | "tap_creator_publish">("client_self_publish");

const taskAmount = ref(4000);
const requirement = ref("");

const influencerQ = ref("");
const loadingInfluencers = ref(false);
const influencers = ref<Array<{ id: number; name: string }>>([]);
const selectedInfluencerId = ref<number | null>(null);

const creatorQ = ref("");
const loadingCreators = ref(false);
const creators = ref<Array<{ id: number; name: string }>>([]);
const selectedCreatorId = ref<number | null>(null);
const creatorReviewCount = ref(8);
const creatorPricePlaceholder = ref("待老板配置 / รอผู้ดูแลตั้งราคา");

const modelQ = ref("");
const loadingModels = ref(false);
const models = ref<Array<{ id: number; name: string }>>([]);
const selectedModelId = ref<number | null>(null);
const monthlyMonths = ref(1);
const monthlyCount = ref(20);

const loadingPickers = ref(false);
const creating = ref(false);

const pointsPerVideo = computed(() => (tier.value === "A" ? 60 : tier.value === "B" ? 40 : 20));
const pointsTotal = computed(() => pointsPerVideo.value * Math.max(1, Number(taskCount.value || 1)));

const autoNote = computed(() => {
  const zh = "兼职仅负责拍摄剪辑，无TikTok账号、不发布视频，需到我方办公室拍摄；视频不露脸、不提供脚本、不支持修改。";
  const th = "พนักงานพาร์ทไทม์รับผิดชอบเฉพาะถ่ายทำ/ตัดต่อ ไม่มีบัญชี TikTok และไม่โพสต์ ต้องมาถ่ายที่ออฟฟิศของเรา; ไม่โชว์หน้า ไม่ทำสคริปต์ และไม่รับแก้ไข";
  return `${zh}\n${th}`;
});

async function loadInfluencers() {
  if (loadingInfluencers.value) return;
  loadingInfluencers.value = true;
  try {
    const list = await listClientShowcaseInfluencers(influencerQ.value.trim() || undefined);
    influencers.value = list.map((x) => ({ id: x.id, name: x.name }));
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    loadingInfluencers.value = false;
  }
}

async function loadCreators() {
  if (loadingCreators.value) return;
  loadingCreators.value = true;
  try {
    const list = await listClientShowcaseContentCreators(creatorQ.value.trim() || undefined);
    creators.value = list.map((x) => ({ id: x.id, name: x.name }));
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    loadingCreators.value = false;
  }
}

async function loadModels() {
  if (loadingModels.value) return;
  loadingModels.value = true;
  try {
    const list = await listClientModels(modelQ.value.trim() || undefined);
    models.value = list.map((x) => ({ id: x.id, name: x.name }));
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    loadingModels.value = false;
  }
}

async function reloadPickers() {
  if (loadingPickers.value) return;
  loadingPickers.value = true;
  try {
    await Promise.all([loadInfluencers(), loadCreators(), loadModels()]);
  } finally {
    loadingPickers.value = false;
  }
}

async function create() {
  if (!title.value.trim()) {
    ElMessage.error("请填写标题");
    return;
  }
  creating.value = true;
  try {
    const req: Record<string, unknown> = {};

    if (typeId.value === "graded_video") {
      req.tier = tier.value;
      req.task_count = taskCount.value;
      req.client_shop_name = shopName.value.trim();
      req.client_group_chat = groupChat.value.trim();
      req.publish_method = publishMethod.value;
      req.auto_note = autoNote.value;
      const ret = await createClientVideoOrder({ type_id: "graded_video", title: title.value.trim(), amount_thb: 0, requirements: req });
      ElMessage.success(`已创建分级视频订单：#${ret.id}（已扣除 ${pointsTotal.value} 积分）`);
    } else if (typeId.value === "high_quality_custom_video") {
      if (!selectedInfluencerId.value) {
        ElMessage.error("请选择 Influencer");
        return;
      }
      req.showcase_influencer_id = selectedInfluencerId.value;
      req.script_or_reference = requirement.value.trim();
      req.revisions = 2;
      const ret = await createClientVideoOrder({
        type_id: "high_quality_custom_video",
        title: title.value.trim(),
        amount_thb: Number(taskAmount.value || 0),
        requirements: req,
      });
      ElMessage.success(`已创建高质量视频订单：#${ret.id}（请到列表中标记已付款）`);
    } else if (typeId.value === "monthly_package") {
      if (!selectedModelId.value) {
        ElMessage.error("请选择模特/Creator");
        return;
      }
      req.model_id = selectedModelId.value;
      req.months = monthlyMonths.value;
      req.monthly_count = monthlyCount.value;
      req.unit_price_thb = 650;
      req.note = requirement.value.trim();
      const total = Number(monthlyCount.value || 0) * 650 * Number(monthlyMonths.value || 1);
      const ret = await createClientVideoOrder({
        type_id: "monthly_package",
        title: title.value.trim(),
        amount_thb: total > 0 ? total : 0,
        requirements: req,
      });
      ElMessage.success(`已创建包月套餐订单：#${ret.id}（按周批次验收结算）`);
    } else {
      req.showcase_creator_id = selectedCreatorId.value || null;
      req.count = creatorReviewCount.value;
      req.note = requirement.value.trim();
      const ret = await createClientVideoOrder({ type_id: "creator_review_video", title: title.value.trim(), amount_thb: 0, requirements: req });
      ElMessage.success(`已创建测评带货订单：#${ret.id}（价格待配置；请到列表中标记已付款）`);
    }

    title.value = "";
    requirement.value = "";
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "创建失败");
  } finally {
    creating.value = false;
  }
}

watch(
  () => typeId.value,
  (v) => {
    if (v === "graded_video") {
      taskCount.value = Math.max(1, taskCount.value || 1);
      tier.value = tier.value || "C";
    } else if (v === "high_quality_custom_video") {
      taskAmount.value = 4000;
    } else if (v === "monthly_package") {
      monthlyCount.value = Math.max(20, monthlyCount.value || 20);
      monthlyMonths.value = monthlyMonths.value || 1;
    } else {
      creatorReviewCount.value = Math.max(8, creatorReviewCount.value || 8);
    }
  },
  { immediate: true }
);

reloadPickers();
</script>

