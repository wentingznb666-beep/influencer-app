# 湘泰国际达人分发 App — 项目承接文档

## 项目概述

泰国垂直达人建联与派单管理平台。商家浏览达人市场 → 发起建联 → 定向派单 → 达人提交作品 → 审核 → 付款。支持**自主达人**（自行操作）和**托管达人**（管理员代理操作）两条链路。

- **线上地址**：https://xiangtaiyyj.site
- **服务器**：腾讯云 119.28.143.135 (Ubuntu, nginx 反代 :3000)
- **GitHub**：https://github.com/wentingznb666-beep/influencer-app

---

## 技术栈

| 层 | 技术 | 端口 |
|---|------|------|
| 前端 | React 19 + TypeScript + Vite 7 + React Router 7 + i18next | :5173 (dev) |
| 后端 | Express 5 + TypeScript + ts-node-dev | :3000 |
| 数据库 | PostgreSQL 16 (本地), 生产同 | :5432 |
| 部署 | GitHub Actions → PM2 (influencer-app) | — |

---

## 启动开发环境

```bash
# 1. 数据库
brew services start postgresql@16
# 已创建数据库 influencer_app，连接:
DATABASE_URL=postgresql://localhost:5432/influencer_app

# 2. 后端 (自动建表+种子数据)
cd /Users/wt/influencer-app/backend
npm run dev   # ts-node-dev 自动热重载

# 3. 前端
cd /Users/wt/influencer-app/frontend
npm run dev   # Vite HMR
```

### 预置账号
| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 管理员 (role=1) |
| employee001 | 123456 | 员工 (role=4) |
| client002 | 123456 | 商家 (role=2) |
| influencer002 | 123456 | 自主达人 (role=3) |

---

## 项目结构

```
/Users/wt/influencer-app/
├── backend/
│   ├── src/
│   │   ├── index.ts          # Express 入口 + 路由挂载
│   │   ├── db.ts             # 数据库建表 + ALTER TABLE 迁移 + 种子数据
│   │   ├── auth.ts           # JWT 鉴权中间件 (requireAuth / requireRole)
│   │   └── routes/
│   │       ├── connections.ts        # ★ 垂直建联核心路由 (商家/达人/管理员三套子路由)
│   │       └── influencerProfiles.ts # 达人资料 CRUD + 等级自动计算 + 关联用户
│   ├── .env                 # 本地环境变量
│   └── ecosystem.config.js  # PM2 生产配置
├── frontend/
│   └── src/
│       ├── main.tsx         # 路由注册 (lazy imports)
│       ├── AdminLayout.tsx  # 管理员侧边栏
│       ├── EmployeeLayout.tsx
│       ├── ClientLayout.tsx # 商家侧边栏
│       ├── InfluencerLayout.tsx
│       ├── DashboardShell.tsx
│       ├── fetchWithAuth.ts # 带 JWT 的 fetch 封装
│       ├── admin/
│       │   ├── VerticalConnectionsDashboard.tsx  # 数据看板
│       │   ├── AdminVCProfilesPage.tsx           # 达人资料管理
│       │   ├── AdminVCConnectionsPage.tsx        # 建联记录
│       │   ├── AdminVCOrdersPage.tsx             # 派单管理
│       │   └── GradeConfigPage.tsx               # 等级配置
│       ├── client/
│       │   ├── ClientVCPage.tsx                  # 达人市场主页
│       │   ├── ClientVCInfluencerList.tsx        # 达人列表
│       │   ├── ClientVCInviteForm.tsx            # 发起建联邀请
│       │   ├── ClientVCMyConnections.tsx         # 我的建联 (续约/派单入口)
│       │   ├── ClientVCCreateOrder.tsx           # 创建派单
│       │   ├── ClientConnectionOrdersPage.tsx    # 订单列表
│       │   ├── ClientVCBatchOrders.tsx           # 批量派单
│       │   └── ClientVCOrderDetail.tsx           # 订单详情
│       └── influencer/
│           ├── InfluencerVCHome.tsx              # 合作中心首页
│           ├── InfluencerVCPage.tsx              # 建联邀请 (接受/拒绝)
│           ├── InfluencerVCOrders.tsx            # 我的派单列表
│           ├── InfluencerVCOrderDetail.tsx       # 派单详情 (提交/修改+接受/拒绝)
│           ├── InfluencerVCProfile.tsx           # 我的资料
│           └── InfluencerVCPayment.tsx           # 收款设置
├── seed_vc_data.sql         # 生产环境种子数据
└── 系统逻辑链路文档.md
```

---

## 核心数据库表

