import { useEffect, useState } from "react";
import { resolvePublicUploadUrl } from "../fetchWithAuth";
import * as api from "../clientApi";

type ModelRow = {
  id: number;
  name: string;
  photos: string[];
  intro: string | null;
  cloud_link: string;
  selected: number;
};

/**
 * 客户端模特展示页：浏览、筛选并选择长期合作模特。
 */
export default function ClientModelsPage() {
  const [list, setList] = useState<ModelRow[]>([]);
  const [myList, setMyList] = useState<ModelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  /**
   * 拉取可展示模特与我的合作列表。
   */
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [allRes, myRes] = await Promise.all([api.getClientModels({ q: q.trim() || undefined }), api.getMyCooperationModels()]);
      setList((allRes.list || []) as ModelRow[]);
      setMyList((myRes.list || []) as ModelRow[]);
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

  /**
   * 切换长期合作状态。
   */
  const toggleCooperation = async (modelId: number, selected: boolean) => {
    setError(null);
    try {
      await api.updateModelCooperation(modelId, !selected);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>模特展示</h2>
      <p style={{ fontSize: 14, color: "#64748b" }}>浏览已启用模特，选择长期合作对象；仅显示你自己的合作选择。</p>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <div style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索模特名称/介绍" style={{ padding: "8px 12px", border: "1px solid #dbe1ea", borderRadius: 8, minWidth: 260 }} />
        <button type="button" onClick={load} style={{ padding: "8px 14px", border: "none", borderRadius: 8, background: "var(--xt-accent)", color: "#fff", cursor: "pointer" }}>
          搜索
        </button>
      </div>

      <section style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px" }}>我的合作模特</h3>
        {myList.length === 0 ? (
          <p style={{ color: "#64748b" }}>暂无长期合作模特</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {myList.map((m) => (
              <div key={`my-${m.id}`} style={{ background: "#fff", borderRadius: 10, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <strong>{m.name}</strong>
                <div style={{ marginTop: 6, whiteSpace: "pre-wrap", color: "#334155" }}>{m.intro || "暂无介绍"}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 style={{ margin: "0 0 8px" }}>可选模特</h3>
        {loading ? (
          <p>加载中…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {list.map((m) => {
              const selected = Number(m.selected) === 1;
              return (
                <div key={m.id} style={{ background: "#fff", borderRadius: 10, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <strong>{m.name}</strong>
                    <button
                      type="button"
                      onClick={() => toggleCooperation(m.id, selected)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: selected ? "1px solid #fecaca" : "1px solid #bbf7d0",
                        background: "#fff",
                        color: selected ? "#b91c1c" : "#166534",
                        cursor: "pointer",
                      }}
                    >
                      {selected ? "取消长期合作" : "设为长期合作"}
                    </button>
                  </div>
                  <div style={{ marginTop: 8, whiteSpace: "pre-wrap", color: "#334155" }}>{m.intro || "暂无介绍"}</div>
                  <div style={{ marginTop: 8 }}>
                    视频链接：<a href={m.cloud_link} target="_blank" rel="noreferrer">{m.cloud_link}</a>
                  </div>
                  {Array.isArray(m.photos) && m.photos.length > 0 && (
                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {m.photos.map((url, idx) => (
                        <a key={`${m.id}-${idx}`} href={resolvePublicUploadUrl(url)} target="_blank" rel="noreferrer">
                          <img src={resolvePublicUploadUrl(url)} alt={`client-model-${m.id}-${idx}`} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" }} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {list.length === 0 && <p style={{ color: "#666" }}>暂无可展示模特</p>}
          </div>
        )}
      </section>
    </div>
  );
}

