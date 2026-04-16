import { useState, useEffect } from "react";
import * as api from "../adminApi";

type AlertRow = { id: number; submission_id: number; check_result: string; checked_at: string; note: string | null; work_link: string; user_id: number; username: string };
type ViolationRow = { id: number; user_id: number; username: string; submission_id: number | null; reason: string; created_at: string };

export default function RiskPage() {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [violations, setViolations] = useState<ViolationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkSubId, setCheckSubId] = useState("");
  const [checking, setChecking] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [alertsData, violationsData] = await Promise.all([api.getRiskAlerts(), api.getRiskViolations()]);
      setAlerts(alertsData.list || []);
      setViolations(violationsData.list || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleTriggerCheck = async () => {
    const id = Number(checkSubId);
    if (!Number.isInteger(id) || id < 1) return;
    setChecking(true);
    setError(null);
    try {
      await api.triggerRiskCheck(id);
      setCheckSubId("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "检查失败");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>防删巡检与风控</h2>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <section style={{ marginBottom: 32 }}>
        <h3>手动巡检</h3>
        <p style={{ fontSize: 14, color: "#666" }}>输入投稿 ID，检测作品链接是否可访问。锁定期内若检测到删除将自动扣分并记违规，满 3 次违规将列入黑名单。</p>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
          <input
            type="number"
            placeholder="投稿 ID"
            value={checkSubId}
            onChange={(e) => setCheckSubId(e.target.value)}
            style={{ width: 100, padding: "6px 10px" }}
          />
          <button type="button" onClick={handleTriggerCheck} disabled={checking} style={{ padding: "8px 16px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: 8, cursor: checking ? "not-allowed" : "pointer" }}>
            {checking ? "检查中…" : "检测链接"}
          </button>
        </div>
      </section>
      {loading ? (
        <p>加载中…</p>
      ) : (
        <>
          <section style={{ marginBottom: 32 }}>
            <h3>告警列表（疑似删除/异常）</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  <th style={{ padding: 10, textAlign: "left" }}>投稿ID</th>
                  <th style={{ padding: 10, textAlign: "left" }}>结果</th>
                  <th style={{ padding: 10, textAlign: "left" }}>达人</th>
                  <th style={{ padding: 10, textAlign: "left" }}>检测时间</th>
                  <th style={{ padding: 10, textAlign: "left" }}>备注</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.id}>
                    <td style={{ padding: 10 }}>{a.submission_id}</td>
                    <td style={{ padding: 10 }}>{a.check_result === "deleted" ? "已删除" : "异常"}</td>
                    <td style={{ padding: 10 }}>{a.username}</td>
                    <td style={{ padding: 10 }}>{a.checked_at}</td>
                    <td style={{ padding: 10 }}>{a.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {alerts.length === 0 && <p style={{ color: "#666" }}>暂无告警</p>}
          </section>
          <section>
            <h3>违规记录</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  <th style={{ padding: 10, textAlign: "left" }}>达人</th>
                  <th style={{ padding: 10, textAlign: "left" }}>原因</th>
                  <th style={{ padding: 10, textAlign: "left" }}>时间</th>
                </tr>
              </thead>
              <tbody>
                {violations.map((v) => (
                  <tr key={v.id}>
                    <td style={{ padding: 10 }}>{v.username}</td>
                    <td style={{ padding: 10 }}>{v.reason}</td>
                    <td style={{ padding: 10 }}>{v.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {violations.length === 0 && <p style={{ color: "#666" }}>暂无违规记录</p>}
          </section>
        </>
      )}
    </div>
  );
}
