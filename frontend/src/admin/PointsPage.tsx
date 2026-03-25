import { useState, useEffect } from "react";
import * as api from "../adminApi";

type Account = { id: number; user_id: number; balance: number; updated_at: string; username: string; role: string };
type WeekRow = { user_id: number; username: string; role: string; total_added: number };
type LedgerRow = { id: number; account_id: number; amount: number; type: string; ref_id: number | null; created_at: string; user_id: number; username: string };
type RechargeOrderRow = { id: number; order_no: string | null; user_id: number; username: string; amount: number; status: "pending" | "approved" | "rejected"; note: string | null; created_at: string; updated_at: string; approved_at: string | null };

export default function PointsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [weekSummary, setWeekSummary] = useState<WeekRow[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [rechargeOrders, setRechargeOrders] = useState<RechargeOrderRow[]>([]);
  const [rechargeStatus, setRechargeStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [week, setWeek] = useState("");
  const [ledgerUserId, setLedgerUserId] = useState<string>("");
  const [manualUserId, setManualUserId] = useState<string>("");
  const [manualUserSearch, setManualUserSearch] = useState<string>("");
  const [manualAmount, setManualAmount] = useState<string>("");
  const [manualNote, setManualNote] = useState<string>("");
  const [manualMode, setManualMode] = useState<"add" | "deduct">("add");
  const [manualSubmitting, setManualSubmitting] = useState(false);

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

  const loadRechargeOrders = async () => {
    try {
      const data = await api.getRechargeOrders({ status: rechargeStatus === "all" ? undefined : rechargeStatus, limit: 200 });
      setRechargeOrders(data.list || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "充值订单加载失败");
    }
  };

  useEffect(() => {
    setLoading(true);
    loadSummary().finally(() => setLoading(false));
  }, [week]);

  useEffect(() => {
    loadLedger();
  }, [ledgerUserId]);

  useEffect(() => {
    loadRechargeOrders();
  }, [rechargeStatus]);

  const handleApproveRecharge = async (id: number) => {
    const note = window.prompt("可填写确认备注（可选）：") ?? undefined;
    try {
      await api.updateRechargeOrder(id, { status: "approved", note });
      loadRechargeOrders();
      loadSummary();
      loadLedger();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    }
  };

  const handleRejectRecharge = async (id: number) => {
    const note = window.prompt("请输入驳回原因（可选）：") ?? undefined;
    try {
      await api.updateRechargeOrder(id, { status: "rejected", note });
      loadRechargeOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    }
  };

  /**
   * 管理员手动充值：为达人/商家直接加积分。
   */
  const handleManualRecharge = async () => {
    const uid = Number(manualUserId);
    const amt = Number(manualAmount);
    if (!Number.isInteger(uid) || uid < 1) {
      setError("请选择有效的充值对象。");
      return;
    }
    if (!Number.isInteger(amt) || amt < 1) {
      setError("请输入有效充值积分（整数且大于 0）。");
      return;
    }
    setError(null);
    setManualSubmitting(true);
    try {
      await api.manualRecharge({ user_id: uid, amount: amt, note: manualNote.trim() || undefined, mode: manualMode });
      setManualAmount("");
      setManualNote("");
      loadSummary();
      loadLedger();
    } catch (e) {
      setError(e instanceof Error ? e.message : "充值失败");
    } finally {
      setManualSubmitting(false);
    }
  };

  const rechargeTargets = accounts.filter((a) => a.role === "influencer" || a.role === "client");
  const normalizedManualSearch = manualUserSearch.trim().toLowerCase();
  const filteredRechargeTargets = normalizedManualSearch
    ? rechargeTargets.filter((u) => {
        const idText = String(u.user_id);
        const nameText = String(u.username || "");
        return idText.toLowerCase().includes(normalizedManualSearch) || nameText.toLowerCase().includes(normalizedManualSearch);
      })
    : rechargeTargets;
  const selectedTarget = manualUserId ? rechargeTargets.find((u) => String(u.user_id) === String(manualUserId)) : undefined;
  const displayRechargeTargets = selectedTarget && !filteredRechargeTargets.some((u) => u.user_id === selectedTarget.user_id)
    ? [selectedTarget, ...filteredRechargeTargets]
    : filteredRechargeTargets;

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>积分与结算</h2>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <section style={{ marginBottom: 32 }}>
        <h3>积分汇总</h3>
        <div style={{ marginBottom: 12, padding: 12, background: "#fff", borderRadius: 8 }}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>管理员积分调整（加分/扣分）</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select value={manualMode} onChange={(e) => setManualMode(e.target.value as "add" | "deduct")} style={{ padding: "6px 8px", minWidth: 120 }}>
              <option value="add">加分</option>
              <option value="deduct">扣分（仅达人）</option>
            </select>
            {/* 关键修改 1：搜索输入框（实时过滤用户名/ID） */}
            <input
              type="text"
              value={manualUserSearch}
              onChange={(e) => setManualUserSearch(e.target.value)}
              placeholder="搜索用户名或ID"
              style={{ padding: "6px 8px", minWidth: 220 }}
            />
            {/* 关键修改 2：下拉选中/回显/提交逻辑保持不变，仅替换 options 来源为过滤后的列表 */}
            <select
              value={manualUserId}
              onChange={(e) => setManualUserId(e.target.value)}
              style={{ padding: "6px 8px", minWidth: 260 }}
            >
              <option value="">选择充值对象</option>
              {displayRechargeTargets.length === 0 ? (
                <option value="" disabled>
                  无匹配结果
                </option>
              ) : (
                displayRechargeTargets.map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.username}（{u.role === "influencer" ? "达人" : "商家"} / ID:{u.user_id}）
                  </option>
                ))
              )}
            </select>
            <input type="number" min={1} value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} placeholder="充值积分" style={{ padding: "6px 8px", width: 120 }} />
            <input type="text" value={manualNote} onChange={(e) => setManualNote(e.target.value)} placeholder="备注（可选）" style={{ padding: "6px 8px", width: 220 }} />
            <button
              type="button"
              onClick={handleManualRecharge}
              disabled={manualSubmitting}
              style={{ padding: "6px 12px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: 8, cursor: manualSubmitting ? "not-allowed" : "pointer" }}
            >
              {manualSubmitting ? "提交中…" : manualMode === "deduct" ? "确认扣分" : "确认加分"}
            </button>
          </div>
        </div>
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
        <h3>充值订单</h3>
        <div style={{ marginBottom: 8 }}>
          <label>订单状态</label>
          <select value={rechargeStatus} onChange={(e) => setRechargeStatus(e.target.value as any)} style={{ marginLeft: 8, padding: "6px 8px" }}>
            <option value="pending">待确认</option>
            <option value="approved">已确认</option>
            <option value="rejected">已驳回</option>
            <option value="all">全部</option>
          </select>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", marginBottom: 24 }}>
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              <th style={{ padding: 10, textAlign: "left" }}>订单号</th>
              <th style={{ padding: 10, textAlign: "left" }}>用户</th>
              <th style={{ padding: 10, textAlign: "right" }}>金额</th>
              <th style={{ padding: 10, textAlign: "left" }}>状态</th>
              <th style={{ padding: 10, textAlign: "left" }}>申请时间</th>
              <th style={{ padding: 10, textAlign: "left" }}>确认时间</th>
              <th style={{ padding: 10, textAlign: "left" }}>备注</th>
              <th style={{ padding: 10, textAlign: "left" }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rechargeOrders.map((o) => (
              <tr key={o.id}>
                <td style={{ padding: 10 }}>{o.order_no || `XT-待生成-${o.id}`}</td>
                <td style={{ padding: 10 }}>{o.username}</td>
                <td style={{ padding: 10, textAlign: "right" }}>{o.amount}</td>
                <td style={{ padding: 10 }}>{o.status === "approved" ? "已确认" : o.status === "rejected" ? "已驳回" : "待确认"}</td>
                <td style={{ padding: 10 }}>{o.created_at}</td>
                <td style={{ padding: 10 }}>{o.approved_at || "—"}</td>
                <td style={{ padding: 10 }}>{o.note || "—"}</td>
                <td style={{ padding: 10 }}>
                  {o.status === "pending" ? (
                    <>
                      <button type="button" onClick={() => handleApproveRecharge(o.id)} style={{ marginRight: 8, padding: "4px 10px", background: "#34c759", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
                        确认入账
                      </button>
                      <button type="button" onClick={() => handleRejectRecharge(o.id)} style={{ padding: "4px 10px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer" }}>
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
        {rechargeOrders.length === 0 && <p style={{ color: "#666" }}>暂无充值订单</p>}

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
