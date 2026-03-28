/**
 * 模特照片删除与管理员批量删除：调用 adminApi.deleteAdminPhoto / deleteEmployeePhoto / deleteAdminPhotosBatch，
 * 与后端 DELETE /api/admin/photos/:id、DELETE /api/admin/photos/batch、DELETE /api/employee/photos/:id 对齐。
 */
import { useEffect, useMemo, useState } from "react";
import { getStoredUser } from "../authApi";
import * as api from "../adminApi";

type PhotoItem = { id: number; url: string; uploader_id: number };

type ModelRow = {
  id: number;
  name: string;
  photos: unknown;
  intro: string | null;
  cloud_link: string;
  status: "enabled" | "disabled";
  pending_status: "enabled" | "disabled" | null;
  review_note?: string | null;
  updated_at: string;
};

/**
 * 将接口返回的 photos 统一解析为带 id 的结构（兼容仅 URL 字符串的旧数据）。
 */
function parsePhotos(raw: unknown): PhotoItem[] {
  if (!Array.isArray(raw)) return [];
  const out: PhotoItem[] = [];
  for (const x of raw) {
    if (typeof x === "string") {
      out.push({ id: 0, url: x.trim(), uploader_id: 0 });
    } else if (x && typeof x === "object" && "url" in x) {
      const o = x as { id?: number; url?: string; uploader_id?: number };
      out.push({
        id: typeof o.id === "number" ? o.id : 0,
        url: String(o.url || "").trim(),
        uploader_id: typeof o.uploader_id === "number" ? o.uploader_id : 0,
      });
    }
  }
  return out.filter((p) => p.url);
}

/**
 * 管理员/员工模特展示管理页（含照片删除、管理员批量删除）。
 */
