import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../fetchWithAuth";

export default function InfluencerVCHome() {
  const nav = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ pendingConns:0, pendingOrders:0, activeConns:0, needRevise:0, completed:0 });
  const [needSubmit, setNeedSubmit] = useState(0);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileIncomplete, setProfileIncomplete] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [rp, rc, ro, rm] = await Promise.all([
          fetchWithAuth("/api/influencer/profile"),
          fetchWithAuth("/api/influencer/connections"),
          fetchWithAuth("/api/influencer/connection-orders"),
          fetchWithAuth("/api/matching/messages"),
        ]);
        const p = await rp.json();
        if (!p) { setProfileIncomplete(true); setLoading(false); return; }
        // Check profile completeness
        const requiredFields = ["influencer_code","source","followers","category","quoted_price","cooperation_conditions","gmv_sales","monthly_cart_videos","units_sold","live_sales","weekly_live_count","avg_live_hours_per_week"];
        const missing = requiredFields.filter((f: string) => { const v = p[f]; return v === null || v === undefined || v === '' || (typeof v === 'string' && v.trim() === ''); });
        setProfile(p);
        setProfileIncomplete(missing.length > 0);
        const conns = ((await rc.json()).list || []);
        const orders = ((await ro.json()).list || []);
        setStats({
          pendingConns: conns.filter((c:any)=>c.status==="pending").length,
          pendingOrders: orders.filter((o:any)=>o.influencer_response==="pending").length,
          activeConns: conns.filter((c:any)=>c.status==="active").length,
          needRevise: orders.filter((o:any)=>o.review_status==="rejected").length,
          completed: orders.filter((o:any)=>o.payment_status==="paid").length,
        });
        setNeedSubmit(orders.filter((o:any)=>o.influencer_response==="accepted"&&!o.submission_content&&o.review_status!=="rejected").length);
        // Recent unread messages (VC related)
        const msgs = ((await rm.json()).list || []).filter((m:any)=>!m.is_read && (m.category?.startsWith("connection")||false)).slice(0,3);
        setMessages(msgs);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const statCards = [
    { label: "待处理邀请", value: stats.pendingConns, bg: "#fef3c7", text: "#92400e" },
    { label: "待提交作品", value: needSubmit, bg: "#dbeafe", text: "#1d4ed8" },
    { label: "需要修改", value: stats.needRevise, bg: "#fee2e2", text: "#b91c1c" },
    { label: "已完成", value: stats.completed, bg: "#dcfce7", text: "#166534" },
  ];

  // Context-aware guide card
  const guideCard = () => {
    if (profileIncomplete) return { icon:"📝", text:"请先完善个人资料", action:"去填写", to:"/influencer/vertical-connections/profile", bg:"#fef3c7", color:"#92400e" };
    if (stats.pendingConns > 0) return { icon:"📨", text:`您有 ${stats.pendingConns} 个新的建联邀请待处理`, action:"查看邀请", to:"/influencer/vertical-connections/invitations?tab=pending", bg:"#fef3c7", color:"#92400e" };
    if (stats.pendingOrders > 0) return { icon:"📤", text:`您有 ${stats.pendingOrders} 个派单待回应`, action:"查看派单", to:"/influencer/vertical-connections/orders", bg:"#dbeafe", color:"#1d4ed8" };
    if (stats.needRevise > 0) return { icon:"🔧", text:`您有 ${stats.needRevise} 个订单需要修改重提`, action:"去修改", to:"/influencer/vertical-connections/orders", bg:"#fee2e2", color:"#b91c1c" };
    if (stats.activeConns === 0) return { icon:"🎉", text:"资料已完善，等待商家邀请", action:"去设置收款方式", to:"/influencer/vertical-connections/payment", bg:"#dcfce7", color:"#166534" };
    return { icon:"👋", text:"欢迎回来", action:"查看建联", to:"/influencer/vertical-connections/invitations", bg:"#f1f5f9", color:"#475569" };
  };
  const guide = guideCard();

  if (loading) return <p>加载中...</p>;

  return (
    <div>
      <h2 style={{marginTop:0}}>达人合作中心</h2>

      {/* Profile card */}
      {profile && (
        <div style={{background:"#fff",borderRadius:12,padding:14,marginBottom:16,boxShadow:"0 1px 3px rgba(0,0,0,0.08)",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <span style={{fontSize:28}}>👤</span>
          <div style={{flex:1}}>
            <strong>{profile.influencer_code}</strong>
            <span style={{marginLeft:8,fontSize:13,color:"#64748b"}}>{profile.category} | {profile.grade||"未评级"}</span>
            {profile.quoted_price && <span style={{marginLeft:8,fontSize:13,color:"var(--xt-accent)",fontWeight:700}}>{profile.quoted_price} THB</span>}
          </div>
          <button onClick={()=>nav("/influencer/vertical-connections/profile")} style={{padding:"6px 14px",border:"1px solid var(--xt-accent)",borderRadius:8,background:"#fff",color:"var(--xt-accent)",cursor:"pointer",fontSize:13}}>编辑资料</button>
        </div>
      )}

      {/* Guide card */}
      <div onClick={()=>nav(guide.to)} style={{background:guide.bg,borderRadius:12,padding:16,marginBottom:16,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:24}}>{guide.icon}</span>
        <div style={{flex:1,fontSize:14,fontWeight:600,color:guide.color}}>{guide.text}</div>
        <span style={{fontSize:13,color:guide.color,fontWeight:700}}>{guide.action} →</span>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(130px, 1fr))",gap:10,marginBottom:20}}>
        {statCards.map(c=>(
          <div key={c.label} style={{background:c.bg,borderRadius:12,padding:14,textAlign:"center"}}>
            <div style={{fontSize:28,fontWeight:800,color:c.text}}>{c.value}</div>
            <div style={{fontSize:12,color:c.text,marginTop:4}}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Recent notifications */}
      <div style={{background:"#fff",borderRadius:12,padding:14,boxShadow:"0 1px 3px rgba(0,0,0,0.08)",marginBottom:16}}>
        <h3 style={{margin:0,fontSize:14,color:"#475569"}}>📬 最近通知</h3>
        {messages.length === 0 ? (
          <p style={{color:"#94a3b8",fontSize:13,margin:"8px 0 0"}}>暂无新消息</p>
        ) : messages.map((m:any)=>(
          <div key={m.id} onClick={()=>{if(m.link)nav(m.link);}} style={{padding:"8px 0",borderBottom:"1px solid #f1f5f9",cursor:m.link?"pointer":"default",fontSize:13,color:"#334155"}}>
            <strong>{m.title}</strong>
            <span style={{marginLeft:8,color:"#64748b",fontSize:12}}>{m.content}</span>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button onClick={()=>nav("/influencer/vertical-connections/invitations")} style={btn}>📨 建联邀请</button>
        <button onClick={()=>nav("/influencer/vertical-connections/orders")} style={btn}>📋 我的派单</button>
        <button onClick={()=>nav("/influencer/vertical-connections/payment")} style={btn}>💳 收款设置</button>
      </div>
    </div>
  );
}
const btn: React.CSSProperties = { padding:"8px 16px",border:"1px solid #dbe1ea",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:13 };
