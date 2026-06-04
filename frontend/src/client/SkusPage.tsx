import { compactPx } from "../responsive";
import { useEffect, useMemo, useState } from "react";
import * as api from "../clientApi";
import { useScrollLock } from "../hooks/useScrollLock";

type ImportResult = {
  success: number;
  skipped: number;
  errors: { row: number; sku_code: string; reason: string }[];
  imagesImported?: number;
};

type BatchImageResult = {
  imagesSaved: number;
  matchedSkus: string[];
  notFoundSkus: string[];
  unmatchedFiles: string[];
};

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
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showBatchImages, setShowBatchImages] = useState(false);
  const [batchImageFiles, setBatchImageFiles] = useState<File[]>([]);
  const [batchImageUploading, setBatchImageUploading] = useState(false);
  const [batchImageResult, setBatchImageResult] = useState<BatchImageResult | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSkuModal, setShowSkuModal] = useState(false);

  useScrollLock(showSkuModal || showImport || showBatchImages);

  /** 批量选择相关 */
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === list.length && list.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(list.map((s) => s.id)));
    }
  };

  const batchDelete = async () => {
    const count = selectedIds.size;
    if (!window.confirm(`确认删除选中的 ${count} 个 SKU？`)) return;
    setError(null);
    try {
      await api.batchDeleteSkus([...selectedIds]);
      setSelectedIds(new Set());
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "批量删除失败");
    }
  };

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

  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.trim().toLowerCase();
    return list.filter(
      (s) => s.sku_code.toLowerCase().includes(q) || (s.sku_name || "").toLowerCase().includes(q),
    );
  }, [list, searchQuery]);

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
      setShowSkuModal(false);
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

  const handleImport = async (mode: "reject" | "skip") => {
    if (!importFile) return;
    setImporting(true);
    setError(null);
    try {
      const result = await api.batchImportSkus(importFile, mode);
      setImportResult(result);
      if (result.success > 0) load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "导入失败");
    } finally {
      setImporting(false);
    }
  };

  const closeImport = () => {
    setShowImport(false);
    setImportFile(null);
    setImportResult(null);
  };

  const handleBatchImages = async () => {
    if (batchImageFiles.length === 0) return;
    setBatchImageUploading(true);
    setError(null);
    try {
      const result = await api.batchImportImages(batchImageFiles);
      setBatchImageResult(result);
      if (result.imagesSaved > 0) load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败");
    } finally {
      setBatchImageUploading(false);
    }
  };

  const closeBatchImages = () => {
    setShowBatchImages(false);
    setBatchImageFiles([]);
    setBatchImageResult(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 100px)" }}>
      {/* ========== 顶部固定区域 ========== */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--xt-bg, #f5f5f5)", paddingBottom: compactPx(12), borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: compactPx(12), marginBottom: compactPx(12) }}>
          <h2 style={{ margin: 0 }}>SKU 列表</h2>
          <input
            placeholder="搜索 SKU 编码或名称…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 240, padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: compactPx(8), fontSize: compactPx(13), boxSizing: "border-box" }}
          />
          <button
            type="button"
            onClick={() => { setShowSkuModal(true); setEditingId(null); setForm({ sku_code: "", sku_name: "" }); setExistingImages([]); setSelectedFiles([]); setUploadProgress(0); setUploadStageText(""); }}
            style={{ padding: "6px 14px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: compactPx(8), cursor: "pointer", fontSize: compactPx(14) }}
          >
            新建 SKU
          </button>
          <button
            type="button"
            onClick={() => { setShowImport(true); setImportResult(null); setImportFile(null); }}
            style={{ padding: "6px 14px", background: "var(--xt-primary)", color: "#fff", border: "none", borderRadius: compactPx(8), cursor: "pointer", fontSize: compactPx(14) }}
          >
            批量导入
          </button>
          <button
            type="button"
            onClick={() => { setShowBatchImages(true); setBatchImageResult(null); setBatchImageFiles([]); }}
            style={{ padding: "6px 14px", background: "var(--xt-primary)", color: "#fff", border: "none", borderRadius: compactPx(8), cursor: "pointer", fontSize: compactPx(14) }}
          >
            批量上传图片
          </button>
        </div>
        {error && <p style={{ color: "#c00", margin: "8px 0 0" }}>{error}</p>}
      </div>

      {/* ========== 中间可滚动列表 ========== */}
      <div style={{ flex: 1, overflowY: "auto", paddingTop: compactPx(12) }}>
        {loading ? (
          <p>加载中…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: compactPx(10) }}>
            {list.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: compactPx(12) }}>
                <label style={{ display: "flex", alignItems: "center", gap: compactPx(4), fontSize: compactPx(13), cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === list.length && list.length > 0}
                    onChange={toggleSelectAll}
                    style={{ width: 15, height: 15, cursor: "pointer" }}
                  />
                  全选
                </label>
                {searchQuery && (
                  <span style={{ fontSize: compactPx(13), color: "#64748b" }}>搜索 "{searchQuery}"：{filteredList.length} 条</span>
                )}
              </div>
            )}
            {selectedIds.size > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: compactPx(12), padding: "8px 12px", background: "#fef2f2", borderRadius: compactPx(8), border: "1px solid #fecaca" }}>
                <span style={{ fontWeight: 600, fontSize: compactPx(14) }}>已选 {selectedIds.size} 个</span>
                <button
                  type="button"
                  onClick={batchDelete}
                  style={{ padding: "6px 14px", background: "#dc2626", color: "#fff", border: "none", borderRadius: compactPx(6), cursor: "pointer", fontSize: compactPx(13) }}
                >
                  批量删除
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  style={{ padding: "6px 14px", border: "1px solid #dbe1ea", borderRadius: compactPx(6), background: "#fff", cursor: "pointer", fontSize: compactPx(13) }}
                >
                  取消选择
                </button>
              </div>
            )}
            {filteredList.map((s) => (
              <div key={s.id} style={{ background: "#fff", borderRadius: compactPx(10), padding: compactPx(12), boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: compactPx(8), flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: compactPx(8) }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(s.id)}
                      onChange={() => toggleSelect(s.id)}
                      style={{ width: 16, height: 16, cursor: "pointer" }}
                    />
                    <div>
                      <strong>{s.sku_code}</strong>
                      {s.sku_name ? ` / ${s.sku_name}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: compactPx(8) }}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(s.id);
                        setForm({ sku_code: s.sku_code, sku_name: s.sku_name || "" });
                        setExistingImages(Array.isArray(s.sku_images) ? s.sku_images : []);
                        setSelectedFiles([]);
                        setUploadProgress(0);
                        setUploadStageText("");
                        setShowSkuModal(true);
                      }}
                      style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: compactPx(8), background: "#fff", cursor: "pointer" }}
                    >
                      编辑
                    </button>
                    <button type="button" onClick={() => remove(s.id)} style={{ padding: "6px 10px", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: compactPx(8), background: "#fff", cursor: "pointer" }}>
                      删除
                    </button>
                  </div>
                </div>
                {Array.isArray(s.sku_images) && s.sku_images.length > 0 && (
                  <div style={{ marginTop: compactPx(8), display: "flex", gap: compactPx(8), flexWrap: "wrap" }}>
                    {s.sku_images.slice(0, 6).map((url, idx) => (
                      <a key={`${s.id}-${idx}`} href={url} target="_blank" rel="noreferrer" style={{ display: "inline-block" }}>
                        <img src={url} alt={`sku-${s.id}-${idx}`} style={{ width: 56, height: 56, borderRadius: compactPx(6), objectFit: "cover", border: "1px solid #eee" }} />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {filteredList.length === 0 && list.length > 0 && <p style={{ color: "#666" }}>无匹配的 SKU</p>}
            {list.length === 0 && <p style={{ color: "#666" }}>暂无 SKU</p>}
          </div>
        )}
      </div>

      {/* ========== 编辑/新建弹窗 ========== */}
      {showSkuModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "grid", placeItems: "center", zIndex: 1000 }}
          onClick={() => {
            setShowSkuModal(false);
            setEditingId(null);
            setForm({ sku_code: "", sku_name: "" });
            setExistingImages([]);
            setSelectedFiles([]);
            setUploadProgress(0);
            setUploadStageText("");
          }}
        >
          <div
            style={{ background: "#fff", borderRadius: compactPx(16), padding: compactPx(24), maxWidth: compactPx(560), width: "90%", maxHeight: "85vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: compactPx(16) }}>
              <h3 style={{ margin: 0 }}>{editingId == null ? "新建 SKU" : "编辑 SKU"}</h3>
              <button
                type="button"
                onClick={() => {
                  setShowSkuModal(false);
                  setEditingId(null);
                  setForm({ sku_code: "", sku_name: "" });
                  setExistingImages([]);
                  setSelectedFiles([]);
                  setUploadProgress(0);
                  setUploadStageText("");
                }}
                style={{ width: 32, height: 32, borderRadius: compactPx(999), border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: compactPx(18), lineHeight: "30px" }}
              >
                ×
              </button>
            </div>
            <div style={{ marginBottom: compactPx(12) }}>
              <label>SKU 编码</label>
              <input value={form.sku_code} onChange={(e) => setForm((f) => ({ ...f, sku_code: e.target.value }))} style={{ width: "100%", padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: compactPx(8), fontSize: compactPx(14), boxSizing: "border-box", marginTop: compactPx(4) }} />
            </div>
            <div style={{ marginBottom: compactPx(12) }}>
              <label>SKU 名称</label>
              <input value={form.sku_name} onChange={(e) => setForm((f) => ({ ...f, sku_name: e.target.value }))} style={{ width: "100%", padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: compactPx(8), fontSize: compactPx(14), boxSizing: "border-box", marginTop: compactPx(4) }} />
            </div>
            <div style={{ marginBottom: compactPx(10) }}>
              <label>SKU 图片（jpg/png/webp，单张≤10MB）</label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(Array.from(e.dataTransfer.files || [])); }}
                style={{
                  marginTop: compactPx(6),
                  width: "100%",
                  borderRadius: compactPx(8),
                  border: `1px dashed ${dragging ? "var(--xt-accent)" : "#cbd5e1"}`,
                  background: dragging ? "#fff7ed" : "#f8fafc",
                  padding: compactPx(12),
                  boxSizing: "border-box",
                }}
              >
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => addFiles(Array.from(e.target.files || []))} />
                <div style={{ marginTop: compactPx(8), fontSize: compactPx(12), color: "#64748b" }}>支持点击选择或拖拽上传</div>
              </div>
              {uploadProgress > 0 && (
                <div style={{ marginTop: compactPx(8), fontSize: compactPx(12), color: "#475569" }}>{uploadStageText ? `${uploadStageText} · ` : ""}上传进度：{uploadProgress}%</div>
              )}
              {(existingImages.length > 0 || localPreviewUrls.length > 0) && (
                <div style={{ marginTop: compactPx(8), display: "flex", gap: compactPx(8), flexWrap: "wrap" }}>
                  {existingImages.map((url, idx) => (
                    <a key={`existing-${idx}`} href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt={`existing-${idx}`} style={{ width: 56, height: 56, borderRadius: compactPx(6), objectFit: "cover", border: "1px solid #eee" }} />
                    </a>
                  ))}
                  {localPreviewUrls.map((url, idx) => (
                    <div key={`local-${idx}`} style={{ position: "relative", width: 56, height: 56 }}>
                      <img src={url} alt={`local-${idx}`} style={{ width: 56, height: 56, borderRadius: compactPx(6), objectFit: "cover", border: "1px solid #eee" }} />
                      <button type="button" onClick={() => removeSelectedFileAt(idx)} style={{ position: "absolute", top: -8, right: -8, width: 22, height: 22, borderRadius: compactPx(999), border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", lineHeight: "20px" }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              {selectedFiles.length > 0 && (
                <div style={{ marginTop: compactPx(10), display: "flex", gap: compactPx(8), flexWrap: "wrap" }}>
                  <button type="button" onClick={clearSelectedFiles} style={{ padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: compactPx(8), background: "#fff", cursor: "pointer" }}>清空本次选择</button>
                  <span style={{ fontSize: compactPx(12), color: "#64748b" }}>已选择 {selectedFiles.length} 张</span>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: compactPx(8), marginTop: compactPx(16) }}>
              <button type="button" onClick={save} style={{ padding: "8px 20px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: compactPx(8), cursor: "pointer", fontSize: compactPx(14) }}>
                {editingId == null ? "新建 SKU" : "保存修改"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSkuModal(false);
                  setEditingId(null);
                  setForm({ sku_code: "", sku_name: "" });
                  setExistingImages([]);
                  setSelectedFiles([]);
                  setUploadProgress(0);
                  setUploadStageText("");
                }}
                style={{ padding: "8px 20px", border: "1px solid #ddd", borderRadius: compactPx(8), background: "#fff", cursor: "pointer", fontSize: compactPx(14) }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "grid", placeItems: "center", zIndex: 1000 }}
          onClick={closeImport}
        >
          <div
            style={{ background: "#fff", borderRadius: compactPx(16), padding: compactPx(24), maxWidth: compactPx(560), width: "90%", maxHeight: "80vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: compactPx(16) }}>
              <h3 style={{ margin: 0 }}>批量导入 SKU</h3>
              <button
                type="button"
                onClick={closeImport}
                style={{ width: 32, height: 32, borderRadius: compactPx(999), border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: compactPx(18), lineHeight: "30px" }}
              >
                ×
              </button>
            </div>

            {!importResult ? (
              <>
                <div style={{ marginBottom: compactPx(16) }}>
                  <button
                    type="button"
                    onClick={() => api.downloadSkuImportTemplate().catch((e) => setError(e instanceof Error ? e.message : "下载失败"))}
                    style={{ padding: "6px 14px", border: "1px solid var(--xt-accent)", color: "var(--xt-accent)", borderRadius: compactPx(8), background: "#fff", cursor: "pointer", fontSize: compactPx(14) }}
                  >
                    下载导入模板
                  </button>
                  <span style={{ marginLeft: compactPx(8), fontSize: compactPx(12), color: "#64748b" }}>请先下载模板，按格式填写后上传</span>
                </div>
                <div style={{ marginBottom: compactPx(8) }}>
                  <span style={{ fontSize: compactPx(12), color: "#64748b" }}>支持两种方式：</span>
                </div>
                <div style={{ marginBottom: compactPx(16) }}>
                  <div style={{ fontSize: compactPx(13), color: "#475569", marginBottom: compactPx(6) }}>
                    方式一：直接上传 Excel 文件（导入 SKU 编码和名称，图片可嵌入单元格或放在对应行）
                  </div>
                  <div style={{ fontSize: compactPx(13), color: "#475569", marginBottom: compactPx(6) }}>
                    方式二：上传 ZIP 包（Excel + 图片文件夹，图片按 SKU 编码命名，如 ABC001.jpg、ABC001_2.jpg）
                  </div>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.zip"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  />
                </div>
                <button
                  type="button"
                  disabled={!importFile || importing}
                  onClick={() => handleImport("reject")}
                  style={{
                    padding: "8px 20px",
                    background: importFile && !importing ? "var(--xt-accent)" : "#94a3b8",
                    color: "#fff",
                    border: "none",
                    borderRadius: compactPx(8),
                    cursor: importFile && !importing ? "pointer" : "not-allowed",
                    fontSize: compactPx(14),
                  }}
                >
                  {importing ? "导入中…" : "开始导入"}
                </button>
              </>
            ) : (
              <>
                <div style={{ marginBottom: compactPx(16), padding: compactPx(12), background: "#f0fdf4", borderRadius: compactPx(8), border: "1px solid #bbf7d0" }}>
                  <div style={{ fontWeight: 600, marginBottom: compactPx(4) }}>导入完成</div>
                  <div>成功导入：<strong>{importResult.success}</strong> 条</div>
                  {importResult.skipped > 0 && <div>跳过重复：<strong>{importResult.skipped}</strong> 条</div>}
                  {(importResult.imagesImported ?? 0) > 0 && <div>导入图片：<strong>{importResult.imagesImported}</strong> 张</div>}
                </div>

                {importResult.errors.length > 0 && (
                  <div style={{ marginBottom: compactPx(16) }}>
                    <div style={{ fontWeight: 600, marginBottom: compactPx(8), color: "#b91c1c" }}>
                      以下 {importResult.errors.length} 条记录有问题：
                    </div>
                    <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: compactPx(8) }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: compactPx(13) }}>
                        <thead>
                          <tr style={{ background: "#f8fafc" }}>
                            <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>行号</th>
                            <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>SKU 编码</th>
                            <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>原因</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importResult.errors.map((err, idx) => (
                            <tr key={idx}>
                              <td style={{ padding: "6px 8px", borderBottom: "1px solid #f1f5f9" }}>{err.row || "-"}</td>
                              <td style={{ padding: "6px 8px", borderBottom: "1px solid #f1f5f9" }}>{err.sku_code || "-"}</td>
                              <td style={{ padding: "6px 8px", borderBottom: "1px solid #f1f5f9", color: "#b91c1c" }}>{err.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {importResult.skipped === 0 && importResult.success === 0 && (
                      <button
                        type="button"
                        onClick={() => handleImport("skip")}
                        disabled={importing}
                        style={{ marginTop: compactPx(12), padding: "8px 20px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: compactPx(8), cursor: "pointer", fontSize: compactPx(14) }}
                      >
                        {importing ? "处理中…" : "跳过重复，继续导入"}
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={closeImport}
                  style={{ padding: "8px 20px", border: "1px solid #ddd", borderRadius: compactPx(8), background: "#fff", cursor: "pointer", fontSize: compactPx(14) }}
                >
                  关闭
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showBatchImages && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "grid", placeItems: "center", zIndex: 1000 }}
          onClick={closeBatchImages}
        >
          <div
            style={{ background: "#fff", borderRadius: compactPx(16), padding: compactPx(24), maxWidth: compactPx(560), width: "90%", maxHeight: "80vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: compactPx(16) }}>
              <h3 style={{ margin: 0 }}>批量上传图片</h3>
              <button
                type="button"
                onClick={closeBatchImages}
                style={{ width: 32, height: 32, borderRadius: compactPx(999), border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: compactPx(18), lineHeight: "30px" }}
              >
                ×
              </button>
            </div>

            {!batchImageResult ? (
              <>
                <div style={{ marginBottom: compactPx(16), fontSize: compactPx(13), color: "#475569" }}>
                  <p style={{ margin: "0 0 8px" }}>按 SKU 编码命名图片文件，系统会自动匹配到对应 SKU：</p>
                  <p style={{ margin: "0 0 8px", color: "#b91c1c", fontSize: compactPx(12) }}>图片必须带扩展名（.jpg/.png/.webp），无扩展名的文件无法识别</p>
                  <div style={{ background: "#f8fafc", padding: compactPx(10), borderRadius: compactPx(8), fontSize: compactPx(12) }}>
                    <div>SKU001.jpg → 匹配 SKU 编码 "SKU001"，第 1 张图</div>
                    <div>SKU001_2.jpg → 匹配 SKU 编码 "SKU001"，第 2 张图</div>
                    <div>SKU002.png → 匹配 SKU 编码 "SKU002"，第 1 张图</div>
                  </div>
                  <p style={{ margin: "8px 0 0", fontSize: compactPx(12), color: "#64748b" }}>
                    也可以把图片打成 ZIP 压缩包直接上传（图片需带扩展名 .jpg/.png/.webp）
                  </p>
                </div>
                <div style={{ marginBottom: compactPx(16) }}>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.zip"
                    multiple
                    onChange={(e) => setBatchImageFiles(Array.from(e.target.files || []))}
                  />
                  {batchImageFiles.length > 0 && (
                    <span style={{ marginLeft: compactPx(8), fontSize: compactPx(12), color: "#64748b" }}>
                      已选择 {batchImageFiles.length} 个文件
                    </span>
                  )}
                  <div style={{ marginTop: compactPx(6), fontSize: compactPx(12), color: "#64748b" }}>
                    支持直接选择多张图片，或上传一个 ZIP 压缩包（内含按编码命名的图片，需带扩展名）
                  </div>
                </div>
                <button
                  type="button"
                  disabled={batchImageFiles.length === 0 || batchImageUploading}
                  onClick={handleBatchImages}
                  style={{
                    padding: "8px 20px",
                    background: batchImageFiles.length > 0 && !batchImageUploading ? "var(--xt-accent)" : "#94a3b8",
                    color: "#fff",
                    border: "none",
                    borderRadius: compactPx(8),
                    cursor: batchImageFiles.length > 0 && !batchImageUploading ? "pointer" : "not-allowed",
                    fontSize: compactPx(14),
                  }}
                >
                  {batchImageUploading ? "上传中…" : "开始上传"}
                </button>
              </>
            ) : (
              <>
                <div style={{ marginBottom: compactPx(16), padding: compactPx(12), background: "#f0fdf4", borderRadius: compactPx(8), border: "1px solid #bbf7d0" }}>
                  <div style={{ fontWeight: 600, marginBottom: compactPx(4) }}>上传完成</div>
                  <div>成功保存图片：<strong>{batchImageResult.imagesSaved}</strong> 张</div>
                  {batchImageResult.matchedSkus.length > 0 && (
                    <div>匹配 SKU：{batchImageResult.matchedSkus.join("、")}</div>
                  )}
                </div>

                {batchImageResult.notFoundSkus.length > 0 && (
                  <div style={{ marginBottom: compactPx(12), padding: compactPx(10), background: "#fef2f2", borderRadius: compactPx(8), border: "1px solid #fecaca", fontSize: compactPx(13) }}>
                    <div style={{ fontWeight: 600, color: "#b91c1c", marginBottom: compactPx(4) }}>以下编码在系统中不存在，图片已跳过：</div>
                    <div>{batchImageResult.notFoundSkus.join("、")}</div>
                  </div>
                )}

                {batchImageResult.unmatchedFiles.length > 0 && (
                  <div style={{ marginBottom: compactPx(12), padding: compactPx(10), background: "#fefce8", borderRadius: compactPx(8), border: "1px solid #fde68a", fontSize: compactPx(13) }}>
                    <div style={{ fontWeight: 600, color: "#a16207", marginBottom: compactPx(4) }}>以下文件无法识别，已跳过：</div>
                    <div>{batchImageResult.unmatchedFiles.join("、")}</div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={closeBatchImages}
                  style={{ padding: "8px 20px", border: "1px solid #ddd", borderRadius: compactPx(8), background: "#fff", cursor: "pointer", fontSize: compactPx(14) }}
                >
                  关闭
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

