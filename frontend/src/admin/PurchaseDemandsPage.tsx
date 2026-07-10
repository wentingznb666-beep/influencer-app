import { useEffect, useState, useCallback } from "react";
import { fetchWithAuth } from "../fetchWithAuth";

const CATEGORIES = [
  "服装", "饰品", "美妆", "3C数码", "家居", "食品", "母婴", "运动户外",
  "包袋", "鞋履", "配饰", "健康保健", "家电", "汽摩", "农业", "其他",
];

const STATUS_OPTIONS = [
  { value: "", label: "全部" },
  { value: "pending", label: "待处理" },
  { value: "recommended", label: "已推荐" },
  { value: "ordered", label: "已下单" },
  { value: "closed", label: "已关闭" },
  { value: "cancelled", label: "已取消" },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#fff7ed", text: "#c2410c" },
  recommended: { bg: "#eff6ff", text: "#1d4ed8" },
  ordered: { bg: "#f0fdf4", text: "#166534" },
  closed: { bg: "#f1f5f9", text: "#475569" },
  cancelled: { bg: "#fef2f2", text: "#991b1b" },
};

const STATUS_LABELS: Record<string, string> = {
  pending: "待处理",
  recommended: "已推荐",
  ordered: "已下单",
  closed: "已关闭",
  cancelled: "已取消",
};

type Demand = Record<string, any>;
type Product = Record<string, any>;
type Recommendation = Record<string, any>;

