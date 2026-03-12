import { useState, useEffect } from "react";
import * as api from "../adminApi";

type Row = { id: number | null; user_id: number; username: string; amount: number; status: string; paid_at: string | null; note: string | null };

export default function SettlementPage() {
  const [weeks, setWeeks] = useState<string[]>([]);
  const [lockDays, setLockDays] = useState(5);
  const [selectedWeek, setSelectedWeek] = useState("");
  const [list, setList] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const loadWeeks = async () => {
    try {
      const data = await api.getSettlementWeeks();
      setWeeks(data.weeks || []);
      setLockDays(data.lock_period_days ?? 5);
      if (!selectedWeek && data.weeks?.length > 0) setSelectedWeek(data.weeks[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  };

  const loadSummary = async () => {
    if (!selectedWeek) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSettlementSummary(selectedWeek);
      setList(data.list || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWeeks();
  }, []);

  useEffect(() => {
    loadSummary();
  }, [selectedWeek]);

  const handleGenerate = async () => {
    if (!selectedWeek) return;
    setGenerating(true);
    setError(null);
    try {
      await api.generateSettlement(selectedWeek);
      loadSummary();
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async () => {
    if (!selectedWeek) return;
    setError(null);
    try {
      const blob = await api.exportSettlementCsv(selectedWeek);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `settlement_${selectedWeek}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "导出失败");
    }
  };

  const handleStatus = async (id: number, status: string) => {
    try {
      await api.updateSettlementStatus(id, { status });
      loadSummary();
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新失败");
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>结算与打款</h2>
      <p style={{ fontSize: 14, color: "#666" }}>按周汇总已通过且过锁定期（{lockDays} 天）的投稿积分，生成记录后可导出 CSV 并标记打款状态。</p>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label>选择周（周一日期）</label>
        <select value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)} style={{ padding: "6px 10px" }}>
          <option value="">请选择</option>
          {weeks.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
        <button type="button" onClick={handleGenerate} disabled={generating || !selectedWeek} style={{ padding: "8px 16px", background: "#007aff", color: "#fff", border: "none", borderRadius: 8, cursor: generating ? "not-allowed" : "pointer" }}>
          {generating ? "生成中…" : "生成结算记录"}
        </button>
        <button type="button" onClick={handleExport} disabled={!selectedWeek} style={{ padding: "8px 16px", border: "1px solid #007aff", color: "#007aff", borderRadius: 8, cursor: "pointer", background: "#fff" }}>
          导出 CSV
        </button>
      </div>
      {loading ? <p>加载中…</p> : (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              <th style={{ padding: 10, textAlign: "left" }}>用户</th>
              <th style={{ padding: 10, textAlign: "right" }}>积分</th>
              <th style={{ padding: 10, textAlign: "left" }}>状态</th>
              <th style={{ padding: 10, textAlign: "left" }}>打款时间</th>
              <th style={{ padding: 10 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r, idx) => (
              <tr key={r.user_id + "-" + idx}>
                <td style={{ padding: 10 }}>{r.username}</td>
                <td style={{ padding: 10, textAlign: "right" }}>{r.amount}</td>
                <td style={{ padding: 10 }}>{r.status === "paid" ? "已打款" : r.status === "exception" ? "异常" : "待打款"}</td>
                <td style={{ padding: 10 }}>{r.paid_at || "—"}</td>
                <td style={{ padding: 10 }}>
                  {r.status === "pending" && r.id != null && (
                    <>
                      <button type="button" onClick={() => handleStatus(r.id as number, "paid")} style={{ marginRight: 8, padding: "4px 10px", background: "#34c759", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>标记已打款</button>
                      <button type="button" onClick={() => handleStatus(r.id as number, "exception")} style={{ padding: "4px 10px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer" }}>异常</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!loading && list.length === 0 && selectedWeek && <p style={{ color: "#666" }}>该周暂无结算数据，可先「生成结算记录」</p>}
    </div>
  );
}
