import { useState, useEffect } from "react";
import * as api from "../clientApi";

type Work = {
  id: number;
  work_link: string;
  submitted_at: string;
  influencer_username: string;
  platform: string;
  point_reward: number;
  material_title: string;
  material_type: string;
  play_count: number | null;
};

export default function WorksPage() {
  const [list, setList] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .getWorks()
      .then((data) => setList(data.list || []))
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>达人已发布作品</h2>
      <p style={{ fontSize: 14, color: "#666" }}>以下为已通过审核的达人投稿，露脸视频需与达人一对一绑定后使用，讲解视频可按组下载并注意防关联。</p>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      {loading ? (
        <p>加载中…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {list.map((w) => (
            <div
              key={w.id}
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
                <strong>{w.material_title}</strong>
                <span style={{ marginLeft: 8, color: "#666" }}>
                  {w.material_type === "face" ? "露脸" : "讲解"} · {w.platform}
                </span>
                <p style={{ margin: "8px 0 0", fontSize: 14 }}>达人：{w.influencer_username}</p>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#666" }}>提交时间：{w.submitted_at}</p>
              </div>
              <div>
                <a href={w.work_link} target="_blank" rel="noreferrer" style={{ padding: "8px 16px", background: "var(--xt-accent)", color: "#fff", borderRadius: 8, textDecoration: "none" }}>
                  打开作品
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && list.length === 0 && <p style={{ color: "#666" }}>暂无已发布作品</p>}
    </div>
  );
}
