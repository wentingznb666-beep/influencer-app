import { useEffect, useState } from "react";
import * as matchingApi from "../matchingApi";

type DemandItem = {
  id: number;
  title: string;
  demand_detail?: string | null;
  expected_points: number;
  status: string;
};

type DemandApply = {
  id: number;
  status: string;
  client_username: string;
  client_name: string;
  note?: string | null;
};

export default function InfluencerDemandsPage() {
  const demandStatusText: Record<string, string> = {
    pending_review: "待审核",
    open: "开放中",
    matched: "已匹配",
    rejected: "已驳回",
    closed: "已关闭",
  };
  const applyStatusText: Record<string, string> = {
    pending: "待处理",
    selected: "已选中",
    rejected: "已拒绝",
  };

  const [canCreate, setCanCreate] = useState(false);
  const [list, setList] = useState<DemandItem[]>([]);
  const [activeDemandId, setActiveDemandId] = useState<number | null>(null);
  const [applications, setApplications] = useState<DemandApply[]>([]);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [expectedPoints, setExpectedPoints] = useState(5);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const data = await matchingApi.getInfluencerDemands();
      setCanCreate(!!data.can_create);
      setList(data.list || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    setError(null);
    try {
      await matchingApi.createInfluencerDemand({ title: title.trim(), demand_detail: detail.trim(), expected_points: expectedPoints });
      setTitle("");
      setDetail("");
      setExpectedPoints(5);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    }
  };

  const viewApplications = async (demandId: number) => {
    setActiveDemandId(demandId);
    setError(null);
    try {
      const data = await matchingApi.getInfluencerDemandApplications(demandId);
      setApplications(data.list || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load applications failed");
    }
  };

  const selectClient = async (appId: number) => {
    if (activeDemandId == null) return;
    setError(null);
    try {
      await matchingApi.selectInfluencerDemandApplication(activeDemandId, appId);
      await viewApplications(activeDemandId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Select failed");
    }
  };

  const rejectClient = async (appId: number) => {
    if (activeDemandId == null) return;
    setError(null);
    try {
      await matchingApi.rejectInfluencerDemandApplication(activeDemandId, appId);
      await viewApplications(activeDemandId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed");
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>{"发布合作需求"}</h2>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      {canCreate ? (
        <div style={{ background: "#fff", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={"需求标题"} style={{ width: "100%", marginBottom: 8, padding: "8px 10px", boxSizing: "border-box" }} />
          <textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder={"需求内容"} rows={4} style={{ width: "100%", marginBottom: 8, padding: "8px 10px", boxSizing: "border-box" }} />
          <input type="number" value={expectedPoints} min={1} onChange={(e) => setExpectedPoints(Math.max(1, Number(e.target.value) || 1))} style={{ width: 180, marginBottom: 8, padding: "8px 10px", boxSizing: "border-box" }} />
          <div><button type="button" onClick={create}>{"提交审核"}</button></div>
        </div>
      ) : (
        <p style={{ color: "#666" }}>{"当前账号未开通发布合作需求权限。"}</p>
      )}

      <h3>{"我的需求"}</h3>
      <div style={{ display: "grid", gap: 10 }}>
        {list.map((item) => (
          <div key={item.id} style={{ background: "#fff", borderRadius: 8, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <div style={{ fontWeight: 700 }}>{item.title}</div>
            <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>{"状态"}?{demandStatusText[item.status] || item.status} ? {"期望积分"}?{item.expected_points}</div>
            <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{item.demand_detail || "-"}</div>
            {(item.status === "open" || item.status === "matched") && (
              <button type="button" onClick={() => viewApplications(item.id)} style={{ marginTop: 8, padding: "6px 12px" }}>{"查看商家报名"}</button>
            )}
          </div>
        ))}
        {list.length === 0 && <p style={{ color: "#666" }}>{"暂无需求"}</p>}
      </div>

      {activeDemandId != null && (
        <div style={{ marginTop: 20 }}>
          <h3>{"商家报名列表（需求"} #{activeDemandId}{"）"}</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {applications.map((app) => (
              <div key={app.id} style={{ background: "#fff", borderRadius: 8, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <div style={{ fontWeight: 700 }}>{app.client_username} / {app.client_name}</div>
                <div style={{ marginTop: 4 }}>{"状态"}?{applyStatusText[app.status] || app.status}</div>
                <div style={{ marginTop: 4, color: "#64748b" }}>{"备注"}?{app.note || "-"}</div>
                {app.status === "pending" && (
                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                    <button type="button" onClick={() => selectClient(app.id)}>{"选中"}</button>
                    <button type="button" onClick={() => rejectClient(app.id)}>{"拒绝"}</button>
                  </div>
                )}
              </div>
            ))}
            {applications.length === 0 && <p style={{ color: "#666" }}>{"暂无报名"}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
