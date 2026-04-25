<template>
  <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px">
    <div style="font-weight: 700">合作业务类型配置</div>
    <el-button @click="load" :loading="loading">刷新</el-button>
    <el-button type="primary" @click="save" :disabled="!canEdit" :loading="saving">保存</el-button>
    <div v-if="!canEdit" style="color: #888">仅管理员/员工可编辑</div>
  </div>

  <el-alert v-if="error" type="error" :title="error" show-icon style="margin-bottom: 12px" />

  <el-collapse v-model="openIds">
    <el-collapse-item v-for="t in draft.types" :key="t.id" :name="t.id">
      <template #title>
        <span style="font-weight: 600">{{ t.name.zh }}（{{ t.id }}）</span>
      </template>
      <el-form label-width="120px">
        <el-form-item label="中文名称">
          <el-input v-model="t.name.zh" :disabled="!canEdit" />
        </el-form-item>
        <el-form-item label="泰语名称">
          <el-input v-model="t.name.th" :disabled="!canEdit" />
        </el-form-item>
        <el-form-item label="可见角色">
          <el-checkbox-group v-model="t.visible_roles" :disabled="!canEdit">
            <el-checkbox label="admin">admin</el-checkbox>
            <el-checkbox label="employee">employee</el-checkbox>
            <el-checkbox label="client">client</el-checkbox>
            <el-checkbox label="influencer">influencer</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="规格/规则(spec)">
          <el-input v-model="specText[t.id]" type="textarea" :rows="10" :disabled="!canEdit" />
          <div v-if="specErr[t.id]" style="color: #c00; margin-top: 6px">{{ specErr[t.id] }}</div>
        </el-form-item>
      </el-form>
    </el-collapse-item>
  </el-collapse>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { getCooperationTypes, updateCooperationTypes, type CooperationTypesConfig } from "@/api/cooperation";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const canEdit = computed(() => auth.user?.role === "admin" || auth.user?.role === "employee");

const loading = ref(false);
const saving = ref(false);
const error = ref("");

const draft = reactive<CooperationTypesConfig>({ version: 1, types: [] });
const specText = reactive<Record<string, string>>({});
const specErr = reactive<Record<string, string>>({});
const openIds = ref<string[]>([]);

function resetSpecState() {
  for (const k of Object.keys(specText)) delete specText[k];
  for (const k of Object.keys(specErr)) delete specErr[k];
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const ret = await getCooperationTypes();
    draft.version = 1;
    draft.types = ret.config.types.map((t) => ({
      id: t.id,
      name: { zh: t.name.zh, th: t.name.th },
      visible_roles: Array.isArray(t.visible_roles) ? [...t.visible_roles] : [],
      spec: t.spec || {},
    }));
    resetSpecState();
    for (const t of draft.types) {
      specText[t.id] = JSON.stringify(t.spec || {}, null, 2);
      specErr[t.id] = "";
    }
    openIds.value = draft.types.map((t) => t.id);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载失败";
  } finally {
    loading.value = false;
  }
}

function parseSpecOrMark(tid: string): Record<string, unknown> | null {
  const raw = specText[tid] || "";
  try {
    specErr[tid] = "";
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") {
      specErr[tid] = "spec 必须是 JSON 对象";
      return null;
    }
    return obj as Record<string, unknown>;
  } catch (e) {
    specErr[tid] = e instanceof Error ? e.message : "JSON 解析失败";
    return null;
  }
}

async function save() {
  if (!canEdit.value) return;
  for (const t of draft.types) {
    const parsed = parseSpecOrMark(t.id);
    if (!parsed) {
      ElMessage.error("请先修复 spec 的 JSON 格式错误");
      return;
    }
    t.spec = parsed;
  }

  saving.value = true;
  try {
    await updateCooperationTypes({ version: 1, types: draft.types });
    ElMessage.success("已保存");
    await load();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    saving.value = false;
  }
}

load();
</script>

