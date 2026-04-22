import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { TH_UI_DICT } from "./locales/th";
import { appI18n, persistThBundlePatch } from "./i18n/i18nApp";
import { getStoredUser } from "./authApi";
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
 * 瑙ｇ爜鏂囨湰涓殑 unicode 杞箟瀛楃銆?
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
 * 瑙勮寖鍖栫炕璇戞枃鏈紝閬垮厤鏄剧ず杞箟娈嬬暀銆?
 */
function normalizeTranslatedText(input: string): string {
  if (!input) return "";
  return decodeEscapedText(input).trim();
}

/**
 * 鍒ゆ柇鏄惁涓轰綆绔澶囷紙useLayoutEffect 闄嶇骇涓?useEffect锛岄伩鍏嶉樆濉炵粯鍒讹級銆?
 */
function isLowEndDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const anyNav = navigator as Navigator & { hardwareConcurrency?: number; deviceMemory?: number };
  const cores = typeof anyNav.hardwareConcurrency === "number" ? anyNav.hardwareConcurrency : 8;
  const mem = typeof anyNav.deviceMemory === "number" ? anyNav.deviceMemory : 8;
  return cores <= 2 || mem <= 2;
}

/**
 * 灏嗕汉宸ヨ瘝鍏?TH_UI_DICT 娉ㄥ叆鍐呭瓨缂撳瓨锛屼紭鍏堜簬鎺ュ彛缈昏瘧銆?
 */
function seedThaiDictionary(): void {
  Object.entries(TH_UI_DICT).forEach(([k, v]) => {
    if (typeof k !== "string" || !k.trim()) return;
    if (typeof v !== "string" || !v.trim()) return;
    translatedCache.set(k, normalizeTranslatedText(v));
  });
}

/**
 * 浠?localStorage 鎭㈠鍘嗗彶娉拌缈昏瘧缂撳瓨銆?
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
 * 灏嗗唴瀛樼紦瀛樺叏閲忓啓鍏?localStorage銆?
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
 * 闃叉姈鍐欏叆 localStorage锛岄伩鍏嶆帴鍙ｆ壒閲忚繑鍥炴椂杩炵画 stringify 闃诲涓荤嚎绋嬨€?
 */
function schedulePersistCache(): void {
  if (persistCacheTimer !== null) window.clearTimeout(persistCacheTimer);
  persistCacheTimer = window.setTimeout(() => {
    persistCacheTimer = null;
    persistCache();
  }, 500);
}

/**
 * 鐢熶骇鐜涓旂敤鎴蜂笂娆￠€夋嫨娉拌鏃讹紝鍦ㄩ灞忓墠棰勭儹缂撳瓨浠ュ噺灏戦棯鐑併€?
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
 * 灏嗘帴鍙ｈ繑鍥炵殑璇戞枃鍚堝苟杩?i18next 杩愯鏃惰祫婧愪笌鎸佷箙鍖栬瘝搴撱€?
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
 * 璋冪敤鍚庣鎵归噺缈昏瘧鎺ュ彛锛堜粎鐢ㄤ簬缂撳瓨鏈懡涓殑涓枃鐗囨锛夈€?
 */
