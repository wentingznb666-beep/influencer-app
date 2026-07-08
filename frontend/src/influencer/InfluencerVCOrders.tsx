import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../fetchWithAuth";

export default function InfluencerVCOrders() {
  const nav = useNavigate();
  const [tab, setTab] = useState("");
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectId, setRejectId] = useState<number|0>(0);
  const [rejectReason, setRejectReason] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetchWithAuth("/api/influencer/connection-orders");
      let items = ((await r.json()).list || []);
      // Sort: pending_response > need_submit > need_revise > others
      const getPriority = (o:any) => {
        if (o.influencer_response==="pending") return 0;
        if (o.review_status==="rejected") return 1;
        if (o.influencer_response==="accepted" && !o.submission_content) return 2;
        if (o.payment_status==="paid") return 4;
        return 3;
      };
      items.sort((a:any,b:any)=>getPriority(a)-getPriority(b)||new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
      setList(items);
    } catch {} finally { setLoading(false); }
  };
  useEffect(()=>{load();},[]);

  const respond = async (id: number, action: string) => {
    if (action==="accept" && !confirm("确认接受该派单？")) return;
    await fetchWithAuth(`/api/influencer/connection-orders/${id}/respond`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({action, reject_reason: action==="reject"?rejectReason:undefined}) });
    setRejectId(0); setRejectReason(""); load();
  };

  const getTabList = () => {
    if (tab==="pending_response") return list.filter(o=>o.influencer_response==="pending");
    if (tab==="need_submit") return list.filter(o=>o.influencer_response==="accepted" && !o.submission_content && o.review_status!=="rejected");
    if (tab==="need_revise") return list.filter(o=>o.review_status==="rejected");
    if (tab==="completed") return list.filter(o=>o.payment_status==="paid");
    return list;
  };
  const filtered = getTabList();

  const tabs = ["","pending_response","need_submit","need_revise","completed"];
  const tabLabels: Record<string,string> = {"":"全部","pending_response":"待回应","need_submit":"待提交","need_revise":"需要修改","completed":"已完成"};

  const statusLabel = (o:any) => {
    if (o.payment_status==="paid") return "已完成 ✅";
    if (o.review_status==="rejected") return "需要修改";
    if (o.submission_content) return "已提交";
    if (o.influencer_response==="accepted") return "待提交";
    if (o.influencer_response==="pending") return "待回应";
    if (o.influencer_response==="rejected") return "已拒绝";
    return o.status||"—";
  };

  return (
    <div>
      <h2 style={{marginTop:0}}>我的派单</h2>
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {tabs.map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{...tb,background:tab===t?"var(--xt-accent)":"#fff",color:tab===t?"#fff":"#334155",fontWeight:tab===t?700:400}}>{tabLabels[t]}</button>
        ))}
      </div>
      {loading ? <p>加载中...</p> : filtered.length===0 ? (
        <p style={{color:"#94a3b8",textAlign:"center",padding:40}}>还没有派单任务，建联成功后商家会向你派单</p>
      ) : filtered.map((o:any)=>(
        <div key={o.id} style={card} onClick={()=>{if(o.influencer_response!=="pending")nav(`/influencer/vertical-connections/orders/${o.id}`);}}>
          {/* "New" badge */}
          {o.influencer_response==="pending" && <span style={newBadge}>新</span>}
          <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap"}}>
            <div>
              <strong>{o.order_no}</strong>
              <span style={{marginLeft:8,fontSize:13,color:"#64748b"}}>{o.client_username||`商家#${o.client_id}`}</span>
            </div>
            <span style={tg(statusLabel(o))}>{statusLabel(o)}</span>
          </div>
          <p style={{fontSize:13,margin:"4px 0",color:"#475569"}}>{o.title}</p>
          <p style={{fontSize:13,margin:0,color:"#64748b"}}>
            <strong>{o.amount} THB</strong>
            {o.deadline && <span style={{marginLeft:8}}>截止: {new Date(o.deadline).toLocaleDateString()}</span>}
          </p>
          {o.review_note && <p style={{fontSize:12,color:"#b91c1c",background:"#fee2e2",padding:"4px 8px",borderRadius:6,margin:"4px 0 0"}}>驳回: {o.review_note}</p>}

          {/* Action buttons */}
          <div style={{marginTop:8,display:"flex",gap:8}} onClick={e=>e.stopPropagation()}>
            {o.influencer_response==="pending" && (
              <>
                <button onClick={()=>respond(o.id,"accept")} style={acc}>接受</button>
                <button onClick={()=>{setRejectId(o.id);setRejectReason("");}} style={rej}>拒绝</button>
                {rejectId===o.id && (
                  <div style={{display:"flex",gap:4,flex:1}}>
                    <input placeholder="拒绝原因（必填）" value={rejectReason} onChange={e=>setRejectReason(e.target.value)} style={{flex:1,padding:"6px 8px",border:"1px solid #dbe1ea",borderRadius:8}} autoFocus />
                    <button onClick={()=>respond(o.id,"reject")} disabled={!rejectReason.trim()} style={{...rej,opacity:rejectReason.trim()?1:0.5}}>确认</button>
                  </div>
                )}
              </>
            )}
            {o.influencer_response==="accepted" && !o.submission_content && o.review_status!=="rejected" && (
              <button onClick={()=>nav(`/influencer/vertical-connections/orders/${o.id}`)} style={acc}>去提交</button>
            )}
            {o.review_status==="rejected" && (
              <button onClick={()=>nav(`/influencer/vertical-connections/orders/${o.id}`)} style={{...acc,background:"#dc2626"}}>修改重提</button>
            )}
            {o.submission_content && o.review_status!=="rejected" && o.payment_status!=="paid" && (
              <span style={{fontSize:12,color:"#64748b"}}>等待商家审核...</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
const card: React.CSSProperties = { background:"#fff",borderRadius:10,padding:14,boxShadow:"0 1px 3px rgba(0,0,0,0.08)",marginBottom:8,cursor:"pointer",position:"relative" };
const tb: React.CSSProperties = { padding:"6px 14px",border:"1px solid #dbe1ea",borderRadius:8,cursor:"pointer",fontSize:13 };
const acc: React.CSSProperties = { padding:"6px 16px",border:"none",borderRadius:8,background:"var(--xt-accent)",color:"#fff",cursor:"pointer",fontSize:13 };
const rej: React.CSSProperties = { padding:"6px 16px",border:"1px solid #fecaca",borderRadius:8,background:"#fff",color:"#b91c1c",cursor:"pointer",fontSize:13 };
const newBadge: React.CSSProperties = { position:"absolute",top:-6,right:-6,background:"#dc2626",color:"#fff",borderRadius:999,padding:"1px 8px",fontSize:10,fontWeight:700,zIndex:1 };
const tg = (s: string): React.CSSProperties => {
  const c: Record<string,{bg:string;text:string}> = { "待回应":{bg:"#fef3c7",text:"#92400e"}, "待提交":{bg:"#dbeafe",text:"#1d4ed8"}, "已提交":{bg:"#dbeafe",text:"#1d4ed8"}, "需要修改":{bg:"#fee2e2",text:"#b91c1c"}, "已完成 ✅":{bg:"#dcfce7",text:"#166534"}, "已拒绝":{bg:"#f1f5f9",text:"#64748b"} };
  const v = c[s]||{bg:"#f1f5f9",text:"#475569"};
  return { display:"inline-block",padding:"2px 10px",borderRadius:999,fontSize:11,fontWeight:700,background:v.bg,color:v.text };
};
