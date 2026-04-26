﻿<template>
  <div class="page-wrap">
    <div class="header-row">
      <div class="title">视频分级订单 / คำสั่งวิดีโอแบบแบ่งระดับ</div>
      <el-button @click="loadTypes" :loading="loadingTypes">刷新</el-button>
    </div>

    <el-form label-width="160px" style="max-width: 920px">
      <el-form-item label="订单类型">
        <el-radio-group v-model="typeId" class="type-radio-group">
          <el-radio-button label="graded_video">① 分级视频 A/B/C</el-radio-button>
          <el-radio-button label="high_quality_custom_video">② 高质量视频</el-radio-button>
          <el-radio-button label="monthly_package">③ 包月合作套餐</el-radio-button>
          <el-radio-button label="creator_review_video">④ Creator带货测评</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <el-alert type="info" :closable="false" show-icon>
        <template #title>{{ activeRuleTitle }}</template>
        <template #default>{{ activeRuleDesc }}</template>
      </el-alert>

      <el-form-item label="标题">
        <el-input v-model="title" placeholder="1-200 字" />
      </el-form-item>

      <template v-if="typeId === 'graded_video'">
        <el-form-item label="分级档位">
          <el-select v-model="tier" style="width: 220px">
            <el-option label="A（60积分/条）" value="A" />
            <el-option label="B（40积分/条）" value="B" />
            <el-option label="C（20积分/条）" value="C" />
          </el-select>
        </el-form-item>
        <el-form-item label="数量（条）">
          <el-input-number v-model="taskCount" :min="1" :max="200" />
          <span class="inline-tip">预计扣除积分：{{ gradedTotalPoints }}</span>
        </el-form-item>
        <el-form-item label="店铺名称"><el-input v-model="shopName" /></el-form-item>
        <el-form-item label="对接群聊"><el-input v-model="groupChat" /></el-form-item>
        <el-form-item label="发布方式">
          <el-select v-model="publishMethod" style="width: 360px">
            <el-option label="商家自行发布" value="client_self_publish" />
            <el-option label="我方Creator发布并TAP挂车" value="influencer_publish_with_cart" />
          </el-select>
        </el-form-item>
        <el-form-item label="固定备注">
          <el-input :model-value="gradedFixedNotes" type="textarea" :rows="4" readonly />
        </el-form-item>
      </template>

      <template v-else-if="typeId === 'high_quality_custom_video'">
        <el-form-item label="单价（THB）"><el-input-number v-model="taskAmount" :min="4000" :max="5000" :precision="2" /></el-form-item>
        <el-form-item label="选择Influencer"><el-input v-model="talentName" placeholder="输入已选优质Influencer" /></el-form-item>
        <el-form-item label="需求说明"><el-input v-model="requirement" type="textarea" :rows="5" placeholder="可填写脚本/参考视频/修改要求" /></el-form-item>
      </template>

      <template v-else-if="typeId === 'monthly_package'">
        <el-form-item label="合作周期（月）"><el-input-number v-model="contractMonths" :min="1" :max="12" /></el-form-item>
        <el-form-item label="每月条数（>=20）"><el-input-number v-model="monthlyMinVideos" :min="20" :max="200" /></el-form-item>
        <el-form-item label="单价（THB/条）"><el-input-number v-model="taskAmount" :min="650" :max="650" :precision="2" /></el-form-item>
        <el-form-item label="合作模特/Creator"><el-input v-model="talentName" placeholder="输入平台内已选模特/Creator" /></el-form-item>
        <el-form-item label="按周分批验收">
          <el-switch v-model="weeklyBatchEnabled" />
          <span class="inline-tip">默认按周生成批次，支持待验收/已验收/已结算</span>
        </el-form-item>
        <el-form-item label="补充要求"><el-input v-model="requirement" type="textarea" :rows="4" placeholder="前1-4条支持修改，交付成品+Footage" /></el-form-item>
      </template>

      <template v-else>
        <el-form-item label="单价（THB）"><el-input-number v-model="taskAmount" :min="1" :precision="2" /></el-form-item>
        <el-form-item label="Creator选择/匹配"><el-input v-model="talentName" placeholder="可填目标Creator，或留空由我方匹配" /></el-form-item>
        <el-form-item label="任务条数（8-10）"><el-input-number v-model="creatorTaskCount" :min="8" :max="10" /></el-form-item>
        <el-form-item label="老板定价字段"><el-input-number v-model="creatorBossPrice" :min="0" :precision="2" /></el-form-item>
        <el-form-item label="审核要求"><el-input v-model="requirement" type="textarea" :rows="4" placeholder="全部视频先审核，通过后再发布" /></el-form-item>
      </template>

      <el-form-item>
        <el-button type="primary" :loading="creating" @click="create">发布需求</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { ElMessage } from "element-plus";
import { createClientMarketOrder } from "@/api/client";
import { getCooperationTypes } from "@/api/cooperation";
import { createClientOfflineVideoOrder, type OfflineVideoOrderTypeId } from "@/api/videoOrders";

