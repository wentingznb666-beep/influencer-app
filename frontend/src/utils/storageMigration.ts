import { normalizeAccountText } from "./accountText";

const STORAGE_USER = "influencer_app_user";
const STORAGE_TH_CACHE = "influencer_app_i18n_th_cache_v2";
const STORAGE_MIGRATION_FLAG = "influencer_app_storage_migration_v2";

/**
 * 浠呭仛瀹夊叏鏂囨湰娓呯悊锛氳В鐮?unicode 杞箟骞剁Щ闄ゆ帶鍒跺瓧绗︼紝涓嶆敼鍙樹笟鍔¤涔夈€?
 */
function normalizeCacheText(value: unknown): string {
  const raw = typeof value === "string" ? value : "";
  if (!raw) return "";

  let next = raw;
  for (let i = 0; i < 2; i += 1) {
    const decoded = next
      .replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/%u([0-9a-fA-F]{4})/g, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16)));
    if (decoded === next) break;
    next = decoded;
  }

  return next.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
}

/**
 * 娓呮礂鏈湴鐢ㄦ埛缂撳瓨涓殑鐢ㄦ埛鍚嶅瓧娈碉紝閬垮厤澶撮儴鏄电О鏄剧ず杞箟涓叉垨涔辩爜銆?
 */
function migrateStoredUser(): void {
  try {
    const raw = localStorage.getItem(STORAGE_USER);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { username?: unknown } & Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return;
    parsed.username = normalizeAccountText(parsed.username);
    localStorage.setItem(STORAGE_USER, JSON.stringify(parsed));
  } catch {
    // ignore
  }
}

/**
 * 娓呮礂娉拌缈昏瘧缂撳瓨涓殑鑴忓€硷紝閬垮厤鍘嗗彶缂撳瓨鎶?unicode 瀛楅潰閲忔覆鏌撳埌鐣岄潰銆?
 */
function migrateThaiTextCache(): void {
  try {
    const raw = localStorage.getItem(STORAGE_TH_CACHE);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return;

    const next: Record<string, string> = {};
    Object.entries(parsed).forEach(([key, value]) => {
      const safeKey = normalizeCacheText(key);
      if (!safeKey) return;
      next[safeKey] = normalizeCacheText(value);
    });

    localStorage.setItem(STORAGE_TH_CACHE, JSON.stringify(next));
  } catch {
    // ignore
  }
}

/**
 * 鍚姩鏈熶竴娆℃€ф墽琛屾湰鍦扮紦瀛樿嚜鎰堣縼绉汇€?
 */
export function runStorageSelfHealMigration(): void {
  try {
    if (localStorage.getItem(STORAGE_MIGRATION_FLAG) === "done") return;
    migrateStoredUser();
    migrateThaiTextCache();
    localStorage.setItem(STORAGE_MIGRATION_FLAG, "done");
  } catch {
    // ignore
  }
}

