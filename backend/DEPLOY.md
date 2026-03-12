# 部署为「随时可访问」的固定网址

把前后端部署到云端后，会得到**固定网址**，不依赖本机或隧道，随时可访问。

---

## 方案概览

| 部分   | 推荐平台 | 得到网址示例              |
|--------|----------|---------------------------|
| 后端   | Render   | `https://xxx.onrender.com` |
| 前端   | Vercel   | `https://xxx.vercel.app`   |

**先部署后端，拿到后端网址，再部署前端并填该网址。**

---

## 一、部署后端（Render）

1. 打开 [Render](https://render.com)，用 GitHub 登录。
2. **New → Web Service**，连接本项目的 **GitHub 仓库**（若未推送，先把 `backend` 和 `frontend` 放到一个仓库里，或分别建两个仓库）。
3. 若仓库是**整个项目**（含 backend 与 frontend）：
   - **Root Directory** 填：`backend`
   - **Build Command**：`npm install && npm run build`
   - **Start Command**：`npm start`
4. **Environment** 里添加变量：
   - `DEEPSEEK_API_KEY` = 你的 DeepSeek API Key
   - （朗读若用 Azure，再填 `AZURE_SPEECH_KEY`、`AZURE_SPEECH_REGION`）
5. 创建服务，等部署完成。在 Render 面板里复制 **服务 URL**，例如：  
   `https://deepseek-translate-backend.onrender.com`  
   **这就是后端的固定网址。**

> Render 免费版一段时间无访问会休眠，首次打开可能稍慢，属正常。

---

## 二、部署前端（Vercel）

1. 打开 [Vercel](https://vercel.com)，用 GitHub 登录。
2. **Add New → Project**，导入**同一仓库**（或仅含前端的仓库）。
3. 若仓库是整项目：
   - **Root Directory** 选：`frontend`
   - **Build Command** 保持：`npm run build`
   - **Output Directory** 保持：`dist`
4. **Environment Variables** 添加：
   - 名称：`VITE_API_BASE_URL`  
   - 值：上一步的**后端地址**（如 `https://deepseek-translate-backend.onrender.com`），**不要**末尾斜杠。
5. 部署完成后，Vercel 会给你一个地址，例如：  
   `https://deepseek-translate.vercel.app`  
   **这就是前端的固定网址，可随时分享、访问。**

---

## 三、得到「随时可访问」的网址

- **给他人或自己用的地址**：用 Vercel 分配的前端地址（如 `https://xxx.vercel.app`）。
- 翻译请求会由前端发到你部署的后端（Render），再调 DeepSeek；朗读仍为浏览器语音，无需额外配置。

之后只要不删除 Vercel/Render 上的服务，该网址就会一直有效，无需本机或隧道在线。
