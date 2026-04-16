import { useState, useEffect } from "react";
import * as api from "../influencerApi";

type LedgerRow = { id: number; amount: number; type: string; ref_id: number | null; created_at: string };

export default function PointsPage() {
  const [balance, setBalance] = useState(0);
  const [weekPending, setWeekPending] = useState(0);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .getPoints()
      .then((data) => {
        setBalance(data.balance ?? 0);
        setWeekPending(data.weekPending ?? 0);
        setLedger(data.ledger ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>积分与收益</h2>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <p style={{ fontSize: 14, color: "#666" }}>1 积分 = 1 泰铢，按周结算。</p>
      {loading ? (
        <p>加载中…</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 24, marginBottom: 24, flexWrap: "wrap" }}>
            <div style={{ padding: 20, background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", minWidth: 160 }}>
              <div style={{ fontSize: 14, color: "#666" }}>当前积分</div>
              <div style={{ fontSize: 28, fontWeight: 600 }}>{balance}</div>
            </div>
            <div style={{ padding: 20, background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", minWidth: 160 }}>
              <div style={{ fontSize: 14, color: "#666" }}>本周已获得</div>
              <div style={{ fontSize: 28, fontWeight: 600 }}>{weekPending}</div>
            </div>
          </div>
          <h3>最近流水</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <thead>
              <tr style={{ background: "#f5f5f5" }}>
                <th style={{ padding: 10, textAlign: "left" }}>时间</th>
                <th style={{ padding: 10, textAlign: "left" }}>类型</th>
                <th style={{ padding: 10, textAlign: "right" }}>金额</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((l) => (
                <tr key={l.id}>
                  <td style={{ padding: 10 }}>{l.created_at}</td>
                  <td style={{ padding: 10 }}>
                    {l.type === "task_approval"
                      ? "任务通过"
                      : l.type === "admin_manual_recharge"
                      ? "管理员加分"
                      : l.type === "admin_manual_deduct"
                      ? "管理员扣分"
                      : l.type}
                  </td>
                  <td style={{ padding: 10, textAlign: "right" }}>{l.amount > 0 ? "+" : ""}{l.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {ledger.length === 0 && <p style={{ color: "#666" }}>暂无流水</p>}
        </>
      )}
    </div>
  );
}
