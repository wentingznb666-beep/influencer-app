<template>
  <el-container style="min-height: 100vh">
    <el-aside width="240px" style="border-right: 1px solid #eee">
      <div style="padding: 12px 12px 8px; font-weight: 700">视频合作</div>
      <el-menu :default-active="active" @select="onSelect" style="border-right: none">
        <template v-if="role === 'admin'">
          <el-menu-item :index="`/${role}/video-orders`">视频订单工作台</el-menu-item>
          <el-menu-item :index="`/${role}/cooperation-types`">合作业务类型配置</el-menu-item>
        </template>
        <template v-else-if="role === 'employee'">
          <el-menu-item :index="`/${role}/video-orders`">视频订单工作台</el-menu-item>
        </template>
        <template v-else-if="role === 'client'">
          <el-menu-item index="/client/video-orders">我的视频订单</el-menu-item>
          <el-menu-item index="/client/video-orders/create">发布视频订单</el-menu-item>
          <el-menu-item index="/client/merchant-template">商家信息模板</el-menu-item>
        </template>
      </el-menu>
      <div style="padding: 12px">
        <el-button style="width: 100%" @click="logout">退出登录</el-button>
      </div>
    </el-aside>
    <el-container>
      <el-header style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #eee">
        <div style="font-weight: 600">{{ title }}</div>
        <div style="color: #666">{{ userText }}</div>
      </el-header>
      <el-main style="padding: 16px">
        <RouterView />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const role = computed(() => auth.user?.role || "");
const userText = computed(() => (auth.user ? `${auth.user.username}（${auth.user.role}）` : ""));
const active = computed(() => route.path);
const title = computed(() => String(route.meta?.title || ""));

function onSelect(index: string) {
  router.push(index);
}

function logout() {
  auth.logout();
  router.replace("/login");
}
</script>