### influencer_profiles_full — 达人资料
| 关键字段 | 说明 |
|----------|------|
| id | 资料 ID (PK) |
| influencer_code | 达人编号 (如 SELF001) |
| user_id | 关联系统用户 (NULL=托管达人) |
| followers, category, grade | 粉丝数/类目/等级 |
| quoted_price | 报价 (派单金额自动取此值) |
| cooperation_conditions | 合作条件 |

### influencer_connections — 建联记录
| 关键字段 | 说明 |
|----------|------|
| id | 建联 ID |
| client_id | 商家用户 ID |
| influencer_id | 达人用户 ID |
| **influencer_profile_id** | ★ 达人资料 ID (JOIN 关键字段) |
| status | pending/active/rejected/expired |
| end_date | 到期日 (30天+续约) |

### connection_orders — 派单记录
| 关键字段 | 说明 |
|----------|------|
| id | 订单 ID |
| connection_id | 关联建联 |
| client_id / influencer_id | 商家/达人用户 ID |
| **influencer_profile_id** | ★ 达人资料 ID (2026-07 新增, 务必写入) |
| amount | 金额 (自动取达人报价) |
| influencer_response | pending/accepted/rejected |
| review_status | pending_review/approved/rejected |
| payment_status | unpaid/paid |

---

## 垂直达人建联业务流程

```
管理员新增达人资料 (含报价+合作条件)
  ↓
商家浏览达人市场 → 发起建联邀请
  ├─ 自主达人 (有 user_id) → 达人自行接受/拒绝
  └─ 托管达人 (无 user_id) → 管理员代接受/代拒绝
      ↓
  建联成功 (30天 active)
      ↓
  商家定向派单 (金额自动取达人报价，只读)
      ├─ 自主达人 → 接受派单 → 提交作品 → 商家审核 → 付款
      └─ 托管达人 → 管理员代接受/代提交/代修改 → 商家审核 → 付款 → 管理员核实凭证
          ↓
  建联到期 → 续约或结束
```

---

## 前端路由表

### 管理员/员工
| 路由 | 组件 |
|------|------|
| /admin/vertical-connections | VerticalConnectionsDashboard |
| /admin/vertical-connections/profiles | AdminVCProfilesPage |
| /admin/vertical-connections/records | AdminVCConnectionsPage |
| /admin/vertical-connections/orders | AdminVCOrdersPage |
| /admin/vertical-connections/grade-config | GradeConfigPage |

员工路由为 `/employee/...`，组件相同。

### 商家
| 路由 | 组件 |
|------|------|
| /client/vertical-connections/market | ClientVCPage |
| /client/vertical-connections/market/category/:id | ClientVCInfluencerList |
| /client/vertical-connections/market/invite/:id | ClientVCInviteForm |
| /client/vertical-connections/my | ClientVCMyConnections |
| /client/vertical-connections/my/create-order/:connectionId?influencer= | ClientVCCreateOrder |
| /client/vertical-connections/my/orders | ClientConnectionOrdersPage |
| /client/vertical-connections/my/orders/batch | ClientVCBatchOrders |
| /client/vertical-connections/my/orders/:id | ClientVCOrderDetail |

### 达人
| 路由 | 组件 |
|------|------|
| /influencer/vertical-connections | InfluencerVCHome |
| /influencer/vertical-connections/invitations | InfluencerVCPage |
| /influencer/vertical-connections/orders | InfluencerVCOrders |
| /influencer/vertical-connections/orders/:id | InfluencerVCOrderDetail |
| /influencer/vertical-connections/profile | InfluencerVCProfile |
| /influencer/vertical-connections/payment | InfluencerVCPayment |

---

## 关键 API 端点

### 管理员
- `GET /api/admin/connections/stats` — 建联统计
- `GET /api/admin/connections` — 建联列表 (含 influencer_code, followers)
- `GET /api/admin/connection-orders` — 派单列表 (含 influencer_code, followers, influencer_disabled)
- `GET /api/admin/influencer-profiles` — 达人资料列表
- `GET /api/admin/influencer-profiles/:id` — 单个达人资料
- `GET /api/admin/influencer-profiles/dashboard` — 仪表盘数据
- `GET /api/admin/influencer-profiles/linkable-users` — 可关联用户列表
- `POST /api/admin/influencer-profiles/auto-grade` — 重新计算等级
- `PATCH /api/admin/connections/:id/proxy` — 代达人接受/拒绝建联
- `PATCH /api/admin/connection-orders/:id/proxy-respond` — 代达人接受/拒绝派单
- `POST /api/admin/connection-orders/:id/proxy-submit` — 代达人提交作品
- `POST /api/admin/connection-orders/:id/proxy-revise` — 代达人修改重提
- `POST /api/admin/connection-orders/:id/admin-action` — 标记付款/驳回凭证
- `POST /api/admin/connections/check-expiry` — 检查到期建联

