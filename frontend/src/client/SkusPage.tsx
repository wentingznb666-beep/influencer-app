import { useEffect, useMemo, useState } from "react";
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
 * 商家端 SKU 列表：新增、编辑、删除 SKU 及图片。
 */
export default function SkusPage() {
  const [list, setList] = useState<SkuRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ sku_code: "", sku_name: "" });
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStageText, setUploadStageText] = useState<string>("");
  const [dragging, setDragging] = useState(false);

  /**
   * 加载当前商家 SKU。
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
   * 生成本地预览链接，用于上传前展示缩略图。
   */
  const localPreviewUrls = useMemo(() => selectedFiles.map((f) => URL.createObjectURL(f)), [selectedFiles]);

  /**
   * 清理本地预览 URL，避免内存泄漏。
   */
  useEffect(() => {
    return () => {
      localPreviewUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [localPreviewUrls]);

  /**
   * 校验并追加用户选择的图片文件。
   */
  const addFiles = (files: File[]) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    const next: File[] = [];
    for (const f of files) {
      if (!allowed.includes(f.type)) continue;
      if (f.size > 10 * 1024 * 1024) continue;
      next.push(f);
      if (next.length >= 20) break;
    }
    setSelectedFiles((prev) => [...prev, ...next].slice(0, 20));
  };

  /**
   * 移除已选择的单个本地文件（上传前）。
   */
  const removeSelectedFileAt = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  /**
   * 清空本次待上传的本地文件。
   */
  const clearSelectedFiles = () => {
    setSelectedFiles([]);
  };

  /**
   * 简单 sleep：用于上传失败后的短暂退避。
   */
  const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

  /**
   * 分批上传队列：避免一次性上传过多文件导致失败，并支持自动重试。
   */
  const uploadWithQueue = async (files: File[]) => {
    const batchSize = 5;
    const maxRetry = 2;
    const batches: File[][] = [];
    for (let i = 0; i < files.length; i += batchSize) batches.push(files.slice(i, i + batchSize));
    const allUrls: string[] = [];
    for (let bi = 0; bi < batches.length; bi++) {
      const batch = batches[bi];
      let attempt = 0;
      // 每批最多重试 maxRetry 次
      while (true) {
        attempt++;
        setUploadStageText(`上传中：第 ${bi + 1}/${batches.length} 批（尝试 ${attempt}/${maxRetry + 1}）`);
        try {
          const urls = await api.uploadSkuImages(batch, (p) => {
            const overall = Math.round(((bi + p / 100) / batches.length) * 100);
            setUploadProgress(Math.min(100, Math.max(1, overall)));
          });
          allUrls.push(...urls);
          break;
        } catch (e) {
          if (attempt > maxRetry) throw e;
          await sleep(500);
        }
      }
    }
    return allUrls;
  };

  /**
   * 保存 SKU（新增/编辑）。
   */
  const save = async () => {
    const code = form.sku_code.trim();
    if (!code) {
      setError("请填写 SKU 编码。");
      return;
    }
    setError(null);
    try {
      let images = existingImages;
      if (selectedFiles.length > 0) {
        setUploadProgress(1);
        images = await uploadWithQueue(selectedFiles);
      }
      if (editingId == null) {
        await api.createSku({ sku_code: code, sku_name: form.sku_name.trim() || undefined, sku_images: images });
      } else {
        await api.updateSku(editingId, { sku_code: code, sku_name: form.sku_name.trim() || undefined, sku_images: images });
      }
      setEditingId(null);
      setForm({ sku_code: "", sku_name: "" });
      setExistingImages([]);
      setSelectedFiles([]);
      setUploadProgress(0);
      setUploadStageText("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
      setUploadProgress(0);
      setUploadStageText("");
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
          <label>SKU 图片上传（jpg/png/webp，单张≤10MB）</label>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFiles(Array.from(e.dataTransfer.files || []));
            }}
            style={{
              marginTop: 6,
              width: "100%",
              maxWidth: 560,
              borderRadius: 8,
              border: `1px dashed ${dragging ? "var(--xt-accent)" : "#cbd5e1"}`,
              background: dragging ? "#fff7ed" : "#f8fafc",
              padding: 12,
              boxSizing: "border-box",
            }}
          >
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => addFiles(Array.from(e.target.files || []))}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>支持点击选择或拖拽上传，多图上传后会显示预览。</div>
          </div>
          {uploadProgress > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#475569" }}>
              {uploadStageText ? `${uploadStageText} · ` : ""}上传进度：{uploadProgress}%
            </div>
          )}
          {(existingImages.length > 0 || localPreviewUrls.length > 0) && (
            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {existingImages.map((url, idx) => (
                <a key={`existing-${idx}`} href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt={`existing-${idx}`} style={{ width: 56, height: 56, borderRadius: 6, objectFit: "cover", border: "1px solid #eee" }} />
                </a>
              ))}
              {localPreviewUrls.map((url, idx) => (
                <div key={`local-${idx}`} style={{ position: "relative", width: 56, height: 56 }}>
                  <img src={url} alt={`local-${idx}`} style={{ width: 56, height: 56, borderRadius: 6, objectFit: "cover", border: "1px solid #eee" }} />
                  <button
                    type="button"
                    onClick={() => removeSelectedFileAt(idx)}
                    style={{
                      position: "absolute",
                      top: -8,
                      right: -8,
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      border: "1px solid #e2e8f0",
                      background: "#fff",
                      cursor: "pointer",
                      lineHeight: "20px",
                    }}
                    aria-label="移除图片"
                    title="移除"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {selectedFiles.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={clearSelectedFiles} style={{ padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer" }}>
                清空本次选择
              </button>
              <span style={{ fontSize: 12, color: "#64748b" }}>已选择 {selectedFiles.length} 张（将以队列分批上传，失败自动重试）</span>
            </div>
          )}
        </div>
        <button type="button" onClick={save} style={{ padding: "8px 14px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
          {editingId == null ? "新建 SKU" : "保存 SKU"}
        </button>
        {editingId != null && (
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm({ sku_code: "", sku_name: "" });
              setExistingImages([]);
              setSelectedFiles([]);
              setUploadProgress(0);
              setUploadStageText("");
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
                      });
                      setExistingImages(Array.isArray(s.sku_images) ? s.sku_images : []);
                      setSelectedFiles([]);
                      setUploadProgress(0);
                      setUploadStageText("");
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

