import { useEffect, useMemo, useState } from "react";
import { getStoredUser } from "../authApi";
import { resolvePublicUploadUrl } from "../fetchWithAuth";
import * as api from "../adminApi";

type ModelRow = {
  id: number;
  name: string;
  photos: string[];
  intro: string | null;
  cloud_link: string;
  status: "enabled" | "disabled";
  pending_status: "enabled" | "disabled" | null;
  review_note?: string | null;
  updated_at: string;
  /** 手动维护的 TK 与可售品类（可选） */
  tiktok_followers_text?: string | null;
  tiktok_sales_text?: string | null;
  sellable_product_types?: string | null;
};

/**
 * 与后端 model_profiles 照片 URL 使用相同规则生成 photo_id（SHA-256 前 32 位 hex）。
 */
async function sha256Hex32(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input.trim()));
  const arr = Array.from(new Uint8Array(buf));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

/**
 * 从图片 URL 解析上传目录所属用户 ID（/uploads/models/{id}/），用于员工删除权限判断。
 */
function parseUploaderUserIdFromPhotoUrl(url: string): number | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/uploads\/models\/(\d+)\//);
    if (!m) return null;
    const id = Number(m[1]);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

/**
 * 管理员/员工模特展示管理页。
 */
export default function ModelsPage() {
  const user = getStoredUser();
  const isAdmin = user?.role === "admin";
  const isEmployee = user?.role === "employee";
  const currentUserId = user?.userId ?? 0;
  const [list, setList] = useState<ModelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | "enabled" | "disabled">("");
  const [form, setForm] = useState({ id: 0, name: "", intro: "", tiktok_followers_text: "", tiktok_sales_text: "", sellable_product_types: "", cloud_link: "", status: "disabled" as "enabled" | "disabled" });
  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  /** URL -> photo_id，供勾选与删除接口使用 */
  const [photoIdCache, setPhotoIdCache] = useState<Record<string, string>>({});
  /** 列表区：每个模特已选中的 photo_id（仅管理员批量删除） */
  const [selectedPhotoIdsByModel, setSelectedPhotoIdsByModel] = useState<Record<number, string[]>>({});
  /** 轻量 toast：成功 / 失败提示 */
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const editing = useMemo(() => form.id > 0, [form.id]);

  /**
   * 展示 toast，成功类约 2.5s 自动消失。
   */
  const showToast = (type: "ok" | "err", text: string) => {
    setToast({ type, text });
    if (type === "ok") {
      window.setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 2500);
    }
  };

  /**
   * 拉取模特列表。
   */
  const load = async (): Promise<ModelRow[]> => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAdminModels({ q: q.trim() || undefined, status: status || undefined });
      const rows = (data.list || []) as ModelRow[];
      setList(rows);
      return rows;
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 为列表与表单中的图片 URL 预计算 photo_id，与后端删除接口一致。
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const urls = new Set<string>();
      list.forEach((m) => (m.photos || []).forEach((u) => urls.add(u)));
      (photos || []).forEach((u) => urls.add(u));
      const computed: Record<string, string> = {};
      for (const url of urls) {
        computed[url] = await sha256Hex32(url);
      }
      if (!cancelled) {
        setPhotoIdCache((prev) => ({ ...prev, ...computed }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [list, photos]);

  /**
   * 上传当前选择的图片文件并返回链接。
   */
  const uploadSelected = async (): Promise<string[]> => {
    if (selectedFiles.length === 0) return photos;
    const uploaded = await api.uploadAdminModelImages(selectedFiles);
    return [...photos, ...uploaded].slice(0, 20);
  };

  /**
   * 重置编辑表单。
   */
  const resetForm = () => {
    setForm({ id: 0, name: "", intro: "", tiktok_followers_text: "", tiktok_sales_text: "", sellable_product_types: "", cloud_link: "", status: "disabled" });
    setPhotos([]);
    setSelectedFiles([]);
  };

  /**
   * 保存模特（新增或编辑）。
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
      if (nextPhotos.length === 0) {
        setError("请至少上传一张模特照片");
        setSaving(false);
        return;
      }
      const payload = {
        name: form.name.trim(),
        intro: form.intro.trim(),
        tiktok_followers_text: form.tiktok_followers_text.trim(),
        tiktok_sales_text: form.tiktok_sales_text.trim(),
        sellable_product_types: form.sellable_product_types.trim(),
        cloud_link: form.cloud_link.trim(),
        status: form.status,
        photos: nextPhotos,
      };
      if (editing) {
        await api.updateAdminModel(form.id, payload);
      } else {
        await api.createAdminModel(payload);
      }
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
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "审核失败");
    }
  };

  /**
   * 删除模特资料（仅管理员）。
   */
  const remove = async (id: number) => {
    if (!window.confirm("确认删除该模特资料？")) return;
    setError(null);
    try {
      await api.deleteAdminModel(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    }
  };

  /**
   * 员工是否可删除某张图片（仅本人上传目录下的文件）。
   */
  const canEmployeeDeletePhoto = (url: string): boolean => {
    if (!isEmployee) return false;
    const uid = parseUploaderUserIdFromPhotoUrl(url);
    return uid != null && uid === currentUserId;
  };

  /**
   * 单张删除照片（确认后）。
   */
  const deleteOnePhoto = async (photoUrl: string) => {
    const pid = photoIdCache[photoUrl] || (await sha256Hex32(photoUrl));
    if (!pid) {
      showToast("err", "无法计算 photo_id，请稍后重试");
      return;
    }
    setError(null);
    try {
      /** 管理员走 /api/admin/photos，员工走 /api/employee/photos，与后端文档路径一致。 */
      if (isAdmin) {
        await api.deleteAdminModelPhoto(pid);
      } else {
        await api.deleteEmployeeModelPhoto(pid);
      }
      showToast("ok", "删除成功");
      const rows = await load();
      if (editing && form.id) {
        const row = rows.find((r) => r.id === form.id);
        if (row && Array.isArray(row.photos)) setPhotos(row.photos);
      }
      setSelectedPhotoIdsByModel((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          const mid = Number(k);
          next[mid] = (next[mid] || []).filter((id) => id !== pid);
        }
        return next;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "删除失败";
      showToast("err", msg);
    }
  };

  /**
   * 管理员批量删除当前列表模特的已选照片。
   */
  const batchDeletePhotos = async (modelId: number) => {
    const ids = selectedPhotoIdsByModel[modelId] || [];
    if (ids.length === 0) return;
    if (!window.confirm(`确定要删除选中的 ${ids.length} 张照片吗？删除后无法恢复`)) return;
    setError(null);
    try {
      await api.deleteAdminModelPhotosBatch(ids);
      showToast("ok", "删除成功");
      const rows = await load();
      setSelectedPhotoIdsByModel((prev) => ({ ...prev, [modelId]: [] }));
      if (editing && form.id === modelId) {
        const row = rows.find((r) => r.id === modelId);
        if (row && Array.isArray(row.photos)) setPhotos(row.photos);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "批量删除失败";
      showToast("err", msg);
    }
  };

  /**
   * 切换某张图片的勾选（仅管理员列表区）。
   */
  const togglePhotoSelected = (modelId: number, photoId: string, checked: boolean) => {
    setSelectedPhotoIdsByModel((prev) => {
      const cur = new Set(prev[modelId] || []);
      if (checked) cur.add(photoId);
      else cur.delete(photoId);
      return { ...prev, [modelId]: [...cur] };
    });
  };

  /**
   * 列表中单张删除：管理员或员工（本人上传）。
   */
  const confirmDeleteSinglePhoto = (photoUrl: string) => {
    if (!window.confirm("确定要删除这张照片吗？删除后无法恢复")) return;
    void deleteOnePhoto(photoUrl);
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>模特展示</h2>
      <p style={{ fontSize: 14, color: "#64748b" }}>管理员可新增/编辑/删除/上下架；员工可新增/编辑并提交上下架审核申请。</p>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      {toast && (
        <div
          role="status"
          style={{
            position: "fixed",
            top: 16,
            right: 16,
            zIndex: 100,
            padding: "10px 14px",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(15,23,42,0.15)",
            background: toast.type === "ok" ? "#ecfdf5" : "#fef2f2",
            color: toast.type === "ok" ? "#065f46" : "#991b1b",
            fontSize: 14,
            maxWidth: 360,
          }}
        >
          {toast.text}
        </div>
      )}

      <div style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索模特名称/介绍" style={{ padding: "8px 12px", border: "1px solid #dbe1ea", borderRadius: 8, minWidth: 260 }} />
        <select value={status} onChange={(e) => setStatus(e.target.value as any)} style={{ padding: "8px 12px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff" }}>
          <option value="">全部状态</option>
          <option value="enabled">已启用</option>
          <option value="disabled">已禁用</option>
        </select>
        <button type="button" onClick={() => load()} style={{ padding: "8px 14px", border: "none", borderRadius: 8, background: "var(--xt-accent)", color: "#fff", cursor: "pointer" }}>
          搜索
        </button>
      </div>

      <div style={{ marginBottom: 16, padding: 14, background: "#fff", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        <h3 style={{ marginTop: 0 }}>{editing ? `编辑模特 #${form.id}` : "新增模特"}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 8, alignItems: "center" }}>
          <div>模特姓名/昵称</div>
          <input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} placeholder="请输入姓名/昵称" style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8 }} />
          <div>文字介绍</div>
          <textarea value={form.intro} onChange={(e) => setForm((s) => ({ ...s, intro: e.target.value }))} rows={4} placeholder="请输入模特介绍" style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8 }} />
          <div>模特 TK 账号粉丝数量</div>
          <input value={form.tiktok_followers_text} onChange={(e) => setForm((s) => ({ ...s, tiktok_followers_text: e.target.value }))} placeholder="可填写数字或描述" style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8 }} />
          <div>模特 TK 账号销售额</div>
          <input value={form.tiktok_sales_text} onChange={(e) => setForm((s) => ({ ...s, tiktok_sales_text: e.target.value }))} placeholder="可填写金额或描述" style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8 }} />
          <div>模特可销售的商品类型</div>
          <input value={form.sellable_product_types} onChange={(e) => setForm((s) => ({ ...s, sellable_product_types: e.target.value }))} placeholder="如：美妆、服饰等" style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8 }} />
          <div>云端网盘链接</div>
          <input value={form.cloud_link} onChange={(e) => setForm((s) => ({ ...s, cloud_link: e.target.value }))} placeholder="用于展示视频的链接" style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8 }} />
          <div>展示状态</div>
          <select value={form.status} onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as any }))} style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff" }}>
            <option value="disabled">禁用</option>
            <option value="enabled">启用</option>
          </select>
          <div>模特照片</div>
          <div>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setSelectedFiles(Array.from(e.target.files || []).slice(0, 20))} />
            {(photos.length > 0 || selectedFiles.length > 0) && (
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                {photos.map((url, idx) => (
                  <div key={`old-${idx}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <img src={resolvePublicUploadUrl(url)} alt={`model-old-${idx}`} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" }} />
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => confirmDeleteSinglePhoto(url)}
                        style={{ padding: "4px 8px", fontSize: 12, border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 6, background: "#fff", cursor: "pointer" }}
                      >
                        删除
                      </button>
                    )}
                    {isEmployee && canEmployeeDeletePhoto(url) && (
                      <button
                        type="button"
                        onClick={() => confirmDeleteSinglePhoto(url)}
                        style={{ padding: "4px 8px", fontSize: 12, border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 6, background: "#fff", cursor: "pointer" }}
                      >
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
          {list.map((m) => (
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
                      setForm({
                        id: m.id,
                        name: m.name,
                        intro: m.intro || "",
                        tiktok_followers_text: m.tiktok_followers_text ?? "",
                        tiktok_sales_text: m.tiktok_sales_text ?? "",
                        sellable_product_types: m.sellable_product_types ?? "",
                        cloud_link: m.cloud_link,
                        status: m.status,
                      });
                      setPhotos(Array.isArray(m.photos) ? m.photos : []);
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
              <div style={{ marginTop: 8, fontSize: 14, color: "#475569", display: "grid", gap: 4 }}>
                <div>
                  <span style={{ color: "#64748b" }}>TK 粉丝数：</span>
                  {m.tiktok_followers_text?.trim() ? m.tiktok_followers_text : "—"}
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>TK 销售额：</span>
                  {m.tiktok_sales_text?.trim() ? m.tiktok_sales_text : "—"}
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>可售商品类型：</span>
                  {m.sellable_product_types?.trim() ? m.sellable_product_types : "—"}
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                视频链接：<a href={m.cloud_link} target="_blank" rel="noreferrer">{m.cloud_link}</a>
              </div>
              {isAdmin && Array.isArray(m.photos) && m.photos.length > 0 && (selectedPhotoIdsByModel[m.id]?.length || 0) > 0 && (
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => batchDeletePhotos(m.id)}
                    style={{ padding: "6px 10px", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 8, background: "#fff", cursor: "pointer" }}
                  >
                    批量删除（{selectedPhotoIdsByModel[m.id]?.length || 0}）
                  </button>
                </div>
              )}
              {Array.isArray(m.photos) && m.photos.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {m.photos.map((url, idx) => {
                    const pid = photoIdCache[url];
                    const showAdmin = isAdmin;
                    const showEmp = isEmployee && canEmployeeDeletePhoto(url);
                    return (
                      <div key={`${m.id}-${idx}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: 88 }}>
                        {isAdmin && pid && (
                          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#64748b" }}>
                            <input
                              type="checkbox"
                              checked={selectedPhotoIdsByModel[m.id]?.includes(pid) || false}
                              onChange={(e) => togglePhotoSelected(m.id, pid, e.target.checked)}
                            />
                            选择
                          </label>
                        )}
                        <a href={resolvePublicUploadUrl(url)} target="_blank" rel="noreferrer">
                          <img src={resolvePublicUploadUrl(url)} alt={`model-${m.id}-${idx}`} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" }} />
                        </a>
                        {showAdmin && (
                          <button
                            type="button"
                            onClick={() => confirmDeleteSinglePhoto(url)}
                            style={{ padding: "4px 8px", fontSize: 12, border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 6, background: "#fff", cursor: "pointer" }}
                          >
                            删除
                          </button>
                        )}
                        {showEmp && (
                          <button
                            type="button"
                            onClick={() => confirmDeleteSinglePhoto(url)}
                            style={{ padding: "4px 8px", fontSize: 12, border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 6, background: "#fff", cursor: "pointer" }}
                          >
                            删除
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
          {list.length === 0 && <p style={{ color: "#666" }}>暂无数据</p>}
        </div>
      )}
    </div>
  );
}
