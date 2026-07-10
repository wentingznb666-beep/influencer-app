import express, { Request, Response, NextFunction } from "express";

import helmet from "helmet";

import cors from "cors";

import dotenv from "dotenv";

import os from "os";

import fs from "fs";

import path from "path";

import { translateBatchWithDeepseek, translateTextWithDeepseek } from "./translate";

import { synthesizeSpeechWithAzure } from "./ttsAzure";

import { requestId, auditLog, loginRateLimit } from "./middlewares";

import { requireAuth } from "./auth";

import authRoutes from "./routes/auth";

import influencersRoutes from "./routes/influencers";

import pointsRoutes from "./routes/points";

import auditRoutes from "./routes/audit";

import settlementRoutes from "./routes/settlement";

import riskControlRoutes from "./routes/riskControl";

import influencerRoutes from "./routes/influencer";

import clientRoutes from "./routes/client";
import clientSkusRoutes from "./routes/clientSkus";
import clientMarketOrderRoutes from "./routes/clientMarketOrders";

import withdrawalsRoutes from "./routes/withdrawals";

import usersRoutes from "./routes/users";

import adminMarketOrdersRoutes from "./routes/adminMarketOrders";

import adminProfitRoutes from "./routes/adminProfit";

import adminSkusRoutes from "./routes/adminSkus";

import operationLogsRoutes from "./routes/operationLogs";

import modelsRoutes, { adminPhotosRouter, employeePhotosRouter } from "./routes/models";

import clientModelsRoutes from "./routes/clientModels";

import showcaseInfluencersRoutes from "./routes/showcaseInfluencers";

import showcaseContentCreatorsRoutes from "./routes/showcaseContentCreators";

import clientShowcaseInfluencersRoutes from "./routes/clientShowcaseInfluencers";

import clientShowcaseContentCreatorsRoutes from "./routes/clientShowcaseContentCreators";

import matchingRoutes from "./routes/matching";
import matchingBizRoutes from "./routes/matchingBiz";

import videoOrdersClientRoutes from "./routes/videoOrdersClient";
import videoOrdersEmployeeRoutes from "./routes/videoOrdersEmployee";
import videoOrdersAdminRoutes from "./routes/videoOrdersAdmin";

import { adminInfluencerProfiles, clientInfluencerProfiles, influencerProfiles } from "./routes/influencerProfiles";
import { adminConnections, clientConnections, influencerConnections } from "./routes/connections";
import { purchaseAdminDemandsRoutes, purchaseInfluencerDemandsRoutes, purchaseProductsRoutes, purchaseRecommendationsRoutes, purchaseAdminOrderRoutes, purchaseInfluencerOrderRoutes, purchaseCozeCallbackRouter, purchaseCozeConfigRouter, purchaseSuppliersRouter, purchaseFinanceRouter, purchaseDashboardRouter, purchaseMaintenanceRouter } from "./routes/purchase";

import { initDb } from "./db";

import { ensureUploadsSubdirs, getUploadsRoot } from "./uploadsConfig";



dotenv.config();



const app = express();

const port = process.env.PORT || 3000;

const TRANSLATE_TEXT_MAX_CHARS = 5_000;
const TRANSLATE_BATCH_ITEM_MAX_CHARS = 2_000;
const TRANSLATE_BATCH_TOTAL_MAX_CHARS = 20_000;
const TTS_TEXT_MAX_CHARS = 1_000;

function countChars(value: string): number {
  return Array.from(value).length;
}



app.use(helmet());
app.use(express.json({ limit: "5mb" }));

const isProduction = process.env.NODE_ENV === "production";
const corsOrigins = (process.env.CORS_ORIGIN || (!isProduction ? "http://localhost:5173,http://localhost:3000" : ""))
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    return cb(null, corsOrigins.includes(origin));
  },
  credentials: true,
}));

/** 上传文件公开访问，用于图片展示。 */
app.use("/uploads", express.static(getUploadsRoot()));

app.use(requestId);

app.use(auditLog);

/** 统一 JSON 响应编码为 UTF-8（仅拦截 res.json，不影响文件/音频流）。 */
app.use((_req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "application/json; charset=utf-8");
    return originalJson(body);
  }) as Response["json"];
  next();
});



/** 达人进货管理 — Coze 回调（公开接口，secret token 验证） */
app.use("/api/purchase/coze-callback", purchaseCozeCallbackRouter);

/** 达人分发 APP：鉴权与用户相关接口 */

app.use("/api/auth", loginRateLimit, authRoutes);

/** 管理员端：素材、任务、达人、投稿、积分、审计 */

