import { useEffect, useState, useCallback } from "react";
import { fetchWithAuth } from "../fetchWithAuth";

const STATUS_FLOW = [
  "pending_approval", "approved", "purchasing", "shipped_cn",
  "arrived_cn_warehouse", "shipped_th", "customs_cleared", "arrived", "completed",
];

const STATUS_LABELS: Record<string, string> = {
  pending_approval: "待审核",
  approved: "已确认",
  purchasing: "采购中",
  shipped_cn: "已发货中国",
  arrived_cn_warehouse: "已到中国仓",
  shipped_th: "已发往泰国",
  customs_cleared: "已清关",
  arrived: "已到货",
  completed: "已完成",
  cancelled: "已取消",
};

const STATUS_COLORS: Record<string, string> = {
  pending_approval: "#f97316",
  approved: "#3b82f6",
  purchasing: "#8b5cf6",
  shipped_cn: "#06b6d4",
  arrived_cn_warehouse: "#14b8a6",
  shipped_th: "#0ea5e9",
  customs_cleared: "#6366f1",
  arrived: "#22c55e",
  completed: "#166534",
  cancelled: "#94a3b8",
};

const STATUS_OPTIONS = [
  { value: "", label: "全部" },
  ...STATUS_FLOW.map((s) => ({ value: s, label: STATUS_LABELS[s] || s })),
  { value: "cancelled", label: "已取消" },
];

type Order = Record<string, any>;
type OrderLog = Record<string, any>;

