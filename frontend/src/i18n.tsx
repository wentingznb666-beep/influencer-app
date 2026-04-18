import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { TH_UI_DICT } from "./locales/th";
import { appI18n, persistThBundlePatch } from "./i18n/i18nApp";
import {
  computeBackoffMs,
  defaultPathTranslatePriority,
  mergePendingByMinPriority,
  readTranslatePriorityFromAncestors,
  sortPendingForBatch,
  type PendingKey,
} from "./i18n/translateQueue";

type Lang = "zh" | "th";

type LangContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
};

const LangContext = createContext<LangContextValue | null>(null);

const TEXT_CACHE_KEY = "influencer_app_i18n_th_cache_v2";

const translatedCache = new Map<string, string>();
const originalTextByNode = new WeakMap<Text, string>();

type AttrName = "placeholder" | "title" | "aria-label" | "alt";
const originalAttrByEl = new WeakMap<Element, Partial<Record<AttrName, string>>>();

let persistCacheTimer: number | null = null;
let translateGeneration = 0;
let networkInFlight = false;

/**
 * 解码文本中的 unicode 转义字符。
 */
function decodeEscapedText(input: string): string {
  let value = input;
  for (let i = 0; i < 2; i += 1) {
    const decoded = value
      .replace(/\\\\u([0-9a-fA-F]{4})/g, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/%u([0-9a-fA-F]{4})/g, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/u([0-9a-fA-F]{4})/g, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\x([0-9a-fA-F]{2})/g, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)));
    if (decoded === value) break;
    value = decoded;
  }
  return value;
}

/**
 * 规范化翻译文本，避免显示转义残留。
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
 * 将接口返回的译文合并进 i18next 运行时资源与持久化词库。
 */
function mergeAutoTranslationsIntoI18nBundle(patch: Record<string, string>): void {
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (!k.trim() || !v.trim()) continue;
    cleaned[k] = v;
  }
  if (Object.keys(cleaned).length === 0) return;
  persistThBundlePatch(cleaned);
  void appI18n.addResourceBundle("th", "translation", cleaned, true, true);
}

/**
 * 调用后端批量翻译接口（仅用于缓存未命中的中文片段）。
 */
