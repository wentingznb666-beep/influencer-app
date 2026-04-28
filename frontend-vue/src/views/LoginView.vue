<template>
  <div class="page" :class="{ ready: ready }">
    <main class="content">
      <section class="hero">
        <div class="hero-bg" />
        <div class="container hero-inner">
          <div class="brand">
            <div class="brand-badge">
              <div class="badge-dot" />
              <div class="badge-text">Employee Portal</div>
            </div>
            <h1 class="brand-title">Xiang Tai Shopping Co.,Ltd.</h1>
            <div class="brand-subtitle">Business · TikTok E-commerce · Digital Marketing</div>
            <div class="brand-points">
              <div class="point">
                <div class="point-k">主题</div>
                <div class="point-v">蓝色 + 橙色商务风</div>
              </div>
              <div class="point">
                <div class="point-k">能力</div>
                <div class="point-v">运营 / 直播 / 广告 / 短视频</div>
              </div>
              <div class="point">
                <div class="point-k">定位</div>
                <div class="point-v">TikTok 泰国头部先锋卖家</div>
              </div>
            </div>
          </div>

          <el-card class="login-card" shadow="always">
            <div class="login-header">
              <div class="login-title">登录</div>
              <div class="login-desc">欢迎回来，请使用账号密码登录系统</div>
            </div>

            <el-form
              ref="formRef"
              :model="form"
              :rules="rules"
              label-position="top"
              @submit.prevent
              @keyup.enter="onLogin"
            >
              <el-form-item label="账号" prop="username">
                <el-input v-model="form.username" autocomplete="username" placeholder="请输入账号" size="large" />
              </el-form-item>
              <el-form-item label="密码" prop="password">
                <el-input
                  v-model="form.password"
                  type="password"
                  autocomplete="current-password"
                  show-password
                  placeholder="请输入密码"
                  size="large"
                />
              </el-form-item>
              <div class="login-actions">
                <el-checkbox v-model="rememberMe" label="记住我" />
                <button class="ghost-link" type="button" @click="scrollToSection('pdpa')">PDPA 隐私政策</button>
              </div>
              <el-button class="login-btn" type="primary" :loading="loading" @click="onLogin" size="large">
                登录
              </el-button>
            </el-form>
          </el-card>
        </div>
      </section>

      <section class="company" aria-label="Company Showcase">
        <div class="container">
          <div class="section-title">
            <div class="section-kicker">Company</div>
            <h2 class="section-heading">公司展示</h2>
            <div class="section-desc">从公司介绍到团队与项目数据，一页了解我们的能力与价值。</div>
          </div>

          <el-row :gutter="16">
            <el-col :xs="24" :sm="12" :lg="8">
              <el-card class="info-card" shadow="hover" id="about">
                <div class="card-title">About Company</div>
                <div class="card-text">公司介绍：TikTok 泰国头部先锋卖家，5 年电商经验。</div>
                <div class="chips">
                  <el-tag type="primary" effect="light" round>Thai TikTok</el-tag>
                  <el-tag type="warning" effect="light" round>5 Years</el-tag>
                  <el-tag type="info" effect="light" round>E-commerce</el-tag>
                </div>
              </el-card>
            </el-col>
            <el-col :xs="24" :sm="12" :lg="8">
              <el-card class="info-card" shadow="hover" id="ceo">
                <div class="card-title">CEO</div>
                <div class="card-text">
                  Xiong Liu：5 年线上业务、直播、广告、短视频、TikTok 运营经验。
                </div>
                <div class="list">
                  <div class="li">线上业务增长</div>
                  <div class="li">直播与投放策略</div>
                  <div class="li">短视频内容运营</div>
                </div>
              </el-card>
            </el-col>
            <el-col :xs="24" :sm="12" :lg="8">
              <el-card class="info-card" shadow="hover" id="vision">
                <div class="card-title">Vision</div>
                <div class="card-text">引领数字营销，新一代网络营销领军企业。</div>
                <div class="quote">Build the next-generation marketing ecosystem.</div>
              </el-card>
            </el-col>

            <el-col :xs="24" :sm="12" :lg="8" class="mt16">
              <el-card class="info-card" shadow="hover" id="mission">
                <div class="card-title">Mission</div>
                <div class="card-text">赋能新一代营销人，打造专业营销社区。</div>
                <div class="pill-row">
                  <div class="pill">赋能</div>
                  <div class="pill">专业</div>
                  <div class="pill">社区</div>
                </div>
              </el-card>
            </el-col>
            <el-col :xs="24" :sm="12" :lg="8" class="mt16">
              <el-card class="info-card" shadow="hover" id="services">
                <div class="card-title">Services</div>
                <div class="card-text">营销方案、媒体制作、分析咨询、代运营。</div>
                <div class="service-grid">
                  <div class="service">营销方案</div>
                  <div class="service">媒体制作</div>
                  <div class="service">分析咨询</div>
                  <div class="service">代运营</div>
                </div>
              </el-card>
            </el-col>
            <el-col :xs="24" :sm="12" :lg="8" class="mt16">
              <el-card class="info-card" shadow="hover" id="team">
                <div class="card-title">Team</div>
                <div class="card-text">CEO、营销组、直播组、剪辑组。</div>
                <div class="team-grid">
                  <div class="team-item">
                    <div class="team-role">CEO</div>
                    <div class="team-desc">战略与业务增长</div>
                  </div>
                  <div class="team-item">
                    <div class="team-role">营销组</div>
                    <div class="team-desc">投放与增长策略</div>
                  </div>
                  <div class="team-item">
                    <div class="team-role">直播组</div>
                    <div class="team-desc">主播与直播运营</div>
                  </div>
                  <div class="team-item">
                    <div class="team-role">剪辑组</div>
                    <div class="team-desc">短视频制作与剪辑</div>
                  </div>
                </div>
              </el-card>
            </el-col>
          </el-row>

          <el-row :gutter="16" class="mt16">
            <el-col :xs="24" :lg="14">
              <el-card class="info-card" shadow="hover" id="projects">
                <div class="card-title">Projects</div>
                <div class="card-text">项目亮点与能力覆盖：</div>
                <div class="project-grid">
                  <div class="project">月销超 100 万泰铢</div>
                  <div class="project">10+ 主播</div>
                  <div class="project">100+ 后端</div>
                  <div class="project">中国商品直播</div>
                  <div class="project">网红打造</div>
                  <div class="project">专业短视频</div>
                  <div class="project">爆款直播</div>
                </div>
              </el-card>
            </el-col>
            <el-col :xs="24" :lg="10" class="mt16-lg0">
              <el-card class="info-card" shadow="hover" id="swot">
                <div class="card-title">SWOT</div>
                <div class="swot">
                  <div class="swot-item swot-s">
                    <div class="swot-k">优势</div>
                    <div class="swot-v">TikTok 领先</div>
                  </div>
                  <div class="swot-item swot-o">
                    <div class="swot-k">机会</div>
                    <div class="swot-v">多平台拓展</div>
                  </div>
                  <div class="swot-item swot-w">
                    <div class="swot-k">劣势</div>
                    <div class="swot-v">物流线下经验不足</div>
                  </div>
                  <div class="swot-item swot-t">
                    <div class="swot-k">威胁</div>
                    <div class="swot-v">平台规则变化</div>
                  </div>
                </div>
              </el-card>
            </el-col>
          </el-row>

          <el-row :gutter="16" class="mt16" id="data">
            <el-col :xs="24" :sm="12" :lg="8">
              <el-card class="stat-card" shadow="hover">
                <div class="card-title">数据</div>
                <div class="stats">
                  <el-statistic title="服务企业" :value="2000" />
                  <div class="stat-suffix">+</div>
                </div>
                <div class="card-sub">服务 2000+ 企业，多平台代运营。</div>
              </el-card>
            </el-col>
            <el-col :xs="24" :sm="12" :lg="8" class="mt16-sm0">
              <el-card class="stat-card" shadow="hover">
                <div class="card-title">多平台</div>
                <div class="stats">
                  <el-statistic title="平台代运营" :value="6" />
                  <div class="stat-suffix">+</div>
                </div>
                <div class="card-sub">覆盖电商、内容与投放等多业务场景。</div>
              </el-card>
            </el-col>
            <el-col :xs="24" :lg="8" class="mt16-lg0">
              <el-card class="stat-card" shadow="hover">
                <div class="card-title">交付</div>
                <div class="stats">
                  <el-statistic title="内容与直播" :value="100" />
                  <div class="stat-suffix">+</div>
                </div>
                <div class="card-sub">短视频、爆款直播与品牌增长项目持续交付。</div>
              </el-card>
            </el-col>
          </el-row>

          <el-card class="pdpa-card mt16" shadow="hover" id="pdpa">
            <div class="card-title">PDPA 条款</div>
            <div class="card-text">严格保护创作者信息与作品，绝不泄露转售第三方。</div>
          </el-card>
        </div>
      </section>
    </main>

    <footer class="footer" id="contact">
      <div class="container footer-inner">
        <div class="footer-col">
          <div class="footer-title">导航</div>
          <div class="footer-links">
            <button class="footer-link" type="button" @click="scrollToSection('about')">About Us</button>
            <button class="footer-link" type="button" @click="scrollToSection('pdpa')">PDPA隐私政策</button>
            <button class="footer-link" type="button" @click="scrollToSection('contact')">Contact Us</button>
          </div>
        </div>

        <div class="footer-col">
          <div class="footer-title">客户支持</div>
          <div class="footer-text">
            Line OA：
            <el-link class="footer-oa" type="primary" :underline="false" href="https://lin.ee/TbYmfgi" target="_blank">
              https://lin.ee/TbYmfgi
            </el-link>
          </div>
        </div>

        <div class="footer-col footer-wide">
          <div class="footer-title">合规信息</div>
          <div class="footer-text th">
            เลขทะเบียน:0505564017671 | ประกอบธุรกิจ:โฆษณา | วันที่จดทะเบียน:8 พฤศจิกายน 2564
          </div>
          <div class="footer-text">
            注册号：0505564017671 | 业务：广告代理 | 成立：2021-11-08 | 地址：清迈
          </div>
        </div>

        <div class="footer-col">
          <div class="footer-title">联系方式</div>
          <div class="footer-text">电话：0653085541 / 0652468116</div>
          <div class="footer-text">邮箱：Xt.tiktok7@gmail.com</div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { useAuthStore } from "@/stores/auth";

