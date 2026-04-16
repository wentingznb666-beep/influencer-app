import { useEffect, useState } from "react";
import * as api from "../adminApi";

type WithdrawalRow = {
  id: number;
  user_id: number;
  username: string;
  amount: number;
  bank_account_name: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  status: "pending" | "paid" | "rejected";
  note: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
};

/**
 * 管理员端提现管理：查看提现申请并标记打款/驳回（策略 A：打款时扣减积分）。
 */
export default function WithdrawalsPage() {
  const [status, setStatus] = useState<"pending" | "paid" | "rejected" | "all">("pending");
  const [list, setList] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * 加载提现申请列表。
   */
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getWithdrawals({ status: status === "all" ? undefined : status, limit: 200 });
      setList(data.list ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [status]);

  /**
   * 标记已打款。
   */
  const handlePaid = async (id: number) => {
    const note = window.prompt("可填写打款备注（可选，例如转账单号）：") ?? undefined;
    try {
      await api.updateWithdrawal(id, { status: "paid", note });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    }
  };

  /**
   * 驳回提现申请。
   */
  const handleReject = async (id: number) => {
    const note = window.prompt("请输入驳回原因（可选）：") ?? undefined;
    try {
      await api.updateWithdrawal(id, { status: "rejected", note });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>提现管理</h2>
      <p style={{ fontSize: 14, color: "#666" }}>查看达人提现申请订单（1 积分 = 1 泰铢），待处理可标记已打款或驳回。</p>
      {error && <p style={{ color: "#c00" }}>{error}</p>}

      <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label>状态</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as any)} style={{ padding: "6px 10px" }}>
          <option value="pending">待处理</option>
          <option value="paid">已打款</option>
          <option value="rejected">已驳回</option>
          <option value="all">全部</option>
        </select>
        <button type="button" onClick={load} disabled={loading} style={{ padding: "8px 16px", border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer" }}>
          刷新
        </button>
      </div>

      {loading ? (
        <p>加载中…</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              <th style={{ padding: 10, textAlign: "left" }}>ID</th>
              <th style={{ padding: 10, textAlign: "left" }}>达人</th>
              <th style={{ padding: 10, textAlign: "left" }}>收款姓名</th>
              <th style={{ padding: 10, textAlign: "left" }}>银行</th>
              <th style={{ padding: 10, textAlign: "left" }}>银行账号</th>
              <th style={{ padding: 10, textAlign: "right" }}>金额</th>
              <th style={{ padding: 10, textAlign: "left" }}>状态</th>
              <th style={{ padding: 10, textAlign: "left" }}>申请时间</th>
              <th style={{ padding: 10, textAlign: "left" }}>打款时间</th>
              <th style={{ padding: 10, textAlign: "left" }}>备注</th>
              <th style={{ padding: 10 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td style={{ padding: 10 }}>{r.id}</td>
                <td style={{ padding: 10 }}>{r.username}（{r.user_id}）</td>
                <td style={{ padding: 10 }}>{r.bank_account_name || "—"}</td>
                <td style={{ padding: 10 }}>{r.bank_name || "—"}</td>
                <td style={{ padding: 10 }}>{r.bank_account_no || "—"}</td>
                <td style={{ padding: 10, textAlign: "right" }}>{r.amount}</td>
                <td style={{ padding: 10 }}>{r.status === "paid" ? "已打款" : r.status === "rejected" ? "已驳回" : "待处理"}</td>
                <td style={{ padding: 10 }}>{r.created_at}</td>
                <td style={{ padding: 10 }}>{r.paid_at || "—"}</td>
                <td style={{ padding: 10 }}>{r.note || "—"}</td>
                <td style={{ padding: 10 }}>
                  {r.status === "pending" ? (
                    <>
                      <button type="button" onClick={() => handlePaid(r.id)} style={{ marginRight: 8, padding: "4px 10px", background: "#34c759", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
                        标记已打款
                      </button>
                      <button type="button" onClick={() => handleReject(r.id)} style={{ padding: "4px 10px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer" }}>
                        驳回
                      </button>
                    </>
                  ) : (
                    <span style={{ color: "#666" }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && list.length === 0 && <p style={{ color: "#666" }}>暂无数据</p>}
    </div>
  );
}

