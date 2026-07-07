import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../fetchWithAuth";

type Conn = any;
export default function AdminVCConnectionsPage() {
  const nav = useNavigate();
  const [list, setList] = useState<Conn[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [stats, setStats] = useState<any>({});

  const load = async () => {
    setLoading(true);
    try {
      const r1 = await fetchWithAuth("/api/admin/connections");
      setList(((await r1.json()).list || []));
      const r2 = await fetchWithAuth("/api/admin/connections/stats");
      setStats(await r2.json());
    } catch(e:any){setErr(e.message)} finally{setLoading(false)};
  };
  useEffect(()=>{load();},[]);

  const intervene = async (id: number, status: string) => {
    await fetchWithAuth(`/api/admin/connections/${id}`, { method: "PATCH", headers: {"Content-Type":"application/json"}, body: JSON.stringify({status}) });
    load();
  };

  return (
    <div>
      <button onClick={()=>nav("/admin/vertical-connections")} style={sb}>← 返回概览</button>
      <h2>建联记录管理</h2>
      {err && <p style={{color:"#c00"}}>{err}</p>}
      <div style={{display:"flex",gap:16,marginBottom:12}}>
        <div style={statCard}>总建联数<br/><strong>{stats.total||0}</strong></div>
        <div style={statCard}>活跃数<br/><strong>{stats.active||0}</strong></div>
      </div>
      {loading ? <p>加载中...</p> : list.map((c:any)=>(
        <div key={c.id} style={card}>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <strong>{c.client_username||`商家#${c.client_id}`} ↔ {c.influencer_username||`达人#${c.influencer_id}`}</strong>
            <span style={tag(c.status)}>{c.status}</span>
          </div>
          <p style={sm}>类目: {c.category} | 等级: {c.grade||"-"} | 有效期: {c.start_date} ~ {c.end_date}</p>
          {c.brief && <p style={sm}>简述: {c.brief}</p>}
          <div style={{marginTop:8,display:"flex",gap:6}}>
            {["active","expired","rejected"].map(s => s !== c.status ? <button key={s} onClick={()=>intervene(c.id,s)} style={ssm}>{s==="active"?"标记建联中":s==="expired"?"标记已到期":"标记已拒绝"}</button> : null)}
          </div>
        </div>
      ))}
    </div>
  );
}
const sb: React.CSSProperties = { padding: "6px 12px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer", marginBottom: 8 };
const card: React.CSSProperties = { background: "#fff", borderRadius: 10, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 8 };
const sm: React.CSSProperties = { fontSize: 12, color: "#64748b", margin: "2px 0" };
const ssm: React.CSSProperties = { padding: "4px 8px", border: "1px solid #dbe1ea", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 11 };
const statCard: React.CSSProperties = { background: "#fff", padding: "12px 20px", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", textAlign: "center" };
const tag = (s: string): React.CSSProperties => ({ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: ({active:"#166534",expired:"#b91c1c",pending:"#92400e",rejected:"#64748b"}[s]||"#f1f5f9")+"22", color: {active:"#166534",expired:"#b91c1c",pending:"#92400e",rejected:"#64748b"}[s]||"#475569" });
