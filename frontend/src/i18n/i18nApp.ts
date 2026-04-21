import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { TH_UI_DICT } from "../locales/th";
import { getStoredUser } from "../authApi";

const I18N_RESOURCE_STORAGE = "influencer_app_i18next_th_bundle_v1";

/**
 * 浠?localStorage 璇诲彇宸叉寔涔呭寲鐨勬嘲璇瘝鏉¤ˉ涓侊紙涓?TH_UI_DICT 鍚堝苟锛夈€?
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
 * 灏嗚嚜鍔ㄧ炕璇戞垨杩愯惀琛ュ綍鐨勬嘲璇粨鏋滃啓鍏?localStorage锛屼緵涓嬫鍚姩棰勫姞杞姐€?
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
    const saved = localStorage.getItem("influencer_app_lang");
    if (saved === "th" || saved === "zh") return saved;
    const role = getStoredUser()?.role;
    return role === "influencer" ? "th" : "zh";
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

/** 鍏ㄥ眬 i18next 鍗曚緥锛屼笌 LanguageProvider 璇█鐘舵€佷繚鎸佷竴鑷淬€?*/
export const appI18n = i18n;

