import { useLanguage } from "./i18n";

/**
 * 语言切换：湘泰品牌 — 选中项使用主色/点缀色区分。
 */
export default function LanguageSwitch() {
  const { lang, setLang } = useLanguage();
  return (
    <div
      data-no-auto-translate
      style={{
        display: "inline-flex",
        border: "1px solid var(--xt-border)",
        borderRadius: 10,
        overflow: "hidden",
        background: "var(--xt-surface)",
        boxShadow: "0 1px 2px rgba(21, 42, 69, 0.06)",
      }}
    >
      <button
        type="button"
        onClick={() => setLang("zh")}
        style={{
          padding: "6px 10px",
          border: "none",
          background: lang === "zh" ? "var(--xt-primary)" : "transparent",
          color: lang === "zh" ? "#fff" : "var(--xt-text-muted)",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: lang === "zh" ? 600 : 500,
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
          borderLeft: "1px solid var(--xt-border)",
          background: lang === "th" ? "var(--xt-accent)" : "transparent",
          color: lang === "th" ? "#fff" : "var(--xt-text-muted)",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: lang === "th" ? 600 : 500,
        }}
      >
        ไทย
      </button>
    </div>
  );
}