const router = useRouter();
const auth = useAuthStore();

const STORAGE_KEY = "xt_login_remember_v1";

const formRef = ref();
const form = reactive({ username: "", password: "" });
const loading = ref(false);
const rememberMe = ref(false);
const ready = ref(false);

const rules = {
  username: [{ required: true, message: "请输入账号", trigger: ["blur", "change"] }],
  password: [{ required: true, message: "请输入密码", trigger: ["blur", "change"] }],
} as const;

function loadRememberMe() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { username?: string; remember?: boolean };
    if (typeof parsed.username === "string") form.username = parsed.username;
    if (typeof parsed.remember === "boolean") rememberMe.value = parsed.remember;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function persistRememberMe() {
  if (!rememberMe.value) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ username: form.username.trim(), remember: true }));
}

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

onMounted(async () => {
  loadRememberMe();
  await nextTick();
  requestAnimationFrame(() => {
    ready.value = true;
  });
});

async function onLogin() {
  const valid = await formRef.value?.validate?.().catch(() => false);
  if (!valid) return;
  loading.value = true;
  try {
    persistRememberMe();
    const user = await auth.login(form.username.trim(), form.password);
    if (user.role === "admin") router.replace("/admin");
    else if (user.role === "employee") router.replace("/employee");
    else if (user.role === "client") router.replace("/client");
    else {
      auth.logout();
      ElMessage.error("达人端无权限访问四类视频项目系统");
      router.replace("/login");
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "登录失败");
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.page {
  --blue-950: #081a3a;
  --blue-900: #0a2553;
  --blue-800: #103070;
  --blue-700: #17408f;
  --blue-500: #2d6bff;
  --orange-500: #ff8a00;
  --orange-600: #ff7a00;
  --text-1: rgba(255, 255, 255, 0.92);
  --text-2: rgba(255, 255, 255, 0.72);
  --text-3: rgba(255, 255, 255, 0.56);
  --border: rgba(255, 255, 255, 0.12);
  --shadow: 0 18px 60px rgba(0, 0, 0, 0.28);
  --footer-h: 220px;

  min-height: 100vh;
  background: radial-gradient(1200px 600px at 20% 10%, rgba(45, 107, 255, 0.35), transparent 60%),
    radial-gradient(900px 500px at 90% 0%, rgba(255, 138, 0, 0.22), transparent 55%),
    linear-gradient(180deg, var(--blue-950) 0%, #070f22 100%);
  color: var(--text-1);
  overflow-x: hidden;
}

.content {
  padding-bottom: var(--footer-h);
}

.container {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;
}

:deep(.el-card) {
  color: rgba(255, 255, 255, 0.9);
}

:deep(.el-card__body) {
  padding: 18px;
}

:deep(.el-form-item__label) {
  color: rgba(255, 255, 255, 0.78);
}

:deep(.el-input__wrapper) {
  background: rgba(255, 255, 255, 0.06);
  box-shadow: none;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 12px;
  transition: border-color 160ms ease, background 160ms ease;
}

:deep(.el-input__wrapper.is-focus) {
  border-color: rgba(255, 138, 0, 0.55);
  background: rgba(255, 255, 255, 0.08);
}

:deep(.el-input__inner) {
  color: rgba(255, 255, 255, 0.92);
}

:deep(.el-input__inner::placeholder) {
  color: rgba(255, 255, 255, 0.45);
}

:deep(.el-checkbox__label) {
  color: rgba(255, 255, 255, 0.78);
}

:deep(.el-statistic__head) {
  color: rgba(255, 255, 255, 0.68);
}

:deep(.el-statistic__content) {
  color: rgba(255, 255, 255, 0.92);
}

.hero {
  position: relative;
  padding: 56px 0 28px;
}

.hero-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(23, 64, 143, 0.55) 0%, rgba(10, 37, 83, 0.25) 55%, rgba(255, 138, 0, 0.08) 100%);
  mask-image: radial-gradient(900px 520px at 50% 35%, black 40%, transparent 70%);
  pointer-events: none;
}

.hero-inner {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 22px;
  align-items: stretch;
}

.brand {
  padding: 18px 4px 18px 2px;
  opacity: 0;
  transform: translateY(10px);
  transition: opacity 520ms ease, transform 520ms ease;
}

.ready .brand {
  opacity: 1;
  transform: translateY(0);
}

.brand-badge {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(10px);
}

.badge-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--orange-500);
  box-shadow: 0 0 0 4px rgba(255, 138, 0, 0.16);
}

