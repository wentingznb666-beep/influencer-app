import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../fetchWithAuth";

export default function InfluencerVCOrders() {
  const nav = useNavigate();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => {
    try { const r = await fetchWithAuth("/api/influencer/connection-orders"); setList(((await r.json()).list || [])); }
    catch {} finally { setLoading(false); }
  })(); }, []);

  const card: React.CSSProperties = { background: "#fff", borderRadius: 10, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 8 };

  return (
    <div>
      <button onClick={()=>nav("/influencer/vertical-connections")} style={{padding:"6px 12px",border:"1px solid #dbe1ea",borderRadius:8,background:"#fff",cursor:"pointer",marginBottom:8}}>← 返回</button>
      <h2 style={{marginTop:0}}>我的定向派单</h2>
      {loading ? <p>加载中...</p> : list.length===0 ? <p style={{color:"#64748b"}}>暂无派单</p> : list.map((o:any)=>(
        <div key={o.id} style={card}>
          <div style={{display:"flex",justifyContent:"space-between"}}><strong>{o.order_no} - {o.title}</strong><span>{o.status}</span></div>
          <p style={{fontSize:13,color:"#475569",margin:"4px 0"}}>{o.amount} THB | 回应: {o.influencer_response} | 审核: {o.review_status} | 付款: {o.payment_status}</p>
          <button onClick={()=>nav(`/influencer/vertical-connections/orders/${o.id}`)} style={{padding:"6px 12px",border:"1px solid #dbe1ea",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:12,marginTop:4}}>查看详情</button>
        </div>
      ))}
    </div>
  );
}
