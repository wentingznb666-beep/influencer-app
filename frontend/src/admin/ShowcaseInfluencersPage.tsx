import { useEffect, useMemo, useState } from "react";
import { resolvePublicUploadUrl } from "../fetchWithAuth";
import * as api from "../adminApi";

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
  status: "enabled" | "disabled";
  updated_at: string;
};

/**
 * 管理员/员工 Influencer（带货达人）资料管理页：增删改查与图片上传。
 */
export default function ShowcaseInfluencersPage() {
  const [list, setList] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | "enabled" | "disabled">("");
  const [form, setForm] = useState({
    id: 0,
    name: "",
    intro: "",
    tiktok_followers_text: "",
    sales_text: "",
    sellable_types_text: "",
    skills_text: "",
    video_url: "",
    status: "disabled" as "enabled" | "disabled",
  });
  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const editing = useMemo(() => form.id > 0, [form.id]);

  /** 拉取 Influencer 列表（支持关键词与状态筛选）。 */
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAdminShowcaseInfluencers({ q: q.trim() || undefined, status: status || undefined });
      setList((data.list || []) as Row[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /** 将待上传文件提交至服务器并合并进图片 URL 列表。 */
  const uploadSelected = async (): Promise<string[]> => {
    if (selectedFiles.length === 0) return photos;
    const uploaded = await api.uploadAdminModelImages(selectedFiles);
    return [...photos, ...uploaded].slice(0, 20);
  };

  /** 清空表单与本地图片状态。 */
  const resetForm = () => {
    setForm({
      id: 0,
      name: "",
      intro: "",
      tiktok_followers_text: "",
      sales_text: "",
      sellable_types_text: "",
        skills_text: "",
      video_url: "",
      status: "disabled",
    });
    setPhotos([]);
    setSelectedFiles([]);
  };

  /** 新增或更新一条 Influencer 记录。 */
  const save = async () => {
    if (!form.name.trim()) {
      setError("请输入姓名/昵称");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const nextPhotos = await uploadSelected();
      if (nextPhotos.length === 0) {
        setError("请至少上传一张图片");
        setSaving(false);
        return;
      }
      const payload = {
        name: form.name.trim(),
        intro: form.intro.trim(),
        tiktok_followers_text: form.tiktok_followers_text.trim(),
        sales_text: form.sales_text.trim(),
        sellable_types_text: form.sellable_types_text.trim(),
        skills_text: form.skills_text.trim(),
        video_url: form.video_url.trim(),
        status: form.status,
        photos: nextPhotos,
      };
      if (editing) {
        await api.updateAdminShowcaseInfluencer(form.id, payload);
      } else {
        await api.createAdminShowcaseInfluencer(payload);
      }
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  /** 软删除指定 Influencer。 */
  const remove = async (id: number) => {
    if (!window.confirm("确认删除该 Influencer 资料？")) return;
    setError(null);
    try {
      await api.deleteAdminShowcaseInfluencer(id);
      await load();
      if (form.id === id) resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    }
  };

  /** 从编辑区移除第 idx 张已上传图片（需保存后生效）。 */
  const removePhotoAt = (idx: number) => {
    setPhotos((p) => p.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Influencer（带货达人）</h2>
      <p style={{ fontSize: 14, color: "#64748b" }}>
        面向可露脸出镜、可挂购物车带货的类型，粉丝与带货数据通常较高。管理员与员工可完整维护资料与图片。
      </p>
      {error && <p style={{ color: "#c00" }}>{error}</p>}

      <div style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索名称/介绍" style={{ padding: "8px 12px", border: "1px solid #dbe1ea", borderRadius: 8, minWidth: 260 }} />
        <select value={status} onChange={(e) => setStatus(e.target.value as "")} style={{ padding: "8px 12px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff" }}>
          <option value="">全部状态</option>
          <option value="enabled">已启用</option>
          <option value="disabled">已禁用</option>
        </select>
        <button type="button" onClick={() => load()} style={{ padding: "8px 14px", border: "none", borderRadius: 8, background: "var(--xt-accent)", color: "#fff", cursor: "pointer" }}>
          搜索
        </button>
      </div>

      <div style={{ marginBottom: 16, padding: 14, background: "#fff", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        <h3 style={{ marginTop: 0 }}>{editing ? `编辑 #${form.id}` : "新增 Influencer"}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, alignItems: "center" }}>
          <div>姓名/昵称</div>
          <input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8 }} />
          <div>简介</div>
          <textarea value={form.intro} onChange={(e) => setForm((s) => ({ ...s, intro: e.target.value }))} rows={3} style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8 }} />
          <div>粉丝数量</div>
          <input value={form.tiktok_followers_text} onChange={(e) => setForm((s) => ({ ...s, tiktok_followers_text: e.target.value }))} style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8 }} />
          <div>账号销售额</div>
          <input value={form.sales_text} onChange={(e) => setForm((s) => ({ ...s, sales_text: e.target.value }))} style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8 }} />
          <div>可销售商品类型</div>
          <input value={form.sellable_types_text} onChange={(e) => setForm((s) => ({ ...s, sellable_types_text: e.target.value }))} style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8 }} />
          <div>技能</div>
          <textarea value={form.skills_text} onChange={(e) => setForm((s) => ({ ...s, skills_text: e.target.value }))} rows={2} style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8 }} placeholder="可填写多项技能或描述" />
          <div>作品视频链接</div>
          <input value={form.video_url} onChange={(e) => setForm((s) => ({ ...s, video_url: e.target.value }))} style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8 }} placeholder="https://" />
          <div>展示状态</div>
          <select value={form.status} onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as "enabled" | "disabled" }))} style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff" }}>
            <option value="disabled">禁用</option>
            <option value="enabled">启用</option>
          </select>
          <div>图片</div>
          <div>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setSelectedFiles(Array.from(e.target.files || []).slice(0, 20))} />
            {(photos.length > 0 || selectedFiles.length > 0) && (
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {photos.map((url, idx) => (
                  <div key={`p-${idx}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <img src={resolvePublicUploadUrl(url)} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" }} />
                    <button type="button" onClick={() => removePhotoAt(idx)} style={{ padding: "4px 8px", fontSize: 12, border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 6, background: "#fff", cursor: "pointer" }}>
                      移除
                    </button>
                  </div>
                ))}
                {selectedFiles.map((file, idx) => (
                  <span key={`f-${idx}`} style={{ fontSize: 12, color: "#334155" }}>
                    {file.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <button type="button" onClick={save} disabled={saving} style={{ padding: "8px 14px", border: "none", borderRadius: 8, background: "var(--xt-accent)", color: "#fff", cursor: saving ? "not-allowed" : "pointer" }}>
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
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setForm({
                        id: m.id,
                        name: m.name,
                        intro: m.intro || "",
                        tiktok_followers_text: m.tiktok_followers_text || "",
                        sales_text: m.sales_text || "",
                        sellable_types_text: m.sellable_types_text || "",
                        skills_text: m.skills_text || "",
                        video_url: m.video_url || "",
                        status: m.status,
                      });
                      setPhotos(m.photos || []);
                      setSelectedFiles([]);
                    }}
                    style={{ padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer" }}
                  >
                    编辑
                  </button>
                  <button type="button" onClick={() => remove(m.id)} style={{ padding: "6px 10px", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 8, background: "#fff", cursor: "pointer" }}>
                    删除
                  </button>
                </div>
              </div>
              <div style={{ marginTop: 8, whiteSpace: "pre-wrap", color: "#334155" }}>{m.intro || "暂无简介"}</div>
              <div style={{ marginTop: 6, fontSize: 13, color: "#475569" }}>
                {[m.tiktok_followers_text && `粉丝：${m.tiktok_followers_text}`, m.sales_text && `销售额：${m.sales_text}`, m.sellable_types_text && `可售类型：${m.sellable_types_text}`, m.skills_text && `技能：${m.skills_text}`, m.video_url && `视频：${m.video_url}`]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
              {Array.isArray(m.photos) && m.photos.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {m.photos.map((url, idx) => (
                    <img key={`${m.id}-${idx}`} src={resolvePublicUploadUrl(url)} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" }} />
                  ))}
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