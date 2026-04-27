<template>
  <el-container class="layout-root">
    <el-aside width="250px" class="layout-aside">
      <div class="brand">视频订单ระบบ / Order Hub</div>
      <el-menu :default-active="active" @select="onSelect" class="side-menu">
        <template v-if="role === 'admin'">
          <el-menu-item :index="`/${role}/video-orders`">订单工作台</el-menu-item>
          <el-menu-item :index="`/${role}/cooperation-types`">合作类型配置</el-menu-item>
        </template>
        <template v-else-if="role === 'employee'">
          <el-menu-item :index="`/${role}/video-orders`">订单工作台</el-menu-item>
        </template>
        <template v-else-if="role === 'client'">
          <el-menu-item index="/client/video-orders">我的订单</el-menu-item>
          <el-menu-item index="/client/video-orders/create">发布订单</el-menu-item>
          <el-menu-item index="/client/merchant-template">商家模板</el-menu-item>
        </template>
      </el-menu>
      <div class="logout-box">
        <el-button class="logout-btn" @click="logout">退出登录</el-button>
      </div>
    </el-aside>
    <el-container>
      <el-header class="layout-header">
        <div class="header-title">{{ title || "视频订单管理" }}</div>
        <div class="header-user">{{ userText }}</div>
      </el-header>
      <el-main class="layout-main">
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

/** 处理左侧菜单跳转。 */
function onSelect(index: string): void {
  void router.push(index);
}

/** 执行退出登录。 */
function logout(): void {
  auth.logout();
  void router.replace("/login");
}
</script>

<style scoped>
.layout-root { min-height: 100vh; }
.layout-aside { border-right: 1px solid #fbc02d; background: #fffde7; }
.brand { padding: 14px 12px 10px; font-weight: 800; color: #4e342e; letter-spacing: 0.4px; }
.side-menu { border-right: none; --el-menu-hover-bg-color: #fff8e1; }
.logout-box { padding: 12px; }
.logout-btn { width: 100%; }
.layout-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #fbc02d; background: #fff8e1; }
.header-title { font-weight: 700; color: #4e342e; }
.header-user { color: #5d4037; }
.layout-main { padding: 16px; background: #fffef7; }
</style>
