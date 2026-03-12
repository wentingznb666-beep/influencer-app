import { useMemo, useState } from "react";
import "./App.css";
import { requestTranslate } from "./api";
import { speakWithBrowser } from "./speech";

type LanguageCode = "auto" | "zh-CN" | "en-US" | "ja-JP" | "ko-KR" | "fr-FR" | "de-DE";

interface LanguageOption {
  code: LanguageCode;
  label: string;
}

const sourceLanguageOptions: LanguageOption[] = [
  { code: "auto", label: "自动检测" },
  { code: "zh-CN", label: "中文（简体）" },
  { code: "en-US", label: "英语（美国）" },
  { code: "ja-JP", label: "日语" },
  { code: "ko-KR", label: "韩语" },
  { code: "fr-FR", label: "法语" },
  { code: "de-DE", label: "德语" },
];

const targetLanguageOptions: LanguageOption[] = sourceLanguageOptions.filter(
  (item) => item.code !== "auto",
);

function App() {
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [sourceLang, setSourceLang] = useState<LanguageCode>("auto");
  const [targetLang, setTargetLang] = useState<LanguageCode>("en-US");
  const [loadingTranslate, setLoadingTranslate] = useState(false);
  const [loadingTts, setLoadingTts] = useState<"source" | "target" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isTranslateDisabled = useMemo(
    () => !sourceText.trim() || loadingTranslate,
    [sourceText, loadingTranslate],
  );

  /**
   * 触发翻译请求，调用后端 DeepSeek 接口并更新译文。
   */
  const handleTranslate = async () => {
    if (!sourceText.trim()) {
      setErrorMessage("请输入要翻译的文本。");
      return;
    }

    setErrorMessage(null);
    setLoadingTranslate(true);

    try {
      const translated = await requestTranslate({
        text: sourceText,
        sourceLang,
        targetLang,
      });
      setTranslatedText(translated);
    } catch (error: any) {
      setErrorMessage(error?.message || "翻译失败，请稍后重试。");
    } finally {
      setLoadingTranslate(false);
    }
  };

  /**
   * 清空输入和输出内容，重置错误信息。
   */
  const handleClear = () => {
    setSourceText("");
    setTranslatedText("");
    setErrorMessage(null);
  };

  /**
   * 使用浏览器自带语音朗读指定文本（无需后端、无需配置）。
   *
   * @param type 指定朗读原文还是译文
   */
  const handleSpeak = (type: "source" | "target") => {
    const textToSpeak =
      type === "source" ? sourceText.trim() : translatedText.trim();

    if (!textToSpeak) {
      setErrorMessage(type === "source" ? "没有可朗读的原文。" : "没有可朗读的译文。");
      return;
    }

    const langForSpeak =
      type === "source"
        ? sourceLang === "auto"
          ? "zh-CN"
          : sourceLang
        : targetLang;

    setErrorMessage(null);
    setLoadingTts(type);

    try {
      speakWithBrowser(textToSpeak, langForSpeak);
    } catch (error: any) {
      setErrorMessage(error?.message || "朗读失败，请稍后重试。");
    } finally {
      setLoadingTts(null);
    }
  };

  return (
    <div className="app-root">
      <header className="app-header">
        <h1 className="app-title">DeepSeek 翻译 · 朗读</h1>
        <p className="app-subtitle">基于 DeepSeek 翻译，支持浏览器朗读（无需额外配置）</p>
      </header>

      <main className="app-main">
        <section className="panel panel-left">
          <div className="panel-header">
            <span className="panel-title">原文</span>
            <select
              className="select"
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value as LanguageCode)}
            >
              {sourceLanguageOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <textarea
            className="textarea"
            placeholder="在这里输入要翻译的文本..."
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
          />
          <div className="panel-footer">
            <button
              className="button button-primary"
              onClick={handleTranslate}
              disabled={isTranslateDisabled}
            >
              {loadingTranslate ? "翻译中..." : "翻译"}
            </button>
            <button className="button button-ghost" onClick={handleClear}>
              清空
            </button>
            <button
              className="button button-ghost"
              onClick={() => handleSpeak("source")}
              disabled={loadingTts === "source" || !sourceText.trim()}
            >
              {loadingTts === "source" ? "朗读中..." : "朗读原文"}
            </button>
          </div>
        </section>

        <section className="panel panel-right">
          <div className="panel-header">
            <span className="panel-title">译文</span>
            <select
              className="select"
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value as LanguageCode)}
            >
              {targetLanguageOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <textarea
            className="textarea textarea-readonly"
            placeholder="译文将显示在这里..."
            value={translatedText}
            readOnly
          />
          <div className="panel-footer">
            <button
              className="button button-ghost"
              onClick={() => handleSpeak("target")}
              disabled={loadingTts === "target" || !translatedText.trim()}
            >
              {loadingTts === "target" ? "朗读中..." : "朗读译文"}
            </button>
          </div>
        </section>
      </main>

      {errorMessage && <div className="error-banner">{errorMessage}</div>}
    </div>
  );
}

export default App;
