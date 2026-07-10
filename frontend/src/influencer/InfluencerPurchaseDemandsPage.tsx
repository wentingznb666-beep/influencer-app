import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../fetchWithAuth";

const CATEGORIES = [
  "服装", "饰品", "美妆", "3C数码", "家居", "食品", "母婴", "运动户外",
  "包袋", "鞋履", "配饰", "健康保健", "家电", "汽摩", "农业", "其他",
];

const TEMPLATES: Record<string, Partial<Record<string, any>>> = {
  "": {},
  "服装生意": {
    category: "服装", sub_category: "女装",
    description: "寻找泰国TikTok爆款女装货源，要求款式新颖、质量好、价格有竞争力，支持一件代发。",
    frequency: "monthly",
  },
  "美妆带货": {
    category: "美妆", sub_category: "护肤品",
    description: "寻找泰国市场热销护肤品/彩妆，要求正品货源、有品牌授权，SPF防晒产品优先。",
    frequency: "monthly",
  },
  "3C配件": {
    category: "3C数码", sub_category: "手机配件",
    description: "寻找手机壳、数据线、充电宝等3C配件，要求1688源头价、支持小批量试单。",
    frequency: "weekly",
  },
};

const STATUS_LABELS: Record<string, string> = {
  pending: "待处理", recommended: "已推荐", ordered: "已下单",
  closed: "已关闭", cancelled: "已取消",
};
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#fff7ed", text: "#c2410c" },
  recommended: { bg: "#eff6ff", text: "#1d4ed8" },
  ordered: { bg: "#f0fdf4", text: "#166534" },
  closed: { bg: "#f1f5f9", text: "#475569" },
  cancelled: { bg: "#fef2f2", text: "#991b1b" },
};

export default function InfluencerPurchaseDemandsPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<any[]>([]);
  const [err, setErr] = useState("");

  // create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<Record<string, any>>({ frequency: "one_time" });
  const [createSaving, setCreateSaving] = useState(false);
  const [template, setTemplate] = useState("");

  // detail modal
  const [detail, setDetail] = useState<any>(null);
  const [detailRecs, setDetailRecs] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // edit
  const [editing, setEditing] = useState<any>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [editSaving, setEditSaving] = useState(false);

  // reject feedback
  const [rejectRec, setRejectRec] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");

  // toast
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg }); setTimeout(() => setToast(null), 3000);
  };

  // ---------- data ----------
  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const r = await fetchWithAuth("/api/influencer/purchase/demands");
      setList(((await r.json()).list || []));
    } catch (e: any) { setErr(e.message || "加载失败"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ---------- create ----------
  const openCreate = () => {
    setCreateForm({ frequency: "one_time" }); setTemplate(""); setShowCreate(true);
  };

  const applyTemplate = (name: string) => {
    setTemplate(name);
    if (name && TEMPLATES[name]) {
      setCreateForm((f) => ({ ...f, ...TEMPLATES[name] }));
    } else {
      setCreateForm({ frequency: "one_time" });
    }
  };

  const submitCreate = async () => {
    if (!createForm.title) { showToast("error", "需求标题为必填项"); return; }
    if (!createForm.category) { showToast("error", "品类为必填项"); return; }
    setCreateSaving(true);
    try {
      await fetchWithAuth("/api/influencer/purchase/demands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      showToast("success", "需求已发布");
      setShowCreate(false); load();
    } catch (e: any) { showToast("error", e.message || "发布失败"); }
    finally { setCreateSaving(false); }
  };

  // ---------- detail ----------
  const openDetail = async (d: any) => {
    setDetail(d); setDetailLoading(true); setDetailRecs([]);
    try {
      const [r1, r2] = await Promise.all([
        fetchWithAuth(`/api/influencer/purchase/demands/${d.id}`),
        fetchWithAuth(`/api/influencer/purchase/demands/recommendations/demand/${d.id}`),
      ]);
      const dd = await r1.json();
      const dr = await r2.json();
      setDetail(dd.demand || d);
      setDetailRecs(dr.list || []);
    } catch (e: any) { showToast("error", e.message); }
    finally { setDetailLoading(false); }
  };

  // ---------- recommendation actions ----------
  const markInterested = async (rec: any) => {
    try {
      await fetchWithAuth(`/api/influencer/purchase/demands/recommendations/${rec.id}/feedback`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "interested", influencer_feedback: "感兴趣" }),
      });
      showToast("success", "已标记感兴趣");
      // navigate to order page
      nav(`/influencer/vertical-connections/purchase/orders?product_id=${rec.product_id}&demand_id=${detail.id}`);
    } catch (e: any) { showToast("error", e.message || "操作失败"); }
  };

  const markRejected = async () => {
    if (!rejectRec || !rejectReason.trim()) { showToast("error", "请填写原因"); return; }
    try {
      await fetchWithAuth(`/api/influencer/purchase/demands/recommendations/${rejectRec.id}/feedback`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected", influencer_feedback: rejectReason }),
      });
      showToast("success", "已反馈不感兴趣");
      setRejectRec(null); setRejectReason("");
      if (detail) openDetail(detail);
    } catch (e: any) { showToast("error", e.message || "操作失败"); }
  };

  // ---------- edit / cancel ----------
  const openEdit = (d: any) => {
    setEditing(d); setEditForm({ ...d });
  };

  const submitEdit = async () => {
    if (!editing) return;
    setEditSaving(true);
    try {
      await fetchWithAuth(`/api/influencer/purchase/demands/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      showToast("success", "需求已更新");
      setEditing(null); load();
    } catch (e: any) { showToast("error", e.message || "更新失败"); }
    finally { setEditSaving(false); }
  };

  const cancelDemand = async (d: any) => {
    if (!confirm("确认撤回该需求？")) return;
    try {
      await fetchWithAuth(`/api/influencer/purchase/demands/${d.id}/cancel`, { method: "PATCH" });
      showToast("success", "需求已撤回"); load();
    } catch (e: any) { showToast("error", e.message || "撤回失败"); }
  };

  // ---------- styles ----------
  const inputStyle: React.CSSProperties = {
    padding: "8px 12px", border: "1px solid #dbe1ea", borderRadius: 8, fontSize: 14,
    width: "100%", boxSizing: "border-box",
  };
  const btn: React.CSSProperties = {
    padding: "10px 24px", border: "none", borderRadius: 8, background: "var(--xt-accent, #f97316)",
    color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14,
  };
  const outlineBtn: React.CSSProperties = {
    ...btn, background: "#fff", color: "#334155", border: "1px solid #dbe1ea",
  };
  const modalOverlay: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000,
    display: "flex", alignItems: "center", justifyContent: "center",
  };
  const modalBox: React.CSSProperties = {
    background: "#fff", borderRadius: 14, padding: 24, maxWidth: 640, width: "92%",
    maxHeight: "85vh", overflow: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
  };
  const card: React.CSSProperties = {
    background: "#fff", borderRadius: 12, padding: 16, marginBottom: 10,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)", cursor: "pointer",
    border: "1px solid #f1f5f9",
  };
  const tag = (status: string): React.CSSProperties => {
    const c = STATUS_COLORS[status] || STATUS_COLORS.pending;
    return { display: "inline-block", padding: "3px 12px", borderRadius: 12, background: c.bg, color: c.text, fontWeight: 700, fontSize: 12 };
  };

  // ---------- render ----------
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

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>我的需求</h2>
        <button onClick={openCreate} style={btn}>+ 发布新需求</button>
      </div>

      {err && <p style={{ color: "#c00", marginBottom: 12 }}>{err}</p>}

      {/* List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div><p>加载中...</p>
        </div>
      ) : list.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>📝</div>
          <p style={{ fontSize: 15, fontWeight: 600 }}>还没有发布过需求</p>
          <p style={{ fontSize: 13 }}>点击上方按钮发布第一个进货需求</p>
        </div>
      ) : (
        list.map((d: any) => {
          const sc = STATUS_COLORS[d.status] || STATUS_COLORS.pending;
          const hasRecs = d.status === "recommended";
          return (
            <div key={d.id} style={card} onClick={() => openDetail(d)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                    {hasRecs && <span style={{ marginRight: 6 }}>🔔</span>}
                    {d.title}
                  </div>
                  <div style={{ fontSize: 13, color: "#64748b" }}>
                    {d.category}{d.sub_category ? ` / ${d.sub_category}` : ""}
                    {d.budget_min_thb || d.budget_max_thb ? (
                      <span> · 预算: ฿{Number(d.budget_min_thb || 0).toLocaleString()}~฿{Number(d.budget_max_thb || 0).toLocaleString()}</span>
                    ) : null}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span style={tag(d.status)}>{STATUS_LABELS[d.status] || d.status}</span>
                  {d.status === "pending" && (
                    <button onClick={(e) => { e.stopPropagation(); openEdit(d); }} style={{ ...outlineBtn, padding: "4px 12px", fontSize: 12 }}>修改</button>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
                {d.created_at ? new Date(d.created_at).toLocaleDateString("zh-CN") : "—"}
                {d.frequency && d.frequency !== "one_time" ? ` · ${d.frequency === "weekly" ? "每周" : "每月"}` : " · 一次性"}
              </div>
            </div>
          );
        })
      )}

      {/* ======== CREATE MODAL ======== */}
      {showCreate && (
        <div style={modalOverlay} onClick={() => setShowCreate(false)}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>发布新需求</h3>
              <button onClick={() => setShowCreate(false)} style={{ ...outlineBtn, padding: "4px 10px", fontSize: 16 }}>✕</button>
            </div>

            {/* Template shortcuts */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>快捷模板</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Object.keys(TEMPLATES).filter(Boolean).map((name) => (
                  <button key={name} onClick={() => applyTemplate(name)} style={{
                    ...outlineBtn, padding: "5px 14px", fontSize: 12,
                    background: template === name ? "var(--xt-accent, #f97316)" : "#fff",
                    color: template === name ? "#fff" : "#334155",
                  }}>
                    {name}
                  </button>
                ))}
                <button onClick={() => applyTemplate("")} style={{
                  ...outlineBtn, padding: "5px 14px", fontSize: 12,
                  background: template === "" ? "var(--xt-accent, #f97316)" : "#fff",
                  color: template === "" ? "#fff" : "#334155",
                }}>自己填写</button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>需求标题 *</label>
                <input value={createForm.title || ""} onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                  style={inputStyle} placeholder="如：需要泰国TikTok爆款女装" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>品类 *</label>
                  <select value={createForm.category || ""} onChange={(e) => setCreateForm((f) => ({ ...f, category: e.target.value }))} style={inputStyle}>
                    <option value="">-- 选择品类 --</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>子品类</label>
                  <input value={createForm.sub_category || ""} onChange={(e) => setCreateForm((f) => ({ ...f, sub_category: e.target.value }))}
                    style={inputStyle} placeholder="如：女装、防晒" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>详细描述</label>
                <textarea value={createForm.description || ""} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                  style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} placeholder="描述你对货源的具体要求..." />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>预算最低 (THB)</label>
                  <input type="number" value={createForm.budget_min_thb || ""}
                    onChange={(e) => setCreateForm((f) => ({ ...f, budget_min_thb: e.target.value ? parseFloat(e.target.value) : "" }))} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>预算最高 (THB)</label>
                  <input type="number" value={createForm.budget_max_thb || ""}
                    onChange={(e) => setCreateForm((f) => ({ ...f, budget_max_thb: e.target.value ? parseFloat(e.target.value) : "" }))} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>频率</label>
                  <select value={createForm.frequency || "one_time"} onChange={(e) => setCreateForm((f) => ({ ...f, frequency: e.target.value }))} style={inputStyle}>
                    <option value="one_time">一次性</option>
                    <option value="weekly">每周</option>
                    <option value="monthly">每月</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>目标售价 THB</label>
                  <input type="number" value={createForm.target_price || ""}
                    onChange={(e) => setCreateForm((f) => ({ ...f, target_price: e.target.value ? parseFloat(e.target.value) : "" }))} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>预估需求量</label>
                  <input type="number" value={createForm.estimated_quantity || ""}
                    onChange={(e) => setCreateForm((f) => ({ ...f, estimated_quantity: e.target.value ? parseInt(e.target.value) : "" }))} style={inputStyle} />
                </div>
              </div>
              <button onClick={submitCreate} disabled={createSaving} style={{ ...btn, alignSelf: "flex-start", opacity: createSaving ? 0.5 : 1 }}>
                {createSaving ? "发布中..." : "发布需求"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======== DETAIL MODAL ======== */}
      {detail && (
        <div style={modalOverlay} onClick={() => { setDetail(null); setRejectRec(null); }}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>需求详情</h3>
              <button onClick={() => { setDetail(null); setRejectRec(null); }} style={{ ...outlineBtn, padding: "4px 10px", fontSize: 16 }}>✕</button>
            </div>

            {detailLoading ? (
              <p style={{ textAlign: "center", color: "#94a3b8", padding: 40 }}>加载中...</p>
            ) : (
              <>
                {/* Info */}
                <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 16 }}>
                  <div style={{ display: "grid", gap: "6px 20px", fontSize: 13, gridTemplateColumns: "1fr 1fr" }}>
                    <div><strong>标题：</strong>{detail.title}</div>
                    <div><strong>状态：</strong><span style={tag(detail.status)}>{STATUS_LABELS[detail.status] || detail.status}</span></div>
                    <div><strong>品类：</strong>{detail.category}{detail.sub_category ? ` / ${detail.sub_category}` : ""}</div>
                    <div><strong>频率：</strong>{detail.frequency === "monthly" ? "每月" : detail.frequency === "weekly" ? "每周" : "一次性"}</div>
                    <div><strong>预算：</strong>฿{Number(detail.budget_min_thb || 0).toLocaleString()} ~ ฿{Number(detail.budget_max_thb || 0).toLocaleString()}</div>
                    <div><strong>目标售价：</strong>{detail.target_price ? `฿${Number(detail.target_price).toLocaleString()}` : "—"}</div>
                    <div style={{ gridColumn: "1 / -1" }}><strong>描述：</strong>{detail.description || "—"}</div>
                  </div>
                </div>

                {/* Actions */}
                {detail.status === "pending" && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    <button onClick={() => { setDetail(null); openEdit(detail); }} style={outlineBtn}>修改需求</button>
                    <button onClick={() => { cancelDemand(detail); setDetail(null); }} style={{ ...outlineBtn, color: "#dc2626", borderColor: "#dc2626" }}>撤回需求</button>
                  </div>
                )}

                {/* Recommendations */}
                <h4 style={{ fontSize: 14, margin: "0 0 10px" }}>
                  推荐商品 ({detailRecs.length})
                  {detail.status === "recommended" && detailRecs.some((r: any) => r.status === "pending") && (
                    <span style={{ fontSize: 12, color: "#f97316", marginLeft: 8 }}>🔔 有新的推荐</span>
                  )}
                </h4>

                {detailRecs.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 30, color: "#94a3b8", fontSize: 13 }}>
                    📦 暂无推荐商品，请等待运营处理
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {detailRecs.map((rec: any) => (
                      <div key={rec.id} style={{
                        display: "flex", alignItems: "center", gap: 12,
                        background: "#f8fafc", borderRadius: 10, padding: 12, border: "1px solid #e2e8f0",
                      }}>
                        {/* thumb */}
                        {rec.image_urls && Array.isArray(rec.image_urls) && rec.image_urls[0] ? (
                          <img src={rec.image_urls[0]} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: "cover", background: "#e2e8f0" }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div style={{ width: 52, height: 52, borderRadius: 8, background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📦</div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {rec.product_name}
                            </span>
                            {rec.product_link && (
                              <a href={rec.product_link} target="_blank" rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title="打开商品链接"
                                style={{ color: "var(--xt-accent, #f97316)", textDecoration: "none", flexShrink: 0, fontSize: 14 }}>
                                🔗
                              </a>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b" }}>
                            [{rec.source}] ¥{rec.price_cny} / ฿{rec.price_thb} · {rec.supplier_name || "—"}
                          </div>
                          {rec.moq && <div style={{ fontSize: 11, color: "#94a3b8" }}>起订量: {rec.moq}</div>}
                        </div>
                        {rec.status === "pending" ? (
                          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                            <button onClick={() => markInterested(rec)} style={{ ...btn, padding: "4px 12px", fontSize: 12 }}>
                              👍 感兴趣
                            </button>
                            <button onClick={() => { setRejectRec(rec); setRejectReason(""); }} style={{ ...outlineBtn, padding: "4px 12px", fontSize: 12 }}>
                              👎 不感兴趣
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, fontWeight: 700, flexShrink: 0,
                            color: rec.status === "interested" ? "#166534" : rec.status === "rejected" ? "#991b1b" : "#475569",
                          }}>
                            {rec.status === "interested" ? "✅ 感兴趣" : rec.status === "rejected" ? "❌ 不感兴趣" : rec.status}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ======== EDIT MODAL ======== */}
      {editing && (
        <div style={modalOverlay} onClick={() => setEditing(null)}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>修改需求</h3>
              <button onClick={() => setEditing(null)} style={{ ...outlineBtn, padding: "4px 10px", fontSize: 16 }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>标题</label>
                <input value={editForm.title || ""} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>品类</label>
                  <select value={editForm.category || ""} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))} style={inputStyle}>
                    <option value="">-- 选择 --</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>子品类</label>
                  <input value={editForm.sub_category || ""} onChange={(e) => setEditForm((f) => ({ ...f, sub_category: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>描述</label>
                <textarea value={editForm.description || ""} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>预算最低 (THB)</label>
                  <input type="number" value={editForm.budget_min_thb || ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, budget_min_thb: e.target.value ? parseFloat(e.target.value) : "" }))} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>预算最高 (THB)</label>
                  <input type="number" value={editForm.budget_max_thb || ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, budget_max_thb: e.target.value ? parseFloat(e.target.value) : "" }))} style={inputStyle} />
                </div>
              </div>
              <button onClick={submitEdit} disabled={editSaving} style={{ ...btn, alignSelf: "flex-start", opacity: editSaving ? 0.5 : 1 }}>
                {editSaving ? "保存中..." : "保存修改"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======== REJECT REASON MODAL ======== */}
      {rejectRec && (
        <div style={modalOverlay} onClick={() => setRejectRec(null)}>
          <div style={{ ...modalBox, maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 12px" }}>不感兴趣的原因</h3>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>
              商品：{rejectRec.product_name}
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              style={{ ...inputStyle, minHeight: 80, resize: "vertical", marginBottom: 12 }}
              placeholder="请告诉我们原因，如：价格太高、质量不符合要求..."
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={markRejected} style={btn}>确认</button>
              <button onClick={() => setRejectRec(null)} style={outlineBtn}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
