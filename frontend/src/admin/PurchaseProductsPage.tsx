import { useEffect, useState, useCallback, useRef } from "react";
import { fetchWithAuth } from "../fetchWithAuth";

const CATEGORIES = [
  "服装", "饰品", "美妆", "3C数码", "家居", "食品", "母婴", "运动户外",
  "包袋", "鞋履", "配饰", "健康保健", "家电", "汽摩", "农业", "其他",
];

const SOURCES = ["1688", "拼多多", "义乌", "手动添加"];

const STATUS_LABELS: Record<string, string> = {
  pending: "待审核", active: "已上架", inactive: "已下架",
};
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#fff7ed", text: "#c2410c" },
  active: { bg: "#f0fdf4", text: "#166534" },
  inactive: { bg: "#f1f5f9", text: "#475569" },
};
const SOURCE_COLORS: Record<string, { bg: string; text: string }> = {
  "1688": { bg: "#fef2f2", text: "#dc2626" },
  "拼多多": { bg: "#fdf4ff", text: "#a21caf" },
  "义乌": { bg: "#f0fdf4", text: "#15803d" },
  "手动添加": { bg: "#eff6ff", text: "#1d4ed8" },
};

type Product = Record<string, any>;

export default function PurchaseProductsPage() {
  // ---------- state ----------
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<Product[]>([]);

  // filters
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // edit modal
  const [editing, setEditing] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [editSaving, setEditSaving] = useState(false);

  // create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<Record<string, any>>({ source: "手动添加" });
  const [createSaving, setCreateSaving] = useState(false);

  // batch import
  const [showImport, setShowImport] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: any[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // tag editing
  const [tagTarget, setTagTarget] = useState<Product | null>(null);
  const [tagInput, setTagInput] = useState("");

  // toast
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  // ---------- data ----------
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCategory) params.set("category", filterCategory);
      if (filterSource) params.set("source", filterSource);
      if (filterStatus) params.set("status", filterStatus);
      if (search) params.set("product_name", search);

      const qs = params.toString();
      const res = await fetchWithAuth(`/api/admin/purchase/products${qs ? "?" + qs : ""}`);
      const d = await res.json();
      setList(d.list || []);
    } catch (e: any) {
      showToast("error", e.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterSource, filterStatus, search]);

  useEffect(() => { load(); }, [load]);

  // ---------- CRUD ----------
  const openCreate = () => {
    setCreateForm({ source: "手动添加" });
    setShowCreate(true);
  };

  const submitCreate = async () => {
    if (!createForm.product_name) { showToast("error", "商品名称为必填项"); return; }
    setCreateSaving(true);
    try {
      await fetchWithAuth("/api/admin/purchase/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      showToast("success", "商品已创建");
      setShowCreate(false);
      load();
    } catch (e: any) {
      showToast("error", e.message || "创建失败");
    } finally {
      setCreateSaving(false);
    }
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setEditForm({ ...p });
  };

  const submitEdit = async () => {
    if (!editing) return;
    setEditSaving(true);
    try {
      await fetchWithAuth(`/api/admin/purchase/products/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      showToast("success", "商品已更新");
      setEditing(null);
      load();
    } catch (e: any) {
      showToast("error", e.message || "保存失败");
    } finally {
      setEditSaving(false);
    }
  };

  const toggleStatus = async (p: Product) => {
    const newStatus = p.status === "inactive" ? "active" : "inactive";
    const action = newStatus === "inactive" ? "下架" : "上架";
    if (!confirm(`确认${action}「${p.product_name}」？`)) return;
    try {
      if (newStatus === "inactive") {
        await fetchWithAuth(`/api/admin/purchase/products/${p.id}/deactivate`, { method: "PATCH" });
      } else {
        await fetchWithAuth(`/api/admin/purchase/products/${p.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "active" }),
        });
      }
      showToast("success", `已${action}`);
      load();
    } catch (e: any) {
      showToast("error", e.message || "操作失败");
    }
  };

  // ---------- batch import ----------
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const products = parseFileToProducts(text, file.name);
      const res = await fetchWithAuth("/api/admin/purchase/products/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products }),
      });
      const d = await res.json();
      setImportResult(d);
      if (d.success > 0) load();
    } catch (err: any) {
      showToast("error", err.message || "导入失败");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ---------- tag edit ----------
  const openTagEdit = (p: Product) => {
    setTagTarget(p);
    const tags = Array.isArray(p.tags) ? p.tags : [];
    setTagInput(tags.join(", "));
  };

  const saveTags = async () => {
    if (!tagTarget) return;
    const tags = tagInput.split(",").map((t: string) => t.trim()).filter(Boolean);
    try {
      await fetchWithAuth(`/api/admin/purchase/products/${tagTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      });
      showToast("success", "标签已更新");
      setTagTarget(null);
      load();
    } catch (e: any) {
      showToast("error", e.message || "保存失败");
    }
  };

  // ---------- resolve image ----------
  const getFirstImage = (p: Product): string | null => {
    try {
      const imgs = typeof p.image_urls === "string" ? JSON.parse(p.image_urls) : p.image_urls;
      if (Array.isArray(imgs) && imgs.length > 0) return imgs[0];
    } catch { /* */ }
    return null;
  };

  // ---------- path detection for tab ----------
  const basePath = window.location.pathname.includes("/employee/") ? "/employee/vertical-connections/purchase" : "/admin/vertical-connections/purchase";

  // ---------- styles ----------
  const inputStyle: React.CSSProperties = {
    padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: 6, fontSize: 13,
  };
  const btn: React.CSSProperties = {
    padding: "7px 16px", border: "none", borderRadius: 6, background: "var(--xt-accent, #f97316)",
    color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13,
  };
  const outlineBtn: React.CSSProperties = {
    ...btn, background: "#fff", color: "#334155", border: "1px solid #dbe1ea",
  };
  const smallBtn: React.CSSProperties = {
    ...outlineBtn, padding: "3px 10px", fontSize: 11,
  };

  const thStyle: React.CSSProperties = {
    padding: "10px 12px", textAlign: "left", borderBottom: "2px solid #e2e8f0",
    fontWeight: 700, fontSize: 12, color: "#64748b", whiteSpace: "nowrap",
  };
  const tdStyle: React.CSSProperties = {
    padding: "10px 12px", borderBottom: "1px solid #f1f5f9", fontSize: 13, verticalAlign: "middle",
  };

  const modalOverlay: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000,
    display: "flex", alignItems: "center", justifyContent: "center",
  };
  const modalBox: React.CSSProperties = {
    background: "#fff", borderRadius: 14, padding: 24, maxWidth: 700, width: "90%",
    maxHeight: "85vh", overflow: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
  };

  // ---------- render ----------
  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 2000,
          background: toast.type === "success" ? "#166534" : "#991b1b",
          color: "#fff", padding: "12px 20px", borderRadius: 10, fontWeight: 700, fontSize: 14,
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        }}>
          {toast.msg}
        </div>
      )}

      <h2 style={{ marginTop: 0, fontSize: 20, fontWeight: 800 }}>达人进货管理</h2>

      {/* Tab Navigation */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "2px solid #e2e8f0" }}>
        {[
          { label: "📊 数据看板", path: basePath },
          { label: "进货需求", path: `${basePath}/demands` },
          { label: "商品库", path: `${basePath}/products` },
          { label: "订货管理", path: `${basePath}/orders` },
          { label: "找货配置", path: `${basePath}/coze-config` },
          { label: "供应商管理", path: `${basePath}/suppliers` },
          { label: "财务管理", path: `${basePath}/finance` },
        ].map((tab) => {
          const active = window.location.pathname === tab.path;
          return (
            <a key={tab.path} href={tab.path} style={{
              padding: "8px 20px", fontSize: 14, fontWeight: active ? 700 : 500,
              color: active ? "var(--xt-accent, #f97316)" : "#64748b",
              borderBottom: active ? "2px solid var(--xt-accent, #f97316)" : "2px solid transparent",
              marginBottom: -2, textDecoration: "none", cursor: "pointer",
              transition: "color 0.15s, border-color 0.15s",
            }}>
              {tab.label}
            </a>
          );
        })}
      </div>

      {/* Filters + Actions */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text" placeholder="搜索商品名称/供应商..." value={search}
          onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, width: 220 }}
        />
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={inputStyle}>
          <option value="">全部品类</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} style={inputStyle}>
          <option value="">全部来源</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={inputStyle}>
          <option value="">全部状态</option>
          <option value="pending">待审核</option>
          <option value="active">已上架</option>
          <option value="inactive">已下架</option>
        </select>
        <button onClick={load} style={btn}>🔍 搜索</button>
        <div style={{ flex: 1 }} />
        <button onClick={openCreate} style={btn}>+ 新增商品</button>
        <button onClick={() => setShowImport(true)} style={outlineBtn}>📥 批量导入</button>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflow: "auto" }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
            <p>加载中...</p>
          </div>
        ) : list.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>📦</div>
            <p style={{ fontSize: 15, fontWeight: 600 }}>暂无商品</p>
            <p style={{ fontSize: 13 }}>点击「新增商品」或「批量导入」添加商品</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>商品</th>
                <th style={thStyle}>品类</th>
                <th style={thStyle}>价格 CNY</th>
                <th style={thStyle}>价格 THB</th>
                <th style={thStyle}>来源</th>
                <th style={thStyle}>供应商</th>
                <th style={thStyle}>状态</th>
                <th style={thStyle}>推荐次数</th>
                <th style={thStyle}>标签</th>
                <th style={thStyle}>操作</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const img = getFirstImage(p);
                const sc = STATUS_COLORS[p.status] || STATUS_COLORS.pending;
                const srcCol = SOURCE_COLORS[p.source] || { bg: "#f1f5f9", text: "#475569" };
                const tags: string[] = (() => {
                  try {
                    const t = typeof p.tags === "string" ? JSON.parse(p.tags) : p.tags;
                    return Array.isArray(t) ? t : [];
                  } catch { return []; }
                })();
                const isManual = p.source === "手动添加" || p.source === "manual";
                return (
                  <tr key={p.id} style={{ cursor: isManual ? "pointer" : "default" }}
                    onClick={() => isManual && openEdit(p)}>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {img ? (
                          <img src={img} alt="" style={{
                            width: 44, height: 44, borderRadius: 6, objectFit: "cover", background: "#e2e8f0",
                          }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div style={{
                            width: 44, height: 44, borderRadius: 6, background: "#e2e8f0",
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                          }}>📦</div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
                          <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {p.product_name}
                          </span>
                          {p.product_link && (
                            <a href={p.product_link} target="_blank" rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="打开商品链接"
                              style={{ color: "var(--xt-accent, #f97316)", textDecoration: "none", flexShrink: 0, fontSize: 14 }}>
                              🔗
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, fontSize: 12 }}>{p.category}{p.sub_category ? ` / ${p.sub_category}` : ""}</td>
                    <td style={tdStyle}>¥{Number(p.price_cny || 0).toLocaleString()}</td>
                    <td style={tdStyle}>฿{Number(p.price_thb || 0).toLocaleString()}</td>
                    <td style={tdStyle}>
                      <span style={{
                        display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700,
                        background: srcCol.bg, color: srcCol.text,
                      }}>
                        {p.source}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontSize: 12 }}>{p.supplier_name || "—"}</td>
                    <td style={tdStyle}>
                      <span style={{
                        display: "inline-block", padding: "2px 10px", borderRadius: 12,
                        background: sc.bg, color: sc.text, fontWeight: 700, fontSize: 12,
                      }}>
                        {STATUS_LABELS[p.status] || p.status}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>{p.total_recommend_count || 0}</td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 3, flexWrap: "wrap", maxWidth: 160 }}>
                        {tags.slice(0, 3).map((t: string, i: number) => (
                          <span key={i} style={{
                            padding: "1px 6px", borderRadius: 8, fontSize: 10,
                            background: "#f1f5f9", color: "#475569",
                          }}>{t}</span>
                        ))}
                        {tags.length > 3 && <span style={{ fontSize: 10, color: "#94a3b8" }}>+{tags.length - 3}</span>}
                      </div>
                    </td>
                    <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                      {isManual ? (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => toggleStatus(p)} style={smallBtn}>
                            {p.status === "inactive" ? "上架" : "下架"}
                          </button>
                          <button onClick={() => openTagEdit(p)} style={smallBtn}>标签</button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>系统导入</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ======== CREATE MODAL ======== */}
      {showCreate && (
        <div style={modalOverlay} onClick={() => setShowCreate(false)}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>新增商品</h3>
              <button onClick={() => setShowCreate(false)} style={{ ...outlineBtn, padding: "4px 10px", fontSize: 16 }}>✕</button>
            </div>
            <EditProductForm
              form={createForm}
              setForm={setCreateForm}
              saving={createSaving}
              onSubmit={submitCreate}
              submitLabel="创建商品"
            />
          </div>
        </div>
      )}

      {/* ======== EDIT MODAL ======== */}
      {editing && (
        <div style={modalOverlay} onClick={() => setEditing(null)}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>编辑商品</h3>
              <button onClick={() => setEditing(null)} style={{ ...outlineBtn, padding: "4px 10px", fontSize: 16 }}>✕</button>
            </div>
            <EditProductForm
              form={editForm}
              setForm={setEditForm}
              saving={editSaving}
              onSubmit={submitEdit}
              submitLabel="保存修改"
            />
          </div>
        </div>
      )}

      {/* ======== BATCH IMPORT MODAL ======== */}
      {showImport && (
        <div style={modalOverlay} onClick={() => { setShowImport(false); setImportResult(null); }}>
          <div style={{ ...modalBox, maxWidth: 550 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>批量导入商品</h3>
              <button onClick={() => { setShowImport(false); setImportResult(null); }} style={{ ...outlineBtn, padding: "4px 10px", fontSize: 16 }}>✕</button>
            </div>

            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
              支持 CSV 或 JSON 文件。CSV 第一行为列名，支持列：product_name, source, category, sub_category, price_cny, price_thb, supplier_name, moq, description
            </p>

            <div style={{ marginBottom: 16 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                onChange={handleFileUpload}
                disabled={importing}
                style={{ fontSize: 13 }}
              />
              {importing && <span style={{ marginLeft: 10, color: "#94a3b8", fontSize: 13 }}>导入中...</span>}
            </div>

            {importResult && (
              <div style={{
                background: importResult.failed === 0 ? "#f0fdf4" : "#fef2f2",
                borderRadius: 8, padding: 14, fontSize: 13,
              }}>
                <p style={{ fontWeight: 700, margin: "0 0 6px" }}>
                  ✅ 成功 {importResult.success} 条 {importResult.failed > 0 && `· ❌ 失败 ${importResult.failed} 条`}
                </p>
                {importResult.errors?.map((err: any, i: number) => (
                  <p key={i} style={{ margin: 0, fontSize: 12, color: "#991b1b" }}>
                    第 {err.index + 1} 行：{err.error}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======== TAG EDIT MODAL ======== */}
      {tagTarget && (
        <div style={modalOverlay} onClick={() => setTagTarget(null)}>
          <div style={{ ...modalBox, maxWidth: 450 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 12px" }}>编辑标签 — {tagTarget.product_name}</h3>
            <p style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>多个标签用逗号分隔，如：热销, 新品, 清仓</p>
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              style={{ ...inputStyle, width: "100%", marginBottom: 12 }}
              placeholder="热销, 新品, 清仓"
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={saveTags} style={btn}>保存</button>
              <button onClick={() => setTagTarget(null)} style={outlineBtn}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Shared form component for create/edit product */
function EditProductForm({
  form, setForm, saving, onSubmit, submitLabel,
}: {
  form: Record<string, any>;
  setForm: (f: Record<string, any>) => void;
  saving: boolean;
  onSubmit: () => void;
  submitLabel: string;
}) {
  const inputStyle: React.CSSProperties = {
    padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: 6, fontSize: 13, width: "100%", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: "#64748b", display: "block", marginBottom: 2 };
  const btn: React.CSSProperties = {
    padding: "10px 24px", border: "none", borderRadius: 6, background: "var(--xt-accent, #f97316)",
    color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={labelStyle}>商品名称 *</label>
          <input value={form.product_name || ""} onChange={(e) => setForm({ ...form, product_name: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>来源 *</label>
          <select value={form.source || "手动添加"} onChange={(e) => setForm({ ...form, source: e.target.value })} style={inputStyle}>
            {["1688", "拼多多", "义乌", "手动添加"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={labelStyle}>品类</label>
          <select value={form.category || ""} onChange={(e) => setForm({ ...form, category: e.target.value })} style={inputStyle}>
            <option value="">-- 选择 --</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>子品类</label>
          <input value={form.sub_category || ""} onChange={(e) => setForm({ ...form, sub_category: e.target.value })} style={inputStyle} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div>
          <label style={labelStyle}>品牌</label>
          <input value={form.brand || ""} onChange={(e) => setForm({ ...form, brand: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>价格 CNY</label>
          <input type="number" value={form.price_cny || ""} onChange={(e) => setForm({ ...form, price_cny: e.target.value ? parseFloat(e.target.value) : "" })} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>价格 THB</label>
          <input type="number" value={form.price_thb || ""} onChange={(e) => setForm({ ...form, price_thb: e.target.value ? parseFloat(e.target.value) : "" })} style={inputStyle} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div>
          <label style={labelStyle}>MOQ (起订量)</label>
          <input type="number" value={form.moq || ""} onChange={(e) => setForm({ ...form, moq: e.target.value ? parseInt(e.target.value) : "" })} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>重量 (kg)</label>
          <input type="number" step="0.001" value={form.weight_kg || ""} onChange={(e) => setForm({ ...form, weight_kg: e.target.value ? parseFloat(e.target.value) : "" })} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>体积 (m³)</label>
          <input type="number" step="0.000001" value={form.volume_m3 || ""} onChange={(e) => setForm({ ...form, volume_m3: e.target.value ? parseFloat(e.target.value) : "" })} style={inputStyle} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={labelStyle}>供应商名称</label>
          <input value={form.supplier_name || ""} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>供应商评级</label>
          <select value={form.supplier_rating || ""} onChange={(e) => setForm({ ...form, supplier_rating: e.target.value })} style={inputStyle}>
            <option value="">-- 选择 --</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div>
          <label style={labelStyle}>发货地</label>
          <input value={form.shipping_from || ""} onChange={(e) => setForm({ ...form, shipping_from: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>预计发货天数</label>
          <input type="number" value={form.estimated_shipping_days || ""} onChange={(e) => setForm({ ...form, estimated_shipping_days: e.target.value ? parseInt(e.target.value) : "" })} style={inputStyle} />
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 2 }}>
          <label style={{ fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <input type="checkbox" checked={!!form.sample_available} onChange={(e) => setForm({ ...form, sample_available: e.target.checked })} />
            可拿样
          </label>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div>
          <label style={labelStyle}>样品价格 CNY</label>
          <input type="number" value={form.sample_price_cny || ""} onChange={(e) => setForm({ ...form, sample_price_cny: e.target.value ? parseFloat(e.target.value) : "" })} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>竞品泰国售价 THB</label>
          <input type="number" value={form.competitor_price_thb || ""} onChange={(e) => setForm({ ...form, competitor_price_thb: e.target.value ? parseFloat(e.target.value) : "" })} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>建议零售价 THB</label>
          <input type="number" value={form.suggested_retail_thb || ""} onChange={(e) => setForm({ ...form, suggested_retail_thb: e.target.value ? parseFloat(e.target.value) : "" })} style={inputStyle} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={labelStyle}>预估利润率 (%)</label>
          <input type="number" step="0.01" value={form.estimated_profit_rate || ""} onChange={(e) => setForm({ ...form, estimated_profit_rate: e.target.value ? parseFloat(e.target.value) : "" })} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>商品链接</label>
          <input value={form.product_link || ""} onChange={(e) => setForm({ ...form, product_link: e.target.value })} style={inputStyle} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>描述</label>
        <textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} />
      </div>
      <button onClick={onSubmit} disabled={saving} style={{ ...btn, opacity: saving ? 0.5 : 1, alignSelf: "flex-start" }}>
        {saving ? "保存中..." : submitLabel}
      </button>
    </div>
  );
}

/** Parse uploaded file into product array */
function parseFileToProducts(text: string, fileName: string): Record<string, any>[] {
  if (fileName.endsWith(".json")) {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  }

  // CSV
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) throw new Error("CSV 文件至少需要表头 + 1 行数据");

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows: Record<string, any>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, any> = {};
    headers.forEach((h, j) => {
      if (vals[j] !== undefined && vals[j] !== "") {
        // numeric fields
        if (["price_cny", "price_thb", "weight_kg", "volume_m3", "sample_price_cny", "competitor_price_thb", "suggested_retail_thb", "estimated_profit_rate"].includes(h)) {
          row[h] = parseFloat(vals[j]);
        } else if (["moq", "estimated_shipping_days"].includes(h)) {
          row[h] = parseInt(vals[j]);
        } else {
          row[h] = vals[j];
        }
      }
    });
    if (Object.keys(row).length > 0 && row.product_name && row.source) {
      rows.push(row);
    }
  }

  return rows;
}
