import { useNavigate } from "react-router-dom";

export default function VerticalConnectionsDashboard() {
  const nav = useNavigate();
  const cards = [
    { title: "达人资料管理", desc: "管理垂直达人资料、等级", path: "profiles", icon: "👥" },
    { title: "建联记录管理", desc: "查看所有建联记录和状态", path: "records", icon: "📋" },
    { title: "派单与付款管理", desc: "查看派单记录和付款凭证", path: "orders", icon: "💳" },
    { title: "等级配置", desc: "编辑等级计算规则和阈值", path: "grade-config", icon: "⚙️" },
  ];
  return (
    <div>
      <h2 style={{ marginTop: 0 }}>垂直达人建联管理</h2>
      <p style={{ color: "#64748b", fontSize: 14 }}>独立达人建联模块管理面板</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16, marginTop: 20 }}>
        {cards.map(c => (
          <div key={c.path} onClick={() => nav(c.path)} style={{ background: "#fff", borderRadius: 12, padding: 20, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", transition: "0.2s" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{c.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--xt-primary)" }}>{c.title}</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{c.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
