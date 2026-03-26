import { useEffect, useState } from "react";
import * as api from "../clientApi";

type SkuRow = {
  id: number;
  sku_code: string;
  sku_name: string | null;
  sku_images: string[] | null;
  created_at: string;
  updated_at: string;
};

/**
 * 客户端 SKU 列表：新增、编辑、删除 SKU 及图片。
 */
export default function SkusPage() {
  const [list, setList] = useState<SkuRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ sku_code: "", sku_name: "", sku_images_text: "" });

  /**
   * 加载当前客户 SKU。
   */
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSkus();
      setList((data.list || []) as SkuRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /**
   * 保存 SKU（新增/编辑）。
   */
  const save = async () => {
    const code = form.sku_code.trim();
    if (!code) {
      setError("请填写 SKU 编码。");
      return;
    }
    const images = form.sku_images_text
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
    setError(null);
    try {
      if (editingId == null) {
        await api.createSku({ sku_code: code, sku_name: form.sku_name.trim() || undefined, sku_images: images });
      } else {
        await api.updateSku(editingId, { sku_code: code, sku_name: form.sku_name.trim() || undefined, sku_images: images });
      }
      setEditingId(null);
      setForm({ sku_code: "", sku_name: "", sku_images_text: "" });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    }
  };

  /**
   * 删除 SKU（软删）。
   */
  const remove = async (id: number) => {
    if (!window.confirm("确认删除该 SKU？")) return;
    setError(null);
    try {
      await api.deleteSku(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>SKU 列表</h2>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <div style={{ marginBottom: 16, padding: 14, background: "#fff", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        <div style={{ marginBottom: 8 }}>
          <label>SKU 编码</label>
          <input value={form.sku_code} onChange={(e) => setForm((f) => ({ ...f, sku_code: e.target.value }))} style={{ marginLeft: 8, padding: "6px 8px", minWidth: 220 }} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>SKU 名称</label>
          <input value={form.sku_name} onChange={(e) => setForm((f) => ({ ...f, sku_name: e.target.value }))} style={{ marginLeft: 8, padding: "6px 8px", minWidth: 220 }} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label>SKU 图片（多图，每行一个链接）</label>
          <textarea rows={4} value={form.sku_images_text} onChange={(e) => setForm((f) => ({ ...f, sku_images_text: e.target.value }))} style={{ display: "block", marginTop: 6, width: "100%", maxWidth: 560, padding: "8px 10px", boxSizing: "border-box" }} />
        </div>
        <button type="button" onClick={save} style={{ padding: "8px 14px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
          {editingId == null ? "新增 SKU" : "保存 SKU"}
        </button>
        {editingId != null && (
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm({ sku_code: "", sku_name: "", sku_images_text: "" });
            }}
            style={{ marginLeft: 8, padding: "8px 14px", border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer" }}
          >
            取消
          </button>
        )}
      </div>

      {loading ? (
        <p>加载中…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {list.map((s) => (
            <div key={s.id} style={{ background: "#fff", borderRadius: 10, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div>
                  <strong>{s.sku_code}</strong>
                  {s.sku_name ? ` / ${s.sku_name}` : ""}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(s.id);
                      setForm({
                        sku_code: s.sku_code,
                        sku_name: s.sku_name || "",
                        sku_images_text: Array.isArray(s.sku_images) ? s.sku_images.join("\n") : "",
                      });
                    }}
                    style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer" }}
                  >
                    编辑
                  </button>
                  <button type="button" onClick={() => remove(s.id)} style={{ padding: "6px 10px", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 8, background: "#fff", cursor: "pointer" }}>
                    删除
                  </button>
                </div>
              </div>
              {Array.isArray(s.sku_images) && s.sku_images.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {s.sku_images.slice(0, 6).map((url, idx) => (
                    <a key={`${s.id}-${idx}`} href={url} target="_blank" rel="noreferrer" style={{ display: "inline-block" }}>
                      <img src={url} alt={`sku-${s.id}-${idx}`} style={{ width: 56, height: 56, borderRadius: 6, objectFit: "cover", border: "1px solid #eee" }} />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
          {list.length === 0 && <p style={{ color: "#666" }}>暂无 SKU</p>}
        </div>
      )}
    </div>
  );
}

