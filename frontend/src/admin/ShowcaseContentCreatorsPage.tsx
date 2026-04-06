import { useEffect, useMemo, useState } from "react";
import { resolvePublicUploadUrl } from "../fetchWithAuth";
import * as api from "../adminApi";

type Row = {
  id: number;
  name: string;
  photos: string[];
  intro: string | null;
  social_url: string | null;
  tier: "A" | "B" | "C";
  shoot_types_text: string | null;
  fee_quote_text: string | null;
  status: "enabled" | "disabled";
  updated_at: string;
};

/**
 * 管理员/员工 Content Creator（短视频拍摄）资料管理页：增删改查与作品集图片上传。
 */
export default function ShowcaseContentCreatorsPage() {
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
    social_url: "",
    tier: "C" as "A" | "B" | "C",
    shoot_types_text: "",
    fee_quote_text: "",
    status: "disabled" as "enabled" | "disabled",
  });
  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const editing = useMemo(() => form.id > 0, [form.id]);

  /** 拉取 Content Creator 列表。 */
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAdminShowcaseContentCreators({ q: q.trim() || undefined, status: status || undefined });
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

  /** 上传所选文件并合并到作品集。 */
  const uploadSelected = async (): Promise<string[]> => {
    if (selectedFiles.length === 0) return photos;
    const uploaded = await api.uploadAdminModelImages(selectedFiles);
    return [...photos, ...uploaded].slice(0, 20);
  };

  /** 清空表单。 */
  const resetForm = () => {
    setForm({
      id: 0,
      name: "",
      intro: "",
      social_url: "",
      tier: "C",
      shoot_types_text: "",
      fee_quote_text: "",
      status: "disabled",
    });
    setPhotos([]);
    setSelectedFiles([]);
  };

  /** 新增或更新 Content Creator。 */
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
        social_url: form.social_url.trim(),
        tier: form.tier,
        shoot_types_text: form.shoot_types_text.trim(),
        fee_quote_text: form.fee_quote_text.trim(),
        status: form.status,
        photos: nextPhotos,
      };
      if (editing) {
        await api.updateAdminShowcaseContentCreator(form.id, payload);
      } else {
        await api.createAdminShowcaseContentCreator(payload);
      }
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  /** 软删除指定记录。 */
  const remove = async (id: number) => {
    if (!window.confirm("确认删除该 Content Creator 资料？")) return;
    setError(null);
    try {
      await api.deleteAdminShowcaseContentCreator(id);
      await load();
      if (form.id === id) resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    }
  };

  /** 从编辑区移除一张图片。 */
  const removePhotoAt = (idx: number) => {
    setPhotos((p) => p.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Content Creator（短视频拍摄）</h2>
      <p style={{ fontSize: 14, color: "#64748b" }}>
        面向短视频拍摄接单，通常按 A/B/C 等级划分。管理员与员工可完整维护资料与作品集图片。
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
        <h3 style={{ marginTop: 0 }}>{editing ? `编辑 #${form.id}` : "新增 Content Creator"}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, alignItems: "center" }}>
          <div>姓名/昵称</div>
          <input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8 }} />
          <div>简介</div>
          <textarea value={form.intro} onChange={(e) => setForm((s) => ({ ...s, intro: e.target.value }))} rows={3} style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8 }} />
          <div>社交账号链接</div>
          <input value={form.social_url} onChange={(e) => setForm((s) => ({ ...s, social_url: e.target.value }))} placeholder="TikTok 或其他平台" style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8 }} />
          <div>等级</div>
          <select value={form.tier} onChange={(e) => setForm((s) => ({ ...s, tier: e.target.value as "A" | "B" | "C" }))} style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff" }}>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
          <div>可承接拍摄内容类型</div>
          <input value={form.shoot_types_text} onChange={(e) => setForm((s) => ({ ...s, shoot_types_text: e.target.value }))} style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8 }} />
          <div>拍摄报价/合作费用</div>
          <input value={form.fee_quote_text} onChange={(e) => setForm((s) => ({ ...s, fee_quote_text: e.target.value }))} style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8 }} />
          <div>展示状态</div>
          <select value={form.status} onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as "enabled" | "disabled" }))} style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff" }}>
            <option value="disabled">禁用</option>
            <option value="enabled">启用</option>
          </select>
          <div>作品集图片</div>
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
                  <span style={{ marginLeft: 8, color: "#0f766e" }}>等级 {m.tier}</span>
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
                        social_url: m.social_url || "",
                        tier: m.tier,
                        shoot_types_text: m.shoot_types_text || "",
                        fee_quote_text: m.fee_quote_text || "",
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
              {m.social_url && (
                <div style={{ marginTop: 6, fontSize: 13 }}>
                  链接：<a href={m.social_url} target="_blank" rel="noreferrer">{m.social_url}</a>
                </div>
              )}
              <div style={{ marginTop: 6, fontSize: 13, color: "#475569" }}>
                {[m.shoot_types_text && `拍摄类型：${m.shoot_types_text}`, m.fee_quote_text && `报价：${m.fee_quote_text}`].filter(Boolean).join(" · ")}
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