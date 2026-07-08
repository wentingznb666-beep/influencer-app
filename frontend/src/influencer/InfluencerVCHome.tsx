import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../fetchWithAuth";

export default function InfluencerVCHome() {
  const nav = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ pendingConns:0, pendingOrders:0, activeConns:0, needRevise:0, completed:0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [rp, rc, ro] = await Promise.all([
          fetchWithAuth("/api/influencer/profile"),
          fetchWithAuth("/api/influencer/connections"),
          fetchWithAuth("/api/influencer/connection-orders"),
        ]);
        const p = await rp.json();
        setProfile(p);
        const conns = ((await rc.json()).list || []);
        const orders = ((await ro.json()).list || []);
        setStats({
          pendingConns: conns.filter((c:any)=>c.status==="pending").length,
          pendingOrders: orders.filter((o:any)=>o.influencer_response==="pending").length,
          activeConns: conns.filter((c:any)=>c.status==="active").length,
          needRevise: orders.filter((o:any)=>o.review_status==="rejected").length,
          completed: orders.filter((o:any)=>o.payment_status==="paid").length,
        });
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const cards = [
    { label: "待处理邀请", value: stats.pendingConns, color: "#fef3c7", text: "#92400e", to: "/influencer/vertical-connections/invitations?tab=pending" },
    { label: "新派单", value: stats.pendingOrders, color: "#dbeafe", text: "#1d4ed8", to: "/influencer/vertical-connections/orders" },
    { label: "建联中", value: stats.activeConns, color: "#dcfce7", text: "#166534", to: "/influencer/vertical-connections/invitations?tab=active" },
    { label: "需要修改", value: stats.needRevise, color: "#fee2e2", text: "#b91c1c", to: "/influencer/vertical-connections/orders" },
    { label: "已完成", value: stats.completed, color: "#dcfce7", text: "#166534", to: "/influencer/vertical-connections/orders" },
  ];

  if (loading) return <p>加载中...</p>;

  return (
    <div>
      <h2 style={{marginTop:0}}>垂直达人建联</h2>

      {/* Profile status */}
      {profile ? (
        <div style={{background:"#fff",borderRadius:12,padding:16,marginBottom:16,boxShadow:"0 1px 3px rgba(0,0,0,0.08)",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <div style={{fontSize:32}}>👤</div>
          <div style={{flex:1}}>
            <strong style={{fontSize:16}}>{profile.influencer_code}</strong>
            <span style={{marginLeft:8,fontSize:13,color:"#64748b"}}>{profile.category} | {profile.grade||"未评级"}</span>
            {profile.quoted_price && <span style={{marginLeft:8,fontSize:13,color:"var(--xt-accent)",fontWeight:700}}>{profile.quoted_price} THB</span>}
          </div>
          <button onClick={()=>nav("/influencer/vertical-connections/profile")} style={{padding:"6px 14px",border:"1px solid var(--xt-accent)",borderRadius:8,background:"#fff",color:"var(--xt-accent)",cursor:"pointer",fontSize:13}}>编辑资料</button>
        </div>
      ) : (
        <div style={{background:"#fef3c7",borderRadius:12,padding:20,marginBottom:16,textAlign:"center"}}>
          <p style={{color:"#92400e",fontWeight:700,margin:0}}>⚠️ 请先完善达人资料</p>
          <button onClick={()=>nav("/influencer/vertical-connections/profile")} style={{marginTop:8,padding:"8px 20px",border:"none",borderRadius:8,background:"var(--xt-accent)",color:"#fff",cursor:"pointer",fontWeight:700}}>去填写</button>
        </div>
      )}

      {/* Stats cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(140px, 1fr))",gap:10,marginBottom:20}}>
        {cards.map(c=>(
          <div key={c.label} onClick={()=>nav(c.to)} style={{background:c.color,borderRadius:12,padding:16,cursor:"pointer",transition:"0.2s"}}>
            <div style={{fontSize:32,fontWeight:800,color:c.text}}>{c.value}</div>
            <div style={{fontSize:13,color:c.text,marginTop:4}}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button onClick={()=>nav("/influencer/vertical-connections/invitations")} style={btn}>📨 查看建联邀请</button>
        <button onClick={()=>nav("/influencer/vertical-connections/orders")} style={btn}>📋 查看我的派单</button>
        <button onClick={()=>nav("/influencer/vertical-connections/payment")} style={btn}>💳 收款设置</button>
      </div>
    </div>
  );
}
const btn: React.CSSProperties = { padding:"8px 16px",border:"1px solid #dbe1ea",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:13 };