app.use("/api/admin/materials", (_req: Request, res: Response) => {

  res.status(410).json({ error: "MODULE_DISABLED", message: "素材管理模块已下线。" });

});

app.use("/api/admin/tasks", (_req: Request, res: Response) => {

  res.status(410).json({ error: "MODULE_DISABLED", message: "任务管理模块已下线。" });

});

app.use("/api/admin/influencers", influencersRoutes);

app.use("/api/admin/submissions", (_req: Request, res: Response) => {

  res.status(410).json({ error: "MODULE_DISABLED", message: "投稿审核模块已下线。" });

});

app.use("/api/admin/points", pointsRoutes);

app.use("/api/admin/audit", auditRoutes);

app.use("/api/admin/settlement", settlementRoutes);

app.use("/api/admin/risk", riskControlRoutes);

app.use("/api/admin/withdrawals", withdrawalsRoutes);

app.use("/api/admin/users", usersRoutes);

app.use("/api/admin/profit", adminProfitRoutes);

app.use("/api/admin/market-orders", adminMarketOrdersRoutes);

app.use("/api/admin/skus", adminSkusRoutes);

app.use("/api/admin/models", modelsRoutes);

/** 管理员端：模特照片删除（与文档路径 /api/admin/photos 对齐；原 /api/admin/models/photos/* 仍可用） */

app.use("/api/admin/photos", adminPhotosRouter);

/** 员工端：本人上传的模特照片删除（与文档路径 /api/employee/photos 对齐） */

app.use("/api/employee/photos", employeePhotosRouter);

/** 管理员/员工：资源库（模特 / Influencer / Content Creator） */

app.use("/api/admin/showcase-influencers", showcaseInfluencersRoutes);

app.use("/api/admin/showcase-content-creators", showcaseContentCreatorsRoutes);

/** 视频分级订单（线下支付三类） */

app.use("/api/client", videoOrdersClientRoutes);
app.use("/api/employee", videoOrdersEmployeeRoutes);
/** 垂直达人建联 — 必须在 /api/admin 通配路由之前挂载 */
app.use("/api/admin/influencer-profiles", adminInfluencerProfiles);
app.use("/api/admin", adminConnections);
app.use("/api/admin/purchase/demands", purchaseAdminDemandsRoutes);
app.use("/api/admin/purchase/coze-config", purchaseCozeConfigRouter);
app.use("/api/admin/purchase/suppliers", purchaseSuppliersRouter);
app.use("/api/admin/purchase/finance", purchaseFinanceRouter);
app.use("/api/admin/purchase/dashboard", purchaseDashboardRouter);
app.use("/api/admin/purchase/maintenance", purchaseMaintenanceRouter);
app.use("/api/admin/purchase/products", purchaseProductsRoutes);
app.use("/api/admin/purchase/recommendations", purchaseRecommendationsRoutes);
app.use("/api/admin/purchase/orders", purchaseAdminOrderRoutes);
app.use("/api/admin", videoOrdersAdminRoutes);

/** 达人端：任务大厅、领取、我的任务、投稿、积分 */

app.use("/api/influencer", influencerRoutes);

/** 商家端：合作意向、订单跟踪、达人作品、积分充值 */

app.use("/api/client", clientRoutes);
app.use("/api/client", clientSkusRoutes);
app.use("/api/client", clientMarketOrderRoutes);

app.use("/api/client/models", clientModelsRoutes);

app.use("/api/client/showcase-influencers", clientShowcaseInfluencersRoutes);

app.use("/api/client/showcase-content-creators", clientShowcaseContentCreatorsRoutes);

/** 通用：我的操作日志 */

app.use("/api/operation-logs", operationLogsRoutes);

/** 商单撮合/达人合作池相关接口 */

app.use("/api/matching", matchingRoutes);
app.use("/api/matching", matchingBizRoutes);

/** 垂直达人建联模块 — 客户端和达人端路由 */
app.use("/api/client", clientConnections);
app.use("/api/client", clientInfluencerProfiles);
app.use("/api/influencer", influencerConnections);
app.use("/api/influencer", influencerProfiles);
app.use("/api/influencer/purchase/demands", purchaseInfluencerDemandsRoutes);
app.use("/api/influencer/purchase/orders", purchaseInfluencerOrderRoutes);

/**

 * 统一错误处理中间件，确保接口返回结构化错误信息。

 */