async function requestBatchTranslate(texts: string[], targetLang: "th"): Promise<string[]> {
  const base = (import.meta.env.VITE_API_BASE_URL as string) || window.location.origin;
  const res = await fetch(`${base}/api/translate/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ texts, targetLang }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.message as string) || "翻译失败");
  return ((data.translated || []) as string[]).map((t) => normalizeTranslatedText(typeof t === "string" ? t : ""));
}

function shouldSkipElementTag(tag: string): boolean {
  return tag === "SCRIPT" || tag === "STYLE" || tag === "CODE";
}

/**
 * 深度遍历节点树：包含 open Shadow DOM 与同源 iframe body。
 * Canvas 内已绘制的像素文本无法恢复，仅可翻译其可访问属性（如 aria-label）。
 */
function walkUiTree(node: Node, visit: (n: Node) => void): void {
  visit(node);
  for (let ch = node.firstChild; ch; ch = ch.nextSibling) walkUiTree(ch, visit);
  if (node instanceof Element) {
    const sr = node.shadowRoot;
    if (sr) walkUiTree(sr, visit);
    if (node instanceof HTMLIFrameElement) {
      try {
        const b = node.contentDocument?.body;
        if (b) walkUiTree(b, visit);
      } catch {
        // 跨域 iframe 不可访问
      }
    }
  }
}

/**
 * 收集所有可见文本节点（乱码兜底用，不跳过 data-no-auto-translate）。
 */
function collectAllTextNodesDeep(root: HTMLElement): Text[] {
  const list: Text[] = [];
  walkUiTree(root, (n) => {
    if (n.nodeType !== Node.TEXT_NODE) return;
    const textNode = n as Text;
    const value = textNode.nodeValue?.trim() ?? "";
    const parent = textNode.parentElement;
    if (!value || !parent || shouldSkipElementTag(parent.tagName)) return;
    list.push(textNode);
  });
  return list;
}

/**
 * 收集需自动翻译的文本节点（排除 data-no-auto-translate 子树）。
 */
function collectTextNodesDeep(root: HTMLElement): Text[] {
  const list: Text[] = [];
  walkUiTree(root, (n) => {
    if (n.nodeType !== Node.TEXT_NODE) return;
    const textNode = n as Text;
    const value = textNode.nodeValue?.trim() ?? "";
    const parent = textNode.parentElement;
    if (!value || !parent || shouldSkipElementTag(parent.tagName)) return;
    if (parent.closest("[data-no-auto-translate]")) return;
    list.push(textNode);
  });
  return list;
}

/**
 * 收集 placeholder / title / aria-label / alt 等待翻译的节点任务（深度）。
 */
function collectAttrJobsDeep(root: HTMLElement): Array<{ el: Element; attr: AttrName }> {
  const result: Array<{ el: Element; attr: AttrName }> = [];
  walkUiTree(root, (n) => {
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const el = n as Element;
    if (el.closest("[data-no-auto-translate]")) return;
    const tag = el.tagName;
    if (shouldSkipElementTag(tag)) return;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      if (el.placeholder?.trim()) result.push({ el, attr: "placeholder" });
    }
    for (const attr of ["title", "aria-label", "alt"] as const) {
      if (el.getAttribute(attr)?.trim()) result.push({ el, attr });
    }
  });
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
 * 判断文本是否包含 CJK 字符，避免误翻译英文/数字/ID。
 */
function hasCjk(text: string): boolean {
  return /[\u3400-\u4dbf\u4e00-\u9fff]/.test(text);
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
  const nodes = collectTextNodesDeep(root);
  for (const node of nodes) {
    const current = node.nodeValue ?? "";
    const fullSource = originalTextByNode.get(node) ?? current;
    if (!originalTextByNode.has(node)) originalTextByNode.set(node, fullSource);
    const key = fullSource.trim();
    if (!key || !hasCjk(key)) continue;
    const target = translatedCache.get(key);
    if (target) node.nodeValue = applyTranslatedToString(fullSource, key, normalizeTranslatedText(target));
  }
  for (const { el, attr } of collectAttrJobsDeep(root)) {
    const full = ensureAttrOriginal(el, attr);
    const key = full.trim();
    if (!key || !hasCjk(key)) continue;
    const target = translatedCache.get(key);
    if (target) writeAttr(el, attr, applyTranslatedToString(full, key, normalizeTranslatedText(target)));
  }
}

/**
 * 中文：从 WeakMap 还原曾翻译过的文本节点与属性。
 */
function applyZh(root: HTMLElement): void {
  for (const node of collectAllTextNodesDeep(root)) {
    const original = originalTextByNode.get(node);
    if (original !== undefined) node.nodeValue = original;
  }
  for (const { el, attr } of collectAttrJobsDeep(root)) {
    const bag = originalAttrByEl.get(el);
    if (!bag || bag[attr] === undefined) continue;
    writeAttr(el, attr, bag[attr]!);
  }
}

/**
 * 全局清洗转义残留：将 \\uXXXX / uXXXX / %uXXXX 文本还原。
 */
function cleanupEscapedFragments(root: HTMLElement): void {
  for (const node of collectAllTextNodesDeep(root)) {
    const full = node.nodeValue ?? "";
    if (!/(\\u[0-9a-fA-F]{4}|u[0-9a-fA-F]{4}|%u[0-9a-fA-F]{4}|\uFFFD)/.test(full)) continue;
    const fixed = normalizeTranslatedText(full);
    if (fixed && fixed !== full.trim()) {
      node.nodeValue = full.replace(full.trim(), fixed);
    } else if (fixed && fixed !== full) {
      node.nodeValue = fixed;
    }
  }
  for (const { el, attr } of collectAttrJobsDeep(root)) {
    const full = readAttr(el, attr);
    if (!/(\\u[0-9a-fA-F]{4}|u[0-9a-fA-F]{4}|%u[0-9a-fA-F]{4}|\uFFFD)/.test(full)) continue;
    const fixed = normalizeTranslatedText(full);
    if (!fixed || fixed === full) continue;
    writeAttr(el, attr, fixed);
  }
}

/**
 * 汇总尚未命中缓存的中文 key（文本 + 属性），并按路由/节点优先级排序后返回。
 */
function collectPendingChineseKeys(root: HTMLElement, pathname: string): string[] {
  const pathDefault = defaultPathTranslatePriority(pathname);
  const pendingItems: PendingKey[] = [];
  const push = (raw: string, anchor: Element | null) => {
    const key = raw.trim();
    if (!key || !hasCjk(key) || translatedCache.has(key)) return;
    const pri = readTranslatePriorityFromAncestors(anchor, pathDefault);
    pendingItems.push({ key, pri });
  };

  for (const node of collectAllTextNodesDeep(root)) {
    const full = originalTextByNode.get(node) ?? node.nodeValue ?? "";
    if (!originalTextByNode.has(node)) originalTextByNode.set(node, full);
    push(full, node.parentElement);
  }
  for (const { el, attr } of collectAttrJobsDeep(root)) {
    push(ensureAttrOriginal(el, attr), el);
  }

  const merged = mergePendingByMinPriority(pendingItems);
  return sortPendingForBatch(merged);
}

function UiAutoTranslator({ lang }: { lang: Lang }) {
  const location = useLocation();
  const useTranslatorEffect = import.meta.env.PROD && isLowEndDevice() ? useEffect : useLayoutEffect;

  useTranslatorEffect(() => {
    const root = document.getElementById("root");
    if (!root) return;

    let destroyed = false;
    let retryTimer = 0;
    let networkFailureAttempts = 0;
    const childObservers: MutationObserver[] = [];
    const hookedIframes = new WeakSet<HTMLIFrameElement>();

    let scheduledRun = 0;
    const scheduleRun = () => {
      if (destroyed) return;
      if (scheduledRun) return;
      scheduledRun = window.requestAnimationFrame(() => {
        scheduledRun = 0;
        run();
      });
    };

    const attachIframeDocumentObservers = (iframe: HTMLIFrameElement) => {
      const bind = () => {
        if (destroyed || hookedIframes.has(iframe)) return;
        try {
          const doc = iframe.contentDocument;
          if (!doc?.documentElement) return;
          hookedIframes.add(iframe);
          const ob = new MutationObserver(() => scheduleRun());
          ob.observe(doc.documentElement, {
            subtree: true,
            childList: true,
            characterData: true,
            attributes: true,
            attributeFilter: ["placeholder", "title", "aria-label", "alt"],
          });
          childObservers.push(ob);
          scheduleRun();
        } catch {
          // ignore
        }
      };
      iframe.addEventListener("load", bind);
      if (iframe.contentDocument?.readyState === "complete") bind();
    };

    const scanIframes = () => {
      const frames = root.querySelectorAll("iframe");
      frames.forEach((f) => {
        if (!(f instanceof HTMLIFrameElement)) return;
        attachIframeDocumentObservers(f);
      });
    };

    const runThaiNetworkIfNeeded = () => {
      if (destroyed || lang !== "th") return;
      const pending = collectPendingChineseKeys(root, location.pathname);
      if (pending.length === 0) return;
      if (networkInFlight) return;

      const gen = ++translateGeneration;
      networkInFlight = true;

      void (async () => {
        try {
          const translated = await requestBatchTranslate(pending, "th");
          if (destroyed || gen !== translateGeneration) return;
          const patch: Record<string, string> = {};
          pending.forEach((t, i) => {
            const out = normalizeTranslatedText(translated[i] ?? t);
            translatedCache.set(t, out);
            if (out && out !== t) patch[t] = out;
          });
          mergeAutoTranslationsIntoI18nBundle(patch);
          networkFailureAttempts = 0;
          schedulePersistCache();
          applyThaiSync(root);
          cleanupEscapedFragments(root);
          const more = collectPendingChineseKeys(root, location.pathname);
          if (more.length > 0) queueMicrotask(() => runThaiNetworkIfNeeded());
        } catch {
          if (!destroyed && lang === "th" && retryTimer === 0) {
            const delay = computeBackoffMs(networkFailureAttempts, 500, 30_000);
            networkFailureAttempts += 1;
            retryTimer = window.setTimeout(() => {
              retryTimer = 0;
              runThaiNetworkIfNeeded();
            }, delay);
          }
        } finally {
          networkInFlight = false;
        }
      })();
    };

    const run = () => {
      if (destroyed) return;
      scanIframes();
      if (lang === "zh") {
        applyZh(root);
        cleanupEscapedFragments(root);
        return;
      }
      if (!import.meta.env.PROD) loadCache();
      applyThaiSync(root);
      cleanupEscapedFragments(root);
      runThaiNetworkIfNeeded();
    };

    run();

    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        if (!destroyed) run();
      });
    });

    const observer = new MutationObserver(() => scheduleRun());
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label", "alt"],
    });

    return () => {
      destroyed = true;
      observer.disconnect();
      for (const ob of childObservers) ob.disconnect();
      childObservers.length = 0;
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      if (scheduledRun) window.cancelAnimationFrame(scheduledRun);
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [lang, location.pathname]);

  return null;
}

/**
 * 语言上下文 Provider：提供中文/泰语切换能力，并与 i18next 运行时语言同步。
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const raw = localStorage.getItem("influencer_app_lang");
    return raw === "th" ? "th" : "zh";
  });

  useEffect(() => {
    void appI18n.changeLanguage(lang);
  }, [lang]);

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
