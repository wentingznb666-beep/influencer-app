import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchWithAuth } from "../fetchWithAuth";
import { vcTagStyle, vcStatusLabel } from "../utils/vcStatusColors";

export default function ClientVCOrderDetail() {
  const nav = useNavigate(); const params = useParams();
  const id = params.id || "";
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [payVoucher, setPayVoucher] = useState("");
  const [paymentInfo, setPaymentInfo] = useState<string|null>(null);

  const load = async () => {
    try { const r = await fetchWithAuth(`/api/client/connection-orders/${id}`); setOrder(await r.json()); }
    catch(e:any){setErr(e.message)} finally{setLoading(false)};
  };
  useEffect(()=>{load();},[]);

  const doReview = async (action: string) => {
    await fetchWithAuth(`/api/client/connection-orders/${id}/review`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ action, review_note: action==="reject"?reviewNote:undefined }) });
    load();
  };

  const confirmPay = async () => {
    if (!payVoucher) return;
    await fetchWithAuth(`/api/client/connection-orders/${id}/confirm-payment`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ payment_voucher: payVoucher }) });
    load();
  };

  const loadPayInfo = async () => {
    const r = await fetchWithAuth(`/api/client/connection-orders/${id}/payment-info`);
    setPaymentInfo((await r.json()).payment_info);
  };

  const card: React.CSSProperties = { background: "#fff", borderRadius: 10, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 12 };
  const si: React.CSSProperties = { padding: "6px 8px", border: "1px solid #dbe1ea", borderRadius: 8 };
  const sp: React.CSSProperties = { padding: "6px 14px", border: "none", borderRadius: 8, background: "var(--xt-accent)", color: "#fff", cursor: "pointer", fontSize: 13 };

  if (loading) return <p>加载中...</p>;
  if (!order) return <p>订单不存在</p>;

  return (
    <div>
      <button onClick={()=>nav(-1)} style={{ padding: "6px 12px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer", marginBottom: 12 }}>← 返回</button>
      <h2>订单详情: {order.order_no}</h2>
      {err && <p style={{color:"#c00"}}>{err}</p>}
      <div style={card}>
        <p><strong>标题:</strong> {order.title}</p>
        <p><strong>任务要求:</strong> {order.task_requirements}</p>
        <p><strong>交付标准:</strong> {order.delivery_standards}</p>
        <p><strong>截止时间:</strong> {order.deadline}</p>
        <p><strong>金额:</strong> {order.amount} THB</p>
        <p><strong>达人回应:</strong> {order.influencer_response}</p>
        {order.influencer_reject_reason && <p style={{color:"#b91c1c"}}><strong>拒绝原因:</strong> {order.influencer_reject_reason}</p>}
        {order.submission_content && <p><strong>作品:</strong> {order.submission_content}</p>}
        <p><strong>审核:</strong> {order.review_status} | <strong>付款:</strong> {order.payment_status}</p>
        {order.review_note && <p style={{color:"#92400e"}}><strong>驳回备注:</strong> {order.review_note}</p>}

        {order.review_status === "pending_review" && order.submission_content && (
          <div style={{marginTop:12,padding:10,background:"#f8fafc",borderRadius:8}}>
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <button onClick={()=>doReview("approve")} style={sp}>验收通过</button>
              <div>
                <input placeholder="驳回原因（必填）" value={reviewNote} onChange={e=>setReviewNote(e.target.value)} style={si} />
                <button onClick={()=>doReview("reject")} disabled={!reviewNote} style={{...sp,background:reviewNote?"#dc2626":"#94a3b8",marginLeft:4}}>驳回 ({order.review_count}/1)</button>
              </div>
            </div>
          </div>
        )}
        {order.review_status === "approved" && order.payment_status !== "paid" && (
          <div style={{marginTop:12}}>
            {!paymentInfo ? <button onClick={loadPayInfo} style={sp}>查看收款方式</button> : (
              <div style={{padding:10,background:"#f0fdf4",borderRadius:8}}>
                <p style={{fontSize:13}}>收款方式: {paymentInfo}</p>
                <div style={{display:"flex",gap:8}}>
                  <input placeholder="付款凭证URL" value={payVoucher} onChange={e=>setPayVoucher(e.target.value)} style={si} />
                  <button onClick={confirmPay} disabled={!payVoucher} style={sp}>确认已付款</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
