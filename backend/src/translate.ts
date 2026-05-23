import axios from "axios";


const DEEPSEEK_API_URL =
  process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/chat/completions";


/** 使用 DeepSeek 接口执行单条文本翻译 */
export async function translateTextWithDeepseek(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set in environment variables.");

  const systemPrompt = `你是一名专业的翻译助手。请将用户提供的文本从 ${sourceLang} 翻译成 ${targetLang}，只输出翻译后的内容，不要添加任何解释或额外文字。`;

  const payload = {
    model: "deepseek-v4-flash",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ],
  };

  const response = await axios.post(DEEPSEEK_API_URL, payload, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${apiKey}`,
    },
    timeout: 30000,
  });

  const content = response.data?.choices?.[0]?.message?.content?.trim() ?? "";
  if (!content) throw new Error("Empty translation result from DeepSeek.");
  return content;
}


/** 使用 DeepSeek 批量翻译 UI 文本 */
export async function translateBatchWithDeepseek(
  texts: string[],
  targetLang: string,
): Promise<string[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set in environment variables.");
  if (!Array.isArray(texts) || texts.length === 0) return [];

  const systemPrompt =
    `你是一名专业的中文→泰语翻译助手，专门为跨境电商/达人分发平台工作。` +
    `请将用户提供的 JSON 字符串数组中的每一项翻译为 ${targetLang}。` +
    `要求：\n` +
    `1. 理解中文的实际含义和语境，翻译为自然流畅的泰语，而非字面直译\n` +
    `2. 保留英文单词、品牌名、URL、数字、emoji 不翻译\n` +
    `3. 电商专业术语使用泰国电商行业通用表达\n` +
    `4. 必须严格返回 JSON 字符串数组，长度与输入一致，不要输出任何额外说明。`;

  const payload = {
    model: "deepseek-v4-flash",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify(texts) },
    ],
    temperature: 0.2,
  };

  const response = await axios.post(DEEPSEEK_API_URL, payload, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${apiKey}`,
    },
    timeout: 30000,
  });

  const content = response.data?.choices?.[0]?.message?.content?.trim() ?? "";
  if (!content) throw new Error("Empty translation result from DeepSeek.");

  const firstBracket = content.indexOf("[");
  const lastBracket = content.lastIndexOf("]");
  const jsonCandidate =
    firstBracket >= 0 && lastBracket > firstBracket
      ? content.slice(firstBracket, lastBracket + 1)
      : content;
  const parsed = JSON.parse(jsonCandidate);
  if (!Array.isArray(parsed) || parsed.length !== texts.length) {
    throw new Error("Invalid translation array shape from DeepSeek.");
  }
  return parsed.map((v) => String(v));
}
