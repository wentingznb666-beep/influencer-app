<template>
  <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px">
    <div style="font-weight: 700">发布视频订单</div>
    <el-button @click="loadTypes" :loading="loadingTypes">刷新类型</el-button>
  </div>

  <el-form label-width="140px" style="max-width: 760px">
    <el-form-item label="项目类型">
      <el-select v-model="typeId" style="width: 360px">
        <el-option label="分级视频（graded_video）" value="graded_video" />
        <el-option label="高质量定制（high_quality_custom_video）" value="high_quality_custom_video" />
        <el-option label="包月合作（monthly_package）" value="monthly_package" />
        <el-option label="Creator 带货测评（creator_review_video）" value="creator_review_video" />
      </el-select>
    </el-form-item>

    <el-form-item label="标题">
      <el-input v-model="title" placeholder="1-200 字" />
    </el-form-item>

    <template v-if="typeId === 'graded_video'">
      <el-form-item label="分级档位">
        <el-select v-model="tier" style="width: 200px">
          <el-option label="A" value="A" />
          <el-option label="B" value="B" />
          <el-option label="C" value="C" />
        </el-select>
      </el-form-item>
      <el-form-item label="套数(task_count)">
        <el-input-number v-model="taskCount" :min="1" :max="100" />
      </el-form-item>
      <el-form-item label="店铺名称">
        <el-input v-model="shopName" />
      </el-form-item>
      <el-form-item label="对接群聊">
        <el-input v-model="groupChat" />
      </el-form-item>
      <el-form-item label="发布方式">
        <el-select v-model="publishMethod" style="width: 260px">
          <el-option label="商家自发(client_self_publish)" value="client_self_publish" />
          <el-option label="达人挂车(influencer_publish_with_cart)" value="influencer_publish_with_cart" />
        </el-select>
      </el-form-item>
    </template>

    <template v-else>
      <el-form-item label="金额(泰铢)">
        <el-input-number v-model="taskAmount" :min="1" :precision="2" />
      </el-form-item>
      <el-form-item label="要求/备注">
        <el-input v-model="requirement" type="textarea" :rows="4" />
      </el-form-item>
      <el-alert type="info" show-icon title="支付方式：仅线下支付。创建后请在订单列表中标记“已付款”，员工端才可接单。"></el-alert>
    </template>

    <el-form-item>
      <el-button type="primary" :loading="creating" @click="create">创建订单</el-button>
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ElMessage } from "element-plus";
import { createClientMarketOrder } from "@/api/client";
import { getCooperationTypes } from "@/api/cooperation";
import { createClientOfflineVideoOrder, type OfflineVideoOrderTypeId } from "@/api/videoOrders";

const loadingTypes = ref(false);
const typeId = ref<"graded_video" | "high_quality_custom_video" | "monthly_package" | "creator_review_video">("graded_video");
const title = ref("");

const tier = ref<"A" | "B" | "C">("C");
const taskCount = ref(1);
const shopName = ref("");
const groupChat = ref("");
const publishMethod = ref<"client_self_publish" | "influencer_publish_with_cart">("client_self_publish");

const taskAmount = ref(100);
const requirement = ref("");

const creating = ref(false);

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

async function create() {
  if (!title.value.trim()) {
    ElMessage.error("请填写标题");
    return;
  }
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
      ElMessage.success(`已创建：${ret.order_no}`);
    } else {
      const ret = await createClientOfflineVideoOrder({
        type_id: typeId.value as OfflineVideoOrderTypeId,
        title: title.value.trim(),
        amount_thb: taskAmount.value,
        requirements: { requirement: requirement.value.trim() },
      });
      ElMessage.success(`已创建线下支付订单：#${ret.id}（请到列表中标记已付款后，员工端才可接单）`);
    }
    title.value = "";
    requirement.value = "";
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "创建失败");
  } finally {
    creating.value = false;
  }
}

loadTypes();
</script>

