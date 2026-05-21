<template>
  <div class="page-wrap hc-thai">
    <div class="header-row">
      <div class="title">{{ t("ระบบออกคำสั่งวิดีโอ") }} / {{ t("视频订单发布") }}</div>
      <div class="header-actions">
        <el-select v-model="locale" style="width: 150px" @change="onLocaleChange">
          <el-option label="ไทย" value="th" />
          <el-option label="中文" value="zh" />
        </el-select>
        <el-button @click="loadTypes" :loading="loadingTypes">{{ t("รีเฟรช") }}</el-button>
      </div>
    </div>

    <el-form label-width="180px" class="roomy-form">
      <el-form-item :label="t('订单类型')">
        <el-radio-group v-model="typeId" class="type-radio-group">
          <el-radio label="graded_video">{{ typeLabel("graded_video") }}</el-radio>
          <el-radio label="high_quality_custom_video">{{ typeLabel("high_quality_custom_video") }}</el-radio>
          <el-radio label="monthly_package">{{ typeLabel("monthly_package") }}</el-radio>
          <el-radio label="creator_review_video">{{ typeLabel("creator_review_video") }}</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item :label="t('标题')">
        <el-input v-model="title" :placeholder="t('请输入订单标题（1-200）')" />
      </el-form-item>

      <template v-if="typeId === 'graded_video'">
        <el-form-item :label="t('分级档位')">
          <el-select v-model="tier" style="width: 240px">
            <el-option :label="`A（60积分/条）`" value="A" />
            <el-option :label="`B（40积分/条）`" value="B" />
            <el-option :label="`C（20积分/条）`" value="C" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('任务数量（条）')">
          <el-input-number v-model="taskCount" :min="1" :max="300" />
          <span class="inline-tip">{{ t("预计扣除积分") }}：{{ gradedTotalPoints }} ｜ {{ t("兼职结算") }}：{{ gradedSettlement }} THB</span>
        </el-form-item>
        <el-form-item :label="t('店铺名称')"><el-input v-model="shopName" /></el-form-item>
        <el-form-item :label="t('对接群聊')"><el-input v-model="groupChat" /></el-form-item>
        <el-form-item :label="t('发布方式')">
          <el-select v-model="publishMethod" style="width: 360px">
            <el-option :label="t('商家自行发布')" value="client_self_publish" />
            <el-option :label="t('Creator发布并挂车')" value="influencer_publish_with_cart" />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('固定备注（自动回填）')">
          <el-input :model-value="gradedFixedNotes" type="textarea" :rows="4" readonly />
        </el-form-item>
      </template>

      <template v-else-if="typeId === 'high_quality_custom_video'">
        <el-form-item :label="t('优质Influencer')"><el-input v-model="talentName" :placeholder="t('请选择或输入Influencer')" /></el-form-item>
        <el-form-item :label="t('单价区间(THB)')"><el-input :model-value="'4000-5000'" readonly /></el-form-item>
        <el-form-item :label="t('实际单价(THB)')"><el-input v-model="taskAmount" :placeholder="t('如：4000-5000 或按条报价')" /></el-form-item>
        <el-form-item :label="t('修改次数说明')"><el-input :model-value="t('支持1-2次修改，需在初稿后确认')" readonly /></el-form-item>
        <el-form-item :label="t('需求说明')"><el-input v-model="requirement" type="textarea" :rows="5" /></el-form-item>
      </template>

      <template v-else-if="typeId === 'monthly_package'">
        <el-form-item :label="t('合作周期（月）')"><el-input-number v-model="contractMonths" :min="1" :max="24" /></el-form-item>
        <el-form-item :label="t('每月视频数（>=20）')"><el-input-number v-model="monthlyMinVideos" :min="20" :max="300" /></el-form-item>
        <el-form-item :label="t('模特/Creator')"><el-input v-model="talentName" /></el-form-item>
        <el-form-item :label="t('分批验收配置')">
          <el-switch v-model="weeklyBatchEnabled" />
          <span class="inline-tip">{{ t("按周分批：待验收/已验收/已结算 + 周结算单") }}</span>
        </el-form-item>
        <el-form-item :label="t('单价(THB/条)')"><el-input v-model="taskAmount" placeholder="如：650" /></el-form-item>
        <el-form-item :label="t('补充要求')"><el-input v-model="requirement" type="textarea" :rows="4" /></el-form-item>
      </template>

      <template v-else>
        <el-form-item :label="t('Creator匹配')"><el-input v-model="talentName" :placeholder="t('可指定Creator或由系统匹配')" /></el-form-item>
        <el-form-item :label="t('任务条数（8-10）')"><el-input-number v-model="creatorTaskCount" :min="8" :max="10" /></el-form-item>
        <el-form-item :label="t('预留后台价格字段')"><el-input-number v-model="creatorBossPrice" :min="0" :precision="2" /></el-form-item>
        <el-form-item :label="t('前端展示价格(THB)')"><el-input v-model="taskAmount" placeholder="如：0 或面议" /></el-form-item>
        <el-form-item :label="t('审核说明')"><el-input :model-value="t('先审后发，审核通过后可挂车发布')" readonly /></el-form-item>
        <el-form-item :label="t('补充要求')"><el-input v-model="requirement" type="textarea" :rows="4" /></el-form-item>
      </template>

      <el-form-item>
        <el-popover
          placement="top"
          :width="320"
          trigger="hover"
          :disabled="validationErrors.length === 0"
        >
          <template #reference>
            <el-button
              type="primary"
              :loading="creating"
              :disabled="validationErrors.length > 0"
              @click="create"
            >
              {{ t("发布需求") }}
            </el-button>
          </template>
          <div style="color: #f56c6c; line-height: 1.8">
            <p
              v-for="(err, i) in validationErrors"
              :key="i"
              style="margin: 2px 0"
            >
              {{ err }}
            </p>
          </div>
        </el-popover>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { createClientMarketOrder } from "@/api/client";