function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {

  const rawStatus = (err as { statusCode?: number; status?: number }).statusCode ?? (err as { status?: number }).status ?? 500;
  const statusCode = typeof rawStatus === "number" && Number.isFinite(rawStatus) ? rawStatus : 500;

  if ((err as { type?: string }).type === "entity.parse.failed") {
    res.status(400).json({ error: "INVALID_JSON", message: "请求体不是有效的 JSON。" });
    return;
  }

  const message =

    err.message === "UNAUTHORIZED"

      ? "未登录或令牌无效。"

      : err.message === "TOKEN_INVALID_OR_EXPIRED"

      ? "登录已过期，请重新登录。"

      : err.message === "FORBIDDEN"

      ? "无权限访问。"

      : "服务器内部错误，请稍后重试。";

  if (statusCode >= 500) console.error("Unexpected error:", err);

  res.status(statusCode).json({
    error: err.message || "INTERNAL_SERVER_ERROR",
    message,
  });

}



/**

 * 翻译接口：接收原文和语言参数，调用 DeepSeek 完成翻译。

 */

app.post("/api/translate", requireAuth, async (req: Request, res: Response) => {

  const { text, sourceLang, targetLang } = req.body ?? {};



  if (!text || typeof text !== "string") {

    return res.status(400).json({

      error: "INVALID_TEXT",

      message: "请求参数 text 不能为空，并且必须为字符串。",

    });

  }

  if (countChars(text) > TRANSLATE_TEXT_MAX_CHARS) {
    return res.status(400).json({
      error: "TEXT_TOO_LONG",
      message: `单次翻译最多 ${TRANSLATE_TEXT_MAX_CHARS} 字符。`,
    });
  }



  if (!targetLang || typeof targetLang !== "string") {

    return res.status(400).json({

      error: "INVALID_TARGET_LANG",

      message: "请求参数 targetLang 不能为空，并且必须为字符串。",

    });

  }



  try {

    const translatedText = await translateTextWithDeepseek(

      text,

      sourceLang || "auto",

      targetLang,

    );

    res.json({ translatedText });

  } catch (error: any) {

    console.error("Translate error:", error?.response?.data || error);

    res.status(502).json({

      error: "TRANSLATE_FAILED",

      message: "调用 DeepSeek 翻译失败，请稍后重试。",

    });

  }

});



/**

 * UI 批量翻译：与 frontend/src/i18n.tsx 一致，请求体 `{ texts: string[], targetLang }`，响应 `{ translated: string[] }`。

 * 可选 `items` 为 `{ text: string }[]` 或字符串数组，与 `texts` 二选一。

 */

app.post("/api/translate/batch", requireAuth, async (req: Request, res: Response) => {

  const body = req.body ?? {};

  const targetLang = body.targetLang;

  if (!targetLang || typeof targetLang !== "string") {

    return res.status(400).json({

      error: "INVALID_TARGET_LANG",

      message: "请求参数 targetLang 不能为空，并且必须为字符串。",

    });

  }



  let texts: string[] = [];

  if (Array.isArray(body.texts) && body.texts.every((t: unknown) => typeof t === "string")) {

    texts = body.texts as string[];

  } else if (Array.isArray(body.items)) {

    for (const raw of body.items) {

      if (typeof raw === "string") texts.push(raw);

      else if (raw && typeof raw === "object" && typeof (raw as { text?: unknown }).text === "string") {

        texts.push((raw as { text: string }).text);

      }

    }

  } else {

    return res.status(400).json({

      error: "INVALID_TEXTS",

      message: "请求参数 texts 必须为字符串数组，或使用 items 数组。",

    });

  }



  if (texts.length === 0) {

    return res.json({ translated: [] });

  }

  if (texts.length > 50) {

    return res.status(400).json({ error: "TOO_MANY_ITEMS", message: "单次最多 50 条。" });

  }

  if (texts.some((t) => typeof t !== "string")) {

    return res.status(400).json({

      error: "INVALID_TEXTS",

      message: "texts 每项须为字符串。",

    });

  }

  if (texts.some((t) => countChars(t) > TRANSLATE_BATCH_ITEM_MAX_CHARS)) {
    return res.status(400).json({
      error: "TEXT_TOO_LONG",
      message: `批量翻译单条最多 ${TRANSLATE_BATCH_ITEM_MAX_CHARS} 字符。`,
    });
  }

  const totalChars = texts.reduce((sum, t) => sum + countChars(t), 0);
  if (totalChars > TRANSLATE_BATCH_TOTAL_MAX_CHARS) {
    return res.status(400).json({
      error: "TEXT_TOO_LONG",
      message: `批量翻译总字符最多 ${TRANSLATE_BATCH_TOTAL_MAX_CHARS}。`,
    });
  }



  try {

    const translated = await translateBatchWithDeepseek(texts, targetLang);

    res.json({ translated });

  } catch (error: any) {

    console.error("Batch translate error:", error?.response?.data || error);

    res.status(502).json({

      error: "TRANSLATE_BATCH_FAILED",

      message: "调用 DeepSeek 批量翻译失败，请稍后重试。",

    });

  }

});



