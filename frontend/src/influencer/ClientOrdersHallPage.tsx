import { useState, useEffect } from "react";
import * as api from "../influencerApi";

type OpenOrder = {
  id: number;
  requirements: string;
  reward_points: number;
  status: string;
  created_at: string;
};

type MyOrder = {
  id: number;
  requirements: string;
  reward_points: number;
  status: string;
  work_link: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

/**
 * 达人端：客户端发单大厅与我的领单，支持领取与提交完成链接。
 */
export default function ClientOrdersHallPage() {
  const [openList, setOpenList] = useState<OpenOrder[]>([]);
  const [myList, setMyList] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completeId, setCompleteId] = useState<number | null>(null);
  const [workLink, setWorkLink] = useState("");

  /**
   * 加载大厅与我的订单。
   */
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [openRes, myRes] = await Promise.all([api.getMarketOrders(), api.getMyMarketOrders()]);
      setOpenList(openRes.list || []);
      setMyList(myRes.list || []);
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
   * 领取一条待处理订单。
   * @param orderId 订单 ID
   */
  const handleClaim = async (orderId: number) => {
    setError(null);
    try {
      await api.claimMarketOrder(orderId);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "领取失败");
    }
  };

  /**
   * 提交完成与交付链接以结算积分。
   */
  const handleComplete = async () => {
    if (completeId == null) return;
    const link = workLink.trim();
    if (!link) {
      setError("请填写交付链接。");
      return;
    }
    setError(null);
    try {
      await api.completeMarketOrder(completeId, link);
      setCompleteId(null);
      setWorkLink("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败");
    }
  };

  const statusText: Record<string, string> = {
    open: "待领取",
    claimed: "进行中",
    completed: "已完成",
    cancelled: "已取消",
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>客户端发单</h2>
      <p style={{ color: "#64748b", fontSize: 14, marginBottom: 16 }}>
        领取商家发布的任务，完成后提交交付链接即可获得约定积分（由商家账户扣除）。
      </p>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <button type="button" onClick={load} style={{ marginBottom: 16, padding: "6px 12px", border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer" }}>
        刷新
      </button>

      <h3 style={{ fontSize: 16 }}>待领取</h3>
      {loading ? (
        <p>加载中…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
          {openList.map((o) => (
            <div key={o.id} style={{ padding: 16, background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontWeight: 600 }}>#{o.id}</span>
                <span style={{ color: "#166534", fontWeight: 600 }}>+{o.reward_points} 积分</span>
              </div>
              <p style={{ margin: "10px 0", fontSize: 14, whiteSpace: "pre-wrap" }}>{o.requirements}</p>
              <button type="button" onClick={() => handleClaim(o.id)} style={{ padding: "8px 16px", background: "#007aff", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
                领取
              </button>
            </div>
          ))}
          {openList.length === 0 && <p style={{ color: "#666" }}>暂无待领取订单</p>}
        </div>
      )}

      <h3 style={{ fontSize: 16 }}>我的领单</h3>
      {!loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {myList.map((o) => (
            <div key={o.id} style={{ padding: 16, background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontWeight: 600 }}>#{o.id}</span>
                <span style={{ color: "#666" }}>{statusText[o.status] ?? o.status}</span>
              </div>
              <p style={{ margin: "10px 0", fontSize: 14, whiteSpace: "pre-wrap" }}>{o.requirements}</p>
              {o.work_link && (
                <p style={{ fontSize: 14 }}>
                  交付：
                  <a href={o.work_link} target="_blank" rel="noreferrer">
                    {o.work_link}
                  </a>
                </p>
              )}
              {o.status === "claimed" && (
                <div style={{ marginTop: 12 }}>
                  {completeId === o.id ? (
                    <div>
                      <input
                        type="url"
                        value={workLink}
                        onChange={(e) => setWorkLink(e.target.value)}
                        placeholder="https://..."
                        style={{ width: "100%", maxWidth: 400, padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", marginRight: 8 }}
                      />
                      <button type="button" onClick={handleComplete} style={{ padding: "8px 16px", background: "#007aff", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", marginTop: 8 }}>
                        确认提交
                      </button>
                      <button type="button" onClick={() => { setCompleteId(null); setWorkLink(""); }} style={{ marginLeft: 8, padding: "8px 16px", border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer", marginTop: 8 }}>
                        取消
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => { setCompleteId(o.id); setWorkLink(""); }} style={{ padding: "8px 16px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
                      完成并上传链接
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {myList.length === 0 && <p style={{ color: "#666" }}>暂无记录</p>}
        </div>
      )}
    </div>
  );
}
