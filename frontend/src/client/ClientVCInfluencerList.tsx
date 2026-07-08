import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchWithAuth } from "../fetchWithAuth";
type Inf = any;
export default function ClientVCInfluencerList() {
  const nav = useNavigate(); const params = useParams();
  const category = decodeURIComponent(params.id || "");
  const [list, setList] = useState<Inf[]>([]);
  const [loading, setLoading] = useState(true);
  const [grade, setGrade] = useState("");
  const [sort, setSort] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ category });
      if (grade) q.set("grade", grade);
      if (sort) q.set("sort", sort);
      const r = await fetchWithAuth(`/api/client/influencers?${q}`);
      setList(((await r.json()).list || []));
    } catch {} finally { setLoading(false); }
  };
    const [existingConns, setExistingConns] = useState<Set<number>>(new Set());
  useEffect(()=>{load();}, [grade, sort]);
  useEffect(()=>{
    (async()=>{
      try{const r=await fetchWithAuth("/api/client/connections");const d=await r.json();
      const ids=new Set<number>();(d.list||[]).forEach((c:any)=>{if(c.status==="pending"||c.status==="active")ids.add(c.influencer_profile_id);});
      setExistingConns(ids);}catch{}
    })();
  }, []);

  return (
    <div>
      <button onClick={()=>nav("/client/vertical-connections/market")} style={{ padding: "6px 12px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer", marginBottom: 8 }}>← 返回类目列表</button>
      <h2 style={{ marginTop: 0 }}>{category} - 达人列表</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <select value={grade} onChange={e=>setGrade(e.target.value)} style={{ padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: 8 }}>
          <option value="">全部等级</option>{["A+","B+","C+","A","B","C"].map(g=><option key={g} value={g}>{g}</option>)}
        </select>
        <select value={sort} onChange={e=>setSort(e.target.value)} style={{ padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: 8 }}>
          <option value="">默认排序</option><option value="followers_desc">粉丝数降序</option><option value="gmv_desc">GMV降序</option>
        </select>
      </div>
      const [compareIds, setCompareIds] = useState<Set<number>>(new Set());
  const [showCompare, setShowCompare] = useState(false);
  const toggleCompare = (id: number) => { setCompareIds(p=>{const n=new Set(p); n.has(id)?n.delete(id):(n.size<3?n.add(id):null); return n;}); };
  const compareList = list.filter((inf:any)=>compareIds.has(inf.id));
  
  <div style={{marginBottom:8}}>
    {compareIds.size > 0 && <button onClick={()=>setShowCompare(true)} style={{padding:"6px 12px",border:"1px solid var(--xt-accent)",borderRadius:8,background:"#fff",color:"var(--xt-accent)",cursor:"pointer",fontWeight:600}}>对比已选({compareIds.size})</button>}
  </div>
  {showCompare && compareList.length > 0 && (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}} onClick={()=>setShowCompare(false)}>
      <div style={{background:"#fff",borderRadius:12,padding:20,maxWidth:700,width:"90%",maxHeight:"80vh",overflow:"auto"}} onClick={e=>e.stopPropagation()}>
        <h3 style={{marginTop:0}}>达人对比</h3>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr>{{["字段",""].concat(compareList.map((i:any)=>i.influencer_code)).map((h:string,i:number)=><th key={i} style={{padding:"6px 8px",borderBottom:"1px solid #e2e8f0",textAlign:"left"}}>{h}</th>)}}</tr></thead>
          <tbody>
            {[["等级","grade"],["报价","quoted_price"],["GMV","gmv_sales"],["销量","units_sold"],["直播销售","live_sales"],["周直播","weekly_live_count"],["直播时长","avg_live_hours_per_week"]].map(([label,field]:any)=>(
              <tr key={field}>{{[label].concat(compareList.map((i:any)=>i[field]||"-")).map((v:string,j:number)=><td key={j} style={{padding:"6px 8px",borderBottom:"1px solid #f1f5f9"}}>{v}</td>)}}</tr>
            ))}
          </tbody>
        </table>
        <button onClick={()=>setShowCompare(false)} style={{marginTop:12,padding:"6px 14px",border:"1px solid #dbe1ea",borderRadius:8,background:"#fff",cursor:"pointer"}}>关闭</button>
      </div>
    </div>
  )}
  {loading ? <p>加载中...</p> : list.length === 0 ? <p style={{color:"#64748b"}}>该类目下暂无有等级的达人</p> : list.map((inf:any)=>(
        <div key={inf.id} style={{ background: "#fff", borderRadius: 10, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 8, display:"flex",gap:8 }}>
            <input type="checkbox" checked={compareIds.has(inf.id)} onChange={()=>toggleCompare(inf.id)} style={{width:16,height:16,marginTop:2,flexShrink:0}} />
            <div style={{flex:1}}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap" }}>
            <strong>{inf.influencer_code}</strong>
            <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "#04785722", color: "#047857" }}>{inf.grade}</span>
          </div>
          <div style={{ marginTop: 4, padding: "6px 8px", background: "#fffbeb", borderRadius: 6, border: "1px solid #fde68a" }}>
            <div style={{ fontWeight: 700, color: "#92400e", fontSize: 13 }}>报价: {inf.quoted_price ? `${inf.quoted_price} THB` : "未设置"}</div>
            {inf.cooperation_conditions && <div style={{ fontSize: 12, color: "#78716c", marginTop: 2 }}>{inf.cooperation_conditions}</div>}
          </div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 4, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            <span>粉丝: {inf.followers||"-"}</span><span>GMV: {inf.gmv_sales||"-"}</span>
            <span>挂车视频/月: {inf.monthly_cart_videos||"-"}</span><span>销量: {inf.units_sold||"-"}</span>
            <span>可直播: {inf.can_live?"是":"否"}</span><span>直播销售: {inf.live_sales||"-"}</span>
            <span>周直播次数: {inf.weekly_live_count||"-"}</span><span>直播时长: {inf.avg_live_hours_per_week||"-"}</span>
          </div>
          {inf.remark && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>备注: {inf.remark}</div>}
          <button onClick={()=>nav(`/client/vertical-connections/market/invite/${inf.id}?category=${encodeURIComponent(category)}&code=${inf.influencer_code}&grade=${inf.grade||""}`)} style={{ padding: "6px 14px", border: "none", borderRadius: 8, background: "var(--xt-accent)", color: "#fff", cursor: "pointer", fontSize: 13, marginTop: 8 }}>发起邀请</button>
        </div>
      ))}
    </div>
  );
}