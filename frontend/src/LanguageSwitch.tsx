import { useLanguage } from "./i18n";

/**
 * 语言切换控件：支持中文/泰语。
 */
export default function LanguageSwitch() {
  const { lang, setLang } = useLanguage();
  return (
    <div data-no-auto-translate style={{ display: "inline-flex", border: "1px solid #dbe1ea", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
      <button
        type="button"
        onClick={() => setLang("zh")}
        style={{
          padding: "6px 10px",
          border: "none",
          background: lang === "zh" ? "#1d4ed8" : "transparent",
          color: lang === "zh" ? "#fff" : "#334155",
          cursor: "pointer",
          fontSize: 12,
        }}
      >
        中文
      </button>
      <button
        type="button"
        onClick={() => setLang("th")}
        style={{
          padding: "6px 10px",
          border: "none",
          background: lang === "th" ? "#1d4ed8" : "transparent",
          color: lang === "th" ? "#fff" : "#334155",
          cursor: "pointer",
          fontSize: 12,
        }}
      >
        ไทย
      </button>
    </div>
  );
}
