import { useEffect, useState, useCallback } from "react";
import { fetchWithAuth } from "../fetchWithAuth";

const RATING_STARS: Record<string, string> = { A: "⭐⭐⭐⭐⭐", B: "⭐⭐⭐⭐", C: "⭐⭐⭐", D: "⭐⭐" };

export default function PurchaseSuppliersPage() {
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterRating, setFilterRating] = useState("");

  // create/edit modal
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  // history modal
  const [history, setHistory] = useState<any>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // toast
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg }); setTimeout(() => setToast(null), 3000);
  };

  const basePath = window.location.pathname.includes("/employee/")
    ? "/employee/vertical-connections/purchase"
    : "/admin/vertical-connections/purchase";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("name", search);
      if (filterRating) params.set("rating", filterRating);
      const qs = params.toString();
      const r = await fetchWithAuth(`/api/admin/purchase/suppliers${qs ? "?" + qs : ""}`);
      setList(((await r.json()).list || []));
    } catch (e: any) { showToast("error", e.message || "加载失败"); }
    finally { setLoading(false); }
  }, [search, filterRating]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing({ __new: true }); setForm({}); };
  const openEdit = (s: any) => { setEditing(s); setForm({ ...s }); };

  const submit = async () => {
    if (!form.name) { showToast("error", "供应商名称为必填项"); return; }
    setSaving(true);
    try {
      if (editing?.__new) {
        await fetchWithAuth("/api/admin/purchase/suppliers", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
        });
      } else {
        await fetchWithAuth(`/api/admin/purchase/suppliers/${editing.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
        });
      }
      showToast("success", editing?.__new ? "供应商已创建" : "已保存");
      setEditing(null); load();
    } catch (e: any) { showToast("error", e.message || "保存失败"); }
    finally { setSaving(false); }
  };

  const openHistory = async (s: any) => {
    setHistory(s); setHistoryLoading(true);
    try {
      const r = await fetchWithAuth(`/api/admin/purchase/suppliers/${s.id}/history`);
      setHistory(await r.json());
    } catch (e: any) { showToast("error", e.message); }
    finally { setHistoryLoading(false); }
  };

  const now = new Date().toISOString().split("T")[0];

  // styles
  const inputStyle: React.CSSProperties = {
    padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: 6, fontSize: 13,
  };
  const btn: React.CSSProperties = {
    padding: "7px 16px", border: "none", borderRadius: 6, background: "var(--xt-accent, #f97316)",
    color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13,
  };
  const outlineBtn: React.CSSProperties = { ...btn, background: "#fff", color: "#334155", border: "1px solid #dbe1ea" };
  const thStyle: React.CSSProperties = {
    padding: "10px 12px", textAlign: "left", borderBottom: "2px solid #e2e8f0", fontWeight: 700, fontSize: 12, color: "#64748b",
  };
  const tdStyle: React.CSSProperties = {
    padding: "10px 12px", borderBottom: "1px solid #f1f5f9", fontSize: 13, verticalAlign: "middle",
  };
  const modalOverlay: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000,
    display: "flex", alignItems: "center", justifyContent: "center",
  };
  const modalBox: React.CSSProperties = {
    background: "#fff", borderRadius: 14, padding: 24, maxWidth: 600, width: "92%",
    maxHeight: "85vh", overflow: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
  };

  return (
    <div>
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 2000,
          background: toast.type === "success" ? "#166534" : "#991b1b",
          color: "#fff", padding: "12px 20px", borderRadius: 10, fontWeight: 700, fontSize: 14,
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
          {toast.msg}
        </div>
      )}

      <h2 style={{ marginTop: 0, fontSize: 20, fontWeight: 800 }}>达人进货管理</h2>

      {/* Tab Nav */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "2px solid #e2e8f0" }}>
        {[
          { label: "进货需求列表", path: basePath },
          { label: "商品库", path: `${basePath}/products` },
          { label: "订货管理", path: `${basePath}/orders` },
          { label: "找货配置", path: `${basePath}/coze-config` },
          { label: "供应商管理", path: `${basePath}/suppliers` },
        ].map((tab) => (
          <a key={tab.path} href={tab.path} style={{
            padding: "8px 14px", fontSize: 13, fontWeight: tab.path.includes("/suppliers") ? 700 : 500,
            color: tab.path.includes("/suppliers") ? "var(--xt-accent, #f97316)" : "#64748b",
            borderBottom: tab.path.includes("/suppliers") ? "2px solid var(--xt-accent, #f97316)" : "2px solid transparent",
            marginBottom: -2, textDecoration: "none", cursor: "pointer", whiteSpace: "nowrap",
          }}>
            {tab.label}
          </a>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input type="text" placeholder="搜索供应商..." value={search}
          onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, width: 200 }} />
        <select value={filterRating} onChange={(e) => setFilterRating(e.target.value)} style={inputStyle}>
          <option value="">全部评级</option>
          {["A", "B", "C", "D"].map((r) => <option key={r} value={r}>{r} 级</option>)}
        </select>
        <button onClick={load} style={btn}>🔍 搜索</button>
        <div style={{ flex: 1 }} />
        <button onClick={openCreate} style={btn}>+ 新增供应商</button>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflow: "auto" }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}><div style={{ fontSize: 32 }}>⏳</div><p>加载中...</p></div>
        ) : list.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>
            <div style={{ fontSize: 48 }}>🏭</div>
            <p style={{ fontWeight: 600 }}>暂无供应商</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>名称</th>
                <th style={thStyle}>联系方式</th>
                <th style={thStyle}>评级</th>
                <th style={thStyle}>合作次数</th>
                <th style={thStyle}>采购总额</th>
                <th style={thStyle}>合同到期</th>
                <th style={thStyle}>操作</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} style={{ cursor: "pointer" }} onClick={() => openHistory(s)}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{s.name}</td>
                  <td style={{ ...tdStyle, fontSize: 12 }}>{s.contact_info || "—"}</td>
                  <td style={tdStyle}>{RATING_STARS[s.rating] || s.rating || "—"}</td>
                  <td style={{ ...tdStyle, textAlign: "center" }}>{s.cooperation_count || 0}</td>
                  <td style={tdStyle}>฿{Number(s.total_purchase_amount || 0).toLocaleString()}</td>
                  <td style={tdStyle}>
                    {s.contract_expiry ? (
                      <span style={{ color: new Date(s.contract_expiry) < new Date(now) ? "#dc2626" : "#166534", fontWeight: 600 }}>
                        {new Date(s.contract_expiry).toLocaleDateString("zh-CN")}
                        {new Date(s.contract_expiry) < new Date(now) ? " ⚠️" : ""}
                      </span>
                    ) : "—"}
                  </td>
                  <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => openEdit(s)} style={{ ...outlineBtn, padding: "3px 10px", fontSize: 11 }}>编辑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      {editing && (
        <div style={modalOverlay} onClick={() => setEditing(null)}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>{editing.__new ? "新增供应商" : "编辑供应商"}</h3>
              <button onClick={() => setEditing(null)} style={{ ...outlineBtn, padding: "4px 10px", fontSize: 16 }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>名称 *</label>
                <input value={form.name || ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>联系方式</label>
                  <input value={form.contact_info || ""} onChange={(e) => setForm((f) => ({ ...f, contact_info: e.target.value }))}
                    style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} placeholder="电话/微信/Line" />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>评级</label>
                  <select value={form.rating || ""} onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}
                    style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}>
                    <option value="">-- 选择 --</option>
                    {["A", "B", "C", "D"].map((r) => <option key={r} value={r}>{r} 级 {RATING_STARS[r]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>地址</label>
                <input value={form.address || ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>合同到期日</label>
                  <input type="date" value={form.contract_expiry || ""} onChange={(e) => setForm((f) => ({ ...f, contract_expiry: e.target.value }))}
                    style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>账期</label>
                  <input value={form.payment_terms || ""} onChange={(e) => setForm((f) => ({ ...f, payment_terms: e.target.value }))}
                    style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} placeholder="如：月结30天" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>备注</label>
                <textarea value={form.remark || ""} onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))}
                  style={{ ...inputStyle, width: "100%", boxSizing: "border-box", minHeight: 60, resize: "vertical" }} />
              </div>
              <button onClick={submit} disabled={saving} style={{ ...btn, alignSelf: "flex-start", opacity: saving ? 0.5 : 1 }}>
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {history && (
        <div style={modalOverlay} onClick={() => setHistory(null)}>
          <div style={{ ...modalBox, maxWidth: 750 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>供货记录 — {history.supplier?.name || history.name}</h3>
              <button onClick={() => setHistory(null)} style={{ ...outlineBtn, padding: "4px 10px", fontSize: 16 }}>✕</button>
            </div>
            {historyLoading ? (
              <p style={{ textAlign: "center", color: "#94a3b8", padding: 40 }}>加载中...</p>
            ) : (
              <>
                {/* Summary */}
                <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                  <div style={{ background: "#f0fdf4", borderRadius: 8, padding: "10px 16px" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#166534" }}>{history.total_products || 0}</div>
                    <div style={{ fontSize: 11, color: "#166534" }}>商品数</div>
                  </div>
                  <div style={{ background: "#eff6ff", borderRadius: 8, padding: "10px 16px" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#1d4ed8" }}>{history.total_orders || 0}</div>
                    <div style={{ fontSize: 11, color: "#1d4ed8" }}>订单数</div>
                  </div>
                  <div style={{ background: "#fef3c7", borderRadius: 8, padding: "10px 16px" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#92400e" }}>฿{Number(history.total_amount || 0).toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: "#92400e" }}>采购总额</div>
                  </div>
                </div>

                {/* Products */}
                <h4 style={{ fontSize: 13, margin: "0 0 6px" }}>供应商品 ({(history.products || []).length})</h4>
                <div style={{ maxHeight: 200, overflow: "auto", marginBottom: 12 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, fontSize: 11 }}>商品</th>
                        <th style={{ ...thStyle, fontSize: 11 }}>¥CNY</th>
                        <th style={{ ...thStyle, fontSize: 11 }}>฿THB</th>
                        <th style={{ ...thStyle, fontSize: 11 }}>状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(history.products || []).map((p: any) => (
                        <tr key={p.id}>
                          <td style={tdStyle}>{p.product_name}</td>
                          <td style={tdStyle}>¥{p.price_cny}</td>
                          <td style={tdStyle}>฿{p.price_thb}</td>
                          <td style={tdStyle}>{p.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Orders */}
                <h4 style={{ fontSize: 13, margin: "0 0 6px" }}>关联订单 ({(history.orders || []).length})</h4>
                <div style={{ maxHeight: 200, overflow: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, fontSize: 11 }}>单号</th>
                        <th style={{ ...thStyle, fontSize: 11 }}>商品</th>
                        <th style={{ ...thStyle, fontSize: 11 }}>数量</th>
                        <th style={{ ...thStyle, fontSize: 11 }}>金额</th>
                        <th style={{ ...thStyle, fontSize: 11 }}>达人</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(history.orders || []).map((o: any) => (
                        <tr key={o.id}>
                          <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11 }}>{o.order_no}</td>
                          <td style={tdStyle}>{o.product_name}</td>
                          <td style={tdStyle}>{o.quantity}</td>
                          <td style={tdStyle}>฿{Number(o.total_payable).toLocaleString()}</td>
                          <td style={tdStyle}>{o.influencer_username || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
