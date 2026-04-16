# 达人分发 APP 部署指南

将后端部署到 **Render**、前端部署到 **Vercel**，获得固定访问地址。**先部署后端，拿到后端 URL 后再部署前端并填写该 URL。**

---

## 一、部署后端（Render）

1. 打开 [Render](https://render.com)，用 GitHub 登录。
2. **New → Web Service**，连接你的 **GitHub 仓库**（需已推送代码）。
3. 配置：
   - **Root Directory**：`backend`（若仓库为整项目，含 backend 与 frontend 目录）。
   - **Build Command**：`npm install && npm run build`
   - **Start Command**：`npm start`
   - **Instance Type**：Free（免费版一段时间无访问会休眠，首次打开可能较慢）。
4. **Environment** 添加变量：

   | 变量名 | 必填 | 说明 |
   |--------|------|------|
   | `JWT_SECRET` | 是 | 至少 32 位随机字符串，用于签发访问令牌。 |
   | `JWT_REFRESH_SECRET` | 是 | 至少 32 位随机字符串，用于刷新令牌。 |
   | `NODE_ENV` | 可选 | 填 `production`。 |
   | `PORT` | 可选 | Render 会自动注入，一般无需填写。 |
   | `DB_PATH` | 可选 | 默认 `./data/app.db`。免费版实例重启后磁盘可能清空，重要数据请后续迁到外部数据库。 |

5. 创建服务，等待部署完成。在 Render 面板复制 **服务 URL**，例如：  
   `https://influencer-app-backend.onrender.com`  
   **此地址即后端 API 根地址。**

6. 验证：浏览器访问 `https://你的后端URL/health`，应返回 `{"ok":true}`。

---

## 二、部署前端（Vercel）

1. 打开 [Vercel](https://vercel.com)，用 GitHub 登录。
2. **Add New → Project**，导入**同一仓库**。
3. 配置：
   - **Root Directory**：`frontend`
   - **Build Command**：`npm run build`（默认即可）
   - **Output Directory**：`dist`（默认即可）
4. **Environment Variables** 添加：
   - **Name**：`VITE_API_BASE_URL`
   - **Value**：上一步的**后端地址**（如 `https://influencer-app-backend.onrender.com`），**不要**末尾斜杠。
   - 勾选 Production / Preview 等需要生效的环境。
5. 部署完成后，Vercel 会分配一个地址，例如：  
   `https://influencer-app.vercel.app`  
   **此地址即前端访问地址，可分享给用户登录使用。**

---

## 三、部署后检查

- 用前端地址打开页面，应跳转到登录页。
- 使用默认管理员账号 **admin / admin123** 登录（**上线后请尽快修改密码或通过后台修改**）。
- 若需注册商家/达人：可先用管理员登录，或调用 `POST /api/auth/register` 注册（需在后端允许该接口对外）。

---

## 四、注意事项

1. **SQLite 持久化**：Render 免费版实例重启或重新部署后，`./data/app.db` 可能被清空。若需持久化，可：
   - 使用 Render 的 Persistent Disk（付费），并将 `DB_PATH` 指到挂载路径；或
   - 将数据库迁移到 PostgreSQL（如 Render PostgreSQL）并修改后端连接。
2. **CORS**：当前后端允许任意来源（`origin: "*"`）。生产环境建议在代码中限制为前端域名。
3. **默认密码**：首次启动会自动创建管理员 `admin` / `admin123`，部署后请尽快修改或禁用该账号并创建新管理员。

---

## 五、本地与部署对照

| 环境 | 后端 | 前端 |
|------|------|------|
| 本地 | `npm run dev`，默认 `http://localhost:3000` | `npm run dev`，在 `.env` 中设 `VITE_API_BASE_URL=http://localhost:3000` |
| 生产 | Render 提供的 URL | Vercel 提供的 URL，环境变量 `VITE_API_BASE_URL` 指向 Render 后端 URL |