export default function PurchaseOrdersPage() {
  // ---------- state ----------
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<Order[]>([]);

  // filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");

  // selection
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // detail modal
  const [detail, setDetail] = useState<Order | null>(null);
  const [detailLogs, setDetailLogs] = useState<OrderLog[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // action forms within detail
  const [actionStatus, setActionStatus] = useState("");
  const [actionNote, setActionNote] = useState("");
  const [actionSaving, setActionSaving] = useState(false);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject">("approve");
  const [reviewNote, setReviewNote] = useState("");

  // logistics
  const [logisticsCompany, setLogisticsCompany] = useState("");
  const [logisticsNo, setLogisticsNo] = useState("");
  const [logisticsLink, setLogisticsLink] = useState("");

  // payment
  const [payAmount, setPayAmount] = useState("");
  const [paySaving, setPaySaving] = useState(false);

  // proxy order form
  const [proxyProductId, setProxyProductId] = useState<number | "">("");
  const [proxyQuantity, setProxyQuantity] = useState(1);
  const [proxySaving, setProxySaving] = useState(false);

  // toast
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const basePath = window.location.pathname.includes("/employee/")
    ? "/employee/vertical-connections/purchase"
    : "/admin/vertical-connections/purchase";

  // ---------- data ----------
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterStart) params.set("start_date", filterStart);
      if (filterEnd) params.set("end_date", filterEnd);
      const qs = params.toString();
      const res = await fetchWithAuth(`/api/admin/purchase/orders${qs ? "?" + qs : ""}`);
      const d = await res.json();
      let items = d.list || [];
      // client-side influencer search
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        items = items.filter((o: Order) =>
          (o.influencer_code || "").toLowerCase().includes(q) ||
          (o.influencer_username || "").toLowerCase().includes(q)
        );
      }
      setList(items);
    } catch (e: any) {
      showToast("error", e.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterStart, filterEnd, filterSearch]);

  useEffect(() => { load(); }, [load]);

  // ---------- helpers ----------
  const isManaged = (o: Order) =>
    o.profile_user_id === null || o.influencer_disabled === 1;

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    if (selected.size === list.length && list.length > 0) setSelected(new Set());
    else setSelected(new Set(list.map((o) => o.id)));
  };

  const getStatusIndex = (status: string) => {
    if (status === "cancelled") return -1;
    return STATUS_FLOW.indexOf(status);
  };

  // ---------- detail ----------
  const openDetail = async (o: Order) => {
    setDetail(o);
    setDetailLoading(true);
    setDetailLogs([]);
    setActionStatus("");
    setActionNote("");
    setReviewAction("approve");
    setReviewNote("");
    try {
      const res = await fetchWithAuth(`/api/admin/purchase/orders/${o.id}`);
      const d = await res.json();
      setDetail(d.order || o);
      setDetailLogs(d.logs || []);
      // pre-fill logistics from order
      const li = d.order?.logistics_info;
      if (li && typeof li === "object") {
        setLogisticsCompany(li.company || "");
        setLogisticsNo(li.tracking_no || "");
        setLogisticsLink(li.link || "");
      } else {
        setLogisticsCompany(""); setLogisticsNo(""); setLogisticsLink("");
      }
    } catch (e: any) {
      showToast("error", e.message || "加载详情失败");
    } finally {
      setDetailLoading(false);
    }
  };

  // ---------- actions ----------
  const submitReview = async () => {
    if (!detail) return;
    if (reviewAction === "reject" && !reviewNote.trim()) {
      showToast("error", "拒绝必须填写原因"); return;
    }
    setActionSaving(true);
    try {
      await fetchWithAuth(`/api/admin/purchase/orders/${detail.id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: reviewAction, note: reviewNote || "审核通过" }),
      });
      showToast("success", reviewAction === "approve" ? "已通过" : "已拒绝");
      setDetail(null); load();
    } catch (e: any) {
      showToast("error", e.message || "操作失败");
    } finally { setActionSaving(false); }
  };

  const submitStatus = async () => {
    if (!detail || !actionStatus) return;
    if (!actionNote.trim()) { showToast("error", "状态变更必须填写备注"); return; }
    setActionSaving(true);
    try {
      await fetchWithAuth(`/api/admin/purchase/orders/${detail.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: actionStatus, note: actionNote }),
      });
      showToast("success", "状态已更新");
      setDetail(null); load();
    } catch (e: any) {
      showToast("error", e.message || "操作失败");
    } finally { setActionSaving(false); }
  };

  const saveLogistics = async () => {
    if (!detail) return;
    try {
      await fetchWithAuth(`/api/admin/purchase/orders/${detail.id}/logistics`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: logisticsCompany, tracking_no: logisticsNo, link: logisticsLink }),
      });
      showToast("success", "物流信息已保存");
      openDetail(detail);
    } catch (e: any) {
      showToast("error", e.message || "保存失败");
    }
  };

  const savePayment = async () => {
    if (!detail || !payAmount) { showToast("error", "请输入已付金额"); return; }
    setPaySaving(true);
    try {
      await fetchWithAuth(`/api/admin/purchase/orders/${detail.id}/payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid_amount: parseFloat(payAmount) }),
      });
      showToast("success", "付款已记录");
      openDetail(detail);
    } catch (e: any) {
      showToast("error", e.message || "保存失败");
    } finally { setPaySaving(false); }
  };

  const proxyConfirm = async () => {
    if (!detail) return;
    try {
      await fetchWithAuth(`/api/admin/purchase/orders/${detail.id}/confirm-received-proxy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: "管理员代确认收货" }),
      });
      showToast("success", "已代确认收货");
      setDetail(null); load();
    } catch (e: any) {
      showToast("error", e.message || "操作失败");
    }
  };

  const submitProxyOrder = async () => {
    if (!detail || !proxyProductId) { showToast("error", "请选择商品"); return; }
    setProxySaving(true);
    try {
      const body: any = {
        influencer_profile_id: detail.influencer_profile_id || undefined,
        product_id: proxyProductId,
        quantity: proxyQuantity,
        demand_id: detail.demand_id,
      };
      await fetchWithAuth("/api/admin/purchase/orders/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      showToast("success", "代下单成功");
      setDetail(null); load();
    } catch (e: any) {
      showToast("error", e.message || "下单失败");
    } finally { setProxySaving(false); }
  };

  const batchUpdateStatus = async () => {
    if (selected.size === 0) return;
    const target = prompt("输入目标状态:\n" + STATUS_FLOW.map((s) => `${s} (${STATUS_LABELS[s]})`).join("\n"));
    if (!target) return;
    const note = prompt("备注:");
    if (!note) return;
    let ok = 0;
    for (const id of selected) {
      try {
        await fetchWithAuth(`/api/admin/purchase/orders/${id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: target, note }),
        });
        ok++;
      } catch { /* skip */ }
    }
    showToast(ok === selected.size ? "success" : "error", `完成 ${ok}/${selected.size} 单`);
    setSelected(new Set()); load();
  };

  const mergeOrders = () => {
    if (selected.size < 2) { showToast("error", "至少选择 2 个订货单"); return; }
    const selectedOrders = list.filter((o) => selected.has(o.id));
    const sameSupplier = selectedOrders.every((o) => o.supplier_name === selectedOrders[0].supplier_name);
    const msg = sameSupplier
      ? `已选择 ${selected.size} 个同供应商(${selectedOrders[0].supplier_name})订货单，建议合并为一个采购批次。\n\n当前操作将记录批量备注。`
      : `已选择 ${selected.size} 个订货单（不同供应商），请确认合并采购。\n\n当前操作将记录批量备注。`;
    const note = prompt(msg + "\n输入合并备注:");
    if (!note) return;
    // Record a note on each order
    (async () => {
      let ok = 0;
      for (const o of selectedOrders) {
        try {
          await fetchWithAuth(`/api/admin/purchase/orders/${o.id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: o.status, note: `[合并采购] ${note}` }),
          });
          ok++;
        } catch { /* skip */ }
      }
      showToast(ok > 0 ? "success" : "error", `已标记 ${ok} 单为合并采购批次`);
      setSelected(new Set()); load();
    })();
  };

  // ---------- styles ----------
  const inputStyle: React.CSSProperties = {
    padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: 6, fontSize: 13,
  };
  const btn: React.CSSProperties = {
    padding: "7px 16px", border: "none", borderRadius: 6, background: "var(--xt-accent, #f97316)",
    color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13,
  };
  const outlineBtn: React.CSSProperties = {
    ...btn, background: "#fff", color: "#334155", border: "1px solid #dbe1ea",
  };
  const dangerBtn: React.CSSProperties = {
    ...btn, background: "#dc2626",
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
    background: "#fff", borderRadius: 14, padding: 24, maxWidth: 880, width: "95%",
    maxHeight: "90vh", overflow: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
  };

  const statusIdx = detail ? getStatusIndex(detail.status) : -2;
  const canAdvance = detail && statusIdx >= 0 && statusIdx < STATUS_FLOW.length - 1;
  const nextStatuses = canAdvance
    ? STATUS_FLOW.slice(statusIdx + 1, statusIdx + 2) // only next step
    : [];

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

      <h2 style={{ marginTop: 0, fontSize: 20, fontWeight: 800 }}>达人进货管理</h2>

      {/* Tab Nav */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "2px solid #e2e8f0" }}>
        {[
          { label: "进货需求列表", path: basePath },
          { label: "商品库", path: `${basePath}/products` },
          { label: "订货管理", path: `${basePath}/orders` },
        ].map((tab) => {
          const active = window.location.pathname === tab.path ||
            (tab.path.endsWith("/orders") && window.location.pathname.includes("/purchase/orders"));
          return (
            <a key={tab.path} href={tab.path} style={{
              padding: "8px 20px", fontSize: 14, fontWeight: active ? 700 : 500,
              color: active ? "var(--xt-accent, #f97316)" : "#64748b",
              borderBottom: active ? "2px solid var(--xt-accent, #f97316)" : "2px solid transparent",
              marginBottom: -2, textDecoration: "none", cursor: "pointer",
            }}>
              {tab.label}
            </a>
          );
        })}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={inputStyle}>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="text" placeholder="搜索达人编号..." value={filterSearch}
          onChange={(e) => setFilterSearch(e.target.value)} style={{ ...inputStyle, width: 160 }} />
        <input type="date" value={filterStart} onChange={(e) => setFilterStart(e.target.value)} style={inputStyle} />
        <span style={{ color: "#94a3b8", fontSize: 13 }}>至</span>
        <input type="date" value={filterEnd} onChange={(e) => setFilterEnd(e.target.value)} style={inputStyle} />
        <button onClick={load} style={btn}>🔍 搜索</button>
        <div style={{ flex: 1 }} />
        {selected.size > 0 && (
          <>
            <button onClick={batchUpdateStatus} style={outlineBtn}>📦 批量更新 ({selected.size})</button>
            <button onClick={mergeOrders} style={{ ...outlineBtn, borderColor: "#8b5cf6", color: "#8b5cf6" }}>
              🔗 合并采购 ({selected.size})
            </button>
          </>
        )}
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflow: "auto" }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div><p>加载中...</p>
          </div>
        ) : list.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>📋</div>
            <p style={{ fontSize: 15, fontWeight: 600 }}>暂无订货单</p>
            <p style={{ fontSize: 13 }}>达人提交进货需求并推荐商品后，订单将出现在这里</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 40 }}>
                  <input type="checkbox" checked={selected.size === list.length && list.length > 0} onChange={toggleAll} />
                </th>
                <th style={thStyle}>订单号</th>
                <th style={thStyle}>达人</th>
                <th style={thStyle}>商品</th>
                <th style={thStyle}>规格</th>
                <th style={thStyle}>数量</th>
                <th style={thStyle}>金额 (THB)</th>
                <th style={thStyle}>状态</th>
                <th style={thStyle}>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => {
                const managed = isManaged(o);
                const sc = STATUS_COLORS[o.status] || "#94a3b8";
                const specs = (() => {
                  try {
                    const s = typeof o.selected_specs === "string" ? JSON.parse(o.selected_specs) : o.selected_specs;
                    return s && typeof s === "object" ? Object.entries(s).map(([k, v]) => `${k}:${v}`).join(", ") : "—";
                  } catch { return "—"; }
                })();
                return (
                  <tr key={o.id} style={{ cursor: "pointer" }} onClick={() => openDetail(o)}>
                    <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleSelect(o.id)} />
                    </td>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12 }}>{o.order_no}</td>
                    <td style={tdStyle}>
                      {managed ? "🛠 " : "👤 "}
                      {o.influencer_code || o.influencer_username || `#${o.influencer_id}`}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {o.product_name || "—"}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 12, color: "#64748b", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {specs}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{o.quantity}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>฿{Number(o.total_payable || 0).toLocaleString()}</td>
                    <td style={tdStyle}>
                      <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 12,
                        background: sc + "18", color: sc, fontWeight: 700, fontSize: 12 }}>
                        {STATUS_LABELS[o.status] || o.status}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: "#94a3b8", fontSize: 12 }}>
                      {o.created_at ? new Date(o.created_at).toLocaleDateString("zh-CN") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ======== DETAIL MODAL ======== */}
      {detail && (
        <div style={modalOverlay} onClick={() => setDetail(null)}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>
                订货单详情 <span style={{ fontFamily: "monospace", fontSize: 13, color: "#64748b" }}>{detail.order_no}</span>
              </h3>
              <button onClick={() => setDetail(null)} style={{ ...outlineBtn, padding: "4px 10px", fontSize: 16 }}>✕</button>
            </div>

            {detailLoading ? (
              <p style={{ textAlign: "center", color: "#94a3b8", padding: 40 }}>加载中...</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {/* LEFT COLUMN */}
                <div>
                  {/* Basic Info */}
                  <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 12 }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: 13, color: "#64748b" }}>基本信息</h4>
                    <div style={{ display: "grid", gap: "6px 12px", fontSize: 13 }}>
                      <div><strong>达人：</strong>{isManaged(detail) ? "🛠 " : "👤 "}{detail.influencer_code || detail.influencer_username || `#${detail.influencer_id}`}</div>
                      <div><strong>商品：</strong>{detail.product_name || "—"}</div>
                      {detail.product_category && <div><strong>品类：</strong>{detail.product_category}</div>}
                      {detail.supplier_name && <div><strong>供应商：</strong>{detail.supplier_name}</div>}
                      <div><strong>规格：</strong>{((): string => {
                        try {
                          const s = typeof detail.selected_specs === "string" ? JSON.parse(detail.selected_specs) : detail.selected_specs;
                          return s && typeof s === "object" ? Object.entries(s).map(([k, v]) => `${k}:${v}`).join(", ") : "—";
                        } catch { return "—"; }
                      })()}</div>
                      <div><strong>数量：</strong>{detail.quantity}</div>
                    </div>
                  </div>

                  {/* Price breakdown */}
                  <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 12 }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: 13, color: "#64748b" }}>金额明细</h4>
                    <div style={{ fontSize: 13, lineHeight: 2 }}>
                      <div>商品单价：¥{Number(detail.unit_price_cny || 0).toFixed(2)} / ฿{Number(detail.product_price_thb || 0).toFixed(2)}</div>
                      <div style={{ fontWeight: 600 }}>商品总额：¥{Number(detail.total_price_cny || 0).toFixed(2)} / ฿{Number(detail.total_price_thb || 0).toFixed(2)}</div>
                      <div>物流费：฿{Number(detail.shipping_fee || 0).toFixed(2)}</div>
                      <div>服务费：฿{Number(detail.service_fee || 0).toFixed(2)}</div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "var(--xt-accent, #f97316)", borderTop: "1px solid #e2e8f0", paddingTop: 6, marginTop: 4 }}>
                        应付总额：฿{Number(detail.total_payable || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Managed indicator */}
                  {isManaged(detail) && (
                    <div style={{ background: "#fef3c7", borderRadius: 8, padding: "8px 14px", marginBottom: 12, fontSize: 13, color: "#92400e", fontWeight: 600 }}>
                      🛠 托管达人 — 可使用代操作按钮
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ background: "#fff", borderRadius: 10, padding: 14, border: "1px solid #e2e8f0", marginBottom: 12 }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: 13, color: "#64748b" }}>操作</h4>

                    {/* pending_approval: review */}
                    {detail.status === "pending_approval" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <select value={reviewAction} onChange={(e) => setReviewAction(e.target.value as any)}
                            style={{ ...inputStyle, width: 100 }}>
                            <option value="approve">通过</option>
                            <option value="reject">拒绝</option>
                          </select>
                          <input type="text" placeholder="审核备注" value={reviewNote}
                            onChange={(e) => setReviewNote(e.target.value)}
                            style={{ ...inputStyle, flex: 1 }} />
                          <button onClick={submitReview} disabled={actionSaving} style={btn}>
                            {actionSaving ? "处理中..." : "确认"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* active flow: advance status */}
                    {canAdvance && detail.status !== "pending_approval" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 13, whiteSpace: "nowrap" }}>当前：{STATUS_LABELS[detail.status]} →</span>
                          <select value={actionStatus} onChange={(e) => setActionStatus(e.target.value)}
                            style={{ ...inputStyle, flex: 1 }}>
                            <option value="">选择下一步</option>
                            {(() => {
                              const ci = getStatusIndex(detail.status);
                              if (ci < 0) return null;
                              const options = [];
                              // offer next step + cancelled
                              if (ci + 1 < STATUS_FLOW.length) {
                                options.push(
                                  <option key={STATUS_FLOW[ci + 1]} value={STATUS_FLOW[ci + 1]}>
                                    {STATUS_LABELS[STATUS_FLOW[ci + 1]]}
                                  </option>
                                );
                              }
                              options.push(<option key="cancelled" value="cancelled">取消订单</option>);
                              return options;
                            })()}
                          </select>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <input type="text" placeholder="备注" value={actionNote}
                            onChange={(e) => setActionNote(e.target.value)}
                            style={{ ...inputStyle, flex: 1 }} />
                          <button onClick={submitStatus} disabled={actionSaving || !actionStatus} style={{
                            ...btn, opacity: actionSaving || !actionStatus ? 0.5 : 1,
                          }}>
                            {actionSaving ? "更新中..." : "更新状态"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* completed: read-only */}
                    {detail.status === "completed" && (
                      <div style={{ color: "#166534", fontSize: 13, fontWeight: 600 }}>✅ 订单已完成</div>
                    )}

                    {/* cancelled */}
                    {detail.status === "cancelled" && (
                      <div style={{ color: "#94a3b8", fontSize: 13 }}>
                        ❌ 已取消：{detail.internal_note || "无原因记录"}
                      </div>
                    )}

                    {/* arrived: proxy confirm for managed */}
                    {detail.status === "arrived" && isManaged(detail) && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed #e2e8f0" }}>
                        <button onClick={proxyConfirm} style={dashedBtn}>🛠 代确认收货</button>
                      </div>
                    )}
                  </div>

                  {/* Proxy order for managed */}
                  {isManaged(detail) && (
                    <div style={{ background: "#fefce8", borderRadius: 10, padding: 14, border: "1px dashed #e2e8f0", marginBottom: 12 }}>
                      <h4 style={{ margin: "0 0 8px", fontSize: 13, color: "#92400e" }}>🛠 代下单</h4>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input type="number" placeholder="商品ID" value={proxyProductId}
                          onChange={(e) => setProxyProductId(e.target.value ? parseInt(e.target.value) : "")}
                          style={{ ...inputStyle, width: 100 }} />
                        <input type="number" placeholder="数量" value={proxyQuantity}
                          onChange={(e) => setProxyQuantity(e.target.value ? parseInt(e.target.value) : 1)}
                          style={{ ...inputStyle, width: 80 }} />
                        <button onClick={submitProxyOrder} disabled={proxySaving} style={dashedBtn}>
                          {proxySaving ? "下单中..." : "代下单"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT COLUMN */}
                <div>
                  {/* Progress timeline */}
                  <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 12 }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: 13, color: "#64748b" }}>进度时间线</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                      {STATUS_FLOW.map((s, i) => {
                        const isReached = detail.status === "cancelled" ? i < statusIdx : i <= statusIdx;
                        const isCurrent = detail.status !== "cancelled" && s === detail.status;
                        const color = isReached ? STATUS_COLORS[s] : "#d1d5db";
                        const logEntry = detailLogs.find((l: any) => l.to_status === s);
                        return (
                          <div key={s} style={{ display: "flex", gap: 10, minHeight: 36 }}>
                            {/* Timeline node */}
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 28 }}>
                              <div style={{
                                width: isCurrent ? 22 : 16, height: isCurrent ? 22 : 16,
                                borderRadius: "50%", background: color,
                                border: isCurrent ? "3px solid #fff" : isReached ? "2px solid #fff" : "none",
                                boxShadow: isCurrent ? `0 0 0 3px ${color}40` : "none",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 10, color: "#fff", fontWeight: 700,
                                transition: "all 0.2s",
                              }}>
                                {isReached && !isCurrent ? "✓" : ""}
                              </div>
                              {i < STATUS_FLOW.length - 1 && (
                                <div style={{ width: 2, flex: 1, background: isReached && i < statusIdx ? color : "#e5e7eb", minHeight: 8 }} />
                              )}
                            </div>
                            {/* Label */}
                            <div style={{ flex: 1, paddingBottom: i < STATUS_FLOW.length - 1 ? 8 : 0 }}>
                              <div style={{
                                fontSize: 13, fontWeight: isCurrent ? 700 : isReached ? 500 : 400,
                                color: isReached ? "#334155" : "#94a3b8",
                              }}>
                                {STATUS_LABELS[s]}
                              </div>
                              {logEntry && (
                                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                                  {logEntry.created_at ? new Date(logEntry.created_at).toLocaleString("zh-CN") : ""}
                                  {logEntry.note ? ` — ${String(logEntry.note).substring(0, 40)}` : ""}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {/* Cancelled branch */}
                      {detail.status === "cancelled" && (
                        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 28 }}>
                            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff" }}>✕</div>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#dc2626" }}>已取消</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Logistics */}
                  <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 12 }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: 13, color: "#64748b" }}>物流追踪</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <input type="text" placeholder="物流公司" value={logisticsCompany}
                        onChange={(e) => setLogisticsCompany(e.target.value)} style={inputStyle} />
                      <div style={{ display: "flex", gap: 6 }}>
                        <input type="text" placeholder="单号" value={logisticsNo}
                          onChange={(e) => setLogisticsNo(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                        <input type="text" placeholder="跟踪链接" value={logisticsLink}
                          onChange={(e) => setLogisticsLink(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                      </div>
                      <button onClick={saveLogistics} style={{ ...outlineBtn, alignSelf: "flex-start", marginTop: 4 }}>
                        💾 保存物流
                      </button>
                    </div>
                  </div>

                  {/* Payment */}
                  <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 12 }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: 13, color: "#64748b" }}>付款信息</h4>
                    {detail.is_paid ? (
                      <div style={{ fontSize: 13, lineHeight: 2 }}>
                        <div style={{ color: "#166534", fontWeight: 600 }}>✅ 已付款</div>
                        <div>金额：฿{Number(detail.paid_amount || 0).toLocaleString()}</div>
                        <div>时间：{detail.paid_at ? new Date(detail.paid_at).toLocaleString("zh-CN") : "—"}</div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input type="number" placeholder="已付金额 THB" value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                          style={{ ...inputStyle, width: 140 }} />
                        <button onClick={savePayment} disabled={paySaving} style={btn}>
                          {paySaving ? "保存中..." : "记录付款"}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Communication notes (logs where from=to, i.e. comments) */}
                  <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14 }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: 13, color: "#64748b" }}>
                      沟通记录 ({detailLogs.length} 条)
                    </h4>
                    <div style={{ maxHeight: 200, overflow: "auto" }}>
                      {detailLogs.length === 0 ? (
                        <p style={{ color: "#94a3b8", fontSize: 12 }}>暂无记录</p>
                      ) : (
                        detailLogs.map((l, i) => {
                          const isReturn = String(l.note || "").includes('"type":"return_request"');
                          return (
                            <div key={l.id || i} style={{
                              padding: "6px 0", borderBottom: "1px solid #f1f5f9", fontSize: 12,
                              color: isReturn ? "#dc2626" : "#334155",
                            }}>
                              <span style={{ color: "#94a3b8" }}>
                                {l.created_at ? new Date(l.created_at).toLocaleString("zh-CN").slice(5) : ""}
                              </span>
                              {" "}
                              <span style={{ fontWeight: 600 }}>{l.operator_name || "?"}</span>
                              {l.from_status && l.to_status && l.from_status !== l.to_status ? (
                                <span> [{STATUS_LABELS[l.from_status] || l.from_status} → {STATUS_LABELS[l.to_status] || l.to_status}]</span>
                              ) : null}
                              {" "}
                              {isReturn ? (
                                <span style={{ color: "#dc2626" }}>📦 退货申请</span>
                              ) : (
                                <span>{String(l.note || "").substring(0, 80)}</span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
