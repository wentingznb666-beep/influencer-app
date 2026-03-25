import { useEffect, useState } from "react";
import * as api from "../adminApi";

type Row = {
  id: number;
  client_id: number;
  client_username: string;
  request_id: number | null;
  product_info: string | null;
  target_platform: string | null;
  status: "pending" | "sent" | "received" | string;
  note: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * 管理员端：客户订单列表（sample_orders），支持搜索与状态筛选。
 */
export default function OrdersPage() {
  const [list, setList] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | "pending" | "sent" | "received">("");

  /**
   * 拉取订单列表（支持条件查询）。
   */
  const load = async (nextQ?: string, nextStatus?: "" | "pending" | "sent" | "received") => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAdminOrders({
        q: (nextQ ?? q).trim() || undefined,
        status: (nextStatus ?? status) || undefined,
      });
      setList((data.list as Row[]) || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusText: Record<string, string> = {
    pending: "待寄送",
    sent: "已寄出",
    received: "已收货",
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>客户订单列表</h2>
      <p style={{ fontSize: 14, color: "#64748b" }}>展示所有客户提交的样品寄送/订单跟踪记录；支持按订单号、用户名或备注搜索。</p>
      {error && <p style={{ color: "#c00" }}>{error}</p>}

      <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索：订单号(数字)、用户名或备注（模糊）"
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #dbe1ea", minWidth: 280 }}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as any)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #dbe1ea", background: "#fff", minWidth: 140 }}>
          <option value="">全部状态</option>
          <option value="pending">待寄送</option>
          <option value="sent">已寄出</option>
          <option value="received">已收货</option>
        </select>
        <button type="button" onClick={() => load(q, status)} style={{ padding: "8px 16px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
          搜索
        </button>
        <button
          type="button"
          onClick={() => {
            setQ("");
            setStatus("");
            load("", "");
          }}
          style={{ padding: "8px 16px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer" }}
        >
          清空
        </button>
      </div>

      {loading ? (
        <p>加载中…</p>
      ) : (
        <div style={{ overflowX: "auto", background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
            <thead>
              <tr style={{ background: "#f5f5f5" }}>
                <th style={{ padding: 10, textAlign: "left" }}>订单号</th>
                <th style={{ padding: 10, textAlign: "left" }}>客户</th>
                <th style={{ padding: 10, textAlign: "left" }}>状态</th>
                <th style={{ padding: 10, textAlign: "left" }}>关联需求</th>
                <th style={{ padding: 10, textAlign: "left" }}>备注</th>
                <th style={{ padding: 10, textAlign: "left" }}>创建时间</th>
                <th style={{ padding: 10, textAlign: "left" }}>更新时间</th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id}>
                  <td style={{ padding: 10, borderBottom: "1px solid #eef2f7" }}>#{o.id}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eef2f7" }}>
                    {o.client_username} (ID:{o.client_id})
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eef2f7" }}>{statusText[o.status] ?? o.status}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eef2f7" }}>
                    {o.product_info ? (
                      <span>{o.product_info}{o.target_platform ? ` · ${o.target_platform}` : ""}</span>
                    ) : (
                      <span style={{ color: "#94a3b8" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eef2f7" }}>{o.note || <span style={{ color: "#94a3b8" }}>—</span>}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eef2f7", whiteSpace: "nowrap" }}>{o.created_at}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eef2f7", whiteSpace: "nowrap" }}>{o.updated_at}</td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 14, color: "var(--xt-text-muted)" }}>
                    暂无订单
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

