/**
 * 使用浏览器自带的语音合成（Web Speech API）朗读文本。
 * 无需后端、无需 API Key，打开页面即可使用。
 *
 * @param text 要朗读的文本
 * @param lang 语言代码（如 zh-CN、en-US），用于选择发音
 */
export function speakWithBrowser(text: string, lang: string): void {
  if (!text.trim()) return;

  if (!("speechSynthesis" in window)) {
    throw new Error("当前浏览器不支持语音朗读，请使用 Chrome、Edge 或 Safari。");
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 1;
  utterance.volume = 1;

  window.speechSynthesis.speak(utterance);
}