export default function PurchaseDemandsPage() {
  // ---------- state ----------
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<Demand[]>([]);
  const [stats, setStats] = useState({ pending: 0, recommended: 0, ordered: 0 });

  // filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");

  // selection
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // detail modal
  const [detailDemand, setDetailDemand] = useState<Demand | null>(null);
  const [detailRecs, setDetailRecs] = useState<Recommendation[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<Record<string, any>>({});
  const [createSaving, setCreateSaving] = useState(false);

  // manual recommend
  const [showRecPicker, setShowRecPicker] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [recProductId, setRecProductId] = useState<number | "">("");
  const [recSaving, setRecSaving] = useState(false);

  // close demand
  const [closeNote, setCloseNote] = useState("");

  // toast
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  // ---------- data ----------
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterCategory) params.set("category", filterCategory);
      if (filterStart) params.set("start_date", filterStart);
      if (filterEnd) params.set("end_date", filterEnd);
      if (filterSearch) params.set("influencer_id", filterSearch); // backend will parse

      const qs = params.toString();
      const [resList, resStats] = await Promise.all([
        fetchWithAuth(`/api/admin/purchase/demands${qs ? "?" + qs : ""}`),
        fetchWithAuth("/api/admin/purchase/demands/stats"),
      ]);
      const d1 = await resList.json();
      const d2 = await resStats.json();
      setList(d1.list || []);
      setStats(d2);
    } catch (e: any) {
      showToast("error", e.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterCategory, filterStart, filterEnd, filterSearch]);

  useEffect(() => { load(); }, [load]);

  // ---------- helpers ----------
  const isManaged = (d: Demand) => {
    // profile_user_id is NULL → managed influencer (no linked user)
    // OR influencer_disabled === 1 → managed (auto-created disabled account)
    return d.profile_user_id === null || d.influencer_disabled === 1;
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === list.length && list.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(list.map((d: any) => d.id)));
    }
  };

  // ---------- detail ----------
  const openDetail = async (d: Demand) => {
    setDetailDemand(d);
    setDetailLoading(true);
    setDetailRecs([]);
    try {
      const [resDemand, resRecs] = await Promise.all([
        fetchWithAuth(`/api/admin/purchase/demands/${d.id}`),
        fetchWithAuth(`/api/admin/purchase/recommendations/demand/${d.id}`),
      ]);
      const dd = await resDemand.json();
      const dr = await resRecs.json();
      setDetailDemand(dd.demand || d);
      setDetailRecs(dr.list || []);
    } catch (e: any) {
      showToast("error", e.message || "加载详情失败");
    } finally {
      setDetailLoading(false);
    }
  };

  // ---------- actions ----------
  const closeDemand = async () => {
    if (!detailDemand) return;
    if (!closeNote.trim()) { showToast("error", "关闭需求必须填写备注"); return; }
    try {
      await fetchWithAuth(`/api/admin/purchase/demands/${detailDemand.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed", internal_note: closeNote }),
      });
      showToast("success", "需求已关闭");
      setDetailDemand(null);
      setCloseNote("");
      load();
    } catch (e: any) {
      showToast("error", e.message || "操作失败");
    }
  };

  const triggerCoze = async (demandId: number) => {
    try {
      // reset coze flag so it can be re-scanned
      await fetchWithAuth(`/api/admin/purchase/demands/${demandId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending", internal_note: "手动触发 Coze 搜索" }),
      });
      showToast("success", "已触发 Coze 搜索");
      load();
    } catch (e: any) {
      showToast("error", e.message || "触发失败");
    }
  };

  const batchTriggerCoze = async () => {
    if (selected.size === 0) return;
    if (!confirm(`确认对选中的 ${selected.size} 条需求触发 Coze 搜索？`)) return;
    let ok = 0;
    for (const id of selected) {
      try {
        await fetchWithAuth(`/api/admin/purchase/demands/${id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "pending", internal_note: "批量触发 Coze 搜索" }),
        });
        ok++;
      } catch { /* skip */ }
    }
    showToast(ok === selected.size ? "success" : "error", `完成 ${ok}/${selected.size} 条`);
    setSelected(new Set());
    load();
  };

  // ---------- manual recommend ----------
  const openRecPicker = async () => {
    setShowRecPicker(true);
    setRecProductId("");
    try {
      const r = await fetchWithAuth("/api/admin/purchase/products?status=active");
      const d = await r.json();
      setAllProducts(d.list || []);
    } catch { setAllProducts([]); }
  };

  const submitManualRec = async () => {
    if (!detailDemand || !recProductId) return;
    setRecSaving(true);
    try {
      await fetchWithAuth("/api/admin/purchase/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demand_id: detailDemand.id, product_id: recProductId }),
      });
      showToast("success", "推荐成功");
      setShowRecPicker(false);
      // refresh recs
      const r = await fetchWithAuth(`/api/admin/purchase/recommendations/demand/${detailDemand.id}`);
      const d = await r.json();
      setDetailRecs(d.list || []);
    } catch (e: any) {
      showToast("error", e.message || "推荐失败");
    } finally {
      setRecSaving(false);
    }
  };

  const proxyConfirmRec = async (recId: number) => {
    try {
      await fetchWithAuth(`/api/admin/purchase/recommendations/${recId}/confirm-proxy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: "管理员代确认感兴趣" }),
      });
      showToast("success", "已代确认");
      if (detailDemand) {
        const r = await fetchWithAuth(`/api/admin/purchase/recommendations/demand/${detailDemand.id}`);
        setDetailRecs((await r.json()).list || []);
      }
    } catch (e: any) {
      showToast("error", e.message || "操作失败");
    }
  };

  // ---------- create demand (proxy) ----------
  const openCreate = () => {
    setCreateForm({ frequency: "one_time" });
    setShowCreate(true);
  };

  const submitCreate = async () => {
    if (!createForm.influencer_profile_id) { showToast("error", "请选择达人"); return; }
    if (!createForm.title) { showToast("error", "标题为必填"); return; }
    if (!createForm.category) { showToast("error", "品类为必填"); return; }
    setCreateSaving(true);
    try {
      await fetchWithAuth("/api/admin/purchase/demands/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      showToast("success", "需求已创建");
      setShowCreate(false);
      load();
    } catch (e: any) {
      showToast("error", e.message || "创建失败");
    } finally {
      setCreateSaving(false);
    }
  };

  // ---------- styles ----------
  const cardStyle = (bg: string): React.CSSProperties => ({
    background: bg, borderRadius: 10, padding: "14px 20px", minWidth: 130,
  });
  const cardNum: React.CSSProperties = { fontSize: 24, fontWeight: 800, margin: 0 };
  const cardLabel: React.CSSProperties = { fontSize: 12, margin: "4px 0 0", opacity: 0.8 };

  const inputStyle: React.CSSProperties = {
    padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: 6, fontSize: 13, minWidth: 100,
  };
  const btnStyle: React.CSSProperties = {
    padding: "7px 16px", border: "none", borderRadius: 6, background: "var(--xt-accent, #f97316)",
    color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13,
  };
  const outlineBtn: React.CSSProperties = {
    ...btnStyle, background: "#fff", color: "#334155", border: "1px solid #dbe1ea",
  };
  const dangerBtn: React.CSSProperties = {
    ...btnStyle, background: "#dc2626",
  };
  const dashedBtn: React.CSSProperties = {
    ...outlineBtn, borderStyle: "dashed", color: "#94a3b8",
  };

  const thStyle: React.CSSProperties = {
    padding: "10px 12px", textAlign: "left", borderBottom: "2px solid #e2e8f0",
    fontWeight: 700, fontSize: 12, color: "#64748b", whiteSpace: "nowrap",
  };
  const tdStyle: React.CSSProperties = {
    padding: "10px 12px", borderBottom: "1px solid #f1f5f9", fontSize: 13, verticalAlign: "middle",
  };

  const modalOverlay: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000,
    display: "flex", alignItems: "center", justifyContent: "center",
  };
  const modalBox: React.CSSProperties = {
    background: "#fff", borderRadius: 14, padding: 24, maxWidth: 800, width: "90%",
    maxHeight: "85vh", overflow: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
  };

  // ---------- render ----------
  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 2000,
          background: toast.type === "success" ? "#166534" : "#991b1b",
          color: "#fff", padding: "12px 20px", borderRadius: 10, fontWeight: 700, fontSize: 14,
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        }}>
          {toast.msg}
        </div>
      )}

      <h2 style={{ marginTop: 0, fontSize: 20, fontWeight: 800 }}>达人进货管理</h2>

      {/* Tab Navigation */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "2px solid #e2e8f0" }}>
        {[
          { label: "进货需求列表", path: "/admin/vertical-connections/purchase" },
          { label: "商品库", path: "/admin/vertical-connections/purchase/products" },
          { label: "订货管理", path: "/admin/vertical-connections/purchase/orders" },
          { label: "找货配置", path: "/admin/vertical-connections/purchase/coze-config" },
        ].map((tab) => {
          const active = window.location.pathname === tab.path || (tab.path === "/admin/vertical-connections/purchase" && window.location.pathname === "/admin/vertical-connections/purchase");
          return (
            <a key={tab.path} href={tab.path} style={{
              padding: "8px 20px", fontSize: 14, fontWeight: active ? 700 : 500,
              color: active ? "var(--xt-accent, #f97316)" : "#64748b",
              borderBottom: active ? "2px solid var(--xt-accent, #f97316)" : "2px solid transparent",
              marginBottom: -2, textDecoration: "none", cursor: "pointer",
              transition: "color 0.15s, border-color 0.15s",
            }}>
              {tab.label}
            </a>
          );
        })}
      </div>

      {/* Stats Cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={cardStyle("#fff7ed")}>
          <p style={{ ...cardNum, color: "#c2410c" }}>{stats.pending}</p>
          <p style={{ ...cardLabel, color: "#c2410c" }}>待处理</p>
        </div>
        <div style={cardStyle("#eff6ff")}>
          <p style={{ ...cardNum, color: "#1d4ed8" }}>{stats.recommended}</p>
          <p style={{ ...cardLabel, color: "#1d4ed8" }}>已推荐</p>
        </div>
        <div style={cardStyle("#f0fdf4")}>
          <p style={{ ...cardNum, color: "#166534" }}>{stats.ordered}</p>
          <p style={{ ...cardLabel, color: "#166534" }}>已下单</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={inputStyle}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <input
          type="text" placeholder="搜索达人编号..." value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)} style={{ ...inputStyle, width: 160 }}
        />
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={inputStyle}>
          <option value="">全部品类</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="date" value={filterStart} onChange={(e) => setFilterStart(e.target.value)} style={inputStyle} title="开始日期" />
        <span style={{ color: "#94a3b8", fontSize: 13 }}>至</span>
        <input type="date" value={filterEnd} onChange={(e) => setFilterEnd(e.target.value)} style={inputStyle} title="结束日期" />
        <button onClick={load} style={btnStyle}>🔍 搜索</button>
        <div style={{ flex: 1 }} />
        {selected.size > 0 && (
          <button onClick={batchTriggerCoze} style={{ ...outlineBtn, borderColor: "#f97316", color: "#f97316" }}>
            ⚡ 批量触发 Coze ({selected.size})
          </button>
        )}
        <button onClick={openCreate} style={dashedBtn}>+ 新增需求(代提交)</button>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflow: "auto" }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
            <p>加载中...</p>
          </div>
        ) : list.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>📭</div>
            <p style={{ fontSize: 15, fontWeight: 600 }}>暂无进货需求</p>
            <p style={{ fontSize: 13 }}>点击「新增需求」为托管达人代提交需求</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 40 }}>
                  <input type="checkbox" checked={selected.size === list.length && list.length > 0} onChange={toggleAll} />
                </th>
                <th style={thStyle}>需求标题</th>
                <th style={thStyle}>达人</th>
                <th style={thStyle}>品类</th>
                <th style={thStyle}>预算 (THB)</th>
                <th style={thStyle}>状态</th>
                <th style={thStyle}>创建时间</th>
                <th style={thStyle}>操作</th>
              </tr>
            </thead>
            <tbody>
              {list.map((d) => {
                const managed = isManaged(d);
                const sc = STATUS_COLORS[d.status] || STATUS_COLORS.pending;
                return (
                  <tr key={d.id} style={{ cursor: "pointer" }} onClick={() => openDetail(d)}>
                    <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleSelect(d.id)} />
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{d.title}</td>
                    <td style={tdStyle}>
                      {managed ? "🛠 " : "👤 "}
                      {d.influencer_code || `#${d.influencer_id}`}
                    </td>
                    <td style={tdStyle}>{d.category}{d.sub_category ? ` / ${d.sub_category}` : ""}</td>
                    <td style={tdStyle}>
                      {d.budget_min_thb ? `฿${Number(d.budget_min_thb).toLocaleString()}` : "—"}
                      {" ~ "}
                      {d.budget_max_thb ? `฿${Number(d.budget_max_thb).toLocaleString()}` : "—"}
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        display: "inline-block", padding: "2px 10px", borderRadius: 12,
                        background: sc.bg, color: sc.text, fontWeight: 700, fontSize: 12,
                      }}>
                        {STATUS_LABELS[d.status] || d.status}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: "#94a3b8", fontSize: 12 }}>
                      {d.created_at ? new Date(d.created_at).toLocaleDateString("zh-CN") : "—"}
                    </td>
                    <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                      {managed ? (
                        <button onClick={() => openDetail(d)} style={dashedBtn}>
                          🛠 代操作
                        </button>
                      ) : (
                        <button onClick={() => openDetail(d)} style={outlineBtn}>
                          📋 详情
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ======== DETAIL MODAL ======== */}
      {detailDemand && (
        <div style={modalOverlay} onClick={() => { setDetailDemand(null); setShowRecPicker(false); }}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>需求详情</h3>
              <button onClick={() => { setDetailDemand(null); setShowRecPicker(false); }} style={{
                ...outlineBtn, padding: "4px 10px", fontSize: 16,
              }}>✕</button>
            </div>

            {detailLoading ? (
              <p style={{ color: "#94a3b8", textAlign: "center", padding: 40 }}>加载中...</p>
            ) : (
              <>
                {/* Demand info */}
                <div style={{ background: "#f8fafc", borderRadius: 10, padding: 16, marginBottom: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px", fontSize: 13 }}>
                    <div><strong>标题：</strong>{detailDemand.title}</div>
                    <div><strong>状态：</strong>
                      <span style={{
                        display: "inline-block", padding: "2px 10px", borderRadius: 12,
                        background: STATUS_COLORS[detailDemand.status]?.bg || "#f1f5f9",
                        color: STATUS_COLORS[detailDemand.status]?.text || "#475569",
                        fontWeight: 700, fontSize: 12,
                      }}>
                        {STATUS_LABELS[detailDemand.status] || detailDemand.status}
                      </span>
                    </div>
                    <div><strong>品类：</strong>{detailDemand.category}{detailDemand.sub_category ? ` / ${detailDemand.sub_category}` : ""}</div>
                    <div><strong>频率：</strong>{detailDemand.frequency === "monthly" ? "每月" : detailDemand.frequency === "weekly" ? "每周" : "一次性"}</div>
                    <div><strong>预算：</strong>฿{Number(detailDemand.budget_min_thb || 0).toLocaleString()} ~ ฿{Number(detailDemand.budget_max_thb || 0).toLocaleString()}</div>
                    <div><strong>目标售价：</strong>{detailDemand.target_price ? `฿${Number(detailDemand.target_price).toLocaleString()}` : "—"}</div>
                    <div><strong>预估需求量：</strong>{detailDemand.estimated_quantity || "—"}</div>
                    <div><strong>创建时间：</strong>{detailDemand.created_at ? new Date(detailDemand.created_at).toLocaleString("zh-CN") : "—"}</div>
                    <div style={{ gridColumn: "1 / -1" }}><strong>描述：</strong>{detailDemand.description || "—"}</div>
                    {detailDemand.influencer_note && (
                      <div style={{ gridColumn: "1 / -1" }}><strong>达人备注：</strong>{detailDemand.influencer_note}</div>
                    )}
                    {detailDemand.internal_note && (
                      <div style={{ gridColumn: "1 / -1", color: "#dc2626" }}><strong>内部备注：</strong>{detailDemand.internal_note}</div>
                    )}
                  </div>
                </div>

                {/* Managed indicator */}
                {isManaged(detailDemand) && (
                  <div style={{
                    background: "#fef3c7", borderRadius: 8, padding: "8px 14px", marginBottom: 16,
                    fontSize: 13, color: "#92400e", fontWeight: 600,
                  }}>
                    🛠 托管达人 — 可使用下方代操作按钮
                  </div>
                )}

                {/* Actions row */}
                <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                  {detailDemand.status === "pending" && (
                    <>
                      <button onClick={openRecPicker} style={btnStyle}>📦 手动推荐商品</button>
                      <button onClick={() => triggerCoze(detailDemand.id)} style={outlineBtn}>⚡ 触发 Coze 搜索</button>
                    </>
                  )}
                  {["pending", "recommended"].includes(detailDemand.status) && (
                    <>
                      <input
                        type="text" placeholder="关闭原因..." value={closeNote}
                        onChange={(e) => setCloseNote(e.target.value)} style={{ ...inputStyle, width: 200 }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button onClick={closeDemand} style={dangerBtn}>关闭需求</button>
                    </>
                  )}
                  {isManaged(detailDemand) && (
                    <>
                      <span style={{ color: "#94a3b8", fontSize: 12, alignSelf: "center" }}>| 代操作：</span>
                      <button onClick={() => {
                        // open proxy order creation
                        const pid = detailDemand.influencer_profile_id;
                        if (pid) {
                          setCreateForm({
                            influencer_profile_id: pid,
                            title: detailDemand.title,
                            category: detailDemand.category,
                            frequency: "one_time",
                          });
                          setDetailDemand(null);
                          setShowCreate(true);
                        } else {
                          showToast("error", "无法获取达人资料 ID");
                        }
                      }} style={dashedBtn}>🛠 代提交需求</button>
                    </>
                  )}
                </div>

                {/* Manual recommend picker */}
                {showRecPicker && (
                  <div style={{ background: "#f0f9ff", borderRadius: 10, padding: 16, marginBottom: 16 }}>
                    <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>选择推荐商品</h4>
                    <select
                      value={recProductId}
                      onChange={(e) => setRecProductId(e.target.value ? parseInt(e.target.value) : "")}
                      style={{ ...inputStyle, width: "100%", marginBottom: 8 }}
                    >
                      <option value="">-- 选择商品 --</option>
                      {allProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          [{p.source}] {p.product_name} ¥{p.price_cny}/฿{p.price_thb}
                        </option>
                      ))}
                    </select>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={submitManualRec} disabled={recSaving || !recProductId} style={{
                        ...btnStyle, opacity: recSaving || !recProductId ? 0.5 : 1,
                      }}>
                        {recSaving ? "推荐中..." : "确认推荐"}
                      </button>
                      <button onClick={() => setShowRecPicker(false)} style={outlineBtn}>取消</button>
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                <h4 style={{ fontSize: 14, margin: "0 0 10px" }}>
                  推荐商品 ({detailRecs.length})
                </h4>
                {detailRecs.length === 0 ? (
                  <p style={{ color: "#94a3b8", textAlign: "center", padding: 20, fontSize: 13 }}>
                    暂无推荐商品
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {detailRecs.map((rec) => (
                      <div key={rec.id} style={{
                        display: "flex", alignItems: "center", gap: 12,
                        background: "#f8fafc", borderRadius: 10, padding: 12,
                        border: "1px solid #e2e8f0",
                      }}>
                        {/* thumbnail */}
                        {rec.image_urls && Array.isArray(rec.image_urls) && rec.image_urls[0] ? (
                          <img src={rec.image_urls[0]} alt="" style={{
                            width: 56, height: 56, borderRadius: 8, objectFit: "cover", background: "#e2e8f0",
                          }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div style={{
                            width: 56, height: 56, borderRadius: 8, background: "#e2e8f0",
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                          }}>📦</div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {rec.product_name}
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b" }}>
                            [{rec.source}] {rec.supplier_name || ""} · ¥{rec.price_cny} / ฿{rec.price_thb}
                          </div>
                          {rec.moq && <div style={{ fontSize: 11, color: "#94a3b8" }}>起订量: {rec.moq}</div>}
                        </div>
                        <span style={{
                          display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700,
                          background: rec.status === "interested" ? "#f0fdf4" : rec.status === "rejected" ? "#fef2f2" : "#f1f5f9",
                          color: rec.status === "interested" ? "#166534" : rec.status === "rejected" ? "#991b1b" : "#475569",
                        }}>
                          {rec.status === "interested" ? "感兴趣" : rec.status === "rejected" ? "不感兴趣" : "待确认"}
                        </span>
                        {isManaged(detailDemand) && rec.status === "pending" && (
                          <button onClick={() => proxyConfirmRec(rec.id)} style={{
                            ...dashedBtn, padding: "4px 10px", fontSize: 11,
                          }}>
                            🛠 代确认
                          </button>
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

      {/* ======== CREATE DEMAND MODAL ======== */}
      {showCreate && (
        <div style={modalOverlay} onClick={() => setShowCreate(false)}>
          <div style={{ ...modalBox, maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>新增需求（代提交）</h3>
              <button onClick={() => setShowCreate(false)} style={{ ...outlineBtn, padding: "4px 10px", fontSize: 16 }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>达人资料 ID *</label>
                <input
                  type="number" value={createForm.influencer_profile_id || ""}
                  onChange={(e) => setCreateForm((f) => ({ ...f, influencer_profile_id: e.target.value ? parseInt(e.target.value) : "" }))}
                  style={{ ...inputStyle, width: "100%" }} placeholder="输入 influencer_profile_id"
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>标题 *</label>
                <input
                  value={createForm.title || ""} onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                  style={{ ...inputStyle, width: "100%" }} placeholder="需求标题"
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>品类 *</label>
                  <select
                    value={createForm.category || ""} onChange={(e) => setCreateForm((f) => ({ ...f, category: e.target.value }))}
                    style={{ ...inputStyle, width: "100%" }}
                  >
                    <option value="">-- 选择 --</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>子品类</label>
                  <input
                    value={createForm.sub_category || ""} onChange={(e) => setCreateForm((f) => ({ ...f, sub_category: e.target.value }))}
                    style={{ ...inputStyle, width: "100%" }} placeholder="子品类"
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>预算下限 (THB)</label>
                  <input
                    type="number" value={createForm.budget_min_thb || ""}
                    onChange={(e) => setCreateForm((f) => ({ ...f, budget_min_thb: e.target.value ? parseFloat(e.target.value) : "" }))}
                    style={{ ...inputStyle, width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>预算上限 (THB)</label>
                  <input
                    type="number" value={createForm.budget_max_thb || ""}
                    onChange={(e) => setCreateForm((f) => ({ ...f, budget_max_thb: e.target.value ? parseFloat(e.target.value) : "" }))}
                    style={{ ...inputStyle, width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>频率</label>
                  <select
                    value={createForm.frequency || "one_time"} onChange={(e) => setCreateForm((f) => ({ ...f, frequency: e.target.value }))}
                    style={{ ...inputStyle, width: "100%" }}
                  >
                    <option value="one_time">一次性</option>
                    <option value="weekly">每周</option>
                    <option value="monthly">每月</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>目标售价 (THB)</label>
                  <input
                    type="number" value={createForm.target_price || ""}
                    onChange={(e) => setCreateForm((f) => ({ ...f, target_price: e.target.value ? parseFloat(e.target.value) : "" }))}
                    style={{ ...inputStyle, width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>预估需求量</label>
                  <input
                    type="number" value={createForm.estimated_quantity || ""}
                    onChange={(e) => setCreateForm((f) => ({ ...f, estimated_quantity: e.target.value ? parseInt(e.target.value) : "" }))}
                    style={{ ...inputStyle, width: "100%" }}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>描述</label>
                <textarea
                  value={createForm.description || ""} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                  style={{ ...inputStyle, width: "100%", minHeight: 80, resize: "vertical" }} placeholder="需求详细描述"
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>内部备注</label>
                <input
                  value={createForm.internal_note || ""} onChange={(e) => setCreateForm((f) => ({ ...f, internal_note: e.target.value }))}
                  style={{ ...inputStyle, width: "100%" }} placeholder="管理员内部备注"
                />
              </div>
              <button onClick={submitCreate} disabled={createSaving} style={{
                ...btnStyle, padding: "10px 24px", opacity: createSaving ? 0.5 : 1,
                alignSelf: "flex-start",
              }}>
                {createSaving ? "提交中..." : "提交需求"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
