import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../fetchWithAuth";

export default function InfluencerVCCooperation() {
  const nav = useNavigate();
  const [checking, setChecking] = useState(true);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [tab, setTab] = useState("pending");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [rejectTarget, setRejectTarget] = useState<{type:string,id:number}|null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Force profile check
  useEffect(() => {
    (async () => {
      try {
        const r = await fetchWithAuth("/api/influencer/profile");
        const p = await r.json();
        if (!p) { setProfileIncomplete(true); setChecking(false); return; }
        const requiredFields = ["influencer_code","source","followers","category","quoted_price","cooperation_conditions","gmv_sales","monthly_cart_videos","units_sold","live_sales","weekly_live_count","avg_live_hours_per_week"];
        const missing = requiredFields.filter((f: string) => { const v = p[f]; return v === null || v === undefined || v === '' || (typeof v === 'string' && v.trim() === ''); });
        if (missing.length > 0) { setProfileIncomplete(true); setChecking(false); return; }
        setChecking(false);
      } catch { setProfileIncomplete(true); setChecking(false); }
    })();
  }, []);

  const load = async () => {
    if (checking) return;
    setLoading(true);
    try {
      const [rc, ro] = await Promise.all([
        fetchWithAuth("/api/influencer/connections"),
        fetchWithAuth("/api/influencer/connection-orders"),
      ]);
      setConnections(((await rc.json()).list || []));
      setOrders(((await ro.json()).list || []));
    } catch(e:any){setErr(e.message)} finally{setLoading(false)};
  };

  useEffect(() => { if (!checking) load(); }, [checking]);

  const respondConn = async (id: number, action: string) => {
    await fetchWithAuth(`/api/influencer/connections/${id}`, { method: "PATCH", headers: {"Content-Type":"application/json"}, body: JSON.stringify({action}) });
    load(); setMsg(action==="accept"?"已接受":"已拒绝");
  };

  const respondOrder = async (oid: number, action: string, reason?: string) => {
    await fetchWithAuth(`/api/influencer/connection-orders/${oid}/respond`, { method: "PATCH", headers: {"Content-Type":"application/json"}, body: JSON.stringify({action, reject_reason: reason}) });
    load(); setMsg(action==="accept"?"已接受派单":"已拒绝派单");
  };

  if (checking) return <p>验证资料中...</p>;
  if (profileIncomplete) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"50vh",flexDirection:"column",gap:16}}>
      <div style={{fontSize:48}}>⚠️</div>
      <h2 style={{color:"#b91c1c",margin:0}}>资料不完整</h2>
      <p style={{color:"#475569"}}>请先在「我的资料」中填写完整信息</p>
      <button onClick={()=>nav("/influencer/vertical-connections/profile")} style={btnPri}>去填写</button>
    </div>
  );

  // Counts
  const pendingConns = connections.filter(c=>c.status==="pending");
  const pendingOrders = orders.filter(o=>o.influencer_response==="pending");
  const acceptedOrders = orders.filter(o=>o.influencer_response==="accepted"&&!o.submission_content);
  const pendingSubmit = [...acceptedOrders];
  const needRevise = orders.filter(o=>o.review_status==="rejected");
  const completed = orders.filter(o=>o.payment_status==="paid");

  // Filter for tabs
  const pendingItems = [
    ...pendingConns.map(c=>({type:"conn",...c})),
    ...pendingOrders.map(o=>({type:"order",...o})),
  ].sort((a,b)=>new Date(b.created_at||0).getTime()-new Date(a.created_at||0).getTime());

  const inProgressItems = [
    ...connections.filter(c=>c.status==="active").map(c=>({type:"conn_active",...c})),
    ...orders.filter(o=>o.submission_content&&o.review_status!=="rejected").map(o=>({type:"order_submitted",...o})),
  ];

  return (
    <div>
      <h2 style={{marginTop:0}}>合作中心</h2>
      {err && <p style={{color:"#c00"}}>{err}</p>}
      {msg && <p style={{color:"#166534",fontWeight:700}}>{msg}</p>}

      {/* Stats */}
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <div style={{...statCard,background:"#fef3c7"}}><div style={statNum}>{pendingConns.length+pendingOrders.length}</div><div style={statLabel}>待处理</div></div>
        <div style={{...statCard,background:"#dbeafe"}}><div style={statNum}>{pendingSubmit.length}</div><div style={statLabel}>待提交作品</div></div>
        <div style={{...statCard,background:"#fee2e2"}}><div style={statNum}>{needRevise.length}</div><div style={statLabel}>需要修改</div></div>
        <div style={{...statCard,background:"#dcfce7"}}><div style={statNum}>{completed.length}</div><div style={statLabel}>已完成</div></div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {["pending","in_progress","need_revise","completed"].map(t=>{
          const labels:Record<string,string>={pending:"待处理",in_progress:"进行中",need_revise:"需要修改",completed:"已完成"};
          return <button key={t} onClick={()=>setTab(t)} style={{...tabStyle,background:tab===t?"var(--xt-accent)":"#fff",color:tab===t?"#fff":"#334155",fontWeight:tab===t?700:400}}>{labels[t]}</button>;
        })}
      </div>

      {loading ? <p>加载中...</p> : (
        <>
          {/* Pending tab */}
          {tab==="pending" && (pendingItems.length===0 ? <p style={{color:"#64748b"}}>暂无待处理项</p> : pendingItems.map(item=>(
            <div key={`${item.type}-${item.id}`} style={card}>
              {item.type==="conn" ? (
                <>
                  <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap"}}>
                    <div><strong style={{color:"#92400e"}}>📨 建联邀请</strong> <span style={{fontSize:13,color:"#64748b"}}>{item.client_username||`商家#${item.client_id}`}</span></div>
                    <span style={tg("pending")}>待回应</span>
                  </div>
                  <p style={{fontSize:13,margin:"4px 0"}}>类目: {item.category} | 预算: {item.budget||"-"}</p>
                  {item.brief && <p style={{fontSize:13,margin:0,color:"#475569"}}>简述: {item.brief}</p>}
                  <div style={{marginTop:8,display:"flex",gap:8}}>
                    <button onClick={()=>respondConn(item.id,"accept")} style={btnPri}>接受</button>
                    <button onClick={()=>respondConn(item.id,"reject")} style={btnDan}>拒绝</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap"}}>
                    <div><strong style={{color:"#1d4ed8"}}>📋 定向派单</strong> <span style={{fontSize:13,color:"#64748b"}}>{item.client_username||`商家#${item.client_id}`}</span></div>
                    <span style={tg("pending")}>待回应</span>
                  </div>
                  <p style={{fontSize:13,margin:"4px 0"}}>{item.order_no} | {item.title} | <strong>{item.amount} THB</strong></p>
                  <div style={{marginTop:8,display:"flex",gap:8}}>
                    <button onClick={()=>respondOrder(item.id,"accept")} style={btnPri}>接受</button>
                    <button onClick={()=>{setRejectTarget({type:"order",id:item.id});setRejectReason("");}} style={btnDan}>拒绝</button>
                    {rejectTarget?.id===item.id && rejectTarget?.type==="order" && (
                      <div style={{display:"flex",gap:4}}>
                        <input placeholder="拒绝原因（必填）" value={rejectReason} onChange={e=>setRejectReason(e.target.value)} style={si} />
                        <button onClick={()=>respondOrder(item.id,"reject",rejectReason)} disabled={!rejectReason} style={btnDan}>确认拒绝</button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )))}

          {/* In Progress tab */}
          {tab==="in_progress" && (inProgressItems.length===0 ? <p style={{color:"#64748b"}}>暂无进行中项目</p> : inProgressItems.map(item=>(
            <div key={`${item.type}-${item.id}`} style={card}>
              {item.type==="conn_active" ? (
                <>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <div><strong>🔗 建联中</strong> <span style={{fontSize:13,color:"#64748b"}}>{item.client_username||`商家#${item.client_id}`} | {item.category}</span></div>
                    <span style={tg("active")}>建联中</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <div><strong>{item.order_no}</strong> <span style={{fontSize:13,color:"#64748b"}}>{item.client_username||`商家#${item.client_id}`}</span></div>
                    <span style={tg("submitted")}>已提交</span>
                  </div>
                  <p style={{fontSize:13,margin:"4px 0"}}>{item.title} | <strong>{item.amount} THB</strong></p>
                  <button onClick={()=>nav(`/influencer/vertical-connections/orders/${item.id}`)} style={{...btnPri,marginTop:4}}>查看详情</button>
                </>
              )}
            </div>
          )))}

          {/* Need Revise tab */}
          {tab==="need_revise" && (needRevise.length===0 ? <p style={{color:"#64748b"}}>无需修改的订单</p> : needRevise.map(o=>(
            <div key={o.id} style={card}>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <div><strong>{o.order_no}</strong> <span style={{fontSize:13,color:"#64748b"}}>{o.client_username||`商家#${o.client_id}`}</span></div>
                <span style={tg("rejected")}>待修改</span>
              </div>
              <p style={{fontSize:13,margin:"4px 0"}}>{o.title} | <strong>{o.amount} THB</strong></p>
              {o.review_note && <p style={{fontSize:12,color:"#b91c1c",background:"#fee2e2",padding:"4px 8px",borderRadius:6,margin:"4px 0"}}>驳回原因: {o.review_note}</p>}
              <button onClick={()=>nav(`/influencer/vertical-connections/orders/${o.id}`)} style={{...btnPri,marginTop:4}}>修改重提</button>
            </div>
          )))}

          {/* Completed tab */}
          {tab==="completed" && (completed.length===0 ? <p style={{color:"#64748b"}}>暂无已完成订单</p> : completed.map(o=>(
            <div key={o.id} style={card}>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <div><strong>{o.order_no}</strong> <span style={{fontSize:13,color:"#64748b"}}>{o.client_username||`商家#${o.client_id}`}</span></div>
                <span style={tg("paid")}>✅ 已完成</span>
              </div>
              <p style={{fontSize:13,margin:"4px 0"}}>{o.title} | <strong>{o.amount} THB</strong></p>
            </div>
          )))}
        </>
      )}
    </div>
  );
}

const card: React.CSSProperties = { background: "#fff", borderRadius: 10, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 8 };
const si: React.CSSProperties = { padding: "6px 8px", border: "1px solid #dbe1ea", borderRadius: 8 };
const btnPri: React.CSSProperties = { padding: "6px 14px", border: "none", borderRadius: 8, background: "var(--xt-accent)", color: "#fff", cursor: "pointer", fontSize: 13 };
const btnDan: React.CSSProperties = { padding: "6px 14px", border: "1px solid #fecaca", borderRadius: 8, background: "#fff", color: "#b91c1c", cursor: "pointer", fontSize: 13 };
const tabStyle: React.CSSProperties = { padding: "6px 14px", border: "1px solid #dbe1ea", borderRadius: 8, cursor: "pointer", fontSize: 13 };
const statCard: React.CSSProperties = { borderRadius: 8, padding: "8px 16px", flex: 1, minWidth: 80, textAlign: "center" };
const statNum: React.CSSProperties = { fontSize: 22, fontWeight: 800 };
const statLabel: React.CSSProperties = { fontSize: 11, marginTop: 2 };
const tg = (s: string): React.CSSProperties => {
  const c: Record<string,{bg:string;text:string}> = { pending:{bg:"#fef3c7",text:"#92400e"}, active:{bg:"#dcfce7",text:"#166534"}, submitted:{bg:"#dbeafe",text:"#1d4ed8"}, rejected:{bg:"#fee2e2",text:"#b91c1c"}, paid:{bg:"#dcfce7",text:"#166534"} };
  const v = c[s]||{bg:"#f1f5f9",text:"#475569"};
  return { display:"inline-block",padding:"2px 10px",borderRadius:999,fontSize:11,fontWeight:700,background:v.bg,color:v.text };
};
