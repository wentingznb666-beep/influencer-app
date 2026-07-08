import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../fetchWithAuth";

export default function VerticalConnectionsDashboard() {
  const nav = useNavigate();
  const [stats, setStats] = useState<any>({});

  useEffect(() => {
    (async () => {
      try {
        const r = await fetchWithAuth("/api/admin/influencer-profiles/dashboard");
        setStats(await r.json());
      } catch {}
    })();
  }, []);

  const cards = [
    { title: "达人资料管理", desc: "管理垂直达人资料、等级", path: "profiles", icon: "👥" },
    { title: "建联记录管理", desc: "查看所有建联记录和状态", path: "records", icon: "📋" },
    { title: "派单与付款管理", desc: "查看派单记录和付款凭证", path: "orders", icon: "💳" },
    { title: "等级配置", desc: "编辑等级计算规则和阈值", path: "grade-config", icon: "⚙️" },
  ];

  const statItems = [
    { label: "达人总数", value: stats.total_profiles || 0, bg: "#dbeafe", color: "#1d4ed8" },
    { label: "已评级", value: stats.active_profiles || 0, bg: "#dcfce7", color: "#166534" },
    { label: "未达标", value: stats.ungraded || 0, bg: "#fef3c7", color: "#92400e" },
    { label: "活跃建联", value: stats.active_connections || 0, bg: "#dcfce7", color: "#166534" },
    { label: "即将到期", value: stats.expiring || 0, bg: "#fee2e2", color: "#b91c1c" },
    { label: "异常订单", value: stats.anomaly_orders || 0, bg: "#fee2e2", color: "#b91c1c" },
  ];
  return (
    <div>
      <h2 style={{ marginTop: 0 }}>垂直达人建联管理</h2>
      <p style={{ color: "#64748b", fontSize: 14 }}>独立达人建联模块管理面板</p>
      {stats.total_profiles !== undefined && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          {statItems.map(s => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: "10px 18px", flex: 1, minWidth: 100 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: s.color }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}
      {stats.by_category && stats.by_category.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {(stats.by_category || []).slice(0, 10).map((c: any) => (
            <span key={c.category} style={{ background: "#f1f5f9", padding: "3px 10px", borderRadius: 999, fontSize: 12, color: "#475569" }}>{c.category}: <strong>{c.c}</strong></span>
          ))}
        </div>
      )}
      {stats.expiring_list && stats.expiring_list.length > 0 && (
        <div style={{ background: "#fee2e2", borderRadius: 8, padding: "8px 14px", marginBottom: 12, fontSize: 13, color: "#b91c1c" }}>
          ⚠ 即将到期建联：{(stats.expiring_list || []).map((c: any) => `${c.client_name || `商家#${c.client_id}`}↔${c.influencer_name || `达人#${c.influencer_id}`}`).join("、")}
        </div>
      )}
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
