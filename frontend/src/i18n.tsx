import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

type Lang = "zh" | "th";

type LangContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
};

const LangContext = createContext<LangContextValue | null>(null);

const TEXT_CACHE_KEY = "influencer_app_i18n_th_cache_v1";
const translatedCache = new Map<string, string>();
const originalTextByNode = new WeakMap<Text, string>();

function loadCache(): void {
  try {
    const raw = localStorage.getItem(TEXT_CACHE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw) as Record<string, string>;
    Object.keys(obj).forEach((k) => translatedCache.set(k, obj[k]));
  } catch {
    // ignore cache parse errors
  }
}

function persistCache(): void {
  try {
    const obj: Record<string, string> = {};
    translatedCache.forEach((v, k) => {
      obj[k] = v;
    });
    localStorage.setItem(TEXT_CACHE_KEY, JSON.stringify(obj));
  } catch {
    // ignore storage errors
  }
}

async function requestBatchTranslate(texts: string[], targetLang: "th"): Promise<string[]> {
  const base = (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:3000";
  const res = await fetch(`${base}/api/translate/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts, targetLang }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.message as string) || "翻译失败");
  return (data.translated || []) as string[];
}

function collectTextNodes(root: HTMLElement): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const list: Text[] = [];
  let cur: Node | null = walker.nextNode();
  while (cur) {
    const node = cur as Text;
    const value = node.nodeValue?.trim() ?? "";
    const parent = node.parentElement;
    if (
      value &&
      parent &&
      !parent.closest("[data-no-auto-translate]") &&
      parent.tagName !== "SCRIPT" &&
      parent.tagName !== "STYLE" &&
      parent.tagName !== "CODE"
    ) {
      list.push(node);
    }
    cur = walker.nextNode();
  }
  return list;
}

/**
 * 自动翻译当前界面的文本节点（中文<->泰语）。
 */
function UiAutoTranslator({ lang }: { lang: Lang }) {
  const location = useLocation();

  useEffect(() => {
    loadCache();
  }, []);

  useEffect(() => {
    const root = document.getElementById("root");
    if (!root) return;

    let destroyed = false;
    const apply = async () => {
      if (destroyed) return;
      const nodes = collectTextNodes(root);

      if (lang === "zh") {
        nodes.forEach((node) => {
          const original = originalTextByNode.get(node);
          if (original !== undefined) node.nodeValue = original;
        });
        return;
      }

      const pendingTexts: string[] = [];
      const seen = new Set<string>();
      nodes.forEach((node) => {
        const current = node.nodeValue ?? "";
        const source = originalTextByNode.get(node) ?? current;
        if (!originalTextByNode.has(node)) originalTextByNode.set(node, source);
        const text = source.trim();
        if (!text || translatedCache.has(text) || seen.has(text)) return;
        seen.add(text);
        pendingTexts.push(text);
      });

      if (pendingTexts.length > 0) {
        try {
          const translated = await requestBatchTranslate(pendingTexts, "th");
          pendingTexts.forEach((t, i) => translatedCache.set(t, translated[i] ?? t));
          persistCache();
        } catch {
          // ignore translation request errors to avoid blocking UI
        }
      }

      nodes.forEach((node) => {
        const source = (originalTextByNode.get(node) ?? node.nodeValue ?? "").trim();
        if (!source) return;
        const target = translatedCache.get(source);
        if (target) node.nodeValue = node.nodeValue?.replace(source, target) ?? target;
      });
    };

    apply();
    const timer = window.setTimeout(apply, 300);
    return () => {
      destroyed = true;
      window.clearTimeout(timer);
    };
  }, [lang, location.pathname]);

  return null;
}

/**
 * 语言上下文 Provider：提供中文/泰语切换能力。
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const raw = localStorage.getItem("influencer_app_lang");
    return raw === "th" ? "th" : "zh";
  });

  const setLang = (next: Lang) => {
    setLangState(next);
    localStorage.setItem("influencer_app_lang", next);
  };

  const value = useMemo(() => ({ lang, setLang }), [lang]);

  return (
    <LangContext.Provider value={value}>
      {children}
      <UiAutoTranslator lang={lang} />
    </LangContext.Provider>
  );
}

/**
 * 使用全局语言上下文。
 */
export function useLanguage(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
