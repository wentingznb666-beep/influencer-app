import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { TH_UI_DICT } from "./locales/th";

type Lang = "zh" | "th";

type LangContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
};

const LangContext = createContext<LangContextValue | null>(null);

const TEXT_CACHE_KEY = "influencer_app_i18n_th_cache_v1";
const translatedCache = new Map<string, string>();
const originalTextByNode = new WeakMap<Text, string>();

/**
 * 判断是否为低端设备：
 * - 低端设备上 useLayoutEffect 可能阻塞首屏绘制，故降级为 useEffect。
 * - 仅用于“泰语自动翻译”的性能优化，不影响业务逻辑。
 */
function isLowEndDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const anyNav = navigator as any;
  const cores = typeof anyNav.hardwareConcurrency === "number" ? anyNav.hardwareConcurrency : 8;
  const mem = typeof anyNav.deviceMemory === "number" ? anyNav.deviceMemory : 8;
  return cores <= 2 || mem <= 2;
}

/**
 * 将固定词典注入到翻译缓存中：
 * - 优先使用人工校对的泰语翻译，避免自动翻译不稳定或遗漏。
 * - 不影响原有缓存机制：缓存仍可覆盖未命中的文本节点。
 */
function seedThaiDictionary(): void {
  Object.entries(TH_UI_DICT).forEach(([k, v]) => {
    if (typeof k !== "string" || !k.trim()) return;
    if (typeof v !== "string" || !v.trim()) return;
    translatedCache.set(k, v);
  });
}

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

/**
 * 仅泰语模式下预热缓存（生产环境生效）：
 * - 在首次渲染前让 translatedCache 就绪，避免泰语模式出现“先中文后泰语”的闪烁。
 * - 优先注入 TH_UI_DICT，减少首屏触发网络翻译请求。
 */
function bootstrapThaiCacheIfNeeded(): void {
  if (typeof window === "undefined") return;
  if (!import.meta.env.PROD) return;
  const currentLang = localStorage.getItem("influencer_app_lang");
  if (currentLang !== "th") return;
  // 先载入历史缓存，再注入固定词典（固定词典优先级更高）
  loadCache();
  seedThaiDictionary();
}

bootstrapThaiCacheIfNeeded();

async function requestBatchTranslate(texts: string[], targetLang: "th"): Promise<string[]> {
  const base = (import.meta.env.VITE_API_BASE_URL as string) || window.location.origin;
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

  /**
   * 泰语翻译的渲染时机优化（仅生产环境）：
   * - 默认用 useLayoutEffect 在绘制前替换文本，避免闪烁；
   * - 低端设备降级为 useEffect，避免阻塞首屏。
   */
  const useTranslatorEffect = import.meta.env.PROD && isLowEndDevice() ? useEffect : useLayoutEffect;

  useTranslatorEffect(() => {
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

      // 仅泰语模式下确保字典优先级（避免首屏依赖网络翻译）
      if (import.meta.env.PROD) seedThaiDictionary();

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
