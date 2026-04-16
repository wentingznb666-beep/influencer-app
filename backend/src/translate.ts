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

      "Content-Type": "application/json; charset=utf-8",

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



/**

 * 使用 DeepSeek 批量翻译 UI 文本，并返回与输入等长的翻译数组。

 *

 * @param texts 待翻译文本数组

 * @param targetLang 目标语言（如 th）

 */

export async function translateBatchWithDeepseek(

  texts: string[],

  targetLang: string,

): Promise<string[]> {

  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {

    throw new Error("DEEPSEEK_API_KEY is not set in environment variables.");

  }

  if (!Array.isArray(texts) || texts.length === 0) return [];



  const systemPrompt =

    `你是一名 UI 国际化翻译助手。` +

    `请将用户提供的 JSON 字符串数组中的每一项翻译为 ${targetLang}。` +

    `必须严格返回 JSON 字符串数组，长度与输入一致，不要输出任何额外说明。`;



  const payload = {

    model: "deepseek-chat",

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



  const content =

    response.data?.choices?.[0]?.message?.content?.trim() ?? "";

  if (!content) {

    throw new Error("Empty translation result from DeepSeek.");

  }



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