export default function ModelsPage() {
  const user = getStoredUser();
  const userId = user?.userId ?? 0;
  const isAdmin = user?.role === "admin";
  const isEmployee = user?.role === "employee";
  const [list, setList] = useState<ModelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | "enabled" | "disabled">("");
  const [form, setForm] = useState({ id: 0, name: "", intro: "", cloud_link: "", status: "disabled" as "enabled" | "disabled" });
  const [photoItems, setPhotoItems] = useState<PhotoItem[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [listSelectedIds, setListSelectedIds] = useState<Record<number, boolean>>({});
  const editing = useMemo(() => form.id > 0, [form.id]);

  /**
   * Toast 自动消失。
   */
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  /**
   * 拉取模特列表。
   */
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAdminModels({ q: q.trim() || undefined, status: status || undefined });
      setList((data.list || []) as ModelRow[]);
      setListSelectedIds({});
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
   * 上传本地文件并合并为带 id 的照片项。
   */
  const uploadSelected = async (): Promise<PhotoItem[]> => {
    if (selectedFiles.length === 0) return photoItems;
    const { items } = await api.uploadAdminModelImages(selectedFiles);
    const merged = [...photoItems, ...items.map((it) => ({ id: it.id, url: it.url, uploader_id: userId }))].slice(0, 20);
    return merged;
  };

  /**
   * 重置编辑表单。
   */
  const resetForm = () => {
    setForm({ id: 0, name: "", intro: "", cloud_link: "", status: "disabled" });
    setPhotoItems([]);
    setSelectedFiles([]);
  };

  /**
   * 保存模特（新增或编辑），使用 photo_ids 与后端对齐。
   */
  const save = async () => {
    if (!form.name.trim()) {
      setError("请输入模特姓名/昵称");
      return;
    }
    if (!form.cloud_link.trim()) {
      setError("请输入云端网盘链接");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const nextPhotos = await uploadSelected();
      const ids = nextPhotos.map((p) => p.id).filter((id) => id > 0);
      if (ids.length === 0) {
        setError("请至少上传一张模特照片");
        setSaving(false);
        return;
      }
      const payload = {
        name: form.name.trim(),
        intro: form.intro.trim(),
        cloud_link: form.cloud_link.trim(),
        status: form.status,
        photo_ids: ids,
      };
      if (editing) {
        await api.updateAdminModel(form.id, payload);
      } else {
        await api.createAdminModel(payload);
      }
      setToast("保存成功");
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  /**
   * 提交员工上下架审核申请。
   */
  const requestStatusReview = async (id: number, target: "enabled" | "disabled") => {
    setError(null);
    try {
      await api.requestAdminModelStatus(id, target);
      setToast("已提交审核");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交审核失败");
    }
  };

  /**
   * 管理员审核员工上下架申请。
   */
  const reviewStatus = async (id: number, action: "approve" | "reject") => {
    setError(null);
    try {
      await api.reviewAdminModelStatus(id, action);
      setToast(action === "approve" ? "审核已通过" : "已驳回申请");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "审核失败");
    }
  };

  /**
   * 删除整条模特资料（仅管理员）。
   */
  const remove = async (id: number) => {
    if (!window.confirm("确认删除该模特资料？")) return;
    setError(null);
    try {
      await api.deleteAdminModel(id);
      setToast("已删除模特资料");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    }
  };

  /**
   * 删除单张照片（列表或表单内）。
   */
  const deleteOnePhoto = async (photo: PhotoItem, context: "list" | "form") => {
    if (!photo.id) {
      setError("该照片为历史数据无 ID，请重新上传后再管理。");
      return;
    }
    if (!window.confirm("确定要删除这张照片吗？删除后无法恢复")) return;
    setError(null);
    try {
      if (isAdmin) {
        await api.deleteAdminPhoto(photo.id);
      } else if (isEmployee) {
        await api.deleteEmployeePhoto(photo.id);
      } else {
        return;
      }
      setToast("照片已删除");
      if (context === "form") {
        setPhotoItems((prev) => prev.filter((p) => p.id !== photo.id));
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    }
  };

  /**
   * 管理员批量删除列表中勾选的照片。
   */
  const batchDeleteListPhotos = async () => {
    const ids = Object.entries(listSelectedIds)
      .filter(([, v]) => v)
      .map(([k]) => Number(k))
      .filter((id) => Number.isInteger(id) && id > 0);
    if (ids.length === 0) {
      setError("请先勾选要删除的照片");
      return;
    }
    if (!window.confirm(`确定要删除选中的 ${ids.length} 张照片吗？删除后无法恢复`)) return;
    setError(null);
    try {
      await api.deleteAdminPhotosBatch(ids);
      setToast(`已批量删除 ${ids.length} 张照片`);
      setListSelectedIds({});
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "批量删除失败");
    }
  };

  /**
   * 是否展示「删除」按钮：管理员全部；员工仅本人上传。
   */
  const canShowDeletePhoto = (p: PhotoItem): boolean => {
    if (!p.id) return false;
    if (isAdmin) return true;
    if (isEmployee && p.uploader_id === userId) return true;
    return false;
  };

  /**
   * 切换列表中某张照片的勾选状态（管理员批量删除）。
   */
  const toggleListPhotoSelect = (photoId: number) => {
    if (!photoId) return;
    setListSelectedIds((prev) => ({ ...prev, [photoId]: !prev[photoId] }));
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>模特展示</h2>
      <p style={{ fontSize: 14, color: "#64748b" }}>管理员可新增/编辑/删除/上下架；员工可新增/编辑并提交上下架审核申请。</p>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      {toast && (
        <p style={{ position: "fixed", bottom: 24, right: 24, zIndex: 100, margin: 0, padding: "10px 14px", background: "#0f172a", color: "#fff", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }}>
          {toast}
        </p>
      )}

      <div style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索模特名称/介绍" style={{ padding: "8px 12px", border: "1px solid #dbe1ea", borderRadius: 8, minWidth: 260 }} />
        <select value={status} onChange={(e) => setStatus(e.target.value as "" | "enabled" | "disabled")} style={{ padding: "8px 12px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff" }}>
          <option value="">全部状态</option>
          <option value="enabled">已启用</option>
          <option value="disabled">已禁用</option>
        </select>
        <button type="button" onClick={load} style={{ padding: "8px 14px", border: "none", borderRadius: 8, background: "var(--xt-accent)", color: "#fff", cursor: "pointer" }}>
          搜索
        </button>
        {isAdmin && (
          <button type="button" onClick={batchDeleteListPhotos} style={{ padding: "8px 14px", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 8, background: "#fff", cursor: "pointer" }}>
            批量删除
          </button>
        )}
      </div>

      <div style={{ marginBottom: 16, padding: 14, background: "#fff", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        <h3 style={{ marginTop: 0 }}>{editing ? `编辑模特 #${form.id}` : "新增模特"}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 8, alignItems: "center" }}>
          <div>模特姓名/昵称</div>
          <input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} placeholder="请输入姓名/昵称" style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8 }} />
          <div>文字介绍</div>
          <textarea value={form.intro} onChange={(e) => setForm((s) => ({ ...s, intro: e.target.value }))} rows={4} placeholder="请输入模特介绍" style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8 }} />
          <div>云端网盘链接</div>
          <input value={form.cloud_link} onChange={(e) => setForm((s) => ({ ...s, cloud_link: e.target.value }))} placeholder="用于展示视频的链接" style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8 }} />
          <div>展示状态</div>
          <select value={form.status} onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as "enabled" | "disabled" }))} style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff" }}>
            <option value="disabled">禁用</option>
            <option value="enabled">启用</option>
          </select>
          <div>模特照片</div>
          <div>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setSelectedFiles(Array.from(e.target.files || []).slice(0, 20))} />
            {(photoItems.length > 0 || selectedFiles.length > 0) && (
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                {photoItems.map((p) => (
                  <div key={`form-${p.id}-${p.url}`} style={{ position: "relative", display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <img src={p.url} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" }} />
                    {canShowDeletePhoto(p) && (
                      <button type="button" onClick={() => deleteOnePhoto(p, "form")} style={{ fontSize: 12, padding: "2px 8px", borderRadius: 6, border: "1px solid #fecaca", color: "#b91c1c", background: "#fff", cursor: "pointer" }}>
                        删除
                      </button>
                    )}
                  </div>
                ))}
                {selectedFiles.map((file, idx) => (
                  <span key={`new-${idx}`} style={{ fontSize: 12, color: "#334155", border: "1px solid #e2e8f0", borderRadius: 8, padding: "4px 6px" }}>
                    {file.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <button type="button" onClick={save} disabled={saving} style={{ padding: "8px 14px", border: "none", borderRadius: 8, background: "var(--xt-accent)", color: "#fff", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "保存中..." : "保存"}
          </button>
          {editing && (
            <button type="button" onClick={resetForm} style={{ padding: "8px 14px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer" }}>
              取消编辑
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p>加载中…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {list.map((m) => {
            const photos = parsePhotos(m.photos);
            return (
              <div key={m.id} style={{ background: "#fff", borderRadius: 10, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div>
                    <strong>{m.name}</strong>
                    <span style={{ marginLeft: 8, color: m.status === "enabled" ? "#16a34a" : "#64748b" }}>{m.status === "enabled" ? "已启用" : "已禁用"}</span>
                    {m.pending_status && <span style={{ marginLeft: 8, color: "#b45309" }}>待审核：{m.pending_status === "enabled" ? "申请启用" : "申请禁用"}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setForm({ id: m.id, name: m.name, intro: m.intro || "", cloud_link: m.cloud_link, status: m.status });
                        setPhotoItems(photos);
                        setSelectedFiles([]);
                      }}
                      style={{ padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer" }}
                    >
                      编辑
                    </button>
                    {isAdmin && (
                      <button type="button" onClick={() => remove(m.id)} style={{ padding: "6px 10px", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 8, background: "#fff", cursor: "pointer" }}>
                        删除
                      </button>
                    )}
                    {isEmployee && (
                      <button type="button" onClick={() => requestStatusReview(m.id, m.status === "enabled" ? "disabled" : "enabled")} style={{ padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer" }}>
                        申请{m.status === "enabled" ? "禁用" : "启用"}
                      </button>
                    )}
                    {isAdmin && m.pending_status && (
                      <>
                        <button type="button" onClick={() => reviewStatus(m.id, "approve")} style={{ padding: "6px 10px", border: "1px solid #bbf7d0", color: "#166534", borderRadius: 8, background: "#fff", cursor: "pointer" }}>
                          审核通过
                        </button>
                        <button type="button" onClick={() => reviewStatus(m.id, "reject")} style={{ padding: "6px 10px", border: "1px solid #fed7aa", color: "#9a3412", borderRadius: 8, background: "#fff", cursor: "pointer" }}>
                          驳回申请
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ marginTop: 8, whiteSpace: "pre-wrap", color: "#334155" }}>{m.intro || "暂无介绍"}</div>
                <div style={{ marginTop: 8 }}>
                  视频链接：<a href={m.cloud_link} target="_blank" rel="noreferrer">{m.cloud_link}</a>
                </div>
                {photos.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {photos.map((p) => (
                      <div key={`${m.id}-${p.id}-${p.url}`} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{ position: "relative" }}>
                          {isAdmin && p.id > 0 && (
                            <input
                              type="checkbox"
                              checked={!!listSelectedIds[p.id]}
                              onChange={() => toggleListPhotoSelect(p.id)}
                              style={{ position: "absolute", top: 2, left: 2, zIndex: 1 }}
                              title="批量删除时勾选"
                            />
                          )}
                          <a href={p.url} target="_blank" rel="noreferrer">
                            <img src={p.url} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" }} />
                          </a>
                        </div>
                        {canShowDeletePhoto(p) && (
                          <button type="button" onClick={() => deleteOnePhoto(p, "list")} style={{ fontSize: 12, padding: "2px 8px", borderRadius: 6, border: "1px solid #fecaca", color: "#b91c1c", background: "#fff", cursor: "pointer" }}>
                            删除
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {list.length === 0 && <p style={{ color: "#666" }}>暂无数据</p>}
        </div>
      )}
    </div>
  );
}
