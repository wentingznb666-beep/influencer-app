import { useEffect, useState } from "react";
import * as api from "../influencerApi";
import * as matchingApi from "../matchingApi";

type OpenOrder = {
  id: number;
  order_no: string | null;
  title: string | null;
  client_username: string;
  client_display_name: string;
  is_public_apply?: number;
};

type MyApply = {
  id: number;
  status: string;
  market_order_id: number;
  order_no?: string | null;
  title?: string | null;
  client_username?: string;
  client_name?: string;
};

export default function BusinessMatchPage() {
  const statusText: Record<string, string> = {
    pending: "待商家选择",
    selected: "已选中",
    rejected: "已拒绝",
  };
  const [openList, setOpenList] = useState<OpenOrder[]>([]);
  const [myApplies, setMyApplies] = useState<MyApply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [openRes, myRes] = await Promise.all([api.getMarketOrders(), matchingApi.getInfluencerMyApplications()]);
      const openItems = (openRes.list || []) as OpenOrder[];
      setOpenList(openItems.filter((x) => Number(x.is_public_apply || 0) === 1));
      setMyApplies(myRes.list || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const apply = async (id: number) => {
    setError(null);
    try {
      await matchingApi.applyInfluencerMarketOrder(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Apply failed");
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>{"商单撮合"}</h2>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <button type="button" onClick={load} style={{ marginBottom: 12 }}>{"刷新"}</button>
      {loading ? <p>{"加载中..."}</p> : (
        <>
          <h3>{"公开报名任务"}</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {openList.map((item) => (
              <div key={item.id} style={{ background: "#fff", borderRadius: 8, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <div style={{ fontWeight: 700 }}>{"订单号"}?{item.order_no || `#${item.id}`}</div>
                <div style={{ marginTop: 4 }}>{"标题"}?{item.title || "-"}</div>
                <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>{"商家"}?{item.client_username} / {item.client_display_name}</div>
                <button type="button" onClick={() => apply(item.id)} style={{ marginTop: 8, padding: "6px 12px" }}>{"一键报名"}</button>
              </div>
            ))}
            {openList.length === 0 && <p style={{ color: "#666" }}>{"暂无公开报名任务"}</p>}
          </div>

          <h3 style={{ marginTop: 20 }}>{"我的报名"}</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {myApplies.map((item) => (
              <div key={item.id} style={{ background: "#fff", borderRadius: 8, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <div style={{ fontWeight: 700 }}>{"订单号"}?{item.order_no || `#${item.market_order_id}`}</div>
                <div style={{ marginTop: 4 }}>{"标题"}?{item.title || "-"}</div>
                <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>{"商家"}?{item.client_username} / {item.client_name}</div>
                <div style={{ marginTop: 4 }}>{"状态"}?{statusText[item.status] || item.status}</div>
              </div>
            ))}
            {myApplies.length === 0 && <p style={{ color: "#666" }}>{"暂无报名记录"}</p>}
          </div>
        </>
      )}
    </div>
  );
}
