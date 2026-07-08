import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../fetchWithAuth";

export default function AdminVCConnectionsPage() {
  const nav = useNavigate();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [stats, setStats] = useState<any>({});
  const [filter, setFilter] = useState({ status: "", category: "", dateFrom: "", dateTo: "", expiring: false });

  const load = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filter.status) p.set("status", filter.status);
      if (filter.expiring) p.set("expiring", "3");
      const r1 = await fetchWithAuth(`/api/admin/connections?${p}`);
      const r2 = await fetchWithAuth("/api/admin/connections/stats");
      setList(((await r1.json()).list || []));
      setStats(await r2.json());
    } catch(e:any){setErr(e.message)} finally{setLoading(false)};
  };
  useEffect(()=>{load();},[]);

  const [intNote, setIntNote] = useState("");
  const [intTarget, setIntTarget] = useState<number|0>(0);
  const intervene = async (id: number, status: string) => {
    if (!intNote.trim()) { alert("干预操作必须填写备注"); return; }
    await fetchWithAuth(`/api/admin/connections/${id}`, { method: "PATCH", headers: {"Content-Type":"application/json"}, body: JSON.stringify({status, intervention_note: intNote}) });
    setIntTarget(0); setIntNote(""); load();
  };

  const exportCSV = () => {
    const headers = ["ID","商家","达人编号","类目","等级","状态","创建时间","到期时间"];
    const rows = list.map((c:any) => [c.id, c.client_username||"", c.influencer_code||"", c.category, c.grade||"", c.status, c.created_at, c.end_date].join(","));
    const csv = "﻿" + headers.join(",") + "\n" + rows.join("\n");
    const blob = new Blob([csv], {type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "connections.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const cards = [
    { label: "总建联数", value: stats.total||0, bg: "#dbeafe", color: "#1d4ed8" },
    { label: "活跃建联", value: stats.active||0, bg: "#dcfce7", color: "#166534" },
    { label: "本月新增", value: stats.monthly_new||0, bg: "#fef3c7", color: "#92400e" },
    { label: "即将到期", value: stats.expiring||0, bg: "#fee2e2", color: "#b91c1c" },
  ];

  return (
    <div>
      <button onClick={()=>nav("/admin/vertical-connections")} style={sb}>← 返回概览</button>
      <h2 style={{margin:0}}>建联记录管理</h2>
      {err && <p style={{color:"#c00"}}>{err}</p>}

      {/* Stats */}
      <div style={{display:"flex",gap:10,margin:"12px 0",flexWrap:"wrap"}}>
        {cards.map(c=>(
          <div key={c.label} style={{background:c.bg,borderRadius:8,padding:"10px 18px",flex:1,minWidth:100}}>
            <div style={{fontSize:24,fontWeight:800,color:c.color}}>{c.value}</div>
            <div style={{fontSize:12,color:c.color}}>{c.label}</div>
          </div>
        ))}
        <button onClick={exportCSV} style={{...sb,background:"#1d4ed8",color:"#fff",border:"none",fontWeight:700}}>导出 CSV</button>
      </div>

      {/* Category distribution */}
      {stats.byCategory && stats.byCategory.length > 0 && (
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
          {(stats.byCategory||[]).slice(0,10).map((c:any)=>(
            <span key={c.category} style={{background:"#f1f5f9",padding:"3px 10px",borderRadius:999,fontSize:12,color:"#475569"}}>{c.category}: <strong>{c.c}</strong></span>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <select value={filter.status} onChange={e=>setFilter(f=>({...f,status:e.target.value}))} style={si}>
          <option value="">全部状态</option>
          <option value="pending">待确认</option><option value="active">建联中</option><option value="expired">已到期</option><option value="rejected">已拒绝</option>
        </select>
        <input type="date" value={filter.dateFrom} onChange={e=>setFilter(f=>({...f,dateFrom:e.target.value}))} style={si} placeholder="开始日期" />
        <input type="date" value={filter.dateTo} onChange={e=>setFilter(f=>({...f,dateTo:e.target.value}))} style={si} placeholder="结束日期" />
        <label style={{fontSize:12,cursor:"pointer"}}><input type="checkbox" checked={filter.expiring} onChange={e=>setFilter(f=>({...f,expiring:e.target.checked}))} /> 即将到期(3天)</label>
        <button onClick={load} style={sb}>搜索</button>
      </div>

      {loading ? <p style={{color:"#64748b",textAlign:"center",padding:40}}>加载中...</p> : list.length===0 ? <p style={{color:"#64748b",textAlign:"center",padding:40}}>暂无建联记录</p> : list.map((c:any)=>(
        <div key={c.id} style={card}>
          <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap"}}>
            <div>
              <strong>{c.client_username||`商家#${c.client_id}`} ↔ {c.influencer_username||c.influencer_code||`达人#${c.influencer_id}`}</strong>
              <span style={{marginLeft:8,fontSize:13,color:"#64748b"}}>{c.category} | {c.grade||"-"}</span>
            </div>
            <span style={tg(c.status)}>{c.status==="pending"?"待确认":c.status==="active"?"建联中":c.status==="expired"?"已到期":c.status==="rejected"?"已拒绝":c.status}</span>
          </div>
          <p style={sm}>{c.start_date} ~ {c.end_date} | 续约{c.renewal_count||0}次</p>
          {c.brief && <p style={sm}>简述: {c.brief}</p>}
          <div style={{marginTop:8,display:"flex",gap:6}}>
            {intTarget===c.id ? <div style={{display:"flex",gap:4,width:"100%"}}><input placeholder="干预备注(必填)" value={intNote} onChange={e=>setIntNote(e.target.value)} style={{flex:1,padding:"4px 8px",border:"1px solid #dbe1ea",borderRadius:4,fontSize:11}} />{["active","expired","rejected"].filter(s=>s!==c.status).map(s=><button key={s} onClick={()=>{setIntTarget(c.id);setIntNote("");}} style={ssm}>{s==="active"?"标记建联中":s==="expired"?"标记已到期":"标记已拒绝"}</button>)}<button onClick={()=>setIntTarget(0)} style={{...ssm,color:"#b91c1c"}}>取消</button></div> : ["active","expired","rejected"].filter(s=>s!==c.status).map(s=>(
              <button key={s} onClick={()=>{setIntTarget(c.id);setIntNote("");}} style={ssm}>{s==="active"?"标记建联中":s==="expired"?"标记已到期":"标记已拒绝"}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
const sb: React.CSSProperties = { padding: "6px 12px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer" };
const si: React.CSSProperties = { padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: 8 };
const card: React.CSSProperties = { background: "#fff", borderRadius: 10, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 8 };
const sm: React.CSSProperties = { fontSize: 12, color: "#64748b", margin: "2px 0" };
const ssm: React.CSSProperties = { padding: "4px 8px", border: "1px solid #dbe1ea", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 11 };
const tg = (s: string): React.CSSProperties => {
  const c: Record<string,{bg:string;text:string}> = { active:{bg:"#dcfce7",text:"#166534"}, expired:{bg:"#f1f5f9",text:"#64748b"}, pending:{bg:"#fef3c7",text:"#92400e"}, rejected:{bg:"#fee2e2",text:"#b91c1c"} };
  const v = c[s]||{bg:"#f1f5f9",text:"#475569"};
  return { display:"inline-block",padding:"2px 10px",borderRadius:999,fontSize:11,fontWeight:700,background:v.bg,color:v.text };
};
