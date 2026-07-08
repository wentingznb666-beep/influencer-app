import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../fetchWithAuth";

export default function GradeConfigPage() {
  const nav = useNavigate();
  const [counts, setCounts] = useState<Record<string,number>>({});
  const defaults = { a_gmv:"100000",a_units:"1000",b_gmv:"10000",b_units:"100",c_gmv:"3000",c_units:"10",live_pct:"50",live_weekly:"7" };
  const [form, setForm] = useState(() => {
    try {
      const saved = localStorage.getItem("vc_grade_thresholds");
      if (saved) return { ...defaults, ...JSON.parse(saved) };
    } catch {}
    return defaults;
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetchWithAuth("/api/admin/influencer-profiles/dashboard");
        const d = await r.json();
        setCounts({ total: d.total_profiles||0, active: d.active_profiles||0, ungraded: d.ungraded||0 });
      } catch {}
    })();
  }, []);

  const gradeRules = [
    { grade:"A+", gmv:"≥"+form.a_gmv, units:"≥"+form.a_units, live:"≥"+form.live_pct+"%", weekly:"≥"+form.live_weekly, plus:true },
    { grade:"B+", gmv:"≥"+form.b_gmv, units:"≥"+form.b_units, live:"≥"+form.live_pct+"%", weekly:"≥"+form.live_weekly, plus:true },
    { grade:"C+", gmv:"≥"+form.c_gmv, units:"≥"+form.c_units, live:"≥"+form.live_pct+"%", weekly:"≥"+form.live_weekly, plus:true },
    { grade:"A",  gmv:"≥"+form.a_gmv, units:"≥"+form.a_units, live:"—", weekly:"—", plus:false },
    { grade:"B",  gmv:"≥"+form.b_gmv, units:"≥"+form.b_units, live:"—", weekly:"—", plus:false },
    { grade:"C",  gmv:"≥"+form.c_gmv, units:"≥"+form.c_units, live:"—", weekly:"—", plus:false },
  ];

  const save = async () => {
    if (!confirm("此修改将触发重新计算全部达人等级，确认？")) return;
    setSaving(true);
    try {
      localStorage.setItem("vc_grade_thresholds", JSON.stringify(form));
      await fetchWithAuth("/api/admin/influencer-profiles/auto-grade");
      setMsg("等级配置已更新，已重新计算全部达人等级");
      setTimeout(()=>setMsg(""),3000);
    } catch(e:any) { setMsg("保存失败: "+e.message); }
    finally { setSaving(false); }
  };

  const si: React.CSSProperties = { width:80,padding:"4px 8px",border:"1px solid #dbe1ea",borderRadius:6,fontSize:12,textAlign:"center" };
  const th: React.CSSProperties = { padding:"8px 12px",textAlign:"left",borderBottom:"1px solid #e2e8f0",fontWeight:700,fontSize:12,whiteSpace:"nowrap" };
  const td: React.CSSProperties = { padding:"8px 12px",borderBottom:"1px solid #f1f5f9",fontSize:13 };

  return (
    <div>
      <button onClick={()=>nav("/admin/vertical-connections")} style={{ padding: "6px 12px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer", marginBottom: 12 }}>← 返回概览</button>
      <h2 style={{ marginTop: 0 }}>达人等级配置</h2>
      {msg && <p style={{color:msg.includes("失败")?"#c00":"#166534",fontWeight:700}}>{msg}</p>}

      {/* Summary */}
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <div style={{background:"#dbeafe",borderRadius:8,padding:"10px 18px"}}><div style={{fontSize:20,fontWeight:800,color:"#1d4ed8"}}>{counts.total||0}</div><div style={{fontSize:11,color:"#1d4ed8"}}>达人总数</div></div>
        <div style={{background:"#dcfce7",borderRadius:8,padding:"10px 18px"}}><div style={{fontSize:20,fontWeight:800,color:"#166534"}}>{counts.active||0}</div><div style={{fontSize:11,color:"#166534"}}>已评级</div></div>
        <div style={{background:"#fef3c7",borderRadius:8,padding:"10px 18px"}}><div style={{fontSize:20,fontWeight:800,color:"#92400e"}}>{counts.ungraded||0}</div><div style={{fontSize:11,color:"#92400e"}}>未达标</div></div>
      </div>

      {/* Thresholds */}
      <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 3px rgba(0,0,0,0.08)",marginBottom:16}}>
        <h3 style={{marginTop:0}}>阈值参数</h3>
        <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:16}}>
          <div><label style={{fontSize:12,color:"#64748b"}}>A级GMV阈值</label><input value={form.a_gmv} onChange={e=>setForm(f=>({...f,a_gmv:e.target.value}))} style={si} /></div>
          <div><label style={{fontSize:12,color:"#64748b"}}>A级销量阈值</label><input value={form.a_units} onChange={e=>setForm(f=>({...f,a_units:e.target.value}))} style={si} /></div>
          <div><label style={{fontSize:12,color:"#64748b"}}>B级GMV阈值</label><input value={form.b_gmv} onChange={e=>setForm(f=>({...f,b_gmv:e.target.value}))} style={si} /></div>
          <div><label style={{fontSize:12,color:"#64748b"}}>B级销量阈值</label><input value={form.b_units} onChange={e=>setForm(f=>({...f,b_units:e.target.value}))} style={si} /></div>
          <div><label style={{fontSize:12,color:"#64748b"}}>C级GMV阈值</label><input value={form.c_gmv} onChange={e=>setForm(f=>({...f,c_gmv:e.target.value}))} style={si} /></div>
          <div><label style={{fontSize:12,color:"#64748b"}}>C级销量阈值</label><input value={form.c_units} onChange={e=>setForm(f=>({...f,c_units:e.target.value}))} style={si} /></div>
          <div><label style={{fontSize:12,color:"#64748b"}}>直播占比%(PLUS)</label><input value={form.live_pct} onChange={e=>setForm(f=>({...f,live_pct:e.target.value}))} style={si} /></div>
          <div><label style={{fontSize:12,color:"#64748b"}}>周直播次数(PLUS)</label><input value={form.live_weekly} onChange={e=>setForm(f=>({...f,live_weekly:e.target.value}))} style={si} /></div>
        </div>
        <button onClick={save} disabled={saving} style={{padding:"10px 24px",border:"none",borderRadius:8,background:saving?"#94a3b8":"var(--xt-accent)",color:"#fff",cursor:saving?"not-allowed":"pointer",fontWeight:700}}>{saving?"重新计算中...":"保存并重新计算全部等级"}</button>
      </div>

      {/* Grade rules table */}
      <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 3px rgba(0,0,0,0.08)",overflowX:"auto"}}>
        <h3 style={{marginTop:0}}>等级规则表</h3>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead>
            <tr>
              <th style={th}>等级</th><th style={th}>总销售额</th><th style={th}>销量条件</th><th style={th}>直播占比</th><th style={th}>周直播次数</th><th style={th}>说明</th>
            </tr>
          </thead>
          <tbody>
            {gradeRules.map(r=>(
              <tr key={r.grade}>
                <td style={{...td,fontWeight:700,color:r.grade.includes("+")?"var(--xt-accent)":"#334155"}}>{r.grade}</td>
                <td style={td}>{r.gmv}</td><td style={td}>{r.units}</td><td style={td}>{r.live}</td><td style={td}>{r.weekly}</td>
                <td style={{...td,fontSize:12,color:"#64748b"}}>{r.plus?"满足基础+PLUS双条件":"仅满足基础条件"}</td>
              </tr>
            ))}
            <tr style={{background:"#fef3c7"}}>
              <td style={{...td,fontWeight:700,color:"#92400e"}}>未达标</td>
              <td style={td} colSpan={4}>低于GMV {form.c_gmv} 且销量不足 {form.c_units}</td>
              <td style={{...td,color:"#92400e"}}>不展示给商家</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
