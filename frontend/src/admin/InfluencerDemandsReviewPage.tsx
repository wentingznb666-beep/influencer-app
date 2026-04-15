import { useEffect, useState } from "react";
import * as matchingApi from "../matchingApi";

type Demand = {
  id: number;
  title: string;
  demand_detail?: string | null;
  expected_points: number;
  status: string;
  influencer_username: string;
  influencer_name: string;
};

export default function InfluencerDemandsReviewPage() {
  const [status, setStatus] = useState("");
  const [list, setList] = useState<Demand[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async (nextStatus?: string) => {
    const finalStatus = nextStatus ?? status;
    setError(null);
    try {
      const data = await matchingApi.getAdminDemands(finalStatus || undefined);
      setList(data.list || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const review = async (id: number, action: "approve" | "reject") => {
    setError(null);
    try {
      await matchingApi.reviewAdminDemand(id, action);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>{"达人合作需求审核"}</h2>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{"全部状态"}</option>
          <option value="pending_review">{"待审核"}</option>
          <option value="open">{"已通过"}</option>
          <option value="rejected">{"已驳回"}</option>
          <option value="matched">{"已匹配"}</option>
        </select>
        <button type="button" onClick={() => load(status)}>{"查询"}</button>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {list.map((item) => (
          <div key={item.id} style={{ background: "#fff", borderRadius: 8, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <div style={{ fontWeight: 700 }}>{item.title}</div>
            <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>{"达人"}?{item.influencer_username} / {item.influencer_name} ? {"状态"}?{item.status} ? {"积分"}?{item.expected_points}</div>
            <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{item.demand_detail || "-"}</div>
            {item.status === "pending_review" && (
              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                <button type="button" onClick={() => review(item.id, "approve")}>{"通过"}</button>
                <button type="button" onClick={() => review(item.id, "reject")}>{"驳回"}</button>
              </div>
            )}
          </div>
        ))}
        {list.length === 0 && <p style={{ color: "#666" }}>{"暂无记录"}</p>}
      </div>
    </div>
  );
}
