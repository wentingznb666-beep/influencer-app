import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../fetchWithAuth";

export default function AdminVCOrdersPage() {
  const nav = useNavigate();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({});
  const [anomaly, setAnomaly] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const p = anomaly ? "?anomaly=1" : "";
      const r = await fetchWithAuth(`/api/admin/connection-orders${p}`);
      const d = await r.json();
      setList(d.list || []);
      setStats(d.stats || {});
    } catch {} finally { setLoading(false); }
  };
  useEffect(()=>{load();},[anomaly]);

  const adminAction = async (id: number, action: string) => {
    if (!confirm(`确认${action==="mark_paid"?"标记已付款":"驳回凭证"}？`)) return;
    await fetchWithAuth(`/api/admin/connection-orders/${id}/admin-action`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({action}) });
    load();
  };

  const checkExpiry = async () => {
    const r = await fetchWithAuth("/api/admin/connections/check-expiry", { method:"POST" });
    const d = await r.json();
    alert(`已处理过期: ${d.expired} 条, 发送到期提醒: ${d.warnings_sent} 条`);
    load();
  };

  const isAnomaly = (o: any) => {
    if (o.influencer_response==="rejected" && (!o.influencer_reject_reason||o.influencer_reject_reason.trim()==="")) return "拒绝无原因";
    if (o.review_status==="rejected" && (!o.review_note||o.review_note.trim()==="")) return "驳回无备注";
    if (o.influencer_response==="pending" && new Date(o.created_at).getTime() < Date.now()-48*3600000) return "超时未回应";
    return null;
  };

  return (
    <div>
      <button onClick={()=>nav("/admin/vertical-connections")} style={sb}>← 返回概览</button>
      <h2 style={{margin:0}}>派单与付款记录管理</h2>
      <div style={{display:"flex",gap:10,margin:"12px 0",flexWrap:"wrap"}}>
        <div style={{...stc,background:"#dbeafe"}}><div style={sn}>{Number(stats.total_amount||0).toLocaleString()} THB</div><div style={sl}>总派单金额</div></div>
        <div style={{...stc,background:"#dcfce7"}}><div style={sn}>{Number(stats.paid_amount||0).toLocaleString()} THB</div><div style={sl}>已付款金额</div></div>
        <div style={{...stc,background:"#fee2e2"}}><div style={sn}>{Number(stats.unpaid_amount||0).toLocaleString()} THB</div><div style={sl}>未付款金额</div></div>
        <button onClick={checkExpiry} style={{...sb,background:"#fef3c7",border:"1px solid #f59e0b",fontWeight:700}}>检查到期</button>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <label style={{fontSize:12,cursor:"pointer"}}><input type="checkbox" checked={anomaly} onChange={e=>setAnomaly(e.target.checked)} /> 仅异常订单</label>
      </div>
      {loading ? <p>加载中...</p> : list.map((o:any)=>(
        <div key={o.id} style={card}>
          {isAnomaly(o) && <span style={{position:"absolute",top:-6,right:-6,background:"#dc2626",color:"#fff",borderRadius:999,padding:"1px 8px",fontSize:10,fontWeight:700,zIndex:1}}>! {isAnomaly(o)}</span>}
          <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap"}}>
            <strong>{o.order_no} - {o.title}</strong>
            <span style={tg(o.status)}>{o.status}</span>
          </div>
          <p style={sm}>商家: {o.client_username||`#${o.client_id}`} | 达人: {o.influencer_username||`#${o.influencer_id}`}</p>
          <p style={sm}>金额: <strong>{o.amount} THB</strong> | 审核: {o.review_status} | 付款: {o.payment_status}</p>
          {o.influencer_reject_reason && <p style={{...sm,color:"#b91c1c"}}>拒绝: {o.influencer_reject_reason}</p>}
          {o.review_note && <p style={{...sm,color:"#92400e"}}>驳回: {o.review_note}</p>}
          {o.payment_voucher && <p style={sm}>凭证: {o.payment_voucher}</p>}
          <div style={{marginTop:6,display:"flex",gap:6}}>
            {o.review_status==="approved" && o.payment_status!=="paid" && <button onClick={()=>adminAction(o.id,"mark_paid")} style={ssm}>标记已付款</button>}
            {o.payment_voucher && <button onClick={()=>adminAction(o.id,"reject_voucher")} style={{...ssm,color:"#b91c1c"}}>驳回凭证</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
const sb: React.CSSProperties = { padding: "6px 12px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer" };
const card: React.CSSProperties = { background: "#fff", borderRadius: 10, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 8, position:"relative" };
const sm: React.CSSProperties = { fontSize: 12, color: "#64748b", margin: "2px 0" };
const ssm: React.CSSProperties = { padding: "4px 8px", border: "1px solid #dbe1ea", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 11 };
const stc: React.CSSProperties = { borderRadius: 8, padding: "10px 18px", flex: 1, minWidth: 120 };
const sn: React.CSSProperties = { fontSize: 20, fontWeight: 800 };
const sl: React.CSSProperties = { fontSize: 11, marginTop: 2 };
const tg = (s: string): React.CSSProperties => {
  const c: Record<string,{bg:string;text:string}> = { submitted:{bg:"#dbeafe",text:"#1d4ed8"}, completed:{bg:"#dcfce7",text:"#166534"}, rejected:{bg:"#fee2e2",text:"#b91c1c"}, pending:{bg:"#fef3c7",text:"#92400e"} };
  const v = c[s]||{bg:"#f1f5f9",text:"#475569"};
  return { display:"inline-block",padding:"2px 10px",borderRadius:999,fontSize:11,fontWeight:700,background:v.bg,color:v.text };
};
