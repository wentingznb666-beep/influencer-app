import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../fetchWithAuth";

export default function GradeConfigPage() {
  const nav = useNavigate();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetchWithAuth("/api/admin/influencer-profiles/dashboard");
        const d = await r.json();
        setCounts({
          total: d.total_profiles || 0,
          active: d.active_profiles || 0,
          ungraded: d.ungraded || 0,
        });
      } catch {}
    })();
  }, []);

  const recalc = async () => {
    if (!confirm("此操作将重新计算全部达人等级，确认？")) return;
    setSaving(true);
    try {
      await fetchWithAuth("/api/admin/influencer-profiles/auto-grade");
      setMsg("等级已重新计算");
      setTimeout(() => setMsg(""), 3000);
    } catch (e: any) {
      setMsg("保存失败: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const th: React.CSSProperties = {
    padding: "8px 12px", textAlign: "left", borderBottom: "2px solid #e2e8f0",
    fontWeight: 700, fontSize: 12, color: "#64748b", whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    padding: "8px 12px", borderBottom: "1px solid #f1f5f9", fontSize: 13,
  };

  return (
    <div>
      <button onClick={() => nav("/admin/vertical-connections")} style={{
        padding: "6px 12px", border: "1px solid #dbe1ea", borderRadius: 8,
        background: "#fff", cursor: "pointer", marginBottom: 12,
      }}>
        ← 返回概览
      </button>
      <h2 style={{ marginTop: 0 }}>达人等级配置</h2>
      {msg && (
        <p style={{ color: msg.includes("失败") ? "#c00" : "#166534", fontWeight: 700 }}>{msg}</p>
      )}

      {/* Summary */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ background: "#dbeafe", borderRadius: 8, padding: "10px 18px" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1d4ed8" }}>{counts.total || 0}</div>
          <div style={{ fontSize: 11, color: "#1d4ed8" }}>达人总数</div>
        </div>
        <div style={{ background: "#dcfce7", borderRadius: 8, padding: "10px 18px" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#166534" }}>{counts.active || 0}</div>
          <div style={{ fontSize: 11, color: "#166534" }}>已评级</div>
        </div>
        <div style={{ background: "#fef3c7", borderRadius: 8, padding: "10px 18px" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#92400e" }}>{counts.ungraded || 0}</div>
          <div style={{ fontSize: 11, color: "#92400e" }}>未达标</div>
        </div>
      </div>

      {/* Recalculate button */}
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>自动评级</h3>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
          基于达人数据（月度GMV、直播时长、直播频率）自动计算评分并定级。
        </p>
        <button onClick={recalc} disabled={saving} style={{
          padding: "10px 24px", border: "none", borderRadius: 8,
          background: saving ? "#94a3b8" : "var(--xt-accent)", color: "#fff",
          cursor: saving ? "not-allowed" : "pointer", fontWeight: 700,
        }}>
          {saving ? "重新计算中..." : "重新计算全部等级"}
        </button>
      </div>

      {/* Scoring rules */}
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflowX: "auto", marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>评分制规则 (满分 65 分)</h3>

        {/* ① GMV */}
        <h4 style={{ fontSize: 14, margin: "16px 0 8px" }}>① 月度 GMV（30 分）</h4>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 12 }}>
          <thead>
            <tr>
              <th style={th}>GMV 范围 (THB)</th>
              <th style={th}>得分</th>
              <th style={th}>说明</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["≥ 300,000", "28 - 30", ""],
              ["200,000 - 300,000", "23 - 27", ""],
              ["100,000 - 200,000", "15 - 22", ""],
              ["50,000 - 100,000", "8 - 14", ""],
              ["< 50,000", "0 分", "直接评为 C 级，不参与其他项"],
            ].map((r, i) => (
              <tr key={i} style={i === 4 ? { background: "#fef2f2" } : undefined}>
                <td style={td}>{r[0]}</td>
                <td style={{ ...td, fontWeight: 700 }}>{r[1]}</td>
                <td style={{ ...td, color: i === 4 ? "#dc2626" : "#64748b", fontSize: 12 }}>{r[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ② Live hours */}
        <h4 style={{ fontSize: 14, margin: "16px 0 8px" }}>② 平均直播时长（15 分）</h4>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 12 }}>
          <thead>
            <tr>
              <th style={th}>时长范围</th>
              <th style={th}>得分</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["≥ 3 小时", "13 - 15"],
              ["2 - 3 小时", "10 - 12"],
              ["1 - 2 小时", "6 - 9"],
              ["< 1 小时", "5"],
            ].map((r, i) => (
              <tr key={i}>
                <td style={td}>{r[0]}</td>
                <td style={{ ...td, fontWeight: 700 }}>{r[1]}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ③ Live frequency */}
        <h4 style={{ fontSize: 14, margin: "16px 0 8px" }}>③ 直播频率（15 分）</h4>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 12 }}>
          <thead>
            <tr>
              <th style={th}>频率</th>
              <th style={th}>得分</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["≥ 5 次/周", "13 - 15"],
              ["3 - 4 次/周", "10 - 12"],
              ["1 - 2 次/周", "6 - 9"],
              ["不稳定", "5"],
            ].map((r, i) => (
              <tr key={i}>
                <td style={td}>{r[0]}</td>
                <td style={{ ...td, fontWeight: 700 }}>{r[1]}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ④ Professionalism */}
        <h4 style={{ fontSize: 14, margin: "16px 0 8px" }}>④ 创作者专业度（5 分）</h4>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 12 }}>
          <thead>
            <tr>
              <th style={th}>表现</th>
              <th style={th}>得分</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["内容质量高，表达能力强，配合度高", "5"],
              ["表现中等，需要培养提升", "3"],
              ["内容质量低，表达能力弱，配合度低", "1"],
            ].map((r, i) => (
              <tr key={i}>
                <td style={td}>{r[0]}</td>
                <td style={{ ...td, fontWeight: 700 }}>{r[1]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Grade mapping */}
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflowX: "auto" }}>
        <h3 style={{ marginTop: 0 }}>等级判定</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 12 }}>
          <thead>
            <tr>
              <th style={th}>总分</th>
              <th style={th}>等级</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["≥ 50 分", "A 级"],
              ["20 - 49 分", "B 级"],
              ["< 20 分", "C 级"],
            ].map((r, i) => (
              <tr key={i} style={{ background: i === 0 ? "#f0fdf4" : i === 1 ? "#eff6ff" : "#fef3c7" }}>
                <td style={td}>{r[0]}</td>
                <td style={{ ...td, fontWeight: 700, color: i === 0 ? "#166534" : i === 1 ? "#1d4ed8" : "#92400e" }}>{r[1]}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h4 style={{ fontSize: 14, margin: "12px 0 6px" }}>✨ 黄金标准（升级为 +）</h4>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
          如果直播销售额 ≥ 月度GMV 的 50%，在原等级基础上加 +（如 A → A+、B → B+、C → C+），作为最终等级。
        </p>
      </div>
    </div>
  );
}
