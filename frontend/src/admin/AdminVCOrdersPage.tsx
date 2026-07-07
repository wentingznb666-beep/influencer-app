import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../fetchWithAuth";

export default function AdminVCOrdersPage() {
  const nav = useNavigate();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => {
    try { const r = await fetchWithAuth("/api/admin/connection-orders"); setList(((await r.json()).list || [])); } catch {}
    finally { setLoading(false); }
  })(); }, []);

  return (
    <div>
      <button onClick={()=>nav("/admin/vertical-connections")} style={sb}>← 返回概览</button>
      <h2>派单与付款记录管理</h2>
      {loading ? <p>加载中...</p> : list.map((o:any) => (
        <div key={o.id} style={card}>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <strong>{o.order_no} - {o.title}</strong>
            <span style={tag(o.status)}>{o.status}</span>
          </div>
          <p style={sm}>商家: {o.client_username||`#${o.client_id}`} | 达人: {o.influencer_username||`#${o.influencer_id}`}</p>
          <p style={sm}>金额: {o.amount} THB | 审核: {o.review_status} | 付款: {o.payment_status}</p>
          {o.influencer_reject_reason && <p style={{...sm,color:"#b91c1c"}}>拒绝原因: {o.influencer_reject_reason}</p>}
          {o.payment_voucher && <p style={sm}>付款凭证: {o.payment_voucher}</p>}
        </div>
      ))}
    </div>
  );
}
const sb: React.CSSProperties = { padding: "6px 12px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer", marginBottom: 8 };
const card: React.CSSProperties = { background: "#fff", borderRadius: 10, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 8 };
const sm: React.CSSProperties = { fontSize: 12, color: "#64748b", margin: "2px 0" };
const tag = (s: string): React.CSSProperties => ({ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: ({submitted:"#1d4ed8",completed:"#166534",rejected:"#b91c1c",pending:"#92400e"}[s]||"#f1f5f9")+"22", color: {submitted:"#1d4ed8",completed:"#166534",rejected:"#b91c1c",pending:"#92400e"}[s]||"#475569" });
