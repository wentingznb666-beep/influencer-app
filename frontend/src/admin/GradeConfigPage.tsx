import { useNavigate } from "react-router-dom";

export default function GradeConfigPage() {
  const nav = useNavigate();
  return (
    <div>
      <button onClick={()=>nav("/admin/vertical-connections")} style={{ padding: "6px 12px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer", marginBottom: 12 }}>← 返回概览</button>
      <h2 style={{ marginTop: 0 }}>达人等级配置</h2>
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        <h3>等级自动计算规则</h3>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ padding: "10px 14px", background: "#f8fafc", borderRadius: 8 }}>
            <strong>基础等级计算</strong>
            <p style={{ fontSize: 13, color: "#475569", margin: "4px 0" }}>Grade A：GMV ≥ 100,000 THB 或 销量 ≥ 1,000 件</p>
            <p style={{ fontSize: 13, color: "#475569", margin: "4px 0" }}>Grade B：GMV ≥ 10,000 THB 或 销量 ≥ 100 件</p>
            <p style={{ fontSize: 13, color: "#475569", margin: "4px 0" }}>Grade C：GMV ≥ 3,000 THB 或 销量 ≥ 10 件</p>
            <p style={{ fontSize: 13, color: "#94a3b8", margin: "4px 0" }}>未达标：低于 GMV 3,000 THB 且 销量不足 10 件</p>
          </div>
          <div style={{ padding: "10px 14px", background: "#f8fafc", borderRadius: 8 }}>
            <strong>PLUS (+) 升级条件</strong>
            <p style={{ fontSize: 13, color: "#475569", margin: "4px 0" }}>条件1: 直播销售额 ≥ GMV 销售额 × 50%</p>
            <p style={{ fontSize: 13, color: "#475569", margin: "4px 0" }}>条件2: 每周直播次数 ≥ 7</p>
            <p style={{ fontSize: 13, color: "#94a3b8", margin: "4px 0" }}>两个条件必须同时满足，同时满足时在基础等级后加 +</p>
          </div>
        </div>
      </div>
    </div>
  );
}