const loadingTypes = ref(false);
const typeId = ref<"graded_video" | OfflineVideoOrderTypeId>("graded_video");
const title = ref("");

const tier = ref<"A" | "B" | "C">("C");
const taskCount = ref(1);
const shopName = ref("");
const groupChat = ref("");
const publishMethod = ref<"client_self_publish" | "influencer_publish_with_cart">("client_self_publish");

const taskAmount = ref(4000);
const requirement = ref("");
const talentName = ref("");
const contractMonths = ref(1);
const monthlyMinVideos = ref(20);
const weeklyBatchEnabled = ref(true);
const creatorTaskCount = ref(8);
const creatorBossPrice = ref(0);

const creating = ref(false);

/** 计算分级视频预计积分。 */
const gradedTotalPoints = computed(() => {
  const unit = tier.value === "A" ? 60 : tier.value === "B" ? 40 : 20;
  return unit * Math.max(1, taskCount.value);
});

/** 固定业务备注文案。 */
const gradedFixedNotes = computed(
  () =>
    "兼职仅负责拍摄剪辑，无TikTok账号、不发布视频，需到我方办公室拍摄；\n视频不露脸、不提供脚本、不支持修改；\n发布方式可选：商家自行发布 / 我方Creator发布并通过TAP挂购物车（Creator仅负责发布挂车，不参与拍摄剪辑）。"
);

/** 当前类型规则标题。 */
const activeRuleTitle = computed(() => {
  if (typeId.value === "graded_video") return "分级视频：付款后直接进入制作中，按A/B/C扣积分";
  if (typeId.value === "high_quality_custom_video") return "高质量视频：4000-5000 THB/条，可脚本、可露脸、支持1-2次修改";
  if (typeId.value === "monthly_package") return "包月合作：650 THB/条，按周批次验收与结算，不少于20条/月";
  return "Creator带货测评：8-10条/次，先审后发，支持TAP挂购物车";
});

/** 当前类型规则说明。 */
const activeRuleDesc = computed(() => {
  if (typeId.value === "graded_video") return "A 60/B 40/C 20 积分每条（1积分=1THB），下单即扣；员工端可分配兼职并交付/发布。";
  if (typeId.value === "high_quality_custom_video") return "不扣积分，线下付款后进入员工对接Influencer流程：拍摄→初稿→修改→定稿发布。";
  if (typeId.value === "monthly_package") return "不扣积分，按周提交批次，支持待验收/已验收/已结算状态及结算金额追踪。";
  return "不扣积分，单价字段预留给老板后续配置；视频需先审核通过再发布。";
});

/** 加载合作类型配置。 */
async function loadTypes() {
  loadingTypes.value = true;
  try {
    await getCooperationTypes();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    loadingTypes.value = false;
  }
}

/** 创建订单并按类型路由至不同接口。 */
async function create() {
  if (!title.value.trim()) return ElMessage.error("请填写标题");
  creating.value = true;
  try {
    if (typeId.value === "graded_video") {
      if (!shopName.value.trim() || !groupChat.value.trim()) return ElMessage.error("请补全店铺名称与对接群聊");
      const ret = await createClientMarketOrder({
        title: title.value.trim(),
        tier: tier.value,
        task_count: taskCount.value,
        client_shop_name: shopName.value.trim(),
        client_group_chat: groupChat.value.trim(),
        publish_method: publishMethod.value,
      });
      ElMessage.success(`已创建分级订单：${ret.order_no}`);
    } else {
      if (typeId.value === "monthly_package" && monthlyMinVideos.value < 20) return ElMessage.error("包月订单每月不少于20条");
      const requirements: Record<string, unknown> = {
        requirement: requirement.value.trim(),
        selected_talent: talentName.value.trim() || null,
      };
      if (typeId.value === "high_quality_custom_video") {
        requirements.price_range = "4000-5000";
        requirements.flow = ["paid", "shooting", "draft", "revision", "published"];
      }
      if (typeId.value === "monthly_package") {
        requirements.contract_months = contractMonths.value;
        requirements.min_videos_per_month = monthlyMinVideos.value;
        requirements.weekly_batch_enabled = weeklyBatchEnabled.value;
        requirements.unit_price = 650;
      }
      if (typeId.value === "creator_review_video") {
        requirements.task_count = creatorTaskCount.value;
        requirements.creator_price_pending = creatorBossPrice.value;
        requirements.must_review_before_publish = true;
      }
      const ret = await createClientOfflineVideoOrder({
        type_id: typeId.value,
        title: title.value.trim(),
        amount_thb: taskAmount.value,
        requirements,
      });
      ElMessage.success(`已创建订单 #${ret.id}`);
    }

    title.value = "";
    requirement.value = "";
    talentName.value = "";
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "创建失败");
  } finally {
    creating.value = false;
  }
}

loadTypes();
</script>

<style scoped>
.page-wrap { padding: 8px 4px; }
.header-row { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
.title { font-weight: 700; font-size: 18px; letter-spacing: 0.2px; }
.type-radio-group { display: flex; flex-wrap: wrap; gap: 8px; }
.inline-tip { margin-left: 8px; color: #334155; font-size: 13px; }
</style>
