import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as api from "../clientApi";

type RequestItem = {
  id: number;
  product_info: string | null;
  target_platform: string | null;
  budget: string | null;
  need_face: number;
  status: string;
  created_at: string;
};

/**
 * 合作意向编辑页：回显并允许提交更新（不改变原有字段含义与流程）。
 */
export default function RequestEditPage() {
  const { id } = useParams();
  const reqId = Number(id);
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<RequestItem | null>(null);
  const [form, setForm] = useState({ product_info: "", target_platform: "", budget: "", need_face: false });

  useEffect(() => {
    if (!Number.isInteger(reqId) || reqId < 1) {
      setError("无效的需求 ID。");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    (async () => {
      const data = await api.getRequestDetail(reqId);
      const it = (data?.item || null) as RequestItem | null;
      if (!it) throw new Error("需求不存在");
      setItem(it);
      setForm({
        product_info: it.product_info || "",
        target_platform: it.target_platform || "",
        budget: it.budget || "",
        need_face: Number(it.need_face) === 1,
      });
    })()
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [reqId]);

  /**
   * 提交更新：仅更新字段，不改变业务流程。
   */
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!item) return;
    setError(null);
    try {
      await api.updateRequest(item.id, {
        product_info: form.product_info.trim() || undefined,
        target_platform: form.target_platform.trim() || undefined,
        budget: form.budget.trim() || undefined,
        need_face: form.need_face,
      });
      nav("/client/requests", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    }
  };

  return (
    <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 10px 24px rgba(15,23,42,0.08)", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>编辑合作意向</h2>
        <button type="button" onClick={() => nav(-1)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>
          返回
        </button>
      </div>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      {loading ? (
        <p>加载中…</p>
      ) : item ? (
        <form onSubmit={onSubmit} style={{ marginTop: 14 }}>
          <div style={{ marginBottom: 10 }}>
            <label>产品/需求说明</label>
            <textarea value={form.product_info} onChange={(e) => setForm((f) => ({ ...f, product_info: e.target.value }))} rows={4} style={{ display: "block", marginTop: 6, width: "100%", maxWidth: 520, padding: "8px 10px", borderRadius: 10, border: "1px solid #e2e8f0", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label>目标平台</label>
            <input value={form.target_platform} onChange={(e) => setForm((f) => ({ ...f, target_platform: e.target.value }))} style={{ display: "block", marginTop: 6, width: "100%", maxWidth: 360, padding: "8px 10px", borderRadius: 10, border: "1px solid #e2e8f0", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label>预算范围</label>
            <input value={form.budget} onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))} style={{ display: "block", marginTop: 6, width: "100%", maxWidth: 240, padding: "8px 10px", borderRadius: 10, border: "1px solid #e2e8f0", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={form.need_face} onChange={(e) => setForm((f) => ({ ...f, need_face: e.target.checked }))} />
              需要露脸视频
            </label>
          </div>
          <button type="submit" style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: "var(--xt-accent)", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
            保存
          </button>
        </form>
      ) : (
        <p style={{ color: "#666" }}>需求不存在</p>
      )}
    </div>
  );
}

