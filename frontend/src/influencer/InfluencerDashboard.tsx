import { compactPx } from "../responsive";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import * as api from "../influencerApi";
import { fetchWithAuth } from "../fetchWithAuth";

/** 达人首页：简洁内容概览 + 快捷入口 */
export default function InfluencerDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [balance, setBalance] = useState<number | null>(null);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [availableTasks, setAvailableTasks] = useState(0);

  useEffect(() => {
    void loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      const [pts, tasks, myOrders] = await Promise.all([
        api.getPoints().catch(() => ({ balance: 0 })),
        api.getMarketOrders().catch(() => ({ list: [] })),
        api.getMyMarketOrders().catch(() => ({ list: [] })),
      ]);
      setBalance(typeof pts.balance === "number" ? pts.balance : 0);
      setAvailableTasks(((tasks as { list?: unknown[] }).list || []).length);
      setPendingOrders(((myOrders as { list?: unknown[] }).list || []).length);
    } catch {
      // ignore
    }
  };

const [vcProfile, setVcProfile] = useState<any>(null);
  const [vcPending, setVcPending] = useState(0);
  const [vcNeedRevise, setVcNeedRevise] = useState(0);
  const [vcCompleted, setVcCompleted] = useState(0);
  const [vcNeedSubmit, setVcNeedSubmit] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetchWithAuth("/api/influencer/connections/home-stats");
        if (!r.ok) return;
        const d = await r.json();
        setVcProfile(d.has_profile);
        setVcPending(d.pending_invites||0);
        setVcNeedRevise(d.need_revisions||0);
        setVcCompleted(d.completed||0);
        setVcNeedSubmit(d.pending_submissions||0);
      } catch {}
    })();
  }, []);

  const vcStatCard: React.CSSProperties = { borderRadius: 10, padding: "12px 16px", flex: 1, minWidth: 100, textAlign: "center" };
const vcStatNum: React.CSSProperties = { fontSize: 24, fontWeight: 800 };
const vcStatLabel: React.CSSProperties = { fontSize: 11, marginTop: 4 };