### 商家
- `GET /api/client/connections` — 建联列表 (含 influencer_code, influencer_profile_id)
- `GET /api/client/connections/stats` — 建联统计
- `POST /api/client/connections` — 发起建联
- `POST /api/client/connections/:id/renew` — 续约
- `GET /api/client/connection-orders` — 订单列表 (含 influencer_code, followers)
- `POST /api/client/connection-orders` — 创建派单 (★ influencer_id 必须是资料 ID)
- `POST /api/client/connection-orders/batch` — 批量派单
- `POST /api/client/connection-orders/:id/review` — 审核作品
- `POST /api/client/connection-orders/:id/confirm-payment` — 确认付款

### 达人
- `GET /api/influencer/connections/home-stats` — 合作中心统计
- `GET /api/influencer/connections` — 建联邀请列表
- `PATCH /api/influencer/connections/:id` — 接受/拒绝建联
- `GET /api/influencer/connection-orders` — 我的派单
- `PATCH /api/influencer/connection-orders/:id/respond` — 接受/拒绝派单
- `POST /api/influencer/connection-orders/:id/submit` — 提交作品
- `POST /api/influencer/connection-orders/:id/revise` — 修改重提
- `GET /api/influencer/profile` — 我的达人资料

---

## 本次会话已修复的问题

### 1. TypeScript 编译阻塞部署 (commit 7cb1af0)
- `actualInfluencerId`: `number | null` → 加 `!` 断言
- 8x `req.params.id`: `string | string[] | undefined` → `parseInt(String(...))`

### 2. 托管达人派单/建联信息展示 (commits a1c1382, 40d130f)
- 后端 SELECT 增加 `influencer_code`, `followers`
- JOIN 条件：`co.influencer_id = ipf.user_id` → `co.influencer_profile_id = ipf.id`
- 前端显示优先 `influencer_code > influencer_username > #id`

### 3. 订单写入端缺失 influencer_profile_id (commits 26da27e, 28a4252)
- `connection_orders` 表新增 `influencer_profile_id` 列 (ALTER TABLE)
- 单条/批量 INSERT 写入该字段
- 历史数据自动回填

### 4. /linkable-users 500 错误 (commit 38e44bc)
- 路由 `/linkable-users` 在 `/:id` 之后注册 → 被 `:id` 抢先匹配
- 移到 `/:id` 之前

### 5. 商家端派单创建失败 (commit 66c1502)
- MyConnections 传 `c.influencer_id` (用户ID) → 后端期望资料ID
- 改为传 `c.influencer_profile_id`
- CreateOrder 用 `GET /:id` 直查替代 `?q=` 模糊搜索

### 6. 达人端看不到订单详情 (commit 4469b21)
- 列表页 `pending` 订单点击被拦截 → 移除限制
- 详情页新增接受/拒绝按钮

---

## 部署流程

```bash
git add -A
git commit -m "fix: ..."
git push origin master
# GitHub Actions 自动触发：
#   SSH → git pull → npm install → tsc → pm2 restart influencer-app
#   cd frontend → rm -rf dist → npm install → npm run build → chown
```

- **生产目录**：`/home/ubuntu/influencer-app/`
- **PM2 进程**：`influencer-app` (cwd: `/home/ubuntu/influencer-app/backend`)
- **上传目录**：`/home/ubuntu/influencer-data/uploads`

---

## 重要注意事项

1. **influencer_id vs influencer_profile_id**：这是最容易出错的地方。
   - `influencer_id` = 用户表 users.id
   - `influencer_profile_id` = 资料表 influencer_profiles_full.id
   - 所有 JOIN 查达人信息必须用 `influencer_profile_id = ipf.id`
   - 所有 INSERT 必须写入 `influencer_profile_id`

2. **托管达人识别**：`inf.disabled = 1` 或 `ipf.user_id IS NULL`。前端用 `influencer_disabled === 1` 显示 🛠 标记。

3. **Express 5 路由顺序**：具体路径必须在 `/:id` 之前注册，否则被参数路由吃掉。

4. **种子数据**：生产环境 `NODE_ENV=production` 不自动写种子。需要手动导入 `seed_vc_data.sql`。

5. **前端强刷**：部署后必须 Cmd+Shift+R 清除浏览器缓存的旧 JS。
