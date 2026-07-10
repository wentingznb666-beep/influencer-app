import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchWithAuth } from "../fetchWithAuth";

const STATUS_FLOW = [
  "pending_approval", "approved", "purchasing", "shipped_cn",
  "arrived_cn_warehouse", "shipped_th", "customs_cleared", "arrived", "completed",
];

const STATUS_LABELS: Record<string, string> = {
  pending_approval: "待审核", approved: "已确认", purchasing: "采购中",
  shipped_cn: "已发货(中)", arrived_cn_warehouse: "到中国仓",
  shipped_th: "发往泰国", customs_cleared: "已清关",
  arrived: "已到货", completed: "已完成", cancelled: "已取消",
};

const STATUS_COLORS: Record<string, string> = {
  pending_approval: "#f97316", approved: "#3b82f6", purchasing: "#8b5cf6",
  shipped_cn: "#06b6d4", arrived_cn_warehouse: "#14b8a6",
  shipped_th: "#0ea5e9", customs_cleared: "#6366f1",
  arrived: "#22c55e", completed: "#166534", cancelled: "#94a3b8",
};

export default function InfluencerPurchaseOrdersPage() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<any[]>([]);
  const [err, setErr] = useState("");

  // create order
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<Record<string, any>>({ quantity: 1 });
  const [createSaving, setCreateSaving] = useState(false);

  // detail
  const [detail, setDetail] = useState<any>(null);
  const [detailLogs, setDetailLogs] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // confirm received
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmNote, setConfirmNote] = useState("");
  const [confirmSaving, setConfirmSaving] = useState(false);

  // return request
  const [showReturn, setShowReturn] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnSaving, setReturnSaving] = useState(false);

  // toast
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg }); setTimeout(() => setToast(null), 3000);
  };

  // init from query params (navigated from "interested" button)
  useEffect(() => {
    const pid = searchParams.get("product_id");
    const did = searchParams.get("demand_id");
    if (pid) {
      setCreateForm((f) => ({
        ...f,
        product_id: parseInt(pid),
        demand_id: did ? parseInt(did) : "",
        quantity: 1,
      }));
      setShowCreate(true);
    }
  }, [searchParams]);

  // ---------- data ----------
  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const r = await fetchWithAuth("/api/influencer/purchase/orders");
      setList(((await r.json()).list || []));
    } catch (e: any) { setErr(e.message || "加载失败"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const getStatusIndex = (status: string) => {
    if (status === "cancelled") return -1;
    return STATUS_FLOW.indexOf(status);
  };

  // ---------- create order ----------
  const submitCreate = async () => {
    if (!createForm.product_id) { showToast("error", "商品ID为必填"); return; }
    if (!createForm.quantity) { showToast("error", "数量为必填"); return; }
    setCreateSaving(true);
    try {
      const r = await fetchWithAuth("/api/influencer/purchase/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const d = await r.json();
      showToast("success", `下单成功！单号: ${d.order_no}`);
      setShowCreate(false); load();
    } catch (e: any) { showToast("error", e.message || "下单失败"); }
    finally { setCreateSaving(false); }
  };

  // ---------- detail ----------
  const openDetail = async (o: any) => {
    setDetail(o); setDetailLoading(true); setDetailLogs([]);
    try {
      const r = await fetchWithAuth(`/api/influencer/purchase/orders/${o.id}`);
      const d = await r.json();
      setDetail(d.order || o);
      setDetailLogs(d.logs || []);
    } catch (e: any) { showToast("error", e.message); }
    finally { setDetailLoading(false); }
  };

  // ---------- confirm received ----------
  const submitConfirm = async () => {
    if (!detail) return;
    setConfirmSaving(true);
    try {
      await fetchWithAuth(`/api/influencer/purchase/orders/${detail.id}/confirm-received`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: confirmNote || "已确认收货" }),
      });
      showToast("success", "已确认收货！");
      setShowConfirm(false); setConfirmNote("");
      setDetail(null); load();
    } catch (e: any) { showToast("error", e.message); }
    finally { setConfirmSaving(false); }
  };

  // ---------- return request ----------
  const submitReturn = async () => {
    if (!detail || !returnReason.trim()) { showToast("error", "请填写退货原因"); return; }
    setReturnSaving(true);
    try {
      await fetchWithAuth(`/api/influencer/purchase/orders/${detail.id}/return-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: returnReason }),
      });
      showToast("success", "退货申请已提交");
      setShowReturn(false); setReturnReason("");
      setDetail(null); load();
    } catch (e: any) { showToast("error", e.message); }
    finally { setReturnSaving(false); }
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
    background: "#fff", borderRadius: 14, padding: 24, maxWidth: 700, width: "92%",
    maxHeight: "88vh", overflow: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
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

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>我的订单</h2>
        <button onClick={() => { setCreateForm({ quantity: 1 }); setShowCreate(true); }} style={btn}>+ 下单</button>
      </div>

      {err && <p style={{ color: "#c00", marginBottom: 12 }}>{err}</p>}

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div><p>加载中...</p>
        </div>
      ) : list.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>📋</div>
          <p style={{ fontSize: 15, fontWeight: 600 }}>还没有订货单</p>
          <p style={{ fontSize: 13 }}>在推荐商品中点击「感兴趣」即可下单</p>
        </div>
      ) : (
        list.map((o: any) => {
          const si = getStatusIndex(o.status);
          return (
            <div key={o.id} onClick={() => openDetail(o)} style={{
              background: "#fff", borderRadius: 12, padding: 16, marginBottom: 10,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)", cursor: "pointer", border: "1px solid #f1f5f9",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "monospace", fontSize: 12, color: "#64748b", marginBottom: 2 }}>
                    {o.order_no}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 2 }}>{o.product_name || "—"}</div>
                  <div style={{ fontSize: 13, color: "#64748b" }}>
                    数量: {o.quantity} · 金额: <strong>฿{Number(o.total_payable || 0).toLocaleString()}</strong>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "right", flexShrink: 0 }}>
                  {o.created_at ? new Date(o.created_at).toLocaleDateString("zh-CN") : ""}
                </div>
              </div>

              {/* Horizontal progress bar */}
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 0 }}>
                {STATUS_FLOW.map((s, i) => {
                  const reached = o.status === "cancelled" ? i <= si : i <= si;
                  const current = o.status !== "cancelled" && s === o.status;
                  const color = reached ? STATUS_COLORS[s] : "#d1d5db";
                  return (
                    <div key={s} style={{ display: "flex", alignItems: "center", flex: i === STATUS_FLOW.length - 1 ? "0 0 auto" : 1, minWidth: 0 }}>
                      <div title={STATUS_LABELS[s]} style={{
                        width: current ? 16 : 10, height: current ? 16 : 10,
                        borderRadius: "50%", background: color, flexShrink: 0,
                        boxShadow: current ? `0 0 0 3px ${color}40` : "none",
                        transition: "all 0.2s",
                      }} />
                      {i < STATUS_FLOW.length - 1 && (
                        <div style={{ flex: 1, height: 3, background: reached && i < si ? color : "#e5e7eb", minWidth: 4, margin: "0 1px" }} />
                      )}
                    </div>
                  );
                })}
                {o.status === "cancelled" && (
                  <span style={{ fontSize: 10, color: "#ef4444", fontWeight: 700, marginLeft: 6 }}>✕ 已取消</span>
                )}
              </div>
            </div>
          );
        })
      )}

      {/* ======== CREATE ORDER MODAL ======== */}
      {showCreate && (
        <div style={modalOverlay} onClick={() => setShowCreate(false)}>
          <div style={{ ...modalBox, maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>下单</h3>
              <button onClick={() => setShowCreate(false)} style={{ ...outlineBtn, padding: "4px 10px", fontSize: 16 }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>商品 ID *</label>
                <input type="number" value={createForm.product_id || ""}
                  onChange={(e) => setCreateForm((f) => ({ ...f, product_id: e.target.value ? parseInt(e.target.value) : "" }))}
                  style={inputStyle} placeholder="推荐商品中的商品ID" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>需求 ID</label>
                <input type="number" value={createForm.demand_id || ""}
                  onChange={(e) => setCreateForm((f) => ({ ...f, demand_id: e.target.value ? parseInt(e.target.value) : "" }))}
                  style={inputStyle} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>数量 *</label>
                  <input type="number" min={1} value={createForm.quantity || 1}
                    onChange={(e) => setCreateForm((f) => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 }}>规格 (JSON)</label>
                  <input value={typeof createForm.selected_specs === "string" ? createForm.selected_specs : JSON.stringify(createForm.selected_specs || {})}
                    onChange={(e) => { try { setCreateForm((f) => ({ ...f, selected_specs: JSON.parse(e.target.value) })); } catch { setCreateForm((f) => ({ ...f, selected_specs: e.target.value })); } }}
                    style={inputStyle} placeholder='{"颜色":"红色"}' />
                </div>
              </div>
              <button onClick={submitCreate} disabled={createSaving} style={{ ...btn, alignSelf: "flex-start", opacity: createSaving ? 0.5 : 1 }}>
                {createSaving ? "下单中..." : "确认下单"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======== DETAIL MODAL ======== */}
      {detail && (
        <div style={modalOverlay} onClick={() => { setDetail(null); setShowConfirm(false); setShowReturn(false); }}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>
                订单详情 <span style={{ fontFamily: "monospace", fontSize: 12, color: "#64748b" }}>{detail.order_no}</span>
              </h3>
              <button onClick={() => { setDetail(null); setShowConfirm(false); setShowReturn(false); }}
                style={{ ...outlineBtn, padding: "4px 10px", fontSize: 16 }}>✕</button>
            </div>

            {detailLoading ? (
              <p style={{ textAlign: "center", color: "#94a3b8", padding: 40 }}>加载中...</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {/* LEFT */}
                <div>
                  {/* Info */}
                  <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 12 }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: 13, color: "#64748b" }}>订单信息</h4>
                    <div style={{ fontSize: 13, lineHeight: 2 }}>
                      <div><strong>商品：</strong>{detail.product_name || "—"}</div>
                      <div><strong>规格：</strong>{((): string => {
                        try {
                          const s = typeof detail.selected_specs === "string" ? JSON.parse(detail.selected_specs) : detail.selected_specs;
                          return s && typeof s === "object" ? Object.entries(s).map(([k, v]) => `${k}:${v}`).join(", ") : "—";
                        } catch { return "—"; }
                      })()}</div>
                      <div><strong>数量：</strong>{detail.quantity}</div>
                      <div><strong>状态：</strong>
                        <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 12,
                          background: (STATUS_COLORS[detail.status] || "#94a3b8") + "18",
                          color: STATUS_COLORS[detail.status] || "#94a3b8", fontWeight: 700, fontSize: 12 }}>
                          {STATUS_LABELS[detail.status] || detail.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Price */}
                  <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 12 }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: 13, color: "#64748b" }}>金额明细</h4>
                    <div style={{ fontSize: 13, lineHeight: 2 }}>
                      <div>商品单价：฿{Number(detail.product_price_thb || 0).toFixed(2)}</div>
                      <div>商品总额：฿{Number(detail.total_price_thb || 0).toFixed(2)}</div>
                      <div>物流费：฿{Number(detail.shipping_fee || 0).toFixed(2)}</div>
                      <div>服务费：฿{Number(detail.service_fee || 0).toFixed(2)}</div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "var(--xt-accent, #f97316)", borderTop: "1px solid #e2e8f0", paddingTop: 6, marginTop: 4 }}>
                        应付总额：฿{Number(detail.total_payable || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Cost calculator */}
                  <div style={{ background: "#fffbeb", borderRadius: 10, padding: 14, border: "1px solid #fde68a" }}>
                    <h4 style={{ margin: "0 0 8px", fontSize: 13, color: "#92400e" }}>🧮 费用试算</h4>
                    {(() => {
                      const purchase = Number(detail.total_price_thb || 0);
                      const shipping = Number(detail.shipping_fee || 0);
                      const service = Number(detail.service_fee || 0);
                      const totalCost = purchase + shipping + service;
                      const suggestPrice = Number(detail.suggested_retail_thb || detail.product_price_thb || 0) * Number(detail.quantity || 0);
                      const profit = suggestPrice - totalCost;
                      return (
                        <div style={{ fontSize: 12, lineHeight: 2 }}>
                          <div>采购成本：฿{purchase.toLocaleString()}</div>
                          <div>+ 物流费：฿{shipping.toLocaleString()}</div>
                          <div>+ 服务费：฿{service.toLocaleString()}</div>
                          <div style={{ fontWeight: 600, borderTop: "1px solid #fde68a", paddingTop: 4 }}>总成本：฿{totalCost.toLocaleString()}</div>
                          <div style={{ color: "#166534", marginTop: 4 }}>建议售价：฿{suggestPrice.toLocaleString()}</div>
                          <div style={{ fontWeight: 700, color: profit >= 0 ? "#166534" : "#dc2626", fontSize: 14 }}>
                            预估利润：฿{profit.toLocaleString()}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* RIGHT */}
                <div>
                  {/* Timeline */}
                  <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 12 }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: 13, color: "#64748b" }}>进度时间线</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                      {STATUS_FLOW.map((s, i) => {
                        const si = getStatusIndex(detail.status);
                        const reached = detail.status === "cancelled" ? i <= si : i <= si;
                        const current = detail.status !== "cancelled" && s === detail.status;
                        const color = reached ? STATUS_COLORS[s] : "#d1d5db";
                        const logEntry = detailLogs.find((l: any) => l.to_status === s);
                        return (
                          <div key={s} style={{ display: "flex", gap: 10, minHeight: 30 }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 24 }}>
                              <div style={{
                                width: current ? 18 : 12, height: current ? 18 : 12,
                                borderRadius: "50%", background: color,
                                boxShadow: current ? `0 0 0 3px ${color}40` : "none",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 8, color: "#fff", fontWeight: 700,
                              }}>
                                {reached && !current ? "✓" : ""}
                              </div>
                              {i < STATUS_FLOW.length - 1 && (
                                <div style={{ width: 2, flex: 1, background: reached && i < si ? color : "#e5e7eb", minHeight: 6 }} />
                              )}
                            </div>
                            <div style={{ flex: 1, paddingBottom: 4, fontSize: 12 }}>
                              <span style={{ fontWeight: current ? 700 : reached ? 500 : 400, color: reached ? "#334155" : "#94a3b8" }}>
                                {STATUS_LABELS[s]}
                              </span>
                              {logEntry && (
                                <div style={{ fontSize: 10, color: "#94a3b8" }}>
                                  {logEntry.created_at ? new Date(logEntry.created_at).toLocaleString("zh-CN").slice(5) : ""}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {detail.status === "cancelled" && (
                        <div style={{ display: "flex", gap: 10 }}>
                          <div style={{ width: 24, display: "flex", justifyContent: "center" }}>
                            <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff" }}>✕</div>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#dc2626" }}>
                            已取消
                            {detail.internal_note && <div style={{ fontSize: 11, fontWeight: 400 }}>{detail.internal_note}</div>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Logistics */}
                  <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, marginBottom: 12 }}>
                    <h4 style={{ margin: "0 0 6px", fontSize: 13, color: "#64748b" }}>物流追踪</h4>
                    {(() => {
                      const li = detail.logistics_info;
                      const info = typeof li === "string" ? (() => { try { return JSON.parse(li); } catch { return null; } })() : li;
                      if (!info || !info.company) return <p style={{ fontSize: 12, color: "#94a3b8" }}>暂无物流信息</p>;
                      return (
                        <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                          <div>公司：{info.company}</div>
                          <div>单号：{info.tracking_no || "—"}</div>
                          {info.link && <div><a href={info.link} target="_blank" rel="noreferrer" style={{ color: "var(--xt-accent, #f97316)" }}>📦 查看物流</a></div>}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Actions */}
                  <div style={{ background: "#fff", borderRadius: 10, padding: 14, border: "1px solid #e2e8f0" }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: 13, color: "#64748b" }}>操作</h4>
                    {detail.status === "arrived" && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button onClick={() => { setShowConfirm(true); setConfirmNote(""); }} style={btn}>✅ 确认收货</button>
                        <button onClick={() => { setShowReturn(true); setReturnReason(""); }} style={{ ...outlineBtn, color: "#dc2626", borderColor: "#dc2626" }}>📦 退货申请</button>
                      </div>
                    )}
                    {detail.status === "completed" && (
                      <div style={{ color: "#166534", fontSize: 13, fontWeight: 600 }}>✅ 订单已完成</div>
                    )}
                    {detail.status === "cancelled" && (
                      <div style={{ color: "#94a3b8", fontSize: 13 }}>
                        ❌ {detail.internal_note || "订单已取消"}
                      </div>
                    )}
                    {!["arrived", "completed", "cancelled"].includes(detail.status) && (
                      <div style={{ color: "#64748b", fontSize: 13 }}>
                        当前状态：{STATUS_LABELS[detail.status] || detail.status}，请等待后续流程
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======== CONFIRM RECEIVED MODAL ======== */}
      {showConfirm && (
        <div style={modalOverlay} onClick={() => setShowConfirm(false)}>
          <div style={{ ...modalBox, maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 12px" }}>确认收货</h3>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>
              确认收货后订单状态将变为「已完成」
            </p>
            <textarea value={confirmNote} onChange={(e) => setConfirmNote(e.target.value)}
              style={{ ...inputStyle, minHeight: 80, resize: "vertical", marginBottom: 12 }}
              placeholder="验收意见（如：商品与描述一致，质量满意）" />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={submitConfirm} disabled={confirmSaving} style={btn}>
                {confirmSaving ? "提交中..." : "确认收货"}
              </button>
              <button onClick={() => setShowConfirm(false)} style={outlineBtn}>取消</button>
            </div>
          </div>
        </div>
      )}

      {/* ======== RETURN MODAL ======== */}
      {showReturn && (
        <div style={modalOverlay} onClick={() => setShowReturn(false)}>
          <div style={{ ...modalBox, maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 12px" }}>退货申请</h3>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>
              请填写退货原因，运营人员将审核处理
            </p>
            <textarea value={returnReason} onChange={(e) => setReturnReason(e.target.value)}
              style={{ ...inputStyle, minHeight: 100, resize: "vertical", marginBottom: 12 }}
              placeholder="退货原因（如：商品与描述不符、质量问题...）" />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={submitReturn} disabled={returnSaving} style={{ ...btn, background: "#dc2626" }}>
                {returnSaving ? "提交中..." : "提交退货申请"}
              </button>
              <button onClick={() => setShowReturn(false)} style={outlineBtn}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
