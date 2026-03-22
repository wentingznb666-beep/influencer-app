import { useState, useEffect } from "react";
import * as api from "../adminApi";

type Row = {
  id: number;
  order_no: string | null;
  title: string | null;
  requirements: string;
  reward_points: number;
  status: string;
  client_username: string;
  influencer_username: string | null;
  work_link: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

/**
 * 管理员端：达人领单全量列表，支持按订单号/标题/要求精准搜索。
 */
export default function MarketOrdersPage() {
  const [list, setList] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");

  /**
   * 拉取列表（可选搜索关键词）。
   */
  const load = async (q?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAdminMarketOrders(q?.trim() ? { q: q.trim() } : undefined);
      setList((data.list as Row[]) || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const statusText: Record<string, string> = {
    open: "待领取",
    claimed: "已领取/进行中",
    completed: "已完成",
    cancelled: "已取消",
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>达人领单</h2>
      <p style={{ fontSize: 14, color: "#64748b" }}>查看客户端发布的达人领单；支持按订单号、订单标题或任务要求全文进行精准匹配。</p>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="输入订单号、标题或要求全文（精准）"
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #dbe1ea", minWidth: 280 }}
        />
        <button
          type="button"
          onClick={() => load(searchQ)}
          style={{ padding: "8px 16px", background: "#007aff", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
        >
          搜索
        </button>
        <button
          type="button"
          onClick={() => {
            setSearchQ("");
            load();
          }}
          style={{ padding: "8px 16px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer" }}
        >
          清空
        </button>
      </div>
      {loading ? (
        <p>加载中…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {list.map((o) => (
            <div key={o.id} style={{ padding: 16, background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>订单号：{o.order_no || `（内部ID ${o.id}）`}</div>
                  {o.title && <div style={{ marginTop: 6, fontSize: 14, color: "#334155" }}>标题：{o.title}</div>}
                </div>
                <span style={{ color: "#666" }}>
                  {statusText[o.status] ?? o.status} · 奖励 {o.reward_points} 分
                </span>
              </div>
              <p style={{ margin: "10px 0 0", fontSize: 13, color: "#64748b" }}>
                商家：{o.client_username}
                {o.influencer_username ? ` · 达人：${o.influencer_username}` : ""}
              </p>
              <p style={{ margin: "10px 0 0", fontSize: 14, whiteSpace: "pre-wrap" }}>{o.requirements}</p>
              {o.work_link && (
                <p style={{ margin: "8px 0 0", fontSize: 14 }}>
                  交付：
                  <a href={o.work_link} target="_blank" rel="noreferrer">
                    {o.work_link}
                  </a>
                </p>
              )}
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "#999" }}>
                创建：{o.created_at}
                {o.completed_at ? ` · 完成：${o.completed_at}` : ""}
              </p>
            </div>
          ))}
        </div>
      )}
      {!loading && list.length === 0 && <p style={{ color: "#666" }}>暂无数据</p>}
    </div>
  );
}
