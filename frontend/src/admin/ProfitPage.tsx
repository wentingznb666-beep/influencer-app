import { useEffect, useMemo, useRef, useState } from "react";
import * as api from "../adminApi";

type ProfitRow = {
  id: number;
  order_no: string | null;
  completed_at: string;
  client_id: number;
  client_username: string;
  influencer_id: number | null;
  influencer_username: string | null;
  client_pay_points: number;
  creator_reward_points: number;
  platform_profit_points: number;
};

type ExclusionRow = {
  user_id: number;
  username: string;
  display_name: string | null;
  role_name: string;
};

type UserRow = {
  id: number;
  username: string;
  display_name: string | null;
  role: string;
};

/**
 * 日期格式化：YYYY-MM-DD HH:mm:ss。
 */
function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * 管理员利润统计页面：按月/区间统计并支持排除账号过滤。
 */
export default function ProfitPage() {
  const hasInitRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    return `${now.getFullYear()}-${mm}`;
  });
  const [summary, setSummary] = useState({ total_orders: 0, total_client_pay: 0, total_creator_reward: 0, total_profit: 0 });
  const [monthly, setMonthly] = useState<Array<{ month: string; total_orders: number; total_profit: number }>>([]);
  const [list, setList] = useState<ProfitRow[]>([]);
  const [allUsers, setAllUsers] = useState<UserRow[]>([]);
  const [excludedIds, setExcludedIds] = useState<number[]>([]);

  /**
   * 加载用户列表与排除配置。
   */
  const loadUsersAndExclusions = async () => {
    const [usersRes, exclusionRes] = await Promise.all([
      api.getUsers(),
      api.getProfitExclusions(),
    ]);
    setAllUsers((usersRes.list || []).filter((u: UserRow) => ["client", "influencer", "employee"].includes(u.role)));
    const rows = (exclusionRes.list || []) as ExclusionRow[];
    setExcludedIds(rows.map((r) => r.user_id));
  };

  /**
   * 拉取利润统计数据（按月或按区间）。
   */
  const loadSummary = async (opts?: { month?: string; start?: string; end?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getProfitSummary({
        month: opts?.month || month,
        start: opts?.start || start,
        end: opts?.end || end,
      });
      setSummary(data.summary || { total_orders: 0, total_client_pay: 0, total_creator_reward: 0, total_profit: 0 });
      setMonthly(data.monthly || []);
      setList(data.list || []);
      if (Array.isArray(data.excluded_user_ids)) setExcludedIds(data.excluded_user_ids);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasInitRef.current) return;
    hasInitRef.current = true;
    (async () => {
      try {
        await loadUsersAndExclusions();
        await loadSummary();
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /**
   * 保存排除账号配置并刷新统计。
   */
  const saveExclusions = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.updateProfitExclusions(excludedIds);
      await loadSummary();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const exclusionHint = useMemo(() => `${excludedIds.length} 个账号已排除`, [excludedIds]);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>利润统计</h2>
      <p style={{ color: "#64748b", fontSize: 14 }}>
        按月自动统计，支持自定义时间区间与账号排除，排除账号不参与利润核算与列表展示。
      </p>
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", padding: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <label>
            月份
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ marginLeft: 8, padding: "6px 8px", borderRadius: 8, border: "1px solid #dbe1ea" }} />
          </label>
          <button type="button" onClick={() => loadSummary({ month })} style={{ padding: "7px 12px", borderRadius: 8, border: "none", background: "var(--xt-accent)", color: "#fff", cursor: "pointer" }}>
            按月统计
          </button>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
          <label>
            开始
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={{ marginLeft: 8, padding: "6px 8px", borderRadius: 8, border: "1px solid #dbe1ea" }} />
          </label>
          <label>
            结束
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={{ marginLeft: 8, padding: "6px 8px", borderRadius: 8, border: "1px solid #dbe1ea" }} />
          </label>
          <button type="button" onClick={() => loadSummary({ start, end })} style={{ padding: "7px 12px", borderRadius: 8, border: "none", background: "#0f766e", color: "#fff", cursor: "pointer" }}>
            区间统计
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(160px, 1fr))", gap: 10, marginBottom: 14 }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>订单数：<strong>{summary.total_orders}</strong></div>
        <div style={{ background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>商家支付：<strong>{summary.total_client_pay}</strong></div>
        <div style={{ background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>达人收益：<strong>{summary.total_creator_reward}</strong></div>
        <div style={{ background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>平台利润：<strong>{summary.total_profit}</strong></div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 14 }}>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>排除账号（{exclusionHint}）</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {allUsers.map((u) => (
            <label key={u.id} style={{ minWidth: 220, display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={excludedIds.includes(u.id)}
                onChange={(e) =>
                  setExcludedIds((prev) => (e.target.checked ? Array.from(new Set([...prev, u.id])) : prev.filter((id) => id !== u.id)))
                }
              />
              <span>{u.username}{u.display_name ? ` / ${u.display_name}` : ""}（{u.role}）</span>
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={saveExclusions}
          disabled={saving}
          style={{ marginTop: 10, padding: "7px 12px", borderRadius: 8, border: "none", background: "var(--xt-accent)", color: "#fff", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}
        >
          {saving ? "保存中..." : "保存排除配置"}
        </button>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 14 }}>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>按月利润走势</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {monthly.map((m) => (
            <div key={m.month} style={{ fontSize: 14 }}>
              {m.month}：订单 {m.total_orders}，利润 {m.total_profit}
            </div>
          ))}
          {monthly.length === 0 && <div style={{ color: "#64748b" }}>暂无月度数据</div>}
        </div>
      </div>

      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              <th style={{ padding: 10, textAlign: "left" }}>订单号</th>
              <th style={{ padding: 10, textAlign: "left" }}>完成时间</th>
              <th style={{ padding: 10, textAlign: "left" }}>商家</th>
              <th style={{ padding: 10, textAlign: "left" }}>达人</th>
              <th style={{ padding: 10, textAlign: "left" }}>商家支付</th>
              <th style={{ padding: 10, textAlign: "left" }}>达人收益</th>
              <th style={{ padding: 10, textAlign: "left" }}>平台利润</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td style={{ padding: 10, borderBottom: "1px solid #eef2f7" }}>{r.order_no || `#${r.id}`}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eef2f7", whiteSpace: "nowrap" }}>{formatDateTime(r.completed_at)}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eef2f7" }}>{r.client_username}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eef2f7" }}>{r.influencer_username || "—"}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eef2f7" }}>{r.client_pay_points}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eef2f7" }}>{r.creator_reward_points}</td>
                <td style={{ padding: 10, borderBottom: "1px solid #eef2f7", fontWeight: 700 }}>{r.platform_profit_points}</td>
              </tr>
            ))}
            {!loading && list.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 14, color: "#64748b" }}>暂无数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