.badge-text {
  color: var(--text-2);
  font-size: 13px;
  letter-spacing: 0.2px;
}

.brand-title {
  margin: 14px 0 8px;
  font-weight: 700;
  font-size: clamp(28px, 3.3vw, 44px);
  line-height: 1.15;
  text-shadow: 0 10px 50px rgba(0, 0, 0, 0.35);
}

.brand-subtitle {
  color: var(--text-2);
  font-size: 15px;
  letter-spacing: 0.2px;
  margin-bottom: 18px;
}

.brand-points {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  max-width: 520px;
}

.point {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
}

.point-k {
  color: rgba(255, 255, 255, 0.62);
  font-size: 12px;
  align-self: center;
}

.point-v {
  color: var(--text-1);
  font-size: 14px;
  line-height: 1.35;
}

.login-card {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.08);
  box-shadow: var(--shadow);
  backdrop-filter: blur(14px);
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 540ms ease, transform 540ms ease;
}

.ready .login-card {
  opacity: 1;
  transform: translateY(0);
}

.login-header {
  margin-bottom: 10px;
}

.login-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-1);
}

.login-desc {
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-2);
}

.login-actions {
  margin: 4px 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.ghost-link {
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.78);
  padding: 6px 8px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 160ms ease, color 160ms ease, transform 160ms ease;
}

