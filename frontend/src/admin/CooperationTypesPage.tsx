import { useEffect, useMemo, useState } from "react";
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

export default function CooperationTypesPage(props: Props) {
  const user = getStoredUser();
  const isAdmin = user?.role === "admin";
  const readOnly = props.readOnly ?? !isAdmin;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<CooperationTypesConfig | null>(null);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const ret = await getCooperationTypes();
      setConfig(ret.config);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const title = useMemo(() => {
    if (isAdmin) return "合作业务类型配置";
    if (user?.role === "employee") return "合作业务类型说明";
    return "合作业务类型说明";
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
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const renderSpec = (t: CooperationTypesConfig["types"][number]) => {
    const spec = (t.spec || {}) as any;

    if (t.id === "graded_video") {
      const pricing = spec.pricing_points || {};
      const c = pricing.client || {};
      const p = pricing.part_time || {};
      const rate = toNum(spec.point_rate_thb) ?? 1;
      const setGrade = (who: "client" | "part_time", grade: "A" | "B" | "C", value: number) => {
        updateType(t.id, (tt) => {
          const s = (tt.spec || {}) as any;
          s.point_rate_thb = rate;
          s.pricing_points = s.pricing_points || {};
          s.pricing_points[who] = s.pricing_points[who] || {};
          s.pricing_points[who][grade] = value;
          tt.spec = s;
        });
      };
      const cell = (who: "client" | "part_time", grade: "A" | "B" | "C", val: any) => (
        <input
          type="number"
          min={0}
          disabled={readOnly}
          value={toNum(val) ?? 0}
          onChange={(e) => setGrade(who, grade, Number(e.target.value || 0))}
          style={{ padding: "6px 8px", width: 110, borderRadius: 8, border: "1px solid var(--xt-border)" }}
        />
      );
      return (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontWeight: 700, color: "var(--xt-primary)" }}>1 积分 =</div>
            <input
              type="number"
              min={1}
              disabled={readOnly}
              value={rate}
              onChange={(e) =>
                updateType(t.id, (tt) => {
                  const s = (tt.spec || {}) as any;
                  s.point_rate_thb = Number(e.target.value || 1);
                  tt.spec = s;
                })
              }
              style={{ padding: "6px 8px", width: 110, borderRadius: 8, border: "1px solid var(--xt-border)" }}
            />
            <div>泰铢</div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 10, overflow: "hidden" }}>
              <thead>
                <tr style={{ background: "rgba(21,42,69,0.06)" }}>
                  <th style={{ padding: 10, textAlign: "left" }}>对象</th>
                  <th style={{ padding: 10, textAlign: "left" }}>A</th>
                  <th style={{ padding: 10, textAlign: "left" }}>B</th>
                  <th style={{ padding: 10, textAlign: "left" }}>C</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: 10, borderTop: "1px solid var(--xt-border)" }}>商家结算报价（积分）</td>
                  <td style={{ padding: 10, borderTop: "1px solid var(--xt-border)" }}>{cell("client", "A", c.A)}</td>
                  <td style={{ padding: 10, borderTop: "1px solid var(--xt-border)" }}>{cell("client", "B", c.B)}</td>
                  <td style={{ padding: 10, borderTop: "1px solid var(--xt-border)" }}>{cell("client", "C", c.C)}</td>
                </tr>
                <tr>
                  <td style={{ padding: 10, borderTop: "1px solid var(--xt-border)" }}>兼职结算报价（积分）</td>
                  <td style={{ padding: 10, borderTop: "1px solid var(--xt-border)" }}>{cell("part_time", "A", p.A)}</td>
                  <td style={{ padding: 10, borderTop: "1px solid var(--xt-border)" }}>{cell("part_time", "B", p.B)}</td>
                  <td style={{ padding: 10, borderTop: "1px solid var(--xt-border)" }}>{cell("part_time", "C", p.C)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (t.id === "high_quality_custom_video") {
      const range = spec.merchant_price_thb_range || {};
      const min = toNum(range.min) ?? 4000;
      const max = toNum(range.max) ?? 5000;
      return (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontWeight: 700, color: "var(--xt-primary)" }}>对外报价（泰铢）</div>
          <input
            type="number"
            min={0}
            disabled={readOnly}
            value={min}
            onChange={(e) =>
              updateType(t.id, (tt) => {
                const s = (tt.spec || {}) as any;
                s.merchant_price_thb_range = s.merchant_price_thb_range || {};
                s.merchant_price_thb_range.min = Number(e.target.value || 0);
                tt.spec = s;
              })
            }
            style={{ padding: "6px 8px", width: 140, borderRadius: 8, border: "1px solid var(--xt-border)" }}
          />
          <div>—</div>
          <input
            type="number"
            min={0}
            disabled={readOnly}
            value={max}
            onChange={(e) =>
              updateType(t.id, (tt) => {
                const s = (tt.spec || {}) as any;
                s.merchant_price_thb_range = s.merchant_price_thb_range || {};
                s.merchant_price_thb_range.max = Number(e.target.value || 0);
                tt.spec = s;
              })
            }
            style={{ padding: "6px 8px", width: 140, borderRadius: 8, border: "1px solid var(--xt-border)" }}
          />
        </div>
      );
    }

    if (t.id === "monthly_package") {
      const minVideos = toNum(spec.min_videos_per_month) ?? 20;
      const price = toNum(spec.merchant_price_per_video_thb) ?? 650;
      return (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontWeight: 700, color: "var(--xt-primary)" }}>门槛</div>
          <input
            type="number"
            min={0}
            disabled={readOnly}
            value={minVideos}
            onChange={(e) =>
              updateType(t.id, (tt) => {
                const s = (tt.spec || {}) as any;
                s.min_videos_per_month = Number(e.target.value || 0);
                tt.spec = s;
              })
            }
            style={{ padding: "6px 8px", width: 140, borderRadius: 8, border: "1px solid var(--xt-border)" }}
          />
          <div>条/月</div>
          <div style={{ fontWeight: 700, color: "var(--xt-primary)", marginLeft: 8 }}>单价</div>
          <input
            type="number"
            min={0}
            disabled={readOnly}
            value={price}
            onChange={(e) =>
              updateType(t.id, (tt) => {
                const s = (tt.spec || {}) as any;
                s.merchant_price_per_video_thb = Number(e.target.value || 0);
                tt.spec = s;
              })
            }
            style={{ padding: "6px 8px", width: 140, borderRadius: 8, border: "1px solid var(--xt-border)" }}
          />
          <div>泰铢/条</div>
        </div>
      );
    }

    if (t.id === "creator_review_video") {
      const range = spec.deliverables_count_range || {};
      const min = toNum(range.min) ?? 8;
      const max = toNum(range.max) ?? 10;
      const price = spec.merchant_price_thb;
      return (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontWeight: 700, color: "var(--xt-primary)" }}>产出条数</div>
            <input
              type="number"
              min={0}
              disabled={readOnly}
              value={min}
              onChange={(e) =>
                updateType(t.id, (tt) => {
                  const s = (tt.spec || {}) as any;
                  s.deliverables_count_range = s.deliverables_count_range || {};
                  s.deliverables_count_range.min = Number(e.target.value || 0);
                  tt.spec = s;
                })
              }
              style={{ padding: "6px 8px", width: 140, borderRadius: 8, border: "1px solid var(--xt-border)" }}
            />
            <div>—</div>
            <input
              type="number"
              min={0}
              disabled={readOnly}
              value={max}
              onChange={(e) =>
                updateType(t.id, (tt) => {
                  const s = (tt.spec || {}) as any;
                  s.deliverables_count_range = s.deliverables_count_range || {};
                  s.deliverables_count_range.max = Number(e.target.value || 0);
                  tt.spec = s;
                })
              }
              style={{ padding: "6px 8px", width: 140, borderRadius: 8, border: "1px solid var(--xt-border)" }}
            />
            <div>条</div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontWeight: 700, color: "var(--xt-primary)" }}>报价（泰铢）</div>
            <input
              type="number"
              min={0}
              disabled={readOnly}
              value={price == null ? "" : toNum(price) ?? ""}
              placeholder="待定"
              onChange={(e) =>
                updateType(t.id, (tt) => {
                  const s = (tt.spec || {}) as any;
                  const v = e.target.value.trim();
                  s.merchant_price_thb = v ? Number(v) : null;
                  tt.spec = s;
                })
              }
              style={{ padding: "6px 8px", width: 180, borderRadius: 8, border: "1px solid var(--xt-border)" }}
            />
            <div style={{ color: "var(--xt-text-muted)", fontSize: 13 }}>留空表示待定</div>
          </div>
        </div>
      );
    }

    return <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(spec, null, 2)}</pre>;
  };

  if (loading) return <p>加载中…</p>;

  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <button type="button" onClick={() => void load()} disabled={loading} style={{ height: 36 }}>
          刷新
        </button>
        {!readOnly && (
          <button type="button" onClick={() => void save()} disabled={saving || !config} style={{ height: 36, fontWeight: 700 }}>
            {saving ? "保存中…" : "保存配置"}
          </button>
        )}
      </div>

      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

      {!config ? <p style={{ color: "var(--xt-text-muted)" }}>暂无配置</p> : null}

      {config ? (
        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          {config.types.map((t) => (
            <div key={t.id} style={{ border: "1px solid var(--xt-border)", background: "#fff", borderRadius: 14, padding: 14 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontWeight: 900, color: "var(--xt-primary)", fontSize: 16 }}>{t.name?.zh || t.id}</div>
                  <div style={{ color: "var(--xt-text-muted)" }}>{t.name?.th || ""}</div>
                </div>
                <div style={{ color: "var(--xt-text-muted)", fontSize: 12 }}>ID：{t.id}</div>
              </div>

              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontWeight: 800 }}>名称</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <input
                      disabled={readOnly}
                      value={t.name?.zh || ""}
                      onChange={(e) => updateType(t.id, (tt) => (tt.name = { ...(tt.name || { zh: "", th: "" }), zh: e.target.value }))}
                      placeholder="中文"
                      style={{ padding: "8px 10px", minWidth: 260, borderRadius: 10, border: "1px solid var(--xt-border)" }}
                    />
                    <input
                      disabled={readOnly}
                      value={t.name?.th || ""}
                      onChange={(e) => updateType(t.id, (tt) => (tt.name = { ...(tt.name || { zh: "", th: "" }), th: e.target.value }))}
                      placeholder="ภาษาไทย"
                      style={{ padding: "8px 10px", minWidth: 260, borderRadius: 10, border: "1px solid var(--xt-border)" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontWeight: 800 }}>关键参数</div>
                  {renderSpec(t)}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

