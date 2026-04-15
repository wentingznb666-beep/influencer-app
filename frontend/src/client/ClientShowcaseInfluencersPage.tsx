import { useEffect, useState } from "react";
import { resolvePublicUploadUrl } from "../fetchWithAuth";
import * as api from "../clientApi";

type Row = {
  id: number;
  name: string;
  photos: string[];
  intro: string | null;
  tiktok_followers_text: string | null;
  sales_text: string | null;
  sellable_types_text: string | null;
  skills_text: string | null;
  video_url: string | null;
  selected: number;
};

/**
 * 商家端 Influencer 展示：仅浏览与预约；卡片排版与「模特展示」商家端/管理端列表一致。
 */
export default function ClientShowcaseInfluencersPage() {
  const [list, setList] = useState<Row[]>([]);
  const [myList, setMyList] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  /** 加载可选列表与我的预约。 */
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [allRes, myRes] = await Promise.all([
        api.getClientShowcaseInfluencers({ q: q.trim() || undefined }),
        api.getMyShowcaseInfluencers(),
      ]);
      setList((allRes.list || []) as Row[]);
      setMyList((myRes.list || []) as Row[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /** 切换预约状态。 */
  const toggle = async (id: number, selected: boolean) => {
    setError(null);
    try {
      await api.updateShowcaseInfluencerSelection(id, !selected);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Influencer（带货达人）</h2>
      <p style={{ fontSize: 14, color: "#64748b" }}>浏览已启用达人资料，可预约合作；此处不可编辑或上传任何资料。</p>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <div style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索模特名称/介绍" style={{ padding: "8px 12px", border: "1px solid #dbe1ea", borderRadius: 8, minWidth: 260 }} />
        <button type="button" onClick={load} style={{ padding: "8px 14px", border: "none", borderRadius: 8, background: "var(--xt-accent)", color: "#fff", cursor: "pointer" }}>
          搜索
        </button>
      </div>

      <section style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 8px" }}>我的预约</h3>
        {myList.length === 0 ? (
          <p style={{ color: "#64748b" }}>暂无预约</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {myList.map((m) => (
              <div key={`my-${m.id}`} style={{ background: "#fff", borderRadius: 10, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <strong>{m.name}</strong>
                <div style={{ marginTop: 8, whiteSpace: "pre-wrap", color: "#334155" }}>{m.intro || "暂无介绍"}</div>
                <div style={{ marginTop: 8, fontSize: 14, color: "#475569", display: "grid", gap: 4 }}>
                  <div>
                    <span style={{ color: "#64748b" }}>TK 粉丝数：</span>
                    {m.tiktok_followers_text?.trim() ? m.tiktok_followers_text : "—"}
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>TK 销售额：</span>
                    {m.sales_text?.trim() ? m.sales_text : "—"}
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>可售商品类型：</span>
                    {m.sellable_types_text?.trim() ? m.sellable_types_text : "—"}
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>技能：</span>
                    {m.skills_text?.trim() ? m.skills_text : "—"}
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  视频链接：
                  {m.video_url?.trim() ? (
                    <a href={m.video_url} target="_blank" rel="noreferrer">
                      {m.video_url}
                    </a>
                  ) : (
                    "—"
                  )}
                </div>
                {Array.isArray(m.photos) && m.photos.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {m.photos.map((url, idx) => (
                      <a key={`my-${m.id}-${idx}`} href={resolvePublicUploadUrl(url)} target="_blank" rel="noreferrer">
                        <img src={resolvePublicUploadUrl(url)} alt={`my-inf-${m.id}-${idx}`} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" }} />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 style={{ margin: "0 0 8px" }}>可选 Influencer</h3>
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
                      onClick={() => toggle(m.id, selected)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: selected ? "1px solid #fecaca" : "1px solid #bbf7d0",
                        background: "#fff",
                        color: selected ? "#b91c1c" : "#166534",
                        cursor: "pointer",
                      }}
                    >
                      {selected ? "取消预约" : "预约合作"}
                    </button>
                  </div>
                  <div style={{ marginTop: 8, whiteSpace: "pre-wrap", color: "#334155" }}>{m.intro || "暂无介绍"}</div>
                  <div style={{ marginTop: 8, fontSize: 14, color: "#475569", display: "grid", gap: 4 }}>
                    <div>
                      <span style={{ color: "#64748b" }}>TK 粉丝数：</span>
                      {m.tiktok_followers_text?.trim() ? m.tiktok_followers_text : "—"}
                    </div>
                    <div>
                      <span style={{ color: "#64748b" }}>TK 销售额：</span>
                      {m.sales_text?.trim() ? m.sales_text : "—"}
                    </div>
                    <div>
                      <span style={{ color: "#64748b" }}>可售商品类型：</span>
                      {m.sellable_types_text?.trim() ? m.sellable_types_text : "—"}
                    </div>
                    <div>
                      <span style={{ color: "#64748b" }}>技能：</span>
                      {m.skills_text?.trim() ? m.skills_text : "—"}
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    视频链接：
                    {m.video_url?.trim() ? (
                      <a href={m.video_url} target="_blank" rel="noreferrer">
                        {m.video_url}
                      </a>
                    ) : (
                      "—"
                    )}
                  </div>
                  {Array.isArray(m.photos) && m.photos.length > 0 && (
                    <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {m.photos.map((url, idx) => (
                        <a key={`${m.id}-${idx}`} href={resolvePublicUploadUrl(url)} target="_blank" rel="noreferrer">
                          <img src={resolvePublicUploadUrl(url)} alt={`client-inf-${m.id}-${idx}`} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" }} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {list.length === 0 && <p style={{ color: "#666" }}>暂无可展示达人</p>}
          </div>
        )}
      </section>
    </div>
  );
}