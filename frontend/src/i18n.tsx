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

/** 可参与自动翻译的 DOM 属性名。 */
type AttrName = "placeholder" | "title" | "aria-label" | "alt";
const originalAttrByEl = new WeakMap<Element, Partial<Record<AttrName, string>>>();

let persistCacheTimer: number | null = null;
let translateGeneration = 0;
let networkInFlight = false;


/**
 * ??????? unicode ??????????
 */
function decodeEscapedText(input: string): string {
  let value = input;
  for (let i = 0; i < 2; i += 1) {
    const decoded = value
      .replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\x([0-9a-fA-F]{2})/g, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)));
    if (decoded === value) break;
    value = decoded;
  }
  return value;
}

/**
 * ?????????????\u4f59\u989d????????
 */
function normalizeTranslatedText(input: string): string {
  if (!input) return "";
  return decodeEscapedText(input).trim();
}

/**
 * 判断是否为低端设备（useLayoutEffect 降级为 useEffect，避免阻塞绘制）。
 */
function isLowEndDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const anyNav = navigator as Navigator & { hardwareConcurrency?: number; deviceMemory?: number };
  const cores = typeof anyNav.hardwareConcurrency === "number" ? anyNav.hardwareConcurrency : 8;
  const mem = typeof anyNav.deviceMemory === "number" ? anyNav.deviceMemory : 8;
  return cores <= 2 || mem <= 2;
}

/**
 * 将人工词典 TH_UI_DICT 注入内存缓存，优先于接口翻译。
 */
function seedThaiDictionary(): void {
  Object.entries(TH_UI_DICT).forEach(([k, v]) => {
    if (typeof k !== "string" || !k.trim()) return;
    if (typeof v !== "string" || !v.trim()) return;
    translatedCache.set(k, normalizeTranslatedText(v));
  });
}

/**
 * 从 localStorage 恢复历史泰语翻译缓存。
 */
function loadCache(): void {
  try {
    const raw = localStorage.getItem(TEXT_CACHE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw) as Record<string, string>;
    Object.keys(obj).forEach((k) => translatedCache.set(k, normalizeTranslatedText(obj[k])));
  } catch {
    // ignore
  }
}

/**
 * 将内存缓存全量写入 localStorage。
 */
function persistCache(): void {
  try {
    const obj: Record<string, string> = {};
    translatedCache.forEach((v, k) => {
      obj[k] = v;
    });
    localStorage.setItem(TEXT_CACHE_KEY, JSON.stringify(obj));
  } catch {
    // ignore
  }
}

/**
 * 防抖写入 localStorage，避免接口批量返回时连续 stringify 阻塞主线程。
 */
function schedulePersistCache(): void {
  if (persistCacheTimer !== null) window.clearTimeout(persistCacheTimer);
  persistCacheTimer = window.setTimeout(() => {
    persistCacheTimer = null;
    persistCache();
  }, 500);
}

/**
 * 生产环境且用户上次选择泰语时，在首屏前预热缓存以减少闪烁。
 */
function bootstrapThaiCacheIfNeeded(): void {
  if (typeof window === "undefined") return;
  if (!import.meta.env.PROD) return;
  const currentLang = localStorage.getItem("influencer_app_lang");
  if (currentLang !== "th") return;
  loadCache();
  seedThaiDictionary();
}

bootstrapThaiCacheIfNeeded();

/**
 * 调用后端批量翻译接口（仅用于缓存未命中的中文片段）。
 */
async function requestBatchTranslate(texts: string[], targetLang: "th"): Promise<string[]> {
  const base = (import.meta.env.VITE_API_BASE_URL as string) || window.location.origin;
  const res = await fetch(`${base}/api/translate/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts, targetLang }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.message as string) || "翻译失败");
  return ((data.translated || []) as string[]).map((t) => normalizeTranslatedText(typeof t === "string" ? t : ""));
}

/**
 * 收集 #root 内需翻译的文本节点（排除脚本、样式与 data-no-auto-translate）。
 */
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
 * 收集 placeholder / title / aria-label / alt 等待翻译的节点任务。
 */
function collectAttrJobs(root: HTMLElement): Array<{ el: Element; attr: AttrName }> {
  const result: Array<{ el: Element; attr: AttrName }> = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let cur: Node | null = walker.nextNode();
  while (cur) {
    const el = cur as Element;
    if (!el.closest("[data-no-auto-translate]")) {
      const tag = el.tagName;
      if (tag !== "SCRIPT" && tag !== "STYLE" && tag !== "CODE") {
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          if (el.placeholder?.trim()) result.push({ el, attr: "placeholder" });
        }
        for (const attr of ["title", "aria-label", "alt"] as const) {
          if (el.getAttribute(attr)?.trim()) result.push({ el, attr });
        }
      }
    }
    cur = walker.nextNode();
  }
  return result;
}

/**
 * 读取元素上指定可翻译属性的当前值。
 */
function readAttr(el: Element, attr: AttrName): string {
  if (attr === "placeholder") {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.placeholder;
    return "";
  }
  return el.getAttribute(attr) ?? "";
}

/**
 * 写入元素上指定可翻译属性。
 */
function writeAttr(el: Element, attr: AttrName, value: string): void {
  if (attr === "placeholder") {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.placeholder = value;
    return;
  }
  el.setAttribute(attr, value);
}

/**
 * 首次访问时缓存该属性的中文原文，供还原或作为翻译 key。
 */
function ensureAttrOriginal(el: Element, attr: AttrName): string {
  let bag = originalAttrByEl.get(el);
  if (!bag) {
    bag = {};
    originalAttrByEl.set(el, bag);
  }
  if (bag[attr] !== undefined) return bag[attr]!;
  const v = readAttr(el, attr);
  bag[attr] = v;
  return v;
}

/**
 * 在保持首尾空白的前提下，用译文替换 trim 后的 key 对应片段。
 */
function applyTranslatedToString(full: string, keyTrim: string, target: string): string {
  if (!keyTrim) return full;
  if (full.trim() !== keyTrim) return full;
  if (full === keyTrim) return target;
  return full.replace(keyTrim, target);
}

/**
 * 泰语：仅用内存缓存同步更新 DOM，不等待网络（点击切换后立即生效）。
 */
function applyThaiSync(root: HTMLElement): void {
  seedThaiDictionary();

  const nodes = collectTextNodes(root);
  for (const node of nodes) {
    const current = node.nodeValue ?? "";
    const fullSource = originalTextByNode.get(node) ?? current;
    if (!originalTextByNode.has(node)) originalTextByNode.set(node, fullSource);
    const key = fullSource.trim();
    if (!key) continue;
    const target = translatedCache.get(key);
    if (target) node.nodeValue = applyTranslatedToString(fullSource, key, normalizeTranslatedText(target));
  }

  for (const { el, attr } of collectAttrJobs(root)) {
    const full = ensureAttrOriginal(el, attr);
    const key = full.trim();
    if (!key) continue;
    const target = translatedCache.get(key);
    if (target) writeAttr(el, attr, applyTranslatedToString(full, key, normalizeTranslatedText(target)));
  }
}

/**
 * 中文：从 WeakMap 还原曾翻译过的文本节点与属性。
 */
function applyZh(root: HTMLElement): void {
  for (const node of collectTextNodes(root)) {
    const original = originalTextByNode.get(node);
    if (original !== undefined) node.nodeValue = original;
  }
  for (const { el, attr } of collectAttrJobs(root)) {
    const bag = originalAttrByEl.get(el);
    if (!bag || bag[attr] === undefined) continue;
    writeAttr(el, attr, bag[attr]!);
  }
}

/**
 * 汇总尚未命中缓存的中文 key（文本 + 属性），供批量接口补全。
 */
function collectPendingChineseKeys(root: HTMLElement): string[] {
  const pending: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const key = raw.trim();
    if (!key || translatedCache.has(key) || seen.has(key)) return;
    seen.add(key);
    pending.push(key);
  };

  for (const node of collectTextNodes(root)) {
    const full = originalTextByNode.get(node) ?? node.nodeValue ?? "";
    if (!originalTextByNode.has(node)) originalTextByNode.set(node, full);
    push(full);
  }
  for (const { el, attr } of collectAttrJobs(root)) {
    push(ensureAttrOriginal(el, attr));
  }
  return pending;
}

/**
 * 路由与语言变化时，对整棵界面树执行中泰切换（文本节点 + 可翻译属性）。
 */
function UiAutoTranslator({ lang }: { lang: Lang }) {
  const location = useLocation();

  const useTranslatorEffect = import.meta.env.PROD && isLowEndDevice() ? useEffect : useLayoutEffect;

  useTranslatorEffect(() => {
    const root = document.getElementById("root");
    if (!root) return;

    let destroyed = false;

    const runThaiNetworkIfNeeded = () => {
      if (destroyed || lang !== "th") return;
      const pending = collectPendingChineseKeys(root);
      if (pending.length === 0) return;
      if (networkInFlight) return;

      const gen = ++translateGeneration;
      networkInFlight = true;
      void (async () => {
        try {
          const translated = await requestBatchTranslate(pending, "th");
          if (destroyed || gen !== translateGeneration) return;
          pending.forEach((t, i) => translatedCache.set(t, normalizeTranslatedText(translated[i] ?? t)));
          schedulePersistCache();
          applyThaiSync(root);
          const more = collectPendingChineseKeys(root);
          if (more.length > 0) queueMicrotask(() => runThaiNetworkIfNeeded());
        } catch {
          // ignore
        } finally {
          networkInFlight = false;
        }
      })();
    };

    const run = () => {
      if (destroyed) return;
      if (lang === "zh") {
        applyZh(root);
        return;
      }
      if (!import.meta.env.PROD) loadCache();
      applyThaiSync(root);
      runThaiNetworkIfNeeded();
    };

    run();
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        if (!destroyed) run();
      });
    });

    return () => {
      destroyed = true;
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
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
