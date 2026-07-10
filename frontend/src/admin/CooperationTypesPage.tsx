import { useTranslation } from 'react-i18next';
import { compactPx } from "../responsive";
import { useEffect, useMemo, useRef, useState } from "react";
import { getStoredUser } from "../authApi";
import { getCooperationTypes, type CooperationTypesConfig } from "../matchingApi";

export default function CooperationTypesPage() {
  const { t } = useTranslation();
  const user = getStoredUser();
  const isAdmin = user?.role === "admin";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<CooperationTypesConfig | null>(null);
  const mountedRef = useRef(true);

  /** 加载合作业务类型配置，带 15 秒超时保护 */
  const load = async () => {
    setError(null);
    setLoading(true);
    // 15 秒超时保护：防止请求永久挂起导致页面白屏
    const timer = setTimeout(() => {
      if (mountedRef.current) {
        setLoading(false);
        setError("加载超时，请检查网络后刷新重试。");
      }
    }, 15000);
    try {
      const ret = await getCooperationTypes();
      clearTimeout(timer);
      if (!mountedRef.current) return;
      if (!ret?.config || !Array.isArray(ret.config.types)) {
        throw new Error("配置数据格式异常，请刷新重试。");
      }
      setConfig(ret.config);
    } catch (e) {
      clearTimeout(timer);
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : t("加载失败"));
      setConfig(null);
    } finally {
      clearTimeout(timer);
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => { mountedRef.current = false; };
  }, []);

  const title = useMemo(() => {
    if (isAdmin) return t("合作业务类型配置");
    if (user?.role === "employee") return t("合作业务类型说明");
    return t("合作业务类型说明");
  }, [isAdmin, user?.role]);

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <p style={{ color: "var(--xt-text-muted)", fontSize: 14 }}>{t("加载中…")}</p>
      <p style={{ color: "var(--xt-text-muted)", fontSize: 12, marginTop: 4 }}>{t("如长时间无响应，请刷新页面")}</p>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: compactPx(12), alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <button type="button" onClick={() => void load()} disabled={loading} style={{ height: 36 }}>
          {t("刷新")}
        </button>
      </div>

      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

      {!config ? <p style={{ color: "var(--xt-text-muted)" }}>{t("暂无配置")}</p> : null}

      {config ? (
        <div style={{ display: "grid", gap: compactPx(12), marginTop: compactPx(14) }}>
          {config.types.map((type) => (
            <div key={type.id} style={{ border: "1px solid var(--xt-border)", background: "#fff", borderRadius: compactPx(14), padding: compactPx(14) }}>
              <div style={{ display: "flex", gap: compactPx(10), flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: compactPx(10), flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontWeight: 900, color: "var(--xt-primary)", fontSize: compactPx(16) }}>{(type.name?.zh ?? type.id) || type.id}</div>
                  <div style={{ color: "var(--xt-text-muted)" }}>{(type.name?.th ?? type.id) || ""}</div>
                </div>
                <div style={{ color: "var(--xt-text-muted)", fontSize: compactPx(12) }}>{t("ID")}：{type.id}</div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