import { getCooperationTypes } from "@/api/cooperation";
import { createClientOfflineVideoOrder, type OfflineVideoOrderTypeId } from "@/api/videoOrders";
import { calcGradedPoints, calcGradedSettlementThb, getOrderTypeTh, getOrderTypeZh } from "@/utils/videoOrderRules";
import { readLocale, tr, type Locale, writeLocale } from "@/utils/i18n";
import type { GradedTier, UnifiedOrderType } from "@/types/videoOrderExt";

const loadingTypes = ref(false);
const locale = ref<Locale>(readLocale());
const typeId = ref<UnifiedOrderType>("graded_video");
const title = ref("");
const tier = ref<GradedTier>("C");
const taskCount = ref(1);
const shopName = ref("");
const groupChat = ref("");
const publishMethod = ref<"client_self_publish" | "influencer_publish_with_cart">("client_self_publish");
const taskAmount = ref("4000");
const requirement = ref("");
const talentName = ref("");
const contractMonths = ref(1);
const monthlyMinVideos = ref(20);
const weeklyBatchEnabled = ref(true);
const creatorTaskCount = ref(8);
const creatorBossPrice = ref(0);
const creating = ref(false);

/** 国际化翻译入口（默认泰语）。 */
function t(text: string): string {
  return tr(text, text, locale.value);
}

/** 处理语言切换并持久化。 */
function onLocaleChange(v: Locale): void {
  writeLocale(v);
}

/** 订单类型双语标签。 */
function typeLabel(type: UnifiedOrderType): string {
  return `${getOrderTypeTh(type)} / ${getOrderTypeZh(type)}`;
}

watch(
  () => typeId.value,
  (v) => {
    if (v === "high_quality_custom_video") taskAmount.value = "4000";
    if (v === "monthly_package") taskAmount.value = "650";
    if (v === "creator_review_video") taskAmount.value = "0";
  },
  { immediate: true },
);

/** 类型1积分预估。 */
const gradedTotalPoints = computed(() => calcGradedPoints(tier.value, taskCount.value));

/** 类型1兼职结算预估。 */
const gradedSettlement = computed(() => calcGradedSettlementThb(tier.value, taskCount.value));

