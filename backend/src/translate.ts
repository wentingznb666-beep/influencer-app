import axios from "axios";

const DEEPSEEK_API_URL =
  process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/chat/completions";

/**
 * 使用 DeepSeek Chat Completion 接口执行文本翻译。
 *
 * @param text 待翻译的原文内容
 * @param sourceLang 源语言代码（如 zh、en，或 auto 自动检测）
 * @param targetLang 目标语言代码（如 zh、en）
 * @returns DeepSeek 模型返回的译文字符串
 * @throws 当环境变量未配置或 DeepSeek 接口调用失败时抛出错误
 */
export async function translateTextWithDeepseek(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not set in environment variables.");
  }

  const systemPrompt = `你是一名专业的翻译助手。请将用户提供的文本从 ${sourceLang} 翻译成 ${targetLang}，只输出翻译后的内容，不要添加任何解释或额外文字。`;

  const payload = {
    model: "deepseek-chat",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ],
  };

  const response = await axios.post(DEEPSEEK_API_URL, payload, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    timeout: 30000,
  });

  const content =
    response.data?.choices?.[0]?.message?.content?.trim() ?? "";

  if (!content) {
    throw new Error("Empty translation result from DeepSeek.");
  }

  return content;
}

