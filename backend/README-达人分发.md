# 达人分发 APP 后端说明

**部署**：参见 [DEPLOY-达人分发.md](DEPLOY-达人分发.md)（Render + Vercel）。

## 阶段 1 已实现

- **数据库**：SQLite（`data/app.db`），表：roles、users、point_accounts、point_ledger、audit_log、config。
- **鉴权**：JWT 访问令牌 + 刷新令牌，`/api/auth/login`、`/api/auth/refresh`、`/api/auth/me`。
- **中间件**：request-id、审计日志写入、登录限流。
- **默认账号**：首次启动自动创建管理员 `admin` / `admin123`，请上线后修改密码。
- **注册**：`POST /api/auth/register` 可创建测试账号，body：`{ "username", "password", "role": "admin"|"client"|"influencer" }`。

## 阶段 2 已实现（管理员端）

- **表**：materials（素材）、tasks（任务）、influencer_profiles（达人资料）、task_claims（任务领取）、submissions（投稿）。
- **接口**（均需管理员 JWT）：
  - `GET/POST/PATCH/DELETE /api/admin/materials` 素材 CRUD、上下架。
  - `GET/POST/PATCH /api/admin/tasks` 任务列表、创建、发布。
  - `GET /api/admin/influencers`、`PUT /api/admin/influencers/:userId/profile` 达人列表与资料（露脸/人设/平台/黑名单/等级）。
  - `GET /api/admin/submissions`、`POST .../submissions/:id/approve`、`POST .../submissions/:id/reject` 投稿审核。
  - `GET /api/admin/points/summary`、`GET /api/admin/points/ledger` 积分汇总、按周统计、流水。
  - `GET /api/admin/audit`、`GET /api/admin/audit/export` 审计日志与 CSV 导出。

## 阶段 4 已实现（达人端）

- **配置**：`config.daily_claim_limit` 每日领取上限（默认 10）。
- **约束**：task_claims 唯一 (task_id, user_id)；露脸任务仅对 show_face=1 的达人开放；黑名单达人不可领取。
- **接口**（需达人 JWT）：
  - `GET /api/influencer/tasks` 任务大厅（已发布、按平台/类型筛选、标是否已领）。
  - `POST /api/influencer/tasks/:taskId/claim` 领取任务（校验每日上限、任务剩余量、黑名单）。
  - `GET /api/influencer/my-claims` 我的任务列表（含投稿状态与云盘链接）。
  - `GET /api/influencer/my-claims/:claimId` 单条领取详情。
  - `POST /api/influencer/submissions` 投稿（作品链接 + 可选备注）。
  - `GET /api/influencer/points` 当前积分、本周已获得、最近流水。

## 阶段 3 已实现（客户端）

- **表**：client_requests（合作意向/需求）、sample_orders（样品与订单跟踪）。
- **接口**（需客户 JWT）：
  - `GET /api/client/requests`、`POST /api/client/requests` 合作意向列表与提交。
  - `GET /api/client/orders`、`POST /api/client/orders`、`PATCH /api/client/orders/:id` 订单列表、创建、更新状态/备注。
  - `GET /api/client/works` 达人已发布作品列表（已通过审核的投稿，含作品链接、达人、平台等）。
  - `GET /api/client/points` 积分余额与流水。
  - `POST /api/client/recharge` 充值得积分（模拟，实际应由支付或管理员操作）。

## 阶段 5 已实现（支付与风控）

- **配置**：`config.lock_period_days`（锁定期天数，默认 5）、`config.violation_deduct_full`（违约是否全额扣分）。
- **表**：settlement_records（按周按达人结算、打款状态）、submission_checks（巡检结果）、influencer_violations（违规记录）。
- **结算**（需管理员 JWT）：
  - `GET /api/admin/settlement/weeks` 可结算周列表。
  - `GET /api/admin/settlement/summary?week=` 指定周汇总（含锁定期已过积分与已有打款状态）。
  - `POST /api/admin/settlement/generate` 生成该周结算记录（pending）。
  - `GET /api/admin/settlement/export?week=` 导出 CSV。
  - `PATCH /api/admin/settlement/:id` 更新打款状态（paid/exception）及备注。
- **风控**：
  - `GET /api/admin/risk/checks` 巡检结果列表；`POST /api/admin/risk/check` 手动触发单条投稿链接可访问性检查（HEAD 请求）。锁定期内若结果为非 ok 则扣分、记违规，满 3 次违规自动黑名单。
  - `GET /api/admin/risk/violations` 违规记录；`GET /api/admin/risk/alerts` 告警列表（deleted/suspicious）。

## 运行

```bash
npm run dev
```

前端需配置 `VITE_API_BASE_URL=http://localhost:3000`（或后端实际地址）。

## 环境变量（可选）

- `PORT`：服务端口，默认 3000。
- `DB_PATH`：SQLite 文件路径，默认 `./data/app.db`。
- `JWT_SECRET`、`JWT_REFRESH_SECRET`：生产环境务必设置。
