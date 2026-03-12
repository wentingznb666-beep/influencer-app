import { useState, useEffect, type FormEvent } from "react";
import * as api from "../clientApi";

type LedgerRow = { id: number; amount: number; type: string; created_at: string };

export default function ClientPointsPage() {
  const [balance, setBalance] = useState(0);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [recharging, setRecharging] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getPoints();
      setBalance(data.balance ?? 0);
      setLedger(data.ledger ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleRecharge = async (e: FormEvent) => {
    e.preventDefault();
    const num = Number(rechargeAmount);
    if (!Number.isInteger(num) || num < 1) return;
    setError(null);
    setRecharging(true);
    try {
      await api.recharge(num);
      setRechargeAmount("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "充值失败");
    } finally {
      setRecharging(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>积分充值</h2>
      <p style={{ fontSize: 14, color: "#666" }}>1 积分 = 1 泰铢，充值后可用于发布任务等。</p>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      {loading ? (
        <p>加载中…</p>
      ) : (
        <>
          <div style={{ marginBottom: 24 }}>
            <span style={{ fontSize: 14, color: "#666" }}>当前余额：</span>
            <span style={{ fontSize: 24, fontWeight: 600 }}>{balance}</span>
            <span style={{ marginLeft: 4, color: "#666" }}>积分</span>
          </div>
          <form onSubmit={handleRecharge} style={{ marginBottom: 24, padding: 16, background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <label>充值积分（模拟）</label>
            <input
              type="number"
              min={1}
              max={1000000}
              value={rechargeAmount}
              onChange={(e) => setRechargeAmount(e.target.value)}
              required
              style={{ display: "block", marginTop: 4, marginBottom: 12, width: 120, padding: "8px 10px", boxSizing: "border-box" }}
            />
            <button type="submit" disabled={recharging} style={{ padding: "8px 16px", background: "#007aff", color: "#fff", border: "none", borderRadius: 8, cursor: recharging ? "not-allowed" : "pointer" }}>
              {recharging ? "充值中…" : "充值"}
            </button>
          </form>
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
                  <td style={{ padding: 10 }}>{l.type === "client_recharge" ? "充值" : l.type}</td>
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
