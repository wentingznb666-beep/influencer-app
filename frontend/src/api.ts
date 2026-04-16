export interface TranslateRequestPayload {

  text: string;

  sourceLang: string;

  targetLang: string;

}



export interface TranslateResponsePayload {

  translatedText: string;

}



export interface TtsRequestPayload {

  text: string;

  lang: string;

  voice?: string;

}



/**

 * 获取后端 API 的基础地址。

 * 优先读取前端环境变量，以便在不同环境中灵活切换后端地址。

 */

function getApiBaseUrl(): string {

  const baseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

  return baseUrl || window.location.origin;

}



/**

 * 调用后端翻译接口，获取 DeepSeek 翻译结果。

 *

 * @param payload 包含原文、源语言和目标语言的请求体

 * @returns 解析后的译文字符串

 * @throws 当网络错误或后端返回错误状态码时抛出异常

 */

export async function requestTranslate(

  payload: TranslateRequestPayload,

): Promise<string> {

  const response = await fetch(`${getApiBaseUrl()}/api/translate`, {

    method: "POST",

    headers: {

      "Content-Type": "application/json; charset=utf-8",

    },

    body: JSON.stringify(payload),

  });



  if (!response.ok) {

    const errorBody = await response.json().catch(() => null);

    const message =

      (errorBody && (errorBody.message as string)) ||

      `翻译请求失败，状态码：${response.status}`;

    throw new Error(message);

  }



  const data = (await response.json()) as TranslateResponsePayload;

  return data.translatedText;

}



/**

 * 调用后端 TTS 接口，将文本转换为音频并返回可播放的 URL。

 *

 * @param payload 包含文本、语言和可选语音名称的请求体

 * @returns 可以直接赋值给 HTMLAudioElement 的对象 URL

 * @throws 当网络错误或后端返回错误状态码时抛出异常

 */

export async function requestTts(

  payload: TtsRequestPayload,

): Promise<string> {

  const response = await fetch(`${getApiBaseUrl()}/api/tts`, {

    method: "POST",

    headers: {

      "Content-Type": "application/json; charset=utf-8",

    },

    body: JSON.stringify(payload),

  });



  if (!response.ok) {

    const errorBody = await response.json().catch(() => null);

    const message =

      (errorBody && (errorBody.message as string)) ||

      `朗读请求失败，状态码：${response.status}`;

    throw new Error(message);

  }



  const blob = await response.blob();

  const objectUrl = URL.createObjectURL(blob);

  return objectUrl;

}