.ghost-link:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.92);
}

.ghost-link:active {
  transform: translateY(1px);
}

.login-btn {
  width: 100%;
  border-radius: 12px;
  height: 44px;
  background: linear-gradient(135deg, rgba(45, 107, 255, 0.95) 0%, rgba(255, 138, 0, 0.92) 100%);
  border: 0;
}

.company {
  padding: 22px 0 34px;
}

.section-title {
  margin: 0 0 16px;
}

.section-kicker {
  display: inline-block;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.74);
  font-size: 12px;
  letter-spacing: 0.16px;
}

.section-heading {
  margin: 10px 0 8px;
  font-size: 22px;
  font-weight: 800;
}

.section-desc {
  color: var(--text-2);
  font-size: 14px;
}

.info-card,
.stat-card,
.pdpa-card {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(10px);
  transition: transform 200ms ease, background 200ms ease, border-color 200ms ease;
}

.info-card:hover,
.stat-card:hover,
.pdpa-card:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.18);
}

.card-title {
  font-weight: 800;
  font-size: 16px;
  margin-bottom: 8px;
}

.card-text {
  color: var(--text-2);
  font-size: 14px;
  line-height: 1.55;
}

.card-sub {
  margin-top: 10px;
  color: var(--text-2);
  font-size: 13px;
}

