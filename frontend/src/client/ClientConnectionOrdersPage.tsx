import { useEffect, useState } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import { fetchWithAuth } from "../fetchWithAuth";

type Order = {
  id: number; connection_id: number; client_id: number; influencer_id: number;
  order_no: string; title: string; task_requirements: string; delivery_standards: string;
  deadline: string; submission_types: string; amount: string;
  influencer_response: string; influencer_reject_reason: string | null;
  submission_content: string | null; status: string; review_status: string;
  review_note: string | null; review_count: number;
  payment_voucher: string | null; payment_status: string;
  paid_at: string | null;
  influencer_code?: string; influencer_username?: string;
};

export default function ClientConnectionOrdersPage() {
  const [searchParams] = useSearchParams();
  const params = useParams();
  const connectionId = searchParams.get("connection") || "";
  const influencerId = searchParams.get("influencer") || "";
  const detailId = params.id;

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState("");
  const [q, setQ] = useState("");

  // Dispatch form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", task_requirements: "", delivery_standards: "", deadline: "", submission_types: "", amount: "" });

  // Review
  const [reviewTarget, setReviewTarget] = useState<Order | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [detail, setDetail] = useState<Order | null>(null);

  // Payment
  const [payTarget, setPayTarget] = useState<Order | null>(null);
  const [payVoucher, setPayVoucher] = useState("");
  const [paymentInfo, setPaymentInfo] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(); if(tab) params.set('tab', tab); if(q.trim()) params.set('q', q.trim()); const res = await fetchWithAuth(`/api/client/connection-orders?${params}`);
      const data = await res.json();
      setOrders(data.list || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tab]);
  useEffect(() => {
    if (detailId) {
      fetchWithAuth(`/api/client/connection-orders/${detailId}`).then(r => r.json()).then(setDetail).catch(() => {});
    }
  }, [detailId]);

  // Check for unpaid orders that would block new actions
  const hasUnpaid = orders.some(o => o.review_status === "approved" && o.payment_status !== "paid");

  const dispatch = async () => {
    if (hasUnpaid) { setError("请先完成未付款订单的付款后再操作"); return; }
    if (!form.title || !form.task_requirements || !form.delivery_standards || !form.deadline) {
      setError("请填写所有必填字段"); return;
    }
    try {
      await fetchWithAuth("/api/client/connection-orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connection_id: Number(connectionId), influencer_id: Number(influencerId), ...form })
      });
      setShowForm(false); setForm({ title: "", task_requirements: "", delivery_standards: "", deadline: "", submission_types: "", amount: "" });
      load(); setMsg("派单成功");
    } catch (e: any) { setError(e.message); }
  };

  const doReview = async (id: number, action: "approve" | "reject") => {
    try {
      await fetchWithAuth(`/api/client/connection-orders/${id}/review`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, review_note: action === "reject" ? reviewNote : undefined })
      });
      setReviewTarget(null); setReviewNote(""); load();
      setMsg(action === "approve" ? "验收通过" : "已驳回");
    } catch (e: any) { setError(e.message); }
  };

  const confirmPay = async (id: number) => {
    if (!payVoucher) { setError("请上传付款凭证"); return; }
    try {
      await fetchWithAuth(`/api/client/connection-orders/${id}/confirm-payment`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_voucher: payVoucher })
      });
      setPayTarget(null); setPayVoucher(""); load();
      setMsg("已确认付款");
    } catch (e: any) { setError(e.message); }
  };

  const loadPaymentInfo = async (order: Order) => {
    try {
      const res = await fetchWithAuth(`/api/client/connection-orders/${order.id}/payment-info`);
      const data = await res.json();
      setPaymentInfo(data.payment_info);
      setPayTarget(order);
    } catch (e: any) { setError(e.message); }
  };

  const editOrder = async (id: number, updates: Partial<typeof form>) => {
    try {
      await fetchWithAuth(`/api/client/connection-orders/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates)
      });
      load(); setMsg("已更新");
    } catch (e: any) { setError(e.message); }
  };

  const deleteOrder = async (id: number) => {
    if (!confirm("确认删除？")) return;
    try {
      await fetchWithAuth(`/api/client/connection-orders/${id}`, { method: "DELETE" });
      load(); setMsg("已删除");
    } catch (e: any) { setError(e.message); }
  };

  if (detail) return (
    <div>
      <h2>订单详情: {detail.order_no}</h2>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <div style={cardStyle}>
        <p><strong>标题:</strong> {detail.title}</p>
        <p><strong>任务要求:</strong> {detail.task_requirements}</p>
        <p><strong>交付标准:</strong> {detail.delivery_standards}</p>
        <p><strong>截止时间:</strong> {detail.deadline}</p>
        <p><strong>提交方式:</strong> {detail.submission_types}</p>
        <p><strong>金额:</strong> {detail.amount} THB</p>
        <p><strong>达人回应:</strong> {detail.influencer_response}</p>
        {detail.influencer_reject_reason && <p><strong>拒绝原因:</strong> {detail.influencer_reject_reason}</p>}
        {detail.submission_content && <p><strong>作品内容:</strong> {detail.submission_content}</p>}
        <p><strong>审核状态:</strong> {detail.review_status}</p>
        {detail.review_note && <p><strong>驳回备注:</strong> {detail.review_note}</p>}
        <p><strong>付款状态:</strong> {detail.payment_status}</p>
        {detail.payment_voucher && <p><strong>付款凭证:</strong> {detail.payment_voucher}</p>}
      </div>
    </div>
  );

  return (
    <div>
      <h2>订单列表</h2>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        {[["","全部"],["pending_response","待回应"],["pending_review","待审核"],["pending_payment","待付款"],["completed","已完成"]].map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)} style={{padding:"6px 14px",border:"1px solid #dbe1ea",borderRadius:8,background:tab===v?"var(--xt-accent)":"#fff",color:tab===v?"#fff":"#334155",cursor:"pointer",fontSize:13,fontWeight:tab===v?700:400}}>{l}</button>
        ))}
        <input placeholder="搜索订单号/达人编号" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")load();}} style={{padding:"6px 10px",border:"1px solid #dbe1ea",borderRadius:8,minWidth:200,marginLeft:"auto"}} />
        <button onClick={load} style={{padding:"6px 12px",border:"1px solid #dbe1ea",borderRadius:8,background:"#fff",cursor:"pointer"}}>搜索</button>
      </div>
      {hasUnpaid && <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#b91c1c", marginBottom: 12, fontWeight: 700 }}>⚠ 您有未完成付款的订单，请先完成付款后再派单/审核操作！</div>}
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      {msg && <p style={{ color: "#166534" }}>{msg}</p>}

      {connectionId && influencerId && (
        <button onClick={() => setShowForm(!showForm)} disabled={hasUnpaid} style={{...btnPrimary, opacity: hasUnpaid ? 0.5 : 1, cursor: hasUnpaid ? "not-allowed" : "pointer"}}>{showForm ? "取消" : "新建派单"}</button>
      )}

      {showForm && (
        <div style={{ ...cardStyle, marginTop: 12 }}>
          <h3>新建定向派单</h3>
          <div style={formGrid}>
            <label>任务标题*</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inputS} />
            <label>任务要求*</label><textarea value={form.task_requirements} onChange={e => setForm(f => ({ ...f, task_requirements: e.target.value }))} style={inputS} rows={3} />
            <label>交付标准*</label><textarea value={form.delivery_standards} onChange={e => setForm(f => ({ ...f, delivery_standards: e.target.value }))} style={inputS} rows={3} />
            <label>截止时间*</label><input type="datetime-local" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} style={inputS} />
            <label>提交方式</label><input value={form.submission_types} onChange={e => setForm(f => ({ ...f, submission_types: e.target.value }))} style={inputS} placeholder="link,video,image 多选用逗号分隔" />
            <label>订单金额 (达人报价)</label><input type="number" value={form.amount} readOnly style={{...inputS, background:"#f8fafc", color:"#64748b", cursor:"not-allowed"}} /><small style={{color:"#64748b",gridColumn:"2"}}>金额自动取达人报价，不可修改</small>
          </div>
          <button onClick={dispatch} style={{ ...btnPrimary, marginTop: 12 }}>提交派单</button>
        </div>
      )}

      {loading ? <p>加载中...</p> : orders.length === 0 ? <p style={{ color: "#64748b", marginTop: 16 }}>暂无派单记录</p> : orders.map(o => (
        <div key={o.id} style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap" }}>
            <strong>{o.order_no}</strong>
            <span style={statusBadge(o.status)}>{o.status}</span>
          </div>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            <p style={{ margin: 0 }}><strong>{o.title}</strong> | {o.amount} THB</p>
            <p style={{ margin: "4px 0", color: "#64748b" }}>达人: {o.influencer_code || o.influencer_username || `#${o.influencer_id}`} | 回应: {o.influencer_response}</p>
          </div>

          {/* Actions */}
          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {o.influencer_response === "pending" && (
              <>
                <button onClick={() => editOrder(o.id, { title: prompt("新标题", o.title) || o.title })} style={btnSm}>编辑</button>
                <button onClick={() => deleteOrder(o.id)} style={{ ...btnSm, color: "#b91c1c" }}>删除</button>
              </>
            )}
            {o.review_status === "pending_review" && o.submission_content && (
              <button onClick={() => setReviewTarget(o)} disabled={hasUnpaid && o.review_status !== "approved"} style={{...btnSm, opacity: (hasUnpaid && o.review_status !== "approved") ? 0.5 : 1, cursor: (hasUnpaid && o.review_status !== "approved") ? "not-allowed" : "pointer"}}>审核</button>
            )}
            {o.review_status === "approved" && o.payment_status !== "paid" && (
              <button onClick={() => loadPaymentInfo(o)} style={btnPrimary}>确认付款</button>
            )}
          </div>

          {/* Review panel */}
          {reviewTarget?.id === o.id && (
            <div style={{ marginTop: 8, padding: 10, background: "#f8fafc", borderRadius: 8 }}>
              <p style={{ fontSize: 13 }}>作品内容: {o.submission_content}</p>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => doReview(o.id, "approve")} style={btnPrimary}>验收通过</button>
                <div>
                  <input placeholder="驳回原因（必填）" value={reviewNote} onChange={e => setReviewNote(e.target.value)} style={inputS} />
                  <button onClick={() => doReview(o.id, "reject")} disabled={!reviewNote} style={{ ...btnSm, color: "#b91c1c", marginLeft: 4 }}>驳回 ({o.review_count}/1)</button>
                </div>
              </div>
            </div>
          )}

          {/* Payment panel */}
          {payTarget?.id === o.id && (
            <div style={{ marginTop: 8, padding: 10, background: "#f0fdf4", borderRadius: 8 }}>
              <p style={{ fontSize: 13 }}>收款方式: {paymentInfo || "未设置"}</p>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input placeholder="付款凭证URL" value={payVoucher} onChange={e => setPayVoucher(e.target.value)} style={inputS} />
                <button onClick={() => confirmPay(o.id)} disabled={!payVoucher} style={btnPrimary}>确认已付款</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: "#fff", borderRadius: 10, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 8 };
const inputS: React.CSSProperties = { padding: "6px 8px", border: "1px solid #dbe1ea", borderRadius: 8, width: "100%", boxSizing: "border-box" };
const btnPrimary: React.CSSProperties = { padding: "6px 14px", border: "none", borderRadius: 8, background: "var(--xt-accent)", color: "#fff", cursor: "pointer", fontSize: 13 };
const btnSm: React.CSSProperties = { padding: "4px 10px", border: "1px solid #dbe1ea", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 12 };
const formGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "100px 1fr", gap: 8, alignItems: "center" };
const statusBadge = (s: string): React.CSSProperties => {
  const c: Record<string, string> = { pending: "#92400e", submitted: "#1d4ed8", completed: "#166534", rejected: "#b91c1c" };
  return { display: "inline-block", padding: "1px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: (c[s] || "#f1f5f9") + "22", color: c[s] || "#475569" };
};
