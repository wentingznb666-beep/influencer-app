# DeepSeek 翻译 · 朗读站点

一个基于 **DeepSeek Chat Completion** 的多语言翻译与朗读小站，采用前后端分离架构：

- 后端：Node.js + Express + TypeScript，负责调用 DeepSeek 接口做翻译（可选提供 Azure TTS 接口）。
- 前端：Vite + React + TypeScript，提供翻译输入、语言选择、结果展示；**朗读使用浏览器自带语音，无需配置 Azure 或任何 Key**。

---

## 目录结构

```txt
backend/   # 当前目录：后端服务（DeepSeek 翻译 + Azure TTS）
frontend/  # 同级目录：前端 Web 页面（Vite + React）
```

> 说明：本 README 放在 `backend/` 目录下，主要说明整体项目的环境变量与启动方式，前后端仍然是两个独立项目。

---

## 环境准备

### 1. 安装依赖

分别在后端与前端目录执行依赖安装：

```bash
cd D:\backend
npm install

cd D:\frontend
npm install
```

### 2. 配置环境变量

#### 2.1 后端 `.env`

后端使用 `dotenv` 从 `.env` 中读取敏感配置。参考 `backend/.env.example`，在 `D:\backend` 下创建或编辑 `.env`：

```bash
DEEPSEEK_API_KEY=你的_DeepSeek_API_Key

PORT=3000
```

- **DEEPSEEK_API_KEY**：在 DeepSeek 开发者平台获取，用于调用翻译接口。**必填**。
- **PORT**：后端监听端口，默认为 `3000`。

**朗读功能**：当前前端使用浏览器自带的语音合成（Web Speech API），无需配置 Azure。若你希望使用后端提供的 Azure TTS（音质更好），可在 `.env` 中增加 `AZURE_SPEECH_KEY` 和 `AZURE_SPEECH_REGION`，并让前端改回调用 `/api/tts`。

> 注意：`.env` 只应保存在本地或安全的部署环境中，请不要提交到版本控制系统。

#### 2.2 前端 `.env`

前端通过 `VITE_API_BASE_URL` 指定后端访问地址。编辑 `D:\frontend\.env`：

```bash
VITE_API_BASE_URL=http://localhost:3000
```

如果后端部署在其它地址（例如远程服务器或容器），只需要修改这个地址即可。

---

## 启动方式

### 1. 启动后端（backend）

在终端中执行：

```bash
cd D:\backend

# 首次编译（可选）
npm run build

# 开发模式（推荐本地调试）
npm run dev
```

成功后终端会显示类似日志（若有多网卡会多一行 LAN 地址）：

```text
Backend server is running on http://localhost:3000
  LAN access: http://192.168.x.x:3000
```

此时后端会暴露接口：

- `POST /api/translate`：调用 DeepSeek 进行文本翻译（前端在用）。
- `POST /api/tts`：可选，调用 Azure TTS 返回音频流（当前前端已改为浏览器朗读，可不配置 Azure）。

### 2. 启动前端（frontend）

在另一个终端窗口中执行：

```bash
cd D:\frontend
npm run dev
```

启动成功后，你会看到类似输出：

```text
VITE vX.X.X  ready in XXX ms
  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
```

使用浏览器打开 `http://localhost:5173/` 即可访问前端页面。

---

## 外部可访问的网址（局域网 / 外网）

### 局域网访问（同一 WiFi 下的手机、平板、其它电脑）

- 后端已监听 `0.0.0.0:3000`，前端 Vite 已开启 `host: true`，会显示 **Network** 地址。
- 启动后端和前端后，在终端里找到：
  - 后端的 **LAN access: http://192.168.x.x:3000**
  - 前端的 **Network: http://192.168.x.x:5173/**
- 同一局域网内的设备用浏览器打开前端的 Network 地址（如 `http://192.168.1.100:5173/`）即可使用。
- 若前端要连到该机器上的后端，需把前端的 `VITE_API_BASE_URL` 设为该机的局域网地址，例如：
  - 在 `frontend/.env` 中写：`VITE_API_BASE_URL=http://192.168.1.100:3000`（把 `192.168.1.100` 换成你本机实际 LAN IP），然后重启前端 `npm run dev`。

### 外网访问（生成可从互联网打开的网址）

使用 **ngrok** 一次暴露后端和前端两个端口，得到两个公网 URL。项目里已提供 `backend/ngrok.yml` 配置。

#### 步骤 1：安装并登录 ngrok

