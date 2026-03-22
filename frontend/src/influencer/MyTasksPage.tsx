import { useState, useEffect, type FormEvent } from "react";
import * as api from "../influencerApi";

type Claim = {
  claim_id: number;
  task_id: number;
  claim_status: string;
  claimed_at: string;
  point_reward: number;
  platform: string;
  task_type: string;
  material_title: string;
  cloud_link: string;
  submission_id: number | null;
  work_link: string | null;
  submission_status: string | null;
  review_note: string | null;
};

export default function MyTasksPage() {
  const [list, setList] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitClaimId, setSubmitClaimId] = useState<number | null>(null);
  const [workLink, setWorkLink] = useState("");
  const [note, setNote] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMyClaims();
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitClaimId == null || !workLink.trim()) return;
    setError(null);
    try {
      await api.submitWork({ task_claim_id: submitClaimId, work_link: workLink.trim(), note: note.trim() || undefined });
      setSubmitClaimId(null);
      setWorkLink("");
      setNote("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    }
  };

  const statusText = (c: Claim) => {
    if (c.claim_status === "pending") return "待发布";
    if (c.claim_status === "submitted") return c.submission_status === "pending" ? "待审核" : c.submission_status;
    if (c.claim_status === "approved") return "已通过";
    if (c.claim_status === "rejected") return "已驳回";
    if (c.claim_status === "locked") return "锁定期";
    if (c.claim_status === "settled") return "已结算";
    return c.claim_status;
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>我的任务</h2>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      {submitClaimId != null && (
        <form
          onSubmit={handleSubmit}
          style={{ marginBottom: 24, padding: 16, background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
        >
          <h3>提交作品链接</h3>
          <div style={{ marginBottom: 8 }}>
            <label>作品链接 *</label>
            <input
              type="url"
              value={workLink}
              onChange={(e) => setWorkLink(e.target.value)}
              required
              placeholder="https://..."
              style={{ marginLeft: 8, width: "100%", maxWidth: 400, padding: "8px 10px", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>备注（可选）</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ marginLeft: 8, width: "100%", maxWidth: 400, padding: "8px 10px", boxSizing: "border-box" }}
            />
          </div>
          <button type="submit" style={{ padding: "8px 16px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
            提交
          </button>
          <button
            type="button"
            onClick={() => { setSubmitClaimId(null); setWorkLink(""); setNote(""); }}
            style={{ marginLeft: 8, padding: "8px 16px", border: "1px solid #ddd", borderRadius: 8, cursor: "pointer" }}
          >
            取消
          </button>
        </form>
      )}
      {loading ? (
        <p>加载中…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {list.map((c) => (
            <div
              key={c.claim_id}
              style={{
                padding: 16,
                background: "#fff",
                borderRadius: 8,
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <strong>{c.material_title}</strong>
                  <span style={{ marginLeft: 8, color: "#666" }}>{c.platform} · {c.point_reward} 积分</span>
                  <p style={{ margin: "8px 0 0", fontSize: 14 }}>
                    <a href={c.cloud_link} target="_blank" rel="noreferrer">打开云盘下载</a>
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "#666" }}>领取时间：{c.claimed_at}</p>
                  {c.review_note && (
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "#c00" }}>审核备注：{c.review_note}</p>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#666" }}>{statusText(c)}</span>
                  {c.claim_status === "pending" && submitClaimId !== c.claim_id && (
                    <button
                      type="button"
                      onClick={() => setSubmitClaimId(c.claim_id)}
                      style={{ padding: "6px 12px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}
                    >
                      提交作品
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && list.length === 0 && <p style={{ color: "#666" }}>暂无任务，请到任务大厅领取</p>}
    </div>
  );
}
