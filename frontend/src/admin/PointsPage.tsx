import { useState, useEffect } from "react";
import * as api from "../adminApi";

type Account = { id: number; user_id: number; balance: number; updated_at: string; username: string; role: string };
type WeekRow = { user_id: number; username: string; role: string; total_added: number };
type LedgerRow = { id: number; account_id: number; amount: number; type: string; ref_id: number | null; created_at: string; user_id: number; username: string };

export default function PointsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [weekSummary, setWeekSummary] = useState<WeekRow[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [week, setWeek] = useState("");
  const [ledgerUserId, setLedgerUserId] = useState<string>("");

  const loadSummary = async () => {
    setError(null);
    try {
      const data = await api.getPointsSummary(week || undefined);
      setAccounts(data.accounts || []);
      setWeekSummary(data.weekSummary || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  };

  const loadLedger = async () => {
    try {
      const data = await api.getPointsLedger({ user_id: ledgerUserId ? Number(ledgerUserId) : undefined, limit: 50 });
      setLedger(data.list || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "流水加载失败");
    }
  };

  useEffect(() => {
    setLoading(true);
    loadSummary().finally(() => setLoading(false));
  }, [week]);

  useEffect(() => {
    loadLedger();
  }, [ledgerUserId]);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>积分与结算</h2>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <section style={{ marginBottom: 32 }}>
        <h3>积分汇总</h3>
        <div style={{ marginBottom: 8 }}>
          <label>按周统计（年-周，如 2025-12）</label>
          <input type="text" value={week} onChange={(e) => setWeek(e.target.value)} placeholder="留空为全部" style={{ marginLeft: 8, padding: "6px 8px", width: 100 }} />
        </div>
        {loading ? <p>加载中…</p> : (
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden" }}>
            <thead>
              <tr style={{ background: "#f5f5f5" }}>
                <th style={{ padding: 10, textAlign: "left" }}>用户</th>
                <th style={{ padding: 10, textAlign: "left" }}>角色</th>
                <th style={{ padding: 10, textAlign: "left" }}>当前余额</th>
                {week && <th style={{ padding: 10, textAlign: "left" }}>当周增加</th>}
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => {
                const weekRow = weekSummary.find((w) => w.user_id === a.user_id);
                return (
                  <tr key={a.id}>
                    <td style={{ padding: 10 }}>{a.username}</td>
                    <td style={{ padding: 10 }}>{a.role}</td>
                    <td style={{ padding: 10 }}>{a.balance}</td>
                    {week && <td style={{ padding: 10 }}>{weekRow?.total_added ?? 0}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!loading && accounts.length === 0 && <p style={{ color: "#666" }}>暂无积分账户</p>}
      </section>
      <section>
        <h3>积分流水</h3>
        <div style={{ marginBottom: 8 }}>
          <label>按用户筛选</label>
          <input type="number" value={ledgerUserId} onChange={(e) => setLedgerUserId(e.target.value)} placeholder="用户 ID，留空全部" style={{ marginLeft: 8, padding: "6px 8px", width: 100 }} />
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden" }}>
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              <th style={{ padding: 10, textAlign: "left" }}>ID</th>
              <th style={{ padding: 10, textAlign: "left" }}>用户</th>
              <th style={{ padding: 10, textAlign: "left" }}>金额</th>
              <th style={{ padding: 10, textAlign: "left" }}>类型</th>
              <th style={{ padding: 10, textAlign: "left" }}>时间</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((l) => (
              <tr key={l.id}>
                <td style={{ padding: 10 }}>{l.id}</td>
                <td style={{ padding: 10 }}>{l.username}</td>
                <td style={{ padding: 10 }}>{l.amount > 0 ? "+" : ""}{l.amount}</td>
                <td style={{ padding: 10 }}>{l.type}</td>
                <td style={{ padding: 10 }}>{l.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {ledger.length === 0 && <p style={{ color: "#666" }}>暂无流水</p>}
      </section>
    </div>
  );
}
