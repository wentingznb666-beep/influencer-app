# CODEX.md — 达人分发 APP 代码审查与修复记录

> 本文档记录 Codex AI 对项目的代码审查发现和修复，作为团队知识沉淀。

---

## 2026-06-30 ~ 2026-07-01 全面审查与修复

### 审查范围

`backend/src/`（42 个 TS 文件）+ `frontend/src/`（95 个 TSX/TS 文件），共 137 个文件。

### 修复清单（共 14 项，分 4 轮）

---

#### 第一轮 — `530fc9d`：达人首页路由修复 + API 安全加固

| # | 文件 | 问题 | 严重度 |
|---|------|------|--------|
| 1 | `frontend/src/influencer/InfluencerDashboard.tsx` | 3 个快捷卡片指向不存在路由，React Router `*` 通配重定向到 `/login` | 🔴 |
|   | - 📦 我的订单：`/influencer/client-orders-hall` → `/influencer/client-orders` | | |
|   | - 💰 积分余额：`/influencer/points` → `/influencer/payment-profile` | | |
|   | - 📊 撮合广场：`/influencer/collab-demands` → `/influencer/task-hall` | | |
| 2 | `frontend/src/matchingApi.ts:64` | `getClientMarketOrderApplications` 缺 `!res.ok` 检查 + 重复 `return res.json()` | 🔴 |
| 3 | `frontend/src/authApi.ts` | `registerAccount` 缺 `credentials: "include"`，与 `login`/`refreshAccessToken` 不一致 | 🔴 |
| 4 | `frontend/src/api.ts` | `requestTranslate`/`requestTts` 使用裸 `fetch` 不携带 JWT，改为 `fetchWithAuth` | 🟡 |

---

#### 第二轮 — `51664ce`：达人端 403 无权限修复

| # | 文件 | 问题 | 严重度 |
|---|------|------|--------|
| 5 | `frontend/src/influencer/ClientOrdersHallPage.tsx` | 达人「我的订单」页面调用了员工端 API `employeeApi.getEmployeeVideoOrders()`，后端返回 403 "无权限访问"。整个离线视频板块达人不可访问，已删除 65 行员工端专属代码 | 🔴 |

---

#### 第三轮 — `d697860`：管理员端 & 员工端 9 项修复

| # | 文件 | 问题 | 严重度 |
|---|------|------|--------|
| 6 | `frontend/src/admin/CooperationTypesPage.tsx` | 合作业务类型说明页白屏：API 返回异常时 `loading` 永久为 true。加响应校验 + 超时提示 + 安全降级 | 🔴 |
| 7 | `frontend/src/admin/CooperationOrdersPage.tsx` | 合作订单工作台筛选失效：`typeOptions` 从 `filteredList` 动态计算，数据为空时下拉无选项。改为从 `typeConfig`（全局配置）获取 | 🔴 |
| 8 | `frontend/src/DashboardShell.tsx` | 消息通知弹窗 `zIndex: 20` 被侧栏覆盖，改为 `zIndex: 1000` | 🟡 |
| 9 | `frontend/src/admin/InfluencerPermissionsPage.tsx` | 撮合权限审核表分隔线颜色太浅 `#f1f5f9`，改为 `#cbd5e1` | 🟡 |
| 10 | `frontend/src/admin/InfluencerPermissionsPage.tsx` | 撮合权限审核页面无搜索功能，新增 Creator 用户名/账号搜索框 | 🟡 |
| 11 | `frontend/src/admin/CooperationOrdersPage.tsx` | 合作订单工作台附件链接过长无截断，CSS 加 `text-overflow: ellipsis` + `max-width: 160px` | 🟡 |
| 12 | `frontend/src/admin/CooperationOrdersPage.tsx` | 订单编号自动换行阅读困难，加 `.xt-coop-order-no { white-space: nowrap }` | 🟡 |
| 13 | `frontend/src/index.css` | 侧栏一级菜单 11px 半透明不醒目，二级无独立字号。一级改为 13px/800/#fff，二级 13px/500 | 🟡 |
| 14 | `frontend/src/admin/InfluencerDetailPage.tsx` | 达人编辑页等级显示为数字（1-6），改为 A/B/C/A+/B+/C+ | 🟢 |

---

#### 第四轮 — `fec4d5b`：编译构建修复

| # | 文件 | 问题 | 严重度 |
|---|------|------|--------|
| 15 | `frontend/src/admin/CooperationTypesPage.tsx` | `??` 和 `\|\|` 混用未加括号（第 364/365/376/383 行），esbuild 报错。改为 `(t.name?.zh ?? t.id) \|\| t.id` | 🔴 |
| 16 | `frontend-vue/`（服务器） | 无 `node_modules`，后端优先加载 `frontend-vue/dist` 失败。执行 `npm install && npm run build` | 🔴 |

---

### 代码规范教训

1. **路由安全**：所有导航路径必须与 `main.tsx` 中注册的路由一致，避免通配符 `*` 重定向到登录页
2. **API 调用三要素**：每个 `fetch`/`fetchWithAuth` 必须包含 `!res.ok` 检查 + `credentials: "include"` + 用户友好错误提示
3. **角色隔离**：不同角色的页面不应调用其他角色专属的 API，交叉调用会导致 403
4. **esbuild 语法限制**：`??`（空值合并）和 `\|\|`（逻辑或）不能在同一表达式混用，必须用括号明确优先级
5. **构建依赖**：多前端子项目（React + Vue）须确服务器上 `node_modules` 和构建产物完整

### 项目架构注意

- 后端优先加载 `frontend-vue/dist`，不存在时回退到 `frontend/dist`
- GitHub Actions 部署脚本仅构建 React 前端（`frontend/`），Vue 前端需手动构建
- 部署目标：腾讯云 `119.28.143.135`，域名 `xiangtaiyyj.site`
