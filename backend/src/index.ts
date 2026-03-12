import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import os from "os";
import { translateTextWithDeepseek } from "./translate";
import { synthesizeSpeechWithAzure } from "./ttsAzure";
import { requestId, auditLog, loginRateLimit } from "./middlewares";
import authRoutes from "./routes/auth";
import materialsRoutes from "./routes/materials";
import tasksRoutes from "./routes/tasks";
import influencersRoutes from "./routes/influencers";
import submissionsRoutes from "./routes/submissions";
import pointsRoutes from "./routes/points";
import auditRoutes from "./routes/audit";
import settlementRoutes from "./routes/settlement";
import riskControlRoutes from "./routes/riskControl";
import influencerRoutes from "./routes/influencer";
import clientRoutes from "./routes/client";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors({ origin: "*" }));
app.use(requestId);
app.use(auditLog);

/** 达人分发 APP：鉴权与用户相关接口 */
app.use("/api/auth", loginRateLimit, authRoutes);
/** 管理员端：素材、任务、达人、投稿、积分、审计 */
app.use("/api/admin/materials", materialsRoutes);
app.use("/api/admin/tasks", tasksRoutes);
app.use("/api/admin/influencers", influencersRoutes);
app.use("/api/admin/submissions", submissionsRoutes);
app.use("/api/admin/points", pointsRoutes);
app.use("/api/admin/audit", auditRoutes);
app.use("/api/admin/settlement", settlementRoutes);
app.use("/api/admin/risk", riskControlRoutes);
/** 达人端：任务大厅、领取、我的任务、投稿、积分 */
app.use("/api/influencer", influencerRoutes);
/** 客户端：合作意向、订单跟踪、达人作品、积分充值 */
app.use("/api/client", clientRoutes);

/**
 * 统一错误处理中间件，确保接口返回结构化错误信息。
 */
function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const statusCode = (err as { statusCode?: number }).statusCode ?? 500;
  const message = err.message === "UNAUTHORIZED" ? "未登录或令牌无效。" : err.message === "FORBIDDEN" ? "无权限访问。" : "服务器内部错误，请稍后重试。";
  if (statusCode >= 500) console.error("Unexpected error:", err);
  res.status(statusCode).json({
    error: err.message || "INTERNAL_SERVER_ERROR",
    message: typeof err.message === "string" && !["UNAUTHORIZED", "FORBIDDEN", "TOKEN_INVALID_OR_EXPIRED"].includes(err.message) ? err.message : message,
  });
}

/**
 * 翻译接口：接收原文和语言参数，调用 DeepSeek 完成翻译。
 */
app.post("/api/translate", async (req: Request, res: Response) => {
  const { text, sourceLang, targetLang } = req.body ?? {};

  if (!text || typeof text !== "string") {
    return res.status(400).json({
      error: "INVALID_TEXT",
      message: "请求参数 text 不能为空，并且必须为字符串。",
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
 * 朗读接口：接收文本和语言信息，调用 Azure TTS 返回音频流。
 */
app.post("/api/tts", async (req: Request, res: Response) => {
  const { text, lang, voice } = req.body ?? {};

  if (!text || typeof text !== "string") {
    return res.status(400).json({
      error: "INVALID_TEXT",
      message: "请求参数 text 不能为空，并且必须为字符串。",
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

app.listen(Number(port), "0.0.0.0", () => {
  const local = `http://localhost:${port}`;
  const ip = getLocalIp();
  const lan = ip ? `http://${ip}:${port}` : null;
  console.log(`Backend server is running on ${local}`);
  if (lan) console.log(`  LAN access: ${lan}`);
});

