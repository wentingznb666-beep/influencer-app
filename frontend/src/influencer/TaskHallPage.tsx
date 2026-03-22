import { useState, useEffect } from "react";
import * as api from "../influencerApi";

type Task = {
  id: number;
  material_title: string;
  type: string;
  platform: string;
  point_reward: number;
  cloud_link: string;
  material_remark: string | null;
  claimed: boolean;
};

export default function TaskHallPage() {
  const [list, setList] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [filterPlatform, setFilterPlatform] = useState("");
  const [filterType, setFilterType] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTasks({
        platform: filterPlatform || undefined,
        type: filterType || undefined,
      });
      setList(data.list || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filterPlatform, filterType]);

  const handleClaim = async (taskId: number) => {
    setError(null);
    setClaimingId(taskId);
    try {
      await api.claimTask(taskId);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "领取失败");
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>任务大厅</h2>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
        <select value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)} style={{ padding: "6px 10px" }}>
          <option value="">全部平台</option>
          <option value="抖音">抖音</option>
          <option value="小红书">小红书</option>
          <option value="快手">快手</option>
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ padding: "6px 10px" }}>
          <option value="">全部类型</option>
          <option value="face">露脸</option>
          <option value="explain">讲解</option>
        </select>
      </div>
      {loading ? (
        <p>加载中…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {list.map((t) => (
            <div
              key={t.id}
              style={{
                padding: 16,
                background: "#fff",
                borderRadius: 8,
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <strong>{t.material_title}</strong>
                <span style={{ marginLeft: 8, color: "#666" }}>
                  {t.type === "face" ? "露脸" : "讲解"} · {t.platform}
                </span>
                <p style={{ margin: "8px 0 0", fontSize: 14, color: "#666" }}>{t.material_remark || "—"}</p>
                <p style={{ margin: "4px 0 0", fontSize: 14 }}>
                  <a href={t.cloud_link} target="_blank" rel="noreferrer">
                    打开云盘链接
                  </a>
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontWeight: 600, color: "var(--xt-accent)" }}>{t.point_reward} 积分</span>
                {t.claimed ? (
                  <span style={{ color: "#666" }}>已领取</span>
                ) : (
                  <button
                    type="button"
                    disabled={claimingId === t.id}
                    onClick={() => handleClaim(t.id)}
                    style={{
                      padding: "8px 16px",
                      background: "var(--xt-accent)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      cursor: claimingId === t.id ? "not-allowed" : "pointer",
                    }}
                  >
                    {claimingId === t.id ? "领取中…" : "领取"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && list.length === 0 && <p style={{ color: "#666" }}>暂无可用任务</p>}
    </div>
  );
}
