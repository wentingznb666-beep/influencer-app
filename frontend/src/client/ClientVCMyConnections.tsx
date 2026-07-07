import { Component, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../fetchWithAuth";

class ErrorBoundary extends Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: any) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <div style={{padding:40,textAlign:"center"}}><h3 style={{color:"#b91c1c"}}>页面加载异常</h3><p style={{color:"#64748b"}}>请刷新页面重试</p><button onClick={()=>this.setState({hasError:false})} style={{padding:"8px 16px",border:"1px solid #dbe1ea",borderRadius:8,background:"#fff",cursor:"pointer"}}>重试</button></div>;
    return this.props.children;
  }
}

function ClientVCMyConnections() {
  const nav = useNavigate();
  const [tab, setTab] = useState("");
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = async (t: string) => {
    setLoading(true);
    try { const r = await fetchWithAuth(`/api/client/connections?tab=${t}`); setList((await r.json()).list || []); }
    catch(e:any){setErr(e.message)} finally{setLoading(false)};
  };
  useEffect(()=>{load(tab);},[tab]);

  const renew = async (id: number) => {
    await fetchWithAuth(`/api/client/connections/${id}/renew`, {method:"POST"});
    load(tab); setMsg("已续约30天");
  };

  const daysLeft = (end: string) => Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / 86400000));

  return (
    <div>
      <button onClick={()=>nav("/client/vertical-connections")} style={sb}>← 返回建联首页</button>
      <h2 style={{marginTop:0}}>我的建联列表</h2>
      {msg && <p style={{color:"#166534"}}>{msg}</p>}
      {err && <p style={{color:"#c00"}}>{err}</p>}
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        {["","pending","active","expired"].map(t=>{
    let label = t===""?"全部":t==="pending"?"待确认":t==="active"?"建联中":"已到期";
    return <button key={t||"all"} onClick={()=>setTab(t)} style={{...st,background:tab===t?"var(--xt-accent)":"#fff",color:tab===t?"#fff":"#334155"}}>{label}</button>;
  })}
      </div>
      {loading ? <p>加载中...</p> : (list?.length||0)===0 ? <p style={{color:"#64748b"}}>暂无记录</p> : (list||[]).map((c:any)=>(
        <div key={c?.id} style={card}>
          <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap"}}>
            <strong>{c?.influencer_code||c?.influencer_username||`达人#${c?.influencer_id}`}</strong>
            <span style={tag(c?.status)}>{c?.status==="pending"?"待确认":c?.status==="active"?"建联中":c?.status==="expired"?"已到期":c?.status||"—"}</span>
          </div>
          <p style={{fontSize:13,color:"#475569",margin:"4px 0"}}>类目: {c?.category||"—"} | 等级: {c?.grade||"—"} | 剩余 {daysLeft(c?.end_date)} 天</p>
          {c?.brief && <p style={{fontSize:13,margin:0}}>简述: {c.brief}</p>}
          <div style={{marginTop:8,display:"flex",gap:8}}>
            {c?.status==="active" && <button onClick={()=>nav(`/client/vertical-connections/create-order/${c.id}?influencer=${c.influencer_id}`)} style={sp}>定向派单</button>}
            {c?.status==="active" && <button onClick={()=>renew(c.id)} style={sb}>续约</button>}
            {c?.status==="expired" && <span style={{color:"#b91c1c",fontSize:12}}>请先续约再派单</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
const sb: React.CSSProperties = { padding: "6px 12px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer" };
const sp: React.CSSProperties = { padding: "6px 14px", border: "none", borderRadius: 8, background: "var(--xt-accent)", color: "#fff", cursor: "pointer", fontSize: 13 };
const st: React.CSSProperties = { padding: "6px 14px", border: "1px solid #dbe1ea", borderRadius: 8, cursor: "pointer", fontSize: 13 };
const card: React.CSSProperties = { background: "#fff", borderRadius: 10, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 8 };
const tag = (s?: string): React.CSSProperties => ({ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: ({active:"#166534",expired:"#b91c1c"}[s||""]||"#f1f5f9")+"22", color: {active:"#166534",expired:"#b91c1c"}[s||""]||"#475569" });

export default function ClientVCMyConnectionsWithErrorBoundary() {
  return <ErrorBoundary><ClientVCMyConnections /></ErrorBoundary>;
}
