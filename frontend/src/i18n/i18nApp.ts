import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { TH_UI_DICT } from "../locales/th";

const I18N_RESOURCE_STORAGE = "influencer_app_i18next_th_bundle_v1";

/**
 * 从 localStorage 读取已持久化的泰语词条补丁（与 TH_UI_DICT 合并）。
 */
function readPersistedThBundle(): Record<string, string> {
  try {
    const raw = localStorage.getItem(I18N_RESOURCE_STORAGE);
    if (!raw) return {};
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof k === "string" && typeof v === "string" && k.trim() && v.trim()) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * 将自动翻译或运营补录的泰语结果写入 localStorage，供下次启动预加载。
 */
export function persistThBundlePatch(patch: Record<string, string>): void {
  try {
    const cur = readPersistedThBundle();
    localStorage.setItem(I18N_RESOURCE_STORAGE, JSON.stringify({ ...cur, ...patch }));
  } catch {
    // ignore
  }
}

const initialLng = (() => {
  try {
    return localStorage.getItem("influencer_app_lang") === "th" ? "th" : "zh";
  } catch {
    return "zh";
  }
})();

const persistedTh = readPersistedThBundle();

void i18n.use(initReactI18next).init({
  lng: initialLng,
  fallbackLng: "zh",
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
  resources: {
    zh: { translation: {} },
    th: { translation: { ...TH_UI_DICT, ...persistedTh } },
  },
});

/** 全局 i18next 单例，与 LanguageProvider 语言状态保持一致。 */
export const appI18n = i18n;
