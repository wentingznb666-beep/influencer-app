import { useState, useEffect } from "react";
import * as api from "../clientApi";

type MarketOrder = {
  id: number;
  requirements: string;
  reward_points: number;
  status: string;
  influencer_id: number | null;
  work_link: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

/**
 * 客户端「达人领单」页面：发布要求、查看状态与交付链接。
 */
export default function ClientMarketOrdersPage() {
  const [list, setList] = useState<MarketOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [requirements, setRequirements] = useState("");

  /**
   * 拉取当前用户的发单列表。
   */
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMarketOrders();
      setList(data.list || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /**
   * 提交新订单（需账户至少有约定奖励积分）。
   */
  const handleCreate = async () => {
    setError(null);
    const text = requirements.trim();
    if (!text) {
      setError("请填写任务要求。");
      return;
    }
    try {
      await api.createMarketOrder({ requirements: text });
      setShowForm(false);
      setRequirements("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    }
  };

  const statusText: Record<string, string> = {
    open: "待领取",
    claimed: "已领取/进行中",
    completed: "已完成",
    cancelled: "已取消",
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>达人领单</h2>
      <p style={{ color: "#64748b", fontSize: 14, marginBottom: 16 }}>
        填写任务要求后发布订单，达人领取并在完成后上传交付链接。完成后将从您的积分余额中扣除{" "}
        <strong>10</strong> 积分并结算给达人（发单前需至少 10 积分）。
      </p>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <div style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          style={{ padding: "8px 16px", background: "#007aff", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
        >
          {showForm ? "取消" : "发布新订单"}
        </button>
      </div>
      {showForm && (
        <div style={{ marginBottom: 24, padding: 16, background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <label htmlFor="req">任务要求</label>
          <textarea
            id="req"
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            placeholder="说明需要达人完成的内容、风格、截止时间等"
            rows={5}
            style={{ display: "block", marginTop: 8, marginBottom: 12, width: "100%", maxWidth: 560, padding: "8px 10px", boxSizing: "border-box", borderRadius: 8, border: "1px solid #ddd" }}
          />
          <button type="button" onClick={handleCreate} style={{ padding: "8px 16px", background: "#007aff", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
            发布
          </button>
        </div>
      )}
      {loading ? (
        <p>加载中…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {list.map((o) => (
            <div key={o.id} style={{ padding: 16, background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontWeight: 600 }}>订单 #{o.id}</span>
                <span style={{ color: "#666" }}>
                  {statusText[o.status] ?? o.status} · 奖励 {o.reward_points} 分
                </span>
              </div>
              <p style={{ margin: "10px 0 0", fontSize: 14, whiteSpace: "pre-wrap" }}>{o.requirements}</p>
              {o.work_link && (
                <p style={{ margin: "8px 0 0", fontSize: 14 }}>
                  交付链接：
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
      {!loading && list.length === 0 && <p style={{ color: "#666" }}>暂无订单</p>}
    </div>
  );
}
