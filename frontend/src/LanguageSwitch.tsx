import { useLanguage } from "./i18n";

/**
 * 中/泰语言切换按钮组 — 带翻译提示
 */
export default function LanguageSwitch() {
  const { lang, setLang } = useLanguage();
  return (
    <div
      data-no-auto-translate
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
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
        title="中文视图（原始内容）"
        style={{
          padding: "6px 12px",
          border: "none",
          background: lang === "zh" ? "var(--xt-primary)" : "transparent",
          color: lang === "zh" ? "#fff" : "var(--xt-text-muted)",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: lang === "zh" ? 700 : 500,
          transition: "all 150ms ease",
        }}
      >
        中文
      </button>
      <button
        type="button"
        onClick={() => setLang("th")}
        title="泰文视图（自动翻译）"
        style={{
          padding: "6px 12px",
          border: "none",
          borderLeft: "1px solid var(--xt-border)",
          background: lang === "th" ? "var(--xt-accent)" : "transparent",
          color: lang === "th" ? "#fff" : "var(--xt-text-muted)",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: lang === "th" ? 700 : 500,
          transition: "all 150ms ease",
        }}
      >
        🇹🇭 ไทย
      </button>
    </div>
  );
}