.chips {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.list {
  margin-top: 10px;
  display: grid;
  gap: 8px;
}

.li {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.12);
  color: rgba(255, 255, 255, 0.82);
  font-size: 13px;
}

.quote {
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(255, 138, 0, 0.22);
  background: linear-gradient(135deg, rgba(255, 138, 0, 0.14), rgba(45, 107, 255, 0.09));
  color: rgba(255, 255, 255, 0.86);
  font-size: 13px;
}

.pill-row {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pill {
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid rgba(45, 107, 255, 0.25);
  background: rgba(45, 107, 255, 0.12);
  color: rgba(255, 255, 255, 0.86);
  font-size: 12px;
}

.service-grid,
.project-grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.service,
.project {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: rgba(0, 0, 0, 0.1);
  color: rgba(255, 255, 255, 0.84);
  font-size: 13px;
}

.team-grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.team-item {
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: rgba(0, 0, 0, 0.1);
}

.team-role {
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
}

.team-desc {
  margin-top: 6px;
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
}

.swot {
  margin-top: 10px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.swot-item {
  padding: 12px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: rgba(0, 0, 0, 0.1);
}

.swot-k {
  font-weight: 800;
  font-size: 13px;
}

.swot-v {
  margin-top: 6px;
  color: rgba(255, 255, 255, 0.76);
  font-size: 13px;
  line-height: 1.4;
}

.swot-s {
  border-color: rgba(45, 107, 255, 0.3);
  background: rgba(45, 107, 255, 0.1);
}

.swot-o {
  border-color: rgba(255, 138, 0, 0.28);
  background: rgba(255, 138, 0, 0.1);
}

.swot-w {
  border-color: rgba(255, 255, 255, 0.16);
}

.swot-t {
  border-color: rgba(255, 60, 60, 0.22);
  background: rgba(255, 60, 60, 0.08);
}

.stats {
  position: relative;
  margin-top: 6px;
  display: flex;
  align-items: flex-end;
  gap: 6px;
}

.stat-suffix {
  font-size: 18px;
  font-weight: 800;
  color: rgba(255, 138, 0, 0.9);
  transform: translateY(-6px);
}

.mt16 {
  margin-top: 16px;
}

.mt16-sm0 {
  margin-top: 16px;
}

.mt16-lg0 {
  margin-top: 16px;
}

@media (min-width: 768px) {
  .mt16-sm0 {
    margin-top: 0;
  }
}

@media (min-width: 1200px) {
  .mt16-lg0 {
    margin-top: 0;
  }
}

.footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: var(--footer-h);
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(7, 15, 34, 0.72);
  backdrop-filter: blur(14px);
}

.footer-inner {
  height: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr 1.6fr 1fr;
  gap: 14px;
  align-items: start;
  padding: 18px 0;
}

.footer-col {
  min-width: 0;
}

.footer-wide {
  grid-column: span 1;
}

.footer-title {
  font-weight: 800;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.86);
  margin-bottom: 10px;
}

.footer-text {
  color: rgba(255, 255, 255, 0.68);
  font-size: 12px;
  line-height: 1.5;
  margin-top: 6px;
  word-break: break-word;
}

.footer-text.th {
  font-family: system-ui, -apple-system, Segoe UI, Roboto, "Noto Sans Thai", "Noto Sans", Arial, sans-serif;
}

.footer-links {
  display: grid;
  gap: 8px;
}

.footer-link {
  text-align: left;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.82);
  padding: 8px 10px;
  border-radius: 12px;
  cursor: pointer;
  transition: transform 160ms ease, background 160ms ease, border-color 160ms ease;
}

.footer-link:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.18);
}

.footer-oa {
  font-size: 12px;
}

@media (max-width: 980px) {
  .page {
    --footer-h: 280px;
  }

  .hero-inner {
    grid-template-columns: 1fr;
  }

  .brand {
    padding-bottom: 6px;
  }

  .footer-inner {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 640px) {
  .page {
    --footer-h: 340px;
  }

  .hero {
    padding-top: 42px;
  }

  .service-grid,
  .project-grid,
  .team-grid {
    grid-template-columns: 1fr;
  }

  .footer-inner {
    grid-template-columns: 1fr;
  }
}
</style>
