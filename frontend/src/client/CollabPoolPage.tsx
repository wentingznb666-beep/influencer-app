import { useEffect, useState } from "react";
import * as matchingApi from "../matchingApi";

type DemandItem = {
  id: number;
  title: string;
  demand_detail?: string | null;
  expected_points: number;
  influencer_username: string;
  influencer_name: string;
};

export default function CollabPoolPage() {
  const [list, setList] = useState<DemandItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await matchingApi.getClientCollabPool();
      setList(data.list || []);
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
      await matchingApi.applyClientCollabPool(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Apply failed");
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>{"达人合作池"}</h2>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <button type="button" onClick={load} style={{ marginBottom: 12 }}>{"刷新"}</button>
      {loading ? <p>{"加载中..."}</p> : (
        <div style={{ display: "grid", gap: 12 }}>
          {list.map((item) => (
            <div key={item.id} style={{ background: "#fff", borderRadius: 8, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <div style={{ fontWeight: 700 }}>{item.title}</div>
              <div style={{ marginTop: 6, color: "#475569", whiteSpace: "pre-wrap" }}>{item.demand_detail || "-"}</div>
              <div style={{ marginTop: 6, fontSize: 13, color: "#64748b" }}>
                {"达人"}?{item.influencer_username} / {item.influencer_name} ? {"期望积分"}?{item.expected_points}
              </div>
              <button type="button" onClick={() => apply(item.id)} style={{ marginTop: 10, padding: "6px 12px" }}>{"一键报名"}</button>
            </div>
          ))}
          {list.length === 0 && <p style={{ color: "#666" }}>{"暂无开放需求"}</p>}
        </div>
      )}
    </div>
  );
}