- **安装**：本机已可通过 `winget install ngrok.ngrok` 安装；若未安装，在 PowerShell 执行该命令即可。
- **登录**：打开 [ngrok 获取 Authtoken](https://dashboard.ngrok.com/get-started/your-authtoken)，登录后复制你的 token，在本机执行一次：
  ```bash
  ngrok config add-authtoken <粘贴你的token>
  ```
  完成后即可使用下面的步骤或脚本。

#### 步骤 2：先启动后端和前端（保证 3000、5173 已在运行）

在**两个**终端里分别执行：

```bash
# 终端 A
cd D:\backend
npm run dev
```

```bash
# 终端 B
cd D:\frontend
npm run dev
```

确认后端输出 `Backend server is running on http://localhost:3000`，前端输出 `Local: http://localhost:5173/`。

#### 步骤 3：启动 ngrok，暴露 3000 和 5173

**方式 A（推荐）**：在**第三个**终端执行项目自带脚本（会自动更新前端 `.env` 并打印外网地址）：

```powershell
cd D:\backend
.\start-ngrok.ps1
```

按脚本提示重启前端后，用脚本给出的**前端** https 地址在浏览器打开即可。

**方式 B**：手动启动 ngrok：

```bash
cd D:\backend
ngrok start --config ngrok.yml backend frontend
```

终端里会显示两个公网地址，例如：

```text
backend   https://xxxx-backend.ngrok-free.app  -> http://localhost:3000
frontend  https://xxxx-frontend.ngrok-free.app -> http://localhost:5173
```

记下 **backend** 对应的 `https://...` 和 **frontend** 对应的 `https://...`。

#### 步骤 4：把后端公网地址写给前端

打开 `D:\frontend\.env`，把接口地址改成**后端**的 ngrok 地址（不要带末尾斜杠），例如：

```bash
VITE_API_BASE_URL=https://xxxx-backend.ngrok-free.app
```

保存后，回到**终端 B**（跑前端的那个），按 `Ctrl+C` 停掉前端，再执行一次：

```bash
cd D:\frontend
npm run dev
```

#### 步骤 5：用外网网址打开页面

在手机或任意能上网的设备的浏览器里，打开 **frontend** 对应的 ngrok 地址（如 `https://xxxx-frontend.ngrok-free.app`），即可从互联网访问翻译页面；翻译请求会发到你本机的后端再走 DeepSeek。

> 说明：每次重新运行 `ngrok start`，免费版会变域名；若域名变了，需要重新改一次 `frontend/.env` 里的 `VITE_API_BASE_URL` 并重启前端。

---

## 页面使用说明

1. 打开浏览器访问前端地址：`http://localhost:5173/`。
2. 在左侧「原文」面板：
   - 选择 **源语言**（或保持「自动检测」）。
   - 在文本框输入想要翻译的内容。
3. 在右侧「译文」面板：
   - 选择 **目标语言**（例如中文、英文、日文等）。
4. 点击左下角 **「翻译」** 按钮：
   - 前端会调用 `/api/translate`，后端通过 DeepSeek 返回翻译结果。
   - 翻译成功后，右侧「译文」文本框会显示译文。
5. 朗读功能（使用浏览器自带语音，无需配置）：
   - 点击 **「朗读原文」**：按原文语言朗读左侧文本。
   - 点击 **「朗读译文」**：按目标语言朗读右侧译文。
6. 点击 **「清空」** 按钮：
   - 会清空原文与译文，并重置错误提示和当前音频。

如果遇到错误（如网络问题、Key 配置异常），页面底部会出现红色提示条，展示相应错误信息。

---

## 基本功能自测清单

以下是建议在本地完成的最小自测：

### 1. 翻译功能

- **用例 1：中文 → 英文**
  - 源语言选择「自动检测」或「中文」。
  - 目标语言选择「英语（美国）」。
  - 输入一段中文（例如：「今天天气很好，我们去公园散步。」）。
  - 点击「翻译」，确认右侧出现相对自然的英文译文。

- **用例 2：英文 → 中文**
  - 源语言选择「自动检测」或「英语（美国）」。
  - 目标语言选择「中文（简体）」。
  - 输入一段英文句子，确认翻译结果符合预期。

- **边界用例：空文本**
  - 不输入任何内容直接点击「翻译」，页面应给出「请输入要翻译的文本」之类的友好提示，而不是直接报错。

### 2. 朗读功能（浏览器语音）

- **用例 1：朗读原文**
  - 输入一段中文或英文，点击「朗读原文」：
    - 页面不应报错，能听到系统语音朗读对应语言。

- **用例 2：朗读译文**
  - 完成一次翻译后，点击「朗读译文」：
    - 能听到目标语言版本的朗读。

- **边界用例：无文本朗读**
  - 在没有输入原文或没有翻译结果时点击「朗读」按钮：
    - 页面应提示「没有可朗读的原文 / 译文」，而不是静默失败或报错。

### 3. 界面显示与适配

- **桌面端**
  - 浏览器宽度在 1024px 以上时，左右面板应并排显示。
  - 面板为白底、圆角、有轻微阴影，无夸张渐变背景。

- **移动端**
  - 在浏览器开发者工具中切换到手机尺寸（宽度 < 768px）：
    - 左右面板应上下堆叠。
    - 文本输入区高度适中，可滚动。
  - 在更窄的宽度下（< 480px）：
    - 按钮与下拉框应尽量占满一行，便于手指点击。

---

## 常见问题（FAQ）

### 1. 后端启动时报「Missing script: dev」

请确认当前终端所在目录是 `D:\backend`，然后再执行：

```bash
cd D:\backend
npm run dev
```

在 `D:\` 根目录执行 `npm run dev` 会因为没有对应脚本而报错。

### 2. 翻译接口失败

请检查：`.env` 中 `DEEPSEEK_API_KEY` 是否填写正确；DeepSeek 账号是否有额度；后端终端是否有 401/403/429 等错误输出。朗读使用浏览器语音，无需配置。

如果你在某一步卡住了，可以把报错信息或截图发给助手，让它帮忙进一步排查。

---

## 部署为「随时可访问」的固定网址

若希望得到一个**不依赖本机、随时可访问**的固定网址，请把前后端部署到云端。详见 [DEPLOY.md](DEPLOY.md)：后端部署到 Render、前端部署到 Vercel 后，会得到类似 `https://xxx.vercel.app` 的固定链接，可长期使用。

