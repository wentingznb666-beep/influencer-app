import { useTranslation } from 'react-i18next';
import { compactPx } from "../responsive";
import { useEffect, useMemo, useState } from "react";
import { resolvePublicUploadUrl } from "../fetchWithAuth";
import * as api from "../adminApi";

type Row = {
  id: number;
  name: string;
  photos: string[];
  intro: string | null;
  shoot_types_text: string | null;
  skills_text: string | null;
  video_url: string | null;
  tiktok_sales: string | null;
  live_sales: string | null;
  gmv_sales: string | null;
  status: "enabled" | "disabled";
  updated_at: string;
};

/**
 * 管理员/员工 Content Creator（短视频拍摄）资料管理页。
 * 表单与列表卡片的栅格、间距、图片区与「模特展示」一致；字段仍为拍摄类型、技能、视频与作品集。
 */
export default function ShowcaseContentCreatorsPage() {
  const { t } = useTranslation();
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
    shoot_types_text: "",
    skills_text: "",
    video_url: "",
    tiktok_sales: "",
    live_sales: "",
    gmv_sales: "",
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
      setError(e instanceof Error ? e.message : t("加载失败"));
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
      shoot_types_text: "",
      skills_text: "",
      video_url: "",
      tiktok_sales: "",
      live_sales: "",
      gmv_sales: "",
      status: "disabled",
    });
    setPhotos([]);
    setSelectedFiles([]);
  };

  /** 新增或更新 Content Creator。 */
  const save = async () => {
    if (!form.name.trim()) {
      setError(t("请输入达人编号"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const nextPhotos = await uploadSelected();
      if (nextPhotos.length === 0) {
        setError(t("请至少上传一张照片"));
        setSaving(false);
        return;
      }
      const payload = {
        name: form.name.trim(),
        intro: form.intro.trim(),
        shoot_types_text: form.shoot_types_text.trim(),
        skills_text: form.skills_text.trim(),
        video_url: form.video_url.trim(),
        tiktok_sales: form.tiktok_sales.trim(),
        live_sales: form.live_sales.trim(),
        gmv_sales: form.gmv_sales.trim(),
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
      setError(e instanceof Error ? e.message : t("保存失败"));
    } finally {
      setSaving(false);
    }
  };

  /** 软删除指定记录。 */
  const remove = async (id: number) => {
    if (!window.confirm(t("确认删除该 Content Creator 资料？"))) return;
    setError(null);
    try {
      await api.deleteAdminShowcaseContentCreator(id);
      await load();
      if (form.id === id) resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("删除失败"));
    }
  };

  /** 从编辑区移除一张图片。 */
  const removePhotoAt = (idx: number) => {
    setPhotos((p) => p.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>视频分级 - Content Creator（短视频拍摄）</h2>
      <p style={{ fontSize: compactPx(14), color: "#64748b" }}>
        当前已归入视频分级板块，面向短视频拍摄接单。管理员与员工可完整维护资料；表单布局与「模特展示」一致（字段为拍摄类型、技能、视频与作品集图片）。
      </p>
      {error && <p style={{ color: "#c00" }}>{error}</p>}

      <div className="sticky-search" style={{ marginBottom: compactPx(12), display: "flex", gap: compactPx(8), flexWrap: "wrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索达人编号/名称/介绍" style={{ padding: "8px 12px", border: "1px solid #dbe1ea", borderRadius: compactPx(8), minWidth: 260 }} />
        <select value={status} onChange={(e) => setStatus(e.target.value as "")} style={{ padding: "8px 12px", border: "1px solid #dbe1ea", borderRadius: compactPx(8), background: "#fff" }}>
          <option value="">全部状态</option>
          <option value="enabled">已启用</option>
          <option value="disabled">已禁用</option>
        </select>
        <button type="button" onClick={() => load()} style={{ padding: "8px 14px", border: "none", borderRadius: compactPx(8), background: "var(--xt-accent)", color: "#fff", cursor: "pointer" }}>
          搜索
        </button>
      </div>

      <div style={{ marginBottom: compactPx(16), padding: compactPx(14), background: "#fff", borderRadius: compactPx(10), boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        <h3 style={{ marginTop: 0 }}>{editing ? `编辑 Content Creator #${form.id}` : "新增 Content Creator"}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: compactPx(8), alignItems: "center" }}>
          <div>达人编号</div>
          <input
            value={form.name}
            onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
            placeholder="请输入达人编号/姓名"
            style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: compactPx(8) }}
          />
          <div>文字介绍</div>
          <textarea
            value={form.intro}
            onChange={(e) => setForm((s) => ({ ...s, intro: e.target.value }))}
            rows={4}
            placeholder="请输入达人介绍"
            style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: compactPx(8) }}
          />
          <div>可承接拍摄内容类型</div>
          <input
            value={form.shoot_types_text}
            onChange={(e) => setForm((s) => ({ ...s, shoot_types_text: e.target.value }))}
            placeholder="如：开箱、剧情、口播等"
            style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: compactPx(8) }}
          />
          <div>技能</div>
          <textarea
            value={form.skills_text}
            onChange={(e) => setForm((s) => ({ ...s, skills_text: e.target.value }))}
            rows={2}
            placeholder="可填写多项技能或技能描述"
            style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: compactPx(8) }}
          />
          <div>云端网盘链接</div>
          <input
            value={form.video_url}
            onChange={(e) => setForm((s) => ({ ...s, video_url: e.target.value }))}
            placeholder="用于展示视频的链接"
            style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: compactPx(8) }}
          />
          <div>TikTok 销售额</div>
          <input
            value={form.tiktok_sales}
            onChange={(e) => setForm((s) => ({ ...s, tiktok_sales: e.target.value }))}
            placeholder="请输入 TikTok 销售额"
            style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: compactPx(8) }}
          />
          <div>直播销售额</div>
          <input
            value={form.live_sales}
            onChange={(e) => setForm((s) => ({ ...s, live_sales: e.target.value }))}
            placeholder="请输入直播销售额"
            style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: compactPx(8) }}
          />
          <div>GMV 销售额</div>
          <input
            value={form.gmv_sales}
            onChange={(e) => setForm((s) => ({ ...s, gmv_sales: e.target.value }))}
            placeholder="请输入 GMV 销售额"
            style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: compactPx(8) }}
          />
          <div>展示状态</div>
          <select value={form.status} onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as "enabled" | "disabled" }))} style={{ padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: compactPx(8), background: "#fff" }}>
            <option value="disabled">禁用</option>
            <option value="enabled">启用</option>
          </select>
          <div>达人照片</div>
          <div>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setSelectedFiles(Array.from(e.target.files || []).slice(0, 20))} />
            {(photos.length > 0 || selectedFiles.length > 0) && (
              <div style={{ marginTop: compactPx(8), display: "flex", gap: compactPx(8), flexWrap: "wrap", alignItems: "flex-start" }}>
                {photos.map((url, idx) => (
                  <div key={`old-${idx}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: compactPx(4) }}>
                    <img src={resolvePublicUploadUrl(url)} alt={`cc-old-${idx}`} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: compactPx(8), border: "1px solid #e2e8f0" }} />
                    <button type="button" onClick={() => removePhotoAt(idx)} style={{ padding: "4px 8px", fontSize: compactPx(12), border: "1px solid #fecaca", color: "#b91c1c", borderRadius: compactPx(6), background: "#fff", cursor: "pointer" }}>
                      删除
                    </button>
                  </div>
                ))}
                {selectedFiles.map((file, idx) => (
                  <span key={`new-${idx}`} style={{ fontSize: compactPx(12), color: "#334155", border: "1px solid #e2e8f0", borderRadius: compactPx(8), padding: "4px 6px" }}>
                    {file.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ marginTop: compactPx(10), display: "flex", gap: compactPx(8) }}>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            style={{
              padding: "8px 14px",
              border: "none",
              borderRadius: compactPx(8),
              background: "var(--xt-accent)",
              color: "#fff",
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? t("保存中...") : "保存"}
          </button>
          {editing && (
            <button type="button" onClick={resetForm} style={{ padding: "8px 14px", border: "1px solid #dbe1ea", borderRadius: compactPx(8), background: "#fff", cursor: "pointer" }}>
              取消编辑
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p>加载中…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: compactPx(10) }}>
          {list.map((m) => (
            <div key={m.id} style={{ background: "#fff", borderRadius: compactPx(10), padding: compactPx(12), boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: compactPx(8), flexWrap: "wrap" }}>
                <div>
                  <strong>#{m.id} {m.name}</strong>
                  <span style={{ marginLeft: compactPx(8), color: m.status === "enabled" ? "#16a34a" : "#64748b" }}>{m.status === "enabled" ? t("已启用") : "已禁用"}</span>
                </div>
                <div style={{ display: "flex", gap: compactPx(8), flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setForm({
                        id: m.id,
                        name: m.name,
                        intro: m.intro || "",
                        shoot_types_text: m.shoot_types_text || "",
                        skills_text: m.skills_text || "",
                        video_url: m.video_url || "",
                        tiktok_sales: m.tiktok_sales || "",
                        live_sales: m.live_sales || "",
                        gmv_sales: m.gmv_sales || "",
                        status: m.status,
                      });
                      setPhotos(m.photos || []);
                      setSelectedFiles([]);
                    }}
                    style={{ padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: compactPx(8), background: "#fff", cursor: "pointer" }}
                  >
                    编辑
                  </button>
                  <button type="button" onClick={() => remove(m.id)} style={{ padding: "6px 10px", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: compactPx(8), background: "#fff", cursor: "pointer" }}>
                    删除
                  </button>
                </div>
              </div>
              <div style={{ marginTop: compactPx(8), whiteSpace: "pre-wrap", color: "#334155" }}>{m.intro || "暂无介绍"}</div>
              <div style={{ marginTop: compactPx(8), fontSize: compactPx(14), color: "#475569", display: "grid", gap: compactPx(4) }}>
                <div>
                  <span style={{ color: "#64748b" }}>可承接拍摄内容类型：</span>
                  {m.shoot_types_text?.trim() ? m.shoot_types_text : "—"}
                </div>
                <div>
                  <span style={{ color: "#64748b" }}>技能：</span>
                  {m.skills_text?.trim() ? m.skills_text : "—"}
                </div>
              </div>
              <div style={{ marginTop: compactPx(8) }}>
                视频链接：
                {m.video_url?.trim() ? (
                  <a href={m.video_url} target="_blank" rel="noreferrer">
                    {m.video_url}
                  </a>
                ) : (
                  "—"
                )}
              </div>
              <div style={{ marginTop: compactPx(8) }}>
                TikTok 销售额：
                {m.tiktok_sales?.trim() ? m.tiktok_sales : "—"}
              </div>
              <div style={{ marginTop: compactPx(4) }}>
                直播销售额：
                {m.live_sales?.trim() ? m.live_sales : "—"}
              </div>
              <div style={{ marginTop: compactPx(4) }}>
                GMV 销售额：
                {m.gmv_sales?.trim() ? m.gmv_sales : "—"}
              </div>
              {Array.isArray(m.photos) && m.photos.length > 0 && (
                <div style={{ marginTop: compactPx(8), display: "flex", gap: compactPx(10), flexWrap: "wrap" }}>
                  {m.photos.map((url, idx) => (
                    <a key={`${m.id}-${idx}`} href={resolvePublicUploadUrl(url)} target="_blank" rel="noreferrer">
                      <img src={resolvePublicUploadUrl(url)} alt={`cc-${m.id}-${idx}`} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: compactPx(8), border: "1px solid #e2e8f0" }} />
                    </a>
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
