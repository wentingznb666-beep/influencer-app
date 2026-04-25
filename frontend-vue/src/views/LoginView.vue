<template>
  <div style="max-width: 420px; margin: 80px auto">
    <h2 style="margin: 0 0 16px">登录</h2>
    <el-form :model="form" @submit.prevent>
      <el-form-item label="用户名">
        <el-input v-model="form.username" autocomplete="username" />
      </el-form-item>
      <el-form-item label="密码">
        <el-input v-model="form.password" type="password" autocomplete="current-password" show-password />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="loading" @click="onLogin" style="width: 100%">登录</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { useAuthStore } from "@/stores/auth";

const router = useRouter();
const auth = useAuthStore();

const form = reactive({ username: "", password: "" });
const loading = ref(false);

async function onLogin() {
  if (!form.username.trim() || !form.password) {
    ElMessage.error("请输入用户名和密码");
    return;
  }
  loading.value = true;
  try {
    const user = await auth.login(form.username.trim(), form.password);
    if (user.role === "admin") router.replace("/admin");
    else if (user.role === "employee") router.replace("/employee");
    else if (user.role === "client") router.replace("/client");
    else router.replace("/login");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "登录失败");
  } finally {
    loading.value = false;
  }
}
</script>

