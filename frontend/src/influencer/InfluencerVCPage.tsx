import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../fetchWithAuth";

export default function InfluencerVCPage() {
  const nav = useNavigate();
  const [tab, setTab] = useState("pending");
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [rejectId, setRejectId] = useState<number|0>(0);
  const [rejectReason, setRejectReason] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetchWithAuth(`/api/influencer/connections?tab=${tab}`);
      setList(((await r.json()).list || []));
    } catch(e:any){setErr(e.message)} finally{setLoading(false)};
  };
  useEffect(()=>{load();},[tab]);

  const respond = async (id: number, action: string) => {
    if (action==="accept" && !confirm("确认接受该建联邀请？")) return;
    const body: any = { action };
    if (action === "reject") body.reject_reason = rejectReason;
    await fetchWithAuth(`/api/influencer/connections/${id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
    if (action==="accept") { setMsg("✅ 已接受建联邀请，等待商家派单"); setTimeout(()=>{setTab("active");setMsg("");},800); }
    else { setRejectId(0); setRejectReason(""); setMsg("已拒绝该邀请"); setTab("rejected"); }
  };

  const counts = { pending: list.filter(c=>c.status==="pending").length };
  const tabs = ["pending","active","rejected","expired"];
  const tabLabels: Record<string,string> = { pending:"待处理", active:"建联中", rejected:"已拒绝", expired:"已到期" };
  const filtered = list;

  return (
    <div>
      <h2 style={{marginTop:0}}>建联邀请</h2>
      {msg && <p style={{color:"#166534",fontWeight:700}}>{msg}</p>}
      {err && <p style={{color:"#c00"}}>{err}</p>}

      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {tabs.map(t=>{
          const badge = t==="pending" && counts.pending > 0 ? ` (${counts.pending})` : "";
          return <button key={t} onClick={()=>{setTab(t);setRejectId(0);setMsg("");}} style={{...tabStyle,background:tab===t?"var(--xt-accent)":"#fff",color:tab===t?"#fff":"#334155",fontWeight:tab===t?700:400}}>{tabLabels[t]}{badge}</button>;
        })}
      </div>

      {loading ? <p>加载中...</p> : filtered.length===0 ? (
        <p style={{color:"#94a3b8",textAlign:"center",padding:40}}>还没有建联邀请，完善资料后等待商家联系你</p>
      ) : filtered.map((c:any)=>(
        <div key={c.id} style={card}>
          <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap"}}>
            <div>
              <strong>{c.client_username||`商家#${c.client_id}`}</strong>
              <span style={{marginLeft:8,fontSize:13,color:"#64748b"}}>{c.category} | {c.grade||"-"}</span>
            </div>
            <span style={tg(c.status)}>{tabLabels[c.status]||c.status}</span>
          </div>
          {c.brief && <p style={{fontSize:13,margin:"4px 0",color:"#475569"}}>合作简述: {c.brief}</p>}
          {c.budget && <p style={{fontSize:13,margin:0,color:"#64748b"}}>预算: {c.budget}</p>}

          {c.status==="pending" && (
            <div style={{marginTop:8,display:"flex",gap:8}}>
              <button onClick={()=>respond(c.id,"accept")} style={btnAcc}>接受</button>
              <button onClick={()=>{setRejectId(c.id);setRejectReason("");}} style={btnRej}>拒绝</button>
              {rejectId===c.id && (
                <div style={{display:"flex",gap:4,flex:1}}>
                  <input placeholder="拒绝原因（必填）" value={rejectReason} onChange={e=>setRejectReason(e.target.value)} style={{flex:1,padding:"6px 8px",border:"1px solid #dbe1ea",borderRadius:8}} autoFocus />
                  <button onClick={()=>respond(c.id,"reject")} disabled={!rejectReason.trim()} style={{...btnRej,opacity:rejectReason.trim()?1:0.5}}>确认</button>
                </div>
              )}
            </div>
          )}
          {c.status==="active" && <p style={{fontSize:12,color:"#166534",marginTop:8}}>⏳ 等待商家派单</p>}
          {c.status==="rejected" && c.reject_reason && <p style={{fontSize:12,color:"#b91c1c",marginTop:4}}>拒绝原因: {c.reject_reason}</p>}
        </div>
      ))}
    </div>
  );
}
const card: React.CSSProperties = { background:"#fff",borderRadius:10,padding:14,boxShadow:"0 1px 3px rgba(0,0,0,0.08)",marginBottom:8 };
const tabStyle: React.CSSProperties = { padding:"6px 14px",border:"1px solid #dbe1ea",borderRadius:8,cursor:"pointer",fontSize:13 };
const btnAcc: React.CSSProperties = { padding:"6px 16px",border:"none",borderRadius:8,background:"var(--xt-accent)",color:"#fff",cursor:"pointer",fontSize:13 };
const btnRej: React.CSSProperties = { padding:"6px 16px",border:"1px solid #fecaca",borderRadius:8,background:"#fff",color:"#b91c1c",cursor:"pointer",fontSize:13 };
const tg = (s: string): React.CSSProperties => {
  const c: Record<string,{bg:string;text:string}> = { pending:{bg:"#fef3c7",text:"#92400e"}, active:{bg:"#dcfce7",text:"#166534"}, rejected:{bg:"#fee2e2",text:"#b91c1c"}, expired:{bg:"#f1f5f9",text:"#64748b"} };
  const v = c[s]||{bg:"#f1f5f9",text:"#475569"};
  return { display:"inline-block",padding:"2px 10px",borderRadius:999,fontSize:11,fontWeight:700,background:v.bg,color:v.text };
};
