import axios from "axios";

/**
 * 根据语言代码推导默认的 Azure 语音名称。
 *
 * @param lang 语言代码（如 zh-CN、en-US），可为简写 zh/en
 * @returns Azure 语音名称字符串
 */
function getDefaultAzureVoice(lang?: string): string {
  const normalized = (lang || "en-US").toLowerCase();

  if (normalized.startsWith("zh")) {
    // 简体中文默认女声
    return "zh-CN-XiaoxiaoNeural";
  }

  if (normalized.startsWith("ja")) {
    return "ja-JP-NanamiNeural";
  }

  if (normalized.startsWith("ko")) {
    return "ko-KR-SunHiNeural";
  }

  // 英文默认美式女声
  return "en-US-JennyNeural";
}

/**
 * 将文本通过 Azure Speech 服务合成为音频。
 *
 * @param text 待合成的文本内容
 * @param lang 语言代码（如 zh-CN、en-US），用于选择合适的语音
 * @param voice 可选的具体语音名称，若未提供则按语言自动推导
 * @returns 包含音频数据的 Buffer，格式默认为 mp3
 * @throws 当环境变量未配置或 Azure 接口调用失败时抛出错误
 */
export async function synthesizeSpeechWithAzure(
  text: string,
  lang?: string,
  voice?: string,
): Promise<Buffer> {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;

  if (!key || !region) {
    throw new Error(
      "AZURE_SPEECH_KEY or AZURE_SPEECH_REGION is not set in environment variables.",
    );
  }

  const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const voiceName = voice || getDefaultAzureVoice(lang);

  const ssml = `
<speak version="1.0" xml:lang="${lang || "en-US"}">
  <voice name="${voiceName}">${text}</voice>
</speak>`;

  const response = await axios.post<ArrayBuffer>(endpoint, ssml, {
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-16khz-32kbitrate-mono-mp3",
      "User-Agent": "deepseek-translate-site",
    },
    responseType: "arraybuffer",
    timeout: 30000,
  });

  return Buffer.from(response.data);
}

