import { useState, useEffect, type FormEvent } from "react";
import * as api from "../clientApi";

type Request = { id: number; product_info: string | null; target_platform: string | null; budget: string | null; need_face: number; status: string; created_at: string };

export default function RequestsPage() {
  const [list, setList] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitIntentHover, setSubmitIntentHover] = useState(false);
  const [form, setForm] = useState({ product_info: "", target_platform: "", budget: "", need_face: false });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getRequests();
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
    setError(null);
    try {
      await api.createRequest({
        product_info: form.product_info.trim() || undefined,
        target_platform: form.target_platform.trim() || undefined,
        budget: form.budget.trim() || undefined,
        need_face: form.need_face,
      });
      setForm({ product_info: "", target_platform: "", budget: "", need_face: false });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    }
  };

  const statusText: Record<string, string> = { draft: "草稿", submitted: "已提交", processing: "处理中", done: "已完成" };

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 20,
        boxShadow: "0 12px 28px rgba(15,23,42,0.08)",
        padding: 24,
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: 10 }}>合作意向与任务需求</h2>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <div style={{ marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          onMouseEnter={() => setSubmitIntentHover(true)}
          onMouseLeave={() => setSubmitIntentHover(false)}
          style={{
            padding: "10px 18px",
            background: submitIntentHover ? "#1e3a8a" : "#1e40af",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            cursor: "pointer",
            transform: submitIntentHover ? "scale(1.03)" : "scale(1)",
            transition: "transform 160ms ease, background-color 160ms ease",
            fontWeight: 600,
          }}
        >
          {showForm ? "取消" : "提交合作意向"}
        </button>
      </div>
      {showForm && (
        <form onSubmit={handleSubmit} style={{ marginBottom: 24, padding: 16, background: "#fff", borderRadius: 12, boxShadow: "0 6px 14px rgba(15,23,42,0.06)", border: "1px solid #eef2f7" }}>
          <div style={{ marginBottom: 8 }}>
            <label>产品/需求说明</label>
            <textarea
              value={form.product_info}
              onChange={(e) => setForm((f) => ({ ...f, product_info: e.target.value }))}
              rows={3}
              style={{ display: "block", marginTop: 4, width: "100%", maxWidth: 400, padding: "8px 10px", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>目标平台</label>
            <input
              type="text"
              value={form.target_platform}
              onChange={(e) => setForm((f) => ({ ...f, target_platform: e.target.value }))}
              placeholder="如：抖音、小红书"
              style={{ display: "block", marginTop: 4, width: "100%", maxWidth: 300, padding: "8px 10px", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>预算范围</label>
            <input
              type="text"
              value={form.budget}
              onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
              placeholder="可选"
              style={{ display: "block", marginTop: 4, width: "100%", maxWidth: 200, padding: "8px 10px", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>
              <input type="checkbox" checked={form.need_face} onChange={(e) => setForm((f) => ({ ...f, need_face: e.target.checked }))} />
              需要露脸视频
            </label>
          </div>
          <button type="submit" style={{ padding: "8px 16px", background: "#007aff", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>提交</button>
        </form>
      )}
      {loading ? <p>加载中…</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {list.map((r) => (
            <div key={r.id} style={{ padding: 16, background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600 }}>#{r.id}</span>
                <span style={{ color: "#666" }}>{statusText[r.status] ?? r.status}</span>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 14 }}>{r.product_info || "—"}</p>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#666" }}>平台：{r.target_platform || "—"} · 预算：{r.budget || "—"} · {r.need_face ? "露脸" : "讲解"}</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#999" }}>{r.created_at}</p>
            </div>
          ))}
        </div>
      )}
      {!loading && list.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "20px 0 8px" }}>
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" stroke="#94a3b8" strokeWidth="1.5" />
            <path d="M7 9h10M7 12h6" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p style={{ color: "#475569", fontSize: 13, margin: 0 }}>暂无合作意向</p>
        </div>
      )}
    </div>
  );
}
