import { useTranslation } from 'react-i18next';
import { compactPx } from "../responsive";
import { useEffect, useMemo, useRef, useState } from "react";
import { getStoredUser } from "../authApi";
import { getCooperationTypes, updateCooperationTypes, type CooperationTypesConfig } from "../matchingApi";

type Props = { readOnly?: boolean };

function toNum(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  return n;
}

function cloneConfig(cfg: CooperationTypesConfig): CooperationTypesConfig {
  return JSON.parse(JSON.stringify(cfg)) as CooperationTypesConfig;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function ensureRecord(parent: Record<string, unknown>, key: string): Record<string, unknown> {
  const current = parent[key];
  if (current && typeof current === "object") return current as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  parent[key] = next;
  return next;
}

export default function CooperationTypesPage(props: Props) {
  const { t } = useTranslation();
  const user = getStoredUser();
  const isAdmin = user?.role === "admin";
  const readOnly = props.readOnly ?? !isAdmin;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  const updateType = (id: string, patch: (t: CooperationTypesConfig["types"][number]) => void) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const next = cloneConfig(prev);
      const t = next.types.find((x) => x.id === id);
      if (!t) return prev;
      patch(t);
      return next;
    });
  };

  const save = async () => {
    if (readOnly || !config) return;
    setSaving(true);
    setError(null);
    try {
      await updateCooperationTypes(config);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("保存失败"));
    } finally {
      setSaving(false);
    }
  };

  const renderSpec = (item: CooperationTypesConfig["types"][number]) => {
    const spec = asRecord(item.spec);

    const HIDDEN_KEYS = ['requires_tap', 'allow_face', 'deliverables_count_range', 'merchant_price_thb', 'must_review_before_publish', 'merchant_price_thb_range', 'executed_by', 'allow_script', 'revisions', 'publish', 'min_videos_per_month', 'merchant_price_per_video_thb', 'deliverables', 'revisions_first_n'];
    const filterSpec = (s: Record<string, unknown>) => {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(s)) {
        if (!HIDDEN_KEYS.includes(k)) out[k] = s[k];
      }
      return out;
    };
    const fallbackJson = (s: Record<string, unknown>) => {
      const filtered = filterSpec(s);
      if (Object.keys(filtered).length === 0) return null;
      return <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(filtered, null, 2)}</pre>;
    };

    if (item.id === "graded_video") {
      const pricing = asRecord(spec.pricing_points);
      const c = asRecord(pricing.client);
      const p = asRecord(pricing.part_time);
      const rate = toNum(spec.point_rate_thb) ?? 1;
      const setGrade = (who: "client" | "part_time", grade: "A" | "B" | "C", value: number) => {
        updateType(item.id, (tt) => {
          const s = asRecord(tt.spec);
          s.point_rate_thb = rate;
          const nextPricing = ensureRecord(s, "pricing_points");
          const target = ensureRecord(nextPricing, who);
          target[grade] = value;
          tt.spec = s;
        });
      };
      const cell = (who: "client" | "part_time", grade: "A" | "B" | "C", val: unknown) => (
        <input
          type="number"
          inputMode="decimal"
          min={0}
          disabled={readOnly}
          value={toNum(val) ?? 0}
          onChange={(e) => setGrade(who, grade, Number(e.target.value || 0))}
          style={{ padding: "6px 8px", width: 110, borderRadius: compactPx(8), border: "1px solid var(--xt-border)" }}
        />
      );
      return (
        <div style={{ display: "grid", gap: compactPx(10) }}>
          <div style={{ display: "flex", gap: compactPx(10), flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontWeight: 700, color: "var(--xt-primary)" }}>1 积分 =</div>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              disabled={readOnly}
              value={rate}
              onChange={(e) =>
                updateType(t.id, (tt) => {
                  const s = asRecord(tt.spec);
                  s.point_rate_thb = Number(e.target.value || 1);
                  tt.spec = s;
                })
              }
              style={{ padding: "6px 8px", width: 110, borderRadius: compactPx(8), border: "1px solid var(--xt-border)" }}
            />
            <div>{t("泰铢")}</div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: compactPx(10), overflow: "hidden" }}>
              <thead>
                <tr style={{ background: "rgba(21,42,69,0.06)" }}>
                  <th style={{ padding: compactPx(10), textAlign: "left" }}>{t("对象")}</th>
                  <th style={{ padding: compactPx(10), textAlign: "left" }}>A</th>
                  <th style={{ padding: compactPx(10), textAlign: "left" }}>B</th>
                  <th style={{ padding: compactPx(10), textAlign: "left" }}>C</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: compactPx(10), borderTop: "1px solid var(--xt-border)" }}>{t("商家结算报价（积分）")}</td>
                  <td style={{ padding: compactPx(10), borderTop: "1px solid var(--xt-border)" }}>{cell("client", "A", c.A)}</td>
                  <td style={{ padding: compactPx(10), borderTop: "1px solid var(--xt-border)" }}>{cell("client", "B", c.B)}</td>
                  <td style={{ padding: compactPx(10), borderTop: "1px solid var(--xt-border)" }}>{cell("client", "C", c.C)}</td>
                </tr>
                <tr>
                  <td style={{ padding: compactPx(10), borderTop: "1px solid var(--xt-border)" }}>{t("兼职结算报价（积分）")}</td>
                  <td style={{ padding: compactPx(10), borderTop: "1px solid var(--xt-border)" }}>{cell("part_time", "A", p.A)}</td>
                  <td style={{ padding: compactPx(10), borderTop: "1px solid var(--xt-border)" }}>{cell("part_time", "B", p.B)}</td>
                  <td style={{ padding: compactPx(10), borderTop: "1px solid var(--xt-border)" }}>{cell("part_time", "C", p.C)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (t.id === "high_quality_custom_video") {
      return fallbackJson(spec);
    }

    if (t.id === "monthly_package") {
      return fallbackJson(spec);
    }

    if (t.id === "creator_review_video") {
      return fallbackJson(spec);
    }

    return fallbackJson(spec);
  };

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
        {!readOnly && (
          <button type="button" onClick={() => void save()} disabled={saving || !config} style={{ height: 36, fontWeight: 700 }}>
            {saving ? t("保存中…") : t("保存配置")}
          </button>
        )}
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

              <div style={{ display: "grid", gap: compactPx(10), marginTop: compactPx(12) }}>
                <div style={{ display: "grid", gap: compactPx(8) }}>
                  <div style={{ fontWeight: 800 }}>{t("名称")}</div>
                  <div style={{ display: "flex", gap: compactPx(10), flexWrap: "wrap" }}>
                    <input
                      disabled={readOnly}
                      value={(type.name?.zh ?? type.id) || ""}
                      onChange={(e) => updateType(type.id, (tt) => (tt.name = { ...(tt.name || { zh: "", th: "" }), zh: e.target.value }))}
                      placeholder="中文"
                      style={{ padding: "8px 10px", minWidth: 260, borderRadius: compactPx(10), border: "1px solid var(--xt-border)" }}
                    />
                    <input
                      disabled={readOnly}
                      value={(type.name?.th ?? type.id) || ""}
                      onChange={(e) => updateType(type.id, (tt) => (tt.name = { ...(tt.name || { zh: "", th: "" }), th: e.target.value }))}
                      placeholder="ภาษาไทย"
                      style={{ padding: "8px 10px", minWidth: 260, borderRadius: compactPx(10), border: "1px solid var(--xt-border)" }}
                    />
                  </div>
                </div>

                {(() => {
                  const specContent = renderSpec(type);
                  if (!specContent) return null;
                  return (
                    <div style={{ display: "grid", gap: compactPx(8) }}>
                      <div style={{ fontWeight: 800 }}>{t("关键参数")}</div>
                      {specContent}
                    </div>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