async function requestBatchTranslate(texts: string[], targetLang: "th"): Promise<string[]> {
  const base = (import.meta.env.VITE_API_BASE_URL as string) || window.location.origin;
  const res = await fetch(`${base}/api/translate/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ texts, targetLang }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.message as string) || "缈昏瘧澶辫触");
  return ((data.translated || []) as string[]).map((t) => normalizeTranslatedText(typeof t === "string" ? t : ""));
}

function shouldSkipElementTag(tag: string): boolean {
  return tag === "SCRIPT" || tag === "STYLE" || tag === "CODE";
}

/**
 * 娣卞害閬嶅巻鑺傜偣鏍戯細鍖呭惈 open Shadow DOM 涓庡悓婧?iframe body銆?
 * Canvas 鍐呭凡缁樺埗鐨勫儚绱犳枃鏈棤娉曟仮澶嶏紝浠呭彲缈昏瘧鍏跺彲璁块棶灞炴€э紙濡?aria-label锛夈€?
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
        // 璺ㄥ煙 iframe 涓嶅彲璁块棶
      }
    }
  }
}

/**
 * 鏀堕泦鎵€鏈夊彲瑙佹枃鏈妭鐐癸紙涔辩爜鍏滃簳鐢紝涓嶈烦杩?data-no-auto-translate锛夈€?
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
 * 鏀堕泦闇€鑷姩缈昏瘧鐨勬枃鏈妭鐐癸紙鎺掗櫎 data-no-auto-translate 瀛愭爲锛夈€?
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
 * 鏀堕泦 placeholder / title / aria-label / alt 绛夊緟缈昏瘧鐨勮妭鐐逛换鍔★紙娣卞害锛夈€?
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
 * 璇诲彇鍏冪礌涓婃寚瀹氬彲缈昏瘧灞炴€х殑褰撳墠鍊笺€?
 */
function readAttr(el: Element, attr: AttrName): string {
  if (attr === "placeholder") {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.placeholder;
    return "";
  }
  return el.getAttribute(attr) ?? "";
}

/**
 * 鍐欏叆鍏冪礌涓婃寚瀹氬彲缈昏瘧灞炴€с€?
 */
function writeAttr(el: Element, attr: AttrName, value: string): void {
  if (attr === "placeholder") {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.placeholder = value;
    return;
  }
  el.setAttribute(attr, value);
}

/**
 * 棣栨璁块棶鏃剁紦瀛樿灞炴€х殑涓枃鍘熸枃锛屼緵杩樺師鎴栦綔涓虹炕璇?key銆?
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
 * 鍒ゆ柇鏂囨湰鏄惁鍖呭惈 CJK 瀛楃锛岄伩鍏嶈缈昏瘧鑻辨枃/鏁板瓧/ID銆?
 */
function hasCjk(text: string): boolean {
  return /[\u3400-\u4dbf\u4e00-\u9fff]/.test(text);
}

/**
 * 鍦ㄤ繚鎸侀灏剧┖鐧界殑鍓嶆彁涓嬶紝鐢ㄨ瘧鏂囨浛鎹?trim 鍚庣殑 key 瀵瑰簲鐗囨銆?
 */
function applyTranslatedToString(full: string, keyTrim: string, target: string): string {
  if (!keyTrim) return full;
  if (full.trim() !== keyTrim) return full;
  if (full === keyTrim) return target;
  return full.replace(keyTrim, target);
}

/**
 * 娉拌锛氫粎鐢ㄥ唴瀛樼紦瀛樺悓姝ユ洿鏂?DOM锛屼笉绛夊緟缃戠粶锛堢偣鍑诲垏鎹㈠悗绔嬪嵆鐢熸晥锛夈€?
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
 * 涓枃锛氫粠 WeakMap 杩樺師鏇剧炕璇戣繃鐨勬枃鏈妭鐐逛笌灞炴€с€?
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
 * 鍏ㄥ眬娓呮礂杞箟娈嬬暀锛氬皢 \\uXXXX / uXXXX / %uXXXX 鏂囨湰杩樺師銆?
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
 * 姹囨€诲皻鏈懡涓紦瀛樼殑涓枃 key锛堟枃鏈?+ 灞炴€э級锛屽苟鎸夎矾鐢?鑺傜偣浼樺厛绾ф帓搴忓悗杩斿洖銆?
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
 * 璇█涓婁笅鏂?Provider锛氭彁渚涗腑鏂?娉拌鍒囨崲鑳藉姏锛屽苟涓?i18next 杩愯鏃惰瑷€鍚屾銆?
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const raw = localStorage.getItem("influencer_app_lang");
    if (raw === "th" || raw === "zh") return raw;
    const role = getStoredUser()?.role;
    // 达人端首次进入默认泰语；中文需用户主动切换。
    return role === "influencer" ? "th" : "zh";
  });

  /**
   * 达人端默认语言守卫：若被切到中文则自动回切泰语。
   */
  useEffect(() => {
    const role = getStoredUser()?.role;
    if (role === "influencer" && lang !== "th") {
      setLangState("th");
      localStorage.setItem("influencer_app_lang", "th");
    }
  }, [lang]);

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
 * 浣跨敤鍏ㄥ眬璇█涓婁笅鏂囥€?
 */
export function useLanguage(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}

