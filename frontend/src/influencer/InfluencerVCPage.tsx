import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../fetchWithAuth";

export default function InfluencerVCPage() {
  const nav = useNavigate();
  const [checking, setChecking] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [connections, setConnections] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [tab, setTab] = useState("pending");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const requiredFields = ["influencer_code","source","followers","category","quoted_price","cooperation_conditions","gmv_sales","monthly_cart_videos","units_sold","live_sales","weekly_live_count","avg_live_hours_per_week"];

  // Force profile check on mount
  useEffect(() => {
    (async () => {
      try {
        const r = await fetchWithAuth("/api/influencer/profile");
        const p = await r.json();
        if (!p) { setProfileIncomplete(true); setChecking(false); return; }
        const missing = requiredFields.filter(f => {
    const v = p[f];
    if (v === null || v === undefined || v === '') return true;
    if (typeof v === 'string' && v.trim() === '') return true;
    return false;
  });
        if (missing.length > 0) { setProfileIncomplete(true); setChecking(false); return; }
        setProfile(p); setChecking(false);
      } catch { setProfileIncomplete(true); setChecking(false); }
    })();
  }, []);

  const load = async () => {
    if (checking) return;
    setLoading(true);
    try {
      const rc = await fetchWithAuth(`/api/influencer/connections?tab=${tab}`);
      setConnections(((await rc.json()).list || []));
      const ro = await fetchWithAuth("/api/influencer/connection-orders");
      setOrders(((await ro.json()).list || []));
    } catch(e:any){setErr(e.message)} finally{setLoading(false)};
  };

  useEffect(() => { if (!checking) load(); }, [tab, checking]);

  const respondConn = async (id: number, action: string) => {
    await fetchWithAuth(`/api/influencer/connections/${id}`, { method: "PATCH", headers: {"Content-Type":"application/json"}, body: JSON.stringify({action}) });
    load(); setMsg(action==="accept"?"已接受建联":"已拒绝建联");
  };

  const respondOrder = async (oid: number, action: string, reason?: string) => {
    await fetchWithAuth(`/api/influencer/connection-orders/${oid}/respond`, { method: "PATCH", headers: {"Content-Type":"application/json"}, body: JSON.stringify({action, reject_reason: reason}) });
    load(); setMsg(action==="accept"?"已接受派单":"已拒绝派单");
  };

  if (checking) return <p>正在验证资料...</p>;

  if (profileIncomplete) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"50vh",flexDirection:"column",gap:16}}>
      <div style={{fontSize:48}}>⚠️</div>
      <h2 style={{color:"#b91c1c",margin:0}}>资料不完整</h2>
      <p style={{color:"#475569",textAlign:"center",maxWidth:400}}>请先在「我的资料」中填写并保存完整信息后，再进行建联操作</p>
      <button onClick={()=>nav("/influencer/vertical-connections/profile")} style={{padding:"10px 24px",border:"none",borderRadius:8,background:"var(--xt-accent)",color:"#fff",cursor:"pointer",fontWeight:700,fontSize:15}}>去填写</button>
    </div>
  );

  const pendingCount = connections.filter(c=>c.status==="pending").length;
  const card: React.CSSProperties = { background: "#fff", borderRadius: 10, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 8 };
  const sp: React.CSSProperties = { padding: "6px 14px", border: "none", borderRadius: 8, background: "var(--xt-accent)", color: "#fff", cursor: "pointer", fontSize: 13 };
  const sd: React.CSSProperties = { padding: "6px 14px", border: "1px solid #fecaca", borderRadius: 8, background: "#fff", color: "#b91c1c", cursor: "pointer", fontSize: 13 };

  return (
    <div>
      <h2 style={{marginTop:0}}>垂直达人建联 {pendingCount > 0 && `(${pendingCount})`}</h2>
      {err && <p style={{color:"#c00"}}>{err}</p>}
      {msg && <p style={{color:"#166534"}}>{msg}</p>}

      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {["pending","active","rejected","expired"].map(t => {
          const labels:Record<string,string>={pending:"待处理",active:"建联中",rejected:"已拒绝",expired:"已到期"};
          let label = labels[t]||t;
          if(t==="pending"&&pendingCount>0) label += "("+pendingCount+")";
          return <button key={t} onClick={()=>setTab(t)} style={{padding:"6px 14px",border:"1px solid #dbe1ea",borderRadius:8,background:tab===t?"var(--xt-accent)":"#fff",color:tab===t?"#fff":"#334155",cursor:"pointer",fontSize:13,fontWeight:t==="pending"&&pendingCount>0?800:400}}>{label}</button>;
        })}
        <button onClick={()=>nav("/influencer/vertical-connections/profile")} style={{padding:"6px 14px",border:"1px solid var(--xt-accent)",borderRadius:8,background:"#fff",color:"var(--xt-accent)",cursor:"pointer",fontSize:13,marginLeft:"auto"}}>编辑资料</button>
        <button onClick={()=>nav("/influencer/vertical-connections/payment")} style={{padding:"6px 14px",border:"1px solid #dbe1ea",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:13}}>收款方式</button>
      </div>

      {loading ? <p>加载中...</p> : (
        <>
          {connections.length === 0 && <p style={{color:"#64748b"}}>暂无建联记录</p>}
          {connections.map((c:any)=>(
            <div key={c.id} style={card}>
              <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap"}}>
                <div><strong>{c.client_username||`商家#${c.client_id}`}</strong><span style={{marginLeft:8,fontSize:13,color:"#64748b"}}>{c.category} | {c.grade||"-"}</span></div>
                <span style={tag(c.status)}>{c.status}</span>
              </div>
              {c.brief && <p style={{fontSize:13,margin:"4px 0"}}>简述: {c.brief}</p>}
              {c.budget && <p style={{fontSize:13,margin:0,color:"#64748b"}}>预算: {c.budget}</p>}
              {c.status==="pending" && <div style={{marginTop:8,display:"flex",gap:8}}><button onClick={()=>respondConn(c.id,"accept")} style={sp}>接受</button><button onClick={()=>respondConn(c.id,"reject")} style={sd}>拒绝</button></div>}
            </div>
          ))}

          {orders.length > 0 && (
            <div style={{marginTop:24}}>
              <h3>定向派单</h3>
              {orders.map((o:any)=>(
                <div key={o.id} style={card}>
                  <div style={{display:"flex",justifyContent:"space-between"}}><strong>{o.order_no} - {o.title}</strong><span style={tag(o.status)}>{o.status}</span></div>
                  <p style={{fontSize:13,margin:"4px 0",color:"#475569"}}>{o.amount} THB | 商家: {o.client_username||`#${o.client_id}`}</p>
                  {o.review_note && <p style={{fontSize:12,color:"#b91c1c"}}>驳回原因: {o.review_note}</p>}
                  {o.influencer_response==="pending" && (
                    <div style={{marginTop:8,display:"flex",gap:8}}>
                      <button onClick={()=>respondOrder(o.id,"accept")} style={sp}>接受</button>
                      <button onClick={()=>{const r=prompt("拒绝原因（必填）");if(r)respondOrder(o.id,"reject",r)}} style={sd}>拒绝</button>
                    </div>
                  )}
                  {o.influencer_response==="accepted" && (
                    <button onClick={()=>nav(`/influencer/vertical-connections/orders/${o.id}`)} style={{...sp,marginTop:8}}>查看详情/提交作品</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
const tag = (s: string): React.CSSProperties => ({ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: ({active:"#166534",expired:"#b91c1c",pending:"#92400e",rejected:"#64748b",submitted:"#1d4ed8",completed:"#166534"}[s]||"#f1f5f9")+"22", color: {active:"#166534",expired:"#b91c1c",pending:"#92400e",rejected:"#64748b",submitted:"#1d4ed8",completed:"#166534"}[s]||"#475569" });