const navCards = [
    { icon: "📋", label: t("可接任务"), sub: availableTasks > 0 ? `${availableTasks} ${t("个任务")}` : t("暂无"), to: "/influencer/task-hall", color: "#2563eb" },
    { icon: "📦", label: t("我的订单"), sub: pendingOrders > 0 ? `${pendingOrders} ${t("进行中")}` : t("暂无"), to: "/influencer/client-orders", color: "#7c3aed" },
    { icon: "💰", label: t("积分余额"), sub: balance != null ? `${balance} ${t("积分")}` : "—", to: "/influencer/payment-profile", color: "#059669" },
    { icon: "👤", label: t("达人资料"), sub: t("完善信息提高接单率"), to: "/influencer/profile", color: "#d97706" },
    { icon: "🤝", label: t("合作需求"), sub: t("发布需求等商家报名"), to: "/influencer/demands", color: "#dc2626" },
    { icon: "📊", label: t("撮合广场"), sub: t("浏览商家撮合任务"), to: "/influencer/task-hall", color: "#0891b2" },
  ];

  return (
    <div>
      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
        borderRadius: compactPx(20),
        padding: `${compactPx(28)}px ${compactPx(32)}px`,
        color: "#fff",
        marginBottom: compactPx(24),
      }}>
        <div style={{ fontSize: compactPx(28), fontWeight: 800, marginBottom: compactPx(8) }}>
          {t("达人分发")}
        </div>
        <div style={{ fontSize: compactPx(15), color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>
          {t("连接优质商家，发挥创作价值。查看任务、接单赚钱、管理收益，一站式搞定。")}
        </div>
      </div>

      {/* 快捷入口 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: compactPx(14),
        marginBottom: compactPx(24),
      }}>
        {navCards.map((card) => (
          <button
            key={card.to}
            type="button"
            onClick={() => navigate(card.to)}
            style={{
              background: "#fff",
              border: "1px solid #eef2f7",
              borderRadius: compactPx(16),
              padding: `${compactPx(20)}px ${compactPx(16)}px`,
              cursor: "pointer",
              textAlign: "left",
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
              display: "flex",
              flexDirection: "column",
              gap: compactPx(8),
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 8px 24px rgba(15,23,42,0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <span style={{ fontSize: compactPx(28) }}>{card.icon}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: compactPx(15), color: "#1e293b", marginBottom: compactPx(2) }}>
                {card.label}
              </div>
              <div style={{ fontSize: compactPx(13), color: card.color, fontWeight: 600 }}>
                {card.sub}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* 达人合作中心板块 */}
      <div style={{ marginBottom: compactPx(24) }}>
        <h3 style={{ margin: `0 0 ${compactPx(12)}px`, fontSize: compactPx(16), fontWeight: 700, color: "var(--xt-primary)" }}>🤝 达人合作中心</h3>
        {/* Stats — always visible */}
        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <div style={{ ...vcStatCard, background: "#fef3c7" }}><div style={vcStatNum}>{vcPending}</div><div style={vcStatLabel}>待处理邀请</div></div>
          <div style={{ ...vcStatCard, background: "#dbeafe" }}><div style={vcStatNum}>{vcNeedSubmit||0}</div><div style={vcStatLabel}>待提交作品</div></div>
          <div style={{ ...vcStatCard, background: "#fee2e2" }}><div style={vcStatNum}>{vcNeedRevise||0}</div><div style={vcStatLabel}>需要修改</div></div>
          <div style={{ ...vcStatCard, background: "#dcfce7" }}><div style={vcStatNum}>{vcCompleted||0}</div><div style={vcStatLabel}>已完成</div></div>
        </div>
        {/* Guide card */}
        {(() => {
          if (!vcProfile) return <div onClick={()=>navigate("/influencer/vertical-connections/profile")} style={{background:"#fef3c7",borderRadius:10,padding:12,cursor:"pointer",display:"flex",alignItems:"center",gap:8,marginBottom:10,fontSize:14,fontWeight:600,color:"#92400e"}}>📝 请先完善个人资料，才能接收建联邀请 <span style={{marginLeft:"auto",fontSize:12}}>去完善 →</span></div>;
          if (vcPending > 0) return <div onClick={()=>navigate("/influencer/vertical-connections/invitations?tab=pending")} style={{background:"#fef3c7",borderRadius:10,padding:12,cursor:"pointer",display:"flex",alignItems:"center",gap:8,marginBottom:10,fontSize:14,fontWeight:600,color:"#92400e"}}>📨 您有 {vcPending} 个新的建联邀请待处理 <span style={{marginLeft:"auto",fontSize:12}}>查看 →</span></div>;
          if ((vcNeedSubmit||0) > 0) return <div onClick={()=>navigate("/influencer/vertical-connections/orders")} style={{background:"#dbeafe",borderRadius:10,padding:12,cursor:"pointer",display:"flex",alignItems:"center",gap:8,marginBottom:10,fontSize:14,fontWeight:600,color:"#1d4ed8"}}>📤 您有 {vcNeedSubmit} 个派单待提交作品 <span style={{marginLeft:"auto",fontSize:12}}>查看 →</span></div>;
          if ((vcNeedRevise||0) > 0) return <div onClick={()=>navigate("/influencer/vertical-connections/orders")} style={{background:"#fee2e2",borderRadius:10,padding:12,cursor:"pointer",display:"flex",alignItems:"center",gap:8,marginBottom:10,fontSize:14,fontWeight:600,color:"#b91c1c"}}>🔧 您有 {vcNeedRevise} 个订单需要修改重提 <span style={{marginLeft:"auto",fontSize:12}}>去修改 →</span></div>;
          return <div onClick={()=>navigate("/influencer/vertical-connections/payment")} style={{background:"#dcfce7",borderRadius:10,padding:12,cursor:"pointer",display:"flex",alignItems:"center",gap:8,marginBottom:10,fontSize:14,fontWeight:600,color:"#166534"}}>🎉 资料已完善，等待商家邀请 <span style={{marginLeft:"auto",fontSize:12}}>设置收款 →</span></div>;
        })()}
        {/* Quick links */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={()=>navigate("/influencer/vertical-connections/invitations")} style={{padding:"6px 12px",border:"1px solid #dbe1ea",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:12}}>📨 建联邀请</button>
          <button onClick={()=>navigate("/influencer/vertical-connections/orders")} style={{padding:"6px 12px",border:"1px solid #dbe1ea",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:12}}>📋 我的派单</button>
          <button onClick={()=>navigate("/influencer/vertical-connections/payment")} style={{padding:"6px 12px",border:"1px solid #dbe1ea",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:12}}>💳 收款设置</button>
          <button onClick={()=>navigate("/influencer/vertical-connections/profile")} style={{padding:"6px 12px",border:"1px solid #dbe1ea",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:12}}>👤 我的资料</button>
        </div>
      </div>

      {/* 底部快捷操作 */}
      <div style={{
        background: "#fff",
        borderRadius: compactPx(16),
        border: "1px solid #eef2f7",
        padding: `${compactPx(20)}px ${compactPx(24)}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: compactPx(12),
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: compactPx(15), color: "#1e293b" }}>
            {t("准备好了吗？")}
          </div>
          <div style={{ fontSize: compactPx(13), color: "#64748b", marginTop: compactPx(4) }}>
            {t("完善达人资料后即可开始接单赚钱")}
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate("/influencer/task-hall")}
          style={{
            padding: "10px 24px",
            background: "var(--xt-accent)",
            color: "#fff",
            border: "none",
            borderRadius: compactPx(12),
            fontWeight: 700,
            fontSize: compactPx(15),
            cursor: "pointer",
          }}
        >
          {t("立即查看任务")} →
        </button>
      </div>
    </div>
  );
}