/**

 * 朗读接口：接收文本和语言信息，调用 Azure TTS 返回音频流。

 */

app.post("/api/tts", requireAuth, async (req: Request, res: Response) => {

  const { text, lang, voice } = req.body ?? {};



  if (!text || typeof text !== "string") {

    return res.status(400).json({

      error: "INVALID_TEXT",

      message: "请求参数 text 不能为空，并且必须为字符串。",

    });

  }

  if (countChars(text) > TTS_TEXT_MAX_CHARS) {
    return res.status(400).json({
      error: "TEXT_TOO_LONG",
      message: `单次朗读最多 ${TTS_TEXT_MAX_CHARS} 字符。`,
    });
  }



  try {

    const audioBuffer = await synthesizeSpeechWithAzure(text, lang, voice);

    res.setHeader("Content-Type", "audio/mpeg");

    res.setHeader("Content-Length", audioBuffer.length.toString());

    res.send(audioBuffer);

  } catch (error: any) {

    console.error("TTS error:", error?.response?.data || error);

    res.status(502).json({

      error: "TTS_FAILED",

      message: "调用语音合成失败，请稍后重试。",

    });

  }

});



/** 健康检查，供 Render / 负载均衡探测 */

app.get("/health", (_req: Request, res: Response) => {

  res.json({ ok: true });

});



/**

 * 若存在 frontend/dist，则同时托管前端静态资源。

 * 在 Render Web Service 部署时可实现前后端同域访问。

 */

function serveFrontendIfBuilt(appInstance: express.Express): void {

  /**
   * 优先托管 frontend-vue/dist（当前主前端），若不存在再回退到 frontend/dist（历史版本）。
   */
  const preferredDist = path.resolve(__dirname, "../../frontend-vue/dist");
  const legacyDist = path.resolve(__dirname, "../../frontend/dist");
  const frontendDist = fs.existsSync(preferredDist) ? preferredDist : legacyDist;

  if (!fs.existsSync(frontendDist)) {

    console.warn(`[frontend.static] dist not found: ${preferredDist} (preferred), ${legacyDist} (legacy)`);

    return;

  }



  appInstance.use(express.static(frontendDist));

  // 托管 LIFF 小程序静态文件
  const liffAppDir = path.resolve(__dirname, "../../liff-app");
  if (fs.existsSync(liffAppDir)) {
    appInstance.use("/liff", express.static(liffAppDir));
    console.log(`[liff.static] serving from ${liffAppDir}`);
  }



  /**

   * SPA 回退：除 /api 与 /uploads 外均返回 index.html。

   */

  appInstance.get(/^(?!\/api)(?!\/uploads)(?!\/liff).*/, (_req: Request, res: Response) => {

    res.sendFile(path.join(frontendDist, "index.html"));

  });



  console.log(`[frontend.static] serving from ${frontendDist}`);

}



serveFrontendIfBuilt(app);



app.use(errorHandler);



/** 获取本机局域网 IP，用于在启动时打印外部可访问地址 */

function getLocalIp(): string | null {

  const nets = os.networkInterfaces();

  for (const name of Object.keys(nets)) {

    const list = nets[name];

    if (!list) continue;

    for (const info of list) {

      if (info.family === "IPv4" && !info.internal) return info.address;

    }

  }

  return null;

}



/**

 * 启动入口：先初始化 Postgres（建表/默认数据），再启动 HTTP 服务。

 */

async function main(): Promise<void> {

  await initDb();

  ensureUploadsSubdirs();

  /** 部署后可在 Render 日志中搜索 “Uploads root” 核对 UPLOADS_ROOT 是否与磁盘挂载一致 */

  const uploadsResolved = getUploadsRoot();

  console.log(

    `[uploads] UPLOADS_ROOT env=${process.env.UPLOADS_ROOT != null && process.env.UPLOADS_ROOT !== "" ? JSON.stringify(process.env.UPLOADS_ROOT) : "(unset, using cwd/uploads)"} → resolved=${uploadsResolved}`

  );

  app.listen(Number(port), "0.0.0.0", () => {

    const local = `http://localhost:${port}`;

    const ip = getLocalIp();

    const lan = ip ? `http://${ip}:${port}` : null;

    console.log(`Backend server is running on ${local}`);

    if (lan) console.log(`  LAN access: ${lan}`);

  });

}



main().catch((e) => {

  console.error("Failed to start server:", e);

  process.exit(1);

});
