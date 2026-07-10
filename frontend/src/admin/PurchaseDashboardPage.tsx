import { useEffect, useState } from "react";
import { fetchWithAuth } from "../fetchWithAuth";

export default function PurchaseDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const basePath = window.location.pathname.includes("/employee/")
    ? "/employee/vertical-connections/purchase"
    : "/admin/vertical-connections/purchase";

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetchWithAuth("/api/admin/purchase/dashboard");
        setData(await r.json());
      } catch { setData(null); }
      finally { setLoading(false); }
    })();
  }, []);

  const card: React.CSSProperties = { borderRadius: 12, padding: "16px 20px", minWidth: 140 };
  const bigNum: React.CSSProperties = { fontSize: 28, fontWeight: 800, margin: "0 0 4px" };
  const smallLabel: React.CSSProperties = { fontSize: 12, opacity: 0.85 };

  return (
    <div>
      <h2 style={{ marginTop: 0, fontSize: 20, fontWeight: 800 }}>达人进货管理</h2>

      {/* Tab Nav */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "2px solid #e2e8f0", overflow: "auto" }}>
        {[
          { label: "📊 数据看板", path: basePath },
          { label: "进货需求", path: `${basePath}/demands` },
          { label: "商品库", path: `${basePath}/products` },
          { label: "订货管理", path: `${basePath}/orders` },
          { label: "找货配置", path: `${basePath}/coze-config` },
          { label: "供应商", path: `${basePath}/suppliers` },
          { label: "财务管理", path: `${basePath}/finance` },
        ].map((t) => {
          const active = window.location.pathname === t.path ||
            (t.path === basePath && !window.location.pathname.includes("/purchase/"));
          return (
            <a key={t.path} href={t.path} style={{
              padding: "8px 14px", fontSize: 13, fontWeight: active ? 700 : 500,
              color: active ? "var(--xt-accent, #f97316)" : "#64748b",
              borderBottom: active ? "2px solid var(--xt-accent, #f97316)" : "2px solid transparent",
              marginBottom: -2, textDecoration: "none", cursor: "pointer", whiteSpace: "nowrap",
            }}>
              {t.label}
            </a>
          );
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <div style={{ fontSize: 32 }}>⏳</div><p>加载中...</p>
        </div>
      ) : !data ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <p>加载数据失败</p>
        </div>
      ) : (
        <>
          {/* Stats Row */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ ...card, background: "#eff6ff" }}>
              <div style={{ ...bigNum, color: "#1d4ed8" }}>{data.new_demands_month}</div>
              <div style={{ ...smallLabel, color: "#1d4ed8" }}>本月新增需求</div>
            </div>
            <div style={{ ...card, background: "#f0fdf4" }}>
              <div style={{ ...bigNum, color: "#166534" }}>{data.new_orders_month}</div>
              <div style={{ ...smallLabel, color: "#166534" }}>本月订货单</div>
            </div>
            <div style={{ ...card, background: "#fff7ed" }}>
              <div style={{ ...bigNum, color: "#c2410c" }}>¥{Number(data.purchase_total_cny || 0).toLocaleString()}</div>
              <div style={{ ...smallLabel, color: "#c2410c" }}>本月采购总额</div>
            </div>
            <div style={{ ...card, background: "#f0fdf4" }}>
              <div style={{ ...bigNum, color: "#166534" }}>฿{Number(data.received_total_thb || 0).toLocaleString()}</div>
              <div style={{ ...smallLabel, color: "#166534" }}>本月收款总额</div>
            </div>
          </div>

          {/* Alerts */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            {data.pending_demands > 0 && (
              <div style={{ background: "#fef2f2", borderRadius: 10, padding: "10px 18px", border: "1px solid #fecaca" }}>
                <span style={{ fontWeight: 700, color: "#dc2626" }}>⚠️ {data.pending_demands} 条待处理需求</span>
              </div>
            )}
            {data.pending_orders > 0 && (
              <div style={{ background: "#fef2f2", borderRadius: 10, padding: "10px 18px", border: "1px solid #fecaca" }}>
                <span style={{ fontWeight: 700, color: "#dc2626" }}>⚠️ {data.pending_orders} 单待审核订货</span>
              </div>
            )}
            {data.pending_demands === 0 && data.pending_orders === 0 && (
              <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "10px 18px", border: "1px solid #bbf7d0" }}>
                <span style={{ fontWeight: 700, color: "#166534" }}>✅ 暂无待办事项</span>
              </div>
            )}
          </div>

          {/* Rankings */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Left: Categories */}
            <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 15 }}>🏷️ 热门品类 Top 10</h3>
              {(data.top_categories || []).length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: 13 }}>暂无数据</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "6px 0", borderBottom: "1px solid #f1f5f9", color: "#94a3b8", fontSize: 11 }}>#</th>
                      <th style={{ textAlign: "left", padding: "6px 0", borderBottom: "1px solid #f1f5f9", color: "#94a3b8", fontSize: 11 }}>品类</th>
                      <th style={{ textAlign: "right", padding: "6px 0", borderBottom: "1px solid #f1f5f9", color: "#94a3b8", fontSize: 11 }}>需求量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.top_categories || []).map((c: any, i: number) => (
                      <tr key={c.category || i}>
                        <td style={{ padding: "7px 0", fontWeight: 700, color: i < 3 ? "var(--xt-accent, #f97316)" : "#94a3b8" }}>{i + 1}</td>
                        <td style={{ padding: "7px 0" }}>{c.category}</td>
                        <td style={{ padding: "7px 0", textAlign: "right", fontWeight: 600 }}>{c.cnt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Right: Influencers */}
            <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 15 }}>👤 达人订货排行 Top 10</h3>
              {(data.top_influencers || []).length === 0 ? (
                <p style={{ color: "#94a3b8", fontSize: 13 }}>暂无数据</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "6px 0", borderBottom: "1px solid #f1f5f9", color: "#94a3b8", fontSize: 11 }}>#</th>
                      <th style={{ textAlign: "left", padding: "6px 0", borderBottom: "1px solid #f1f5f9", color: "#94a3b8", fontSize: 11 }}>达人</th>
                      <th style={{ textAlign: "right", padding: "6px 0", borderBottom: "1px solid #f1f5f9", color: "#94a3b8", fontSize: 11 }}>订单数</th>
                      <th style={{ textAlign: "right", padding: "6px 0", borderBottom: "1px solid #f1f5f9", color: "#94a3b8", fontSize: 11 }}>金额</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.top_influencers || []).map((inf: any, i: number) => (
                      <tr key={i}>
                        <td style={{ padding: "7px 0", fontWeight: 700, color: i < 3 ? "var(--xt-accent, #f97316)" : "#94a3b8" }}>{i + 1}</td>
                        <td style={{ padding: "7px 0" }}>{inf.influencer_code || inf.username || "—"}</td>
                        <td style={{ padding: "7px 0", textAlign: "right" }}>{inf.order_cnt}</td>
                        <td style={{ padding: "7px 0", textAlign: "right", fontWeight: 600 }}>฿{Number(inf.total_amt || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Bottom: Suppliers */}
          <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", marginTop: 16 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 15 }}>🏭 供应商合作排行 Top 10</h3>
            {(data.top_suppliers || []).length === 0 ? (
              <p style={{ color: "#94a3b8", fontSize: 13 }}>暂无数据</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "6px 0", borderBottom: "1px solid #f1f5f9", color: "#94a3b8", fontSize: 11 }}>#</th>
                    <th style={{ textAlign: "left", padding: "6px 0", borderBottom: "1px solid #f1f5f9", color: "#94a3b8", fontSize: 11 }}>供应商</th>
                    <th style={{ textAlign: "right", padding: "6px 0", borderBottom: "1px solid #f1f5f9", color: "#94a3b8", fontSize: 11 }}>合作次数</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.top_suppliers || []).map((s: any, i: number) => (
                    <tr key={i}>
                      <td style={{ padding: "7px 0", fontWeight: 700, color: i < 3 ? "var(--xt-accent, #f97316)" : "#94a3b8" }}>{i + 1}</td>
                      <td style={{ padding: "7px 0" }}>{s.name || "—"}</td>
                      <td style={{ padding: "7px 0", textAlign: "right", fontWeight: 600 }}>{s.cooperation_count || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