/** 类型1固定备注文案。 */
const gradedFixedNotes = computed(
  () =>
    "【固定规则】兼职仅拍摄剪辑，不提供账号发布；拍摄地点为办公室；不露脸、不供脚本、不支持修改；可选商家自发或Creator挂车发布。",
);

/** 实时校验错误列表（按钮 hover 时弹窗展示）。 */
const validationErrors = computed<string[]>(() => {
  const errors: string[] = [];

  if (!title.value.trim()) {
    errors.push(t("请填写标题"));
    return errors;
  }

  if (typeId.value === "graded_video") {
    if (!shopName.value.trim()) errors.push(t("请填写店铺名称"));
    if (!groupChat.value.trim()) errors.push(t("请填写对接群聊"));
    return errors;
  }

  if (typeId.value === "monthly_package" && monthlyMinVideos.value < 20) {
    errors.push(t("包月每月数量不能少于20"));
    return errors;
  }

  if (typeId.value === "creator_review_video" && (creatorTaskCount.value < 8 || creatorTaskCount.value > 10)) {
    errors.push(t("类型4任务条数需在8-10之间"));
    return errors;
  }

  return errors;
});

/** 加载合作类型配置。 */
async function loadTypes(): Promise<void> {
  loadingTypes.value = true;
  try {
    await getCooperationTypes();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : t("加载失败"));
  } finally {
    loadingTypes.value = false;
  }
}

/** 提交创建订单。 */
async function create(): Promise<void> {
  if (validationErrors.value.length > 0) return;
  creating.value = true;
  try {
    if (typeId.value === "graded_video") {
      const ret = await createClientMarketOrder({
        title: title.value.trim(),
        tier: tier.value,
        task_count: taskCount.value,
        client_shop_name: shopName.value.trim(),
        client_group_chat: groupChat.value.trim(),
        publish_method: publishMethod.value,
      });
      ElMessage.success(`${t("类型1订单创建成功")}：${ret.order_no}`);
      return;
    }

    const requirements: Record<string, unknown> = {
      requirement: requirement.value.trim(),
      selected_talent: talentName.value.trim() || null,
      contract_months: contractMonths.value,
      min_videos_per_month: monthlyMinVideos.value,
      weekly_batch_enabled: weeklyBatchEnabled.value,
      task_count: creatorTaskCount.value,
      creator_price_pending: creatorBossPrice.value,
      manual_payment_required: true,
    };

    if (typeId.value === "high_quality_custom_video") {
      requirements.price_range = taskAmount.value;
      requirements.revise_limit = "1-2";
    }
    if (typeId.value === "monthly_package") {
      requirements.acceptance_view = "accepted/total";
      requirements.batch_statuses = ["pending_acceptance", "accepted", "settled"];
    }
    if (typeId.value === "creator_review_video") {
      requirements.must_review_before_publish = true;
      requirements.publish_after_review = true;
      requirements.boss_price_field_reserved = true;
    }

    const ret = await createClientOfflineVideoOrder({
      type_id: typeId.value as OfflineVideoOrderTypeId,
      title: title.value.trim(),
      amount_thb: Number(taskAmount.value) || 0,
      requirements,
    });
    ElMessage.success(`${t("订单创建成功")} #${ret.id}`);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : t("创建失败"));
  } finally {
    creating.value = false;
  }
}

void loadTypes();
</script>

<style scoped>
.page-wrap { padding: 14px 10px; }
.header-row { display: flex; gap: 12px; align-items: center; margin-bottom: 14px; justify-content: space-between; flex-wrap: wrap; }
.header-actions { display: flex; gap: 10px; align-items: center; }
.title { font-weight: 800; font-size: 21px; color: #3d2a00; letter-spacing: 0.35px; }
.roomy-form :deep(.el-form-item__label) { line-height: 1.85; color: #3f2b00; font-weight: 700; }
.roomy-form :deep(.el-input__wrapper),
.roomy-form :deep(.el-textarea__inner),
.roomy-form :deep(.el-select__wrapper) { padding: 11px 12px; min-height: 44px; }
.type-radio-group { display: flex; gap: 8px; flex-wrap: wrap; }
.inline-tip { margin-left: 10px; color: #5b2a00; font-weight: 600; }
.hc-thai { line-height: 1.9; }
</style>
