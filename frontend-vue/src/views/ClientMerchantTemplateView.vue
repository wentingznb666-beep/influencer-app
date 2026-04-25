<template>
  <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px">
    <div style="font-weight: 700">商家信息模板</div>
    <el-button @click="load" :loading="loading">刷新</el-button>
    <el-button type="primary" @click="save" :loading="saving">保存</el-button>
  </div>

  <el-form label-width="120px" style="max-width: 680px">
    <el-form-item label="店铺名称">
      <el-input v-model="form.shop_name" />
    </el-form-item>
    <el-form-item label="主营品类">
      <el-input v-model="form.product_type" />
    </el-form-item>
    <el-form-item label="店铺链接">
      <el-input v-model="form.shop_link" />
    </el-form-item>
    <el-form-item label="店铺评分">
      <el-input v-model="form.shop_rating" />
    </el-form-item>
    <el-form-item label="用户评价">
      <el-input v-model="form.user_reviews" type="textarea" :rows="4" />
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { getClientMerchantTemplate, saveClientMerchantTemplate, type MerchantTemplate } from "@/api/client";

const loading = ref(false);
const saving = ref(false);
const form = reactive<MerchantTemplate>({
  shop_name: "",
  product_type: "",
  shop_link: "",
  shop_rating: "",
  user_reviews: "",
});

async function load() {
  loading.value = true;
  try {
    const tpl = await getClientMerchantTemplate();
    if (tpl) Object.assign(form, tpl);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    await saveClientMerchantTemplate({ ...form });
    ElMessage.success("已保存");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    saving.value = false;
  }
}

load();
</script>

