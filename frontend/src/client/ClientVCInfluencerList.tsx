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
  useEffect(()=>{load();}, [grade, sort]);

  return (
    <div>
      <button onClick={()=>nav("/client/vertical-connections")} style={{ padding: "6px 12px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer", marginBottom: 8 }}>← 返回类目列表</button>
      <h2 style={{ marginTop: 0 }}>{category} - 达人列表</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <select value={grade} onChange={e=>setGrade(e.target.value)} style={{ padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: 8 }}>
          <option value="">全部等级</option>{["A+","B+","C+","A","B","C"].map(g=><option key={g} value={g}>{g}</option>)}
        </select>
        <select value={sort} onChange={e=>setSort(e.target.value)} style={{ padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: 8 }}>
          <option value="">默认排序</option><option value="followers_desc">粉丝数降序</option><option value="gmv_desc">GMV降序</option>
        </select>
      </div>
      {loading ? <p>加载中...</p> : list.length === 0 ? <p style={{color:"#64748b"}}>该类目下暂无有等级的达人</p> : list.map((inf:any)=>(
        <div key={inf.id} style={{ background: "#fff", borderRadius: 10, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 8 }}>
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
          <button onClick={()=>nav(`/client/vertical-connections/invite/${inf.id}?category=${encodeURIComponent(category)}&code=${inf.influencer_code}&grade=${inf.grade||""}`)} style={{ padding: "6px 14px", border: "none", borderRadius: 8, background: "var(--xt-accent)", color: "#fff", cursor: "pointer", fontSize: 13, marginTop: 8 }}>发起邀请</button>
        </div>
      ))}
    </div>
  );
}