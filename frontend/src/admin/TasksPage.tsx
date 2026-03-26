import { useState, useEffect, type FormEvent } from "react";
import * as api from "../adminApi";

type Task = {
  id: number;
  material_id: number;
  material_title: string;
  type: string;
  platform: string;
  max_claim_count: number | null;
  point_reward: number;
  status: string;
  biz_status?: "open" | "in_progress" | "done" | string;
  claimed_count?: number;
  fulfilled_count?: number;
  tiktok_link?: string | null;
  product_images?: string[] | null;
  sku_codes?: string[] | null;
  sku_images?: string[] | null;
  created_at: string;
};
type Material = { id: number; title: string; type: string; status: string };

export default function TasksPage() {
  const [list, setList] = useState<Task[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    biz_status: "open" as "open" | "in_progress" | "done",
    tiktok_link: "",
    sku_images_text: "",
    sku_codes_text: "",
  });
  const [form, setForm] = useState({
    material_id: 0,
    type: "explain",
    platform: "抖音",
    max_claim_count: "" as number | "",
    point_reward: 10,
    task_count: 1,
    tiktok_link: "",
    sku_images_text: "",
    sku_codes_text: "",
  });

  const loadTasks = async () => {
    const data = await api.getTasks({ status: filterStatus || undefined });
    setList(data.list || []);
  };
  const loadMaterials = async () => {
    const data = await api.getMaterials({ status: "online" });
    setMaterials(data.list || []);
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([loadTasks(), loadMaterials()]).catch((e) => setError(e instanceof Error ? e.message : "加载失败")).finally(() => setLoading(false));
  }, [filterStatus]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.material_id || form.point_reward < 1) return;
    setError(null);
    try {
      /**
       * 多图输入：每行一个 URL，提交给后端 product_images 字段。
       * 不改变上传流程，仅补充字段能力。
       */
      const productImages = form.sku_images_text
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 20);
      const skuCodes = form.sku_codes_text
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 100);
      await api.createTask({
        material_id: form.material_id,
        type: form.type,
        platform: form.platform,
        max_claim_count: form.max_claim_count === "" ? undefined : Number(form.max_claim_count),
        point_reward: form.point_reward,
        task_count: form.task_count,
        tiktok_link: form.tiktok_link.trim() || undefined,
        product_images: productImages,
        sku_images: productImages,
        sku_codes: skuCodes,
      });
      setShowForm(false);
      setForm({
        material_id: materials[0]?.id ?? 0,
        type: "explain",
        platform: "抖音",
        max_claim_count: "",
        point_reward: 10,
        task_count: 1,
        tiktok_link: "",
        sku_images_text: "",
        sku_codes_text: "",
      });
      loadTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    }
  };

  const publish = async (id: number) => {
    try {
      await api.updateTask(id, { status: "published" });
      loadTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "发布失败");
    }
  };

  /**
   * 打开编辑面板并回填当前任务增强字段。
   */
  const openEdit = (task: Task) => {
    setEditingId(task.id);
    setEditForm({
      biz_status:
        String(task.biz_status || "open") === "done"
          ? "done"
          : String(task.biz_status || "open") === "in_progress"
          ? "in_progress"
          : "open",
      tiktok_link: (task.tiktok_link || "") as string,
      sku_images_text: Array.isArray(task.sku_images) ? task.sku_images.join("\n") : "",
      sku_codes_text: Array.isArray(task.sku_codes) ? task.sku_codes.join("\n") : "",
    });
  };

  /**
   * 保存任务增强字段（业务状态/TikTok链接/多图）。
   */
  const saveEdit = async () => {
    if (editingId == null || savingEdit) return;
    setSavingEdit(true);
    setError(null);
    try {
      const productImages = editForm.sku_images_text
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 20);
      const skuCodes = editForm.sku_codes_text
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 100);
      await api.updateTask(editingId, {
        biz_status: editForm.biz_status,
        tiktok_link: editForm.tiktok_link.trim() || undefined,
        product_images: productImages,
        sku_images: productImages,
        sku_codes: skuCodes,
      });
      setEditingId(null);
      await loadTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSavingEdit(false);
    }
  };

  const bizStatusText: Record<string, string> = {
    open: "待领取",
    in_progress: "进行中",
    done: "已完成",
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>任务管理</h2>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: "6px 10px" }}>
          <option value="">全部状态</option>
          <option value="draft">草稿</option>
          <option value="published">已发布</option>
        </select>
        <button
          type="button"
          onClick={() => {
            setShowForm(!showForm);
            if (!showForm && materials.length > 0 && form.material_id === 0) setForm((f) => ({ ...f, material_id: materials[0].id }));
          }}
          style={{ padding: "8px 16px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
        >
          {showForm ? "取消" : "新建任务"}
        </button>
      </div>
      {showForm && materials.length > 0 && (
        <form onSubmit={handleSubmit} style={{ marginBottom: 24, padding: 16, background: "#fff", borderRadius: 8 }}>
          <div style={{ marginBottom: 8 }}>
            <label>素材</label>
            <select value={form.material_id} onChange={(e) => setForm((f) => ({ ...f, material_id: Number(e.target.value) }))} required style={{ marginLeft: 8, padding: "6px 8px", minWidth: 200 }}>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>{m.title} ({m.type === "face" ? "露脸" : "讲解"})</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>类型</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} style={{ marginLeft: 8, padding: "6px 8px" }}>
              <option value="face">露脸</option>
              <option value="explain">讲解</option>
            </select>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>平台</label>
            <input type="text" value={form.platform} onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))} required style={{ marginLeft: 8, padding: "6px 8px", width: 120 }} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>可领取数量</label>
            <input type="number" min={0} value={form.max_claim_count === "" ? "" : form.max_claim_count} onChange={(e) => setForm((f) => ({ ...f, max_claim_count: e.target.value === "" ? "" : Number(e.target.value) }))} style={{ marginLeft: 8, padding: "6px 8px", width: 80 }} placeholder="不限制" />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>积分奖励</label>
            <input type="number" min={1} value={form.point_reward} onChange={(e) => setForm((f) => ({ ...f, point_reward: Number(e.target.value) || 1 }))} required style={{ marginLeft: 8, padding: "6px 8px", width: 80 }} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>批量发布数量</label>
            <input type="number" min={1} max={200} value={form.task_count} onChange={(e) => setForm((f) => ({ ...f, task_count: Math.max(1, Math.min(200, Number(e.target.value) || 1)) }))} style={{ marginLeft: 8, padding: "6px 8px", width: 100 }} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>TikTok 链接</label>
            <input type="url" value={form.tiktok_link} onChange={(e) => setForm((f) => ({ ...f, tiktok_link: e.target.value }))} placeholder="https://www.tiktok.com/..." style={{ marginLeft: 8, padding: "6px 8px", width: 360, maxWidth: "100%" }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>SKU 图片上传（多图，每行一个链接）</label>
            <textarea
              rows={4}
              value={form.sku_images_text}
              onChange={(e) => setForm((f) => ({ ...f, sku_images_text: e.target.value }))}
              placeholder={"https://img1...\nhttps://img2..."}
              style={{ display: "block", marginTop: 6, width: "100%", maxWidth: 560, padding: "8px 10px", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>SKU 编码/名称（每行一个）</label>
            <textarea
              rows={4}
              value={form.sku_codes_text}
              onChange={(e) => setForm((f) => ({ ...f, sku_codes_text: e.target.value }))}
              placeholder={"SKU001 / 黑色\nSKU002 / 白色"}
              style={{ display: "block", marginTop: 6, width: "100%", maxWidth: 560, padding: "8px 10px", boxSizing: "border-box" }}
            />
          </div>
          <button type="submit" style={{ padding: "8px 16px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>保存草稿</button>
        </form>
      )}
      {showForm && materials.length === 0 && <p style={{ color: "#666" }}>请先上架至少一条素材再创建任务</p>}
      {loading ? <p>加载中…</p> : (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden" }}>
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              <th style={{ padding: 10, textAlign: "left" }}>ID</th>
              <th style={{ padding: 10, textAlign: "left" }}>素材</th>
              <th style={{ padding: 10, textAlign: "left" }}>平台</th>
              <th style={{ padding: 10, textAlign: "left" }}>积分</th>
              <th style={{ padding: 10, textAlign: "left" }}>业务状态</th>
              <th style={{ padding: 10, textAlign: "left" }}>领取/履约</th>
              <th style={{ padding: 10, textAlign: "left" }}>状态</th>
              <th style={{ padding: 10 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.id}>
                <td style={{ padding: 10 }}>{t.id}</td>
                <td style={{ padding: 10 }}>{t.material_title}</td>
                <td style={{ padding: 10 }}>{t.platform}</td>
                <td style={{ padding: 10 }}>{t.point_reward}</td>
                <td style={{ padding: 10 }}>{bizStatusText[String(t.biz_status || "open")] ?? String(t.biz_status || "open")}</td>
                <td style={{ padding: 10 }}>
                  {Number(t.claimed_count || 0)} / {Number(t.fulfilled_count || 0)}
                </td>
                <td style={{ padding: 10 }}>{t.status === "published" ? "已发布" : "草稿"}</td>
                <td style={{ padding: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                    {t.status === "draft" && (
                      <button type="button" onClick={() => publish(t.id)} style={{ padding: "4px 10px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer" }}>
                        发布
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEdit(t)}
                      style={{ padding: "4px 10px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer", background: "#fff" }}
                    >
                      编辑
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editingId != null && (
        <div style={{ marginTop: 16, padding: 16, background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 16 }}>编辑任务增强字段（ID: {editingId}）</h3>
          <div style={{ marginBottom: 8 }}>
            <label>业务状态</label>
            <select
              value={editForm.biz_status}
              onChange={(e) => setEditForm((f) => ({ ...f, biz_status: e.target.value as "open" | "in_progress" | "done" }))}
              style={{ marginLeft: 8, padding: "6px 8px" }}
            >
              <option value="open">待领取</option>
              <option value="in_progress">进行中</option>
              <option value="done">已完成</option>
            </select>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>TikTok 链接</label>
            <input
              type="url"
              value={editForm.tiktok_link}
              onChange={(e) => setEditForm((f) => ({ ...f, tiktok_link: e.target.value }))}
              placeholder="https://www.tiktok.com/..."
              style={{ marginLeft: 8, padding: "6px 8px", width: 360, maxWidth: "100%" }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>SKU 图片（每行一个链接）</label>
            <textarea
              rows={4}
              value={editForm.sku_images_text}
              onChange={(e) => setEditForm((f) => ({ ...f, sku_images_text: e.target.value }))}
              placeholder={"https://img1...\nhttps://img2..."}
              style={{ display: "block", marginTop: 6, width: "100%", maxWidth: 560, padding: "8px 10px", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label>SKU 编码/名称（每行一个）</label>
            <textarea
              rows={4}
              value={editForm.sku_codes_text}
              onChange={(e) => setEditForm((f) => ({ ...f, sku_codes_text: e.target.value }))}
              placeholder={"SKU001 / 黑色\nSKU002 / 白色"}
              style={{ display: "block", marginTop: 6, width: "100%", maxWidth: 560, padding: "8px 10px", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={saveEdit}
              disabled={savingEdit}
              style={{ padding: "8px 16px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: 8, cursor: savingEdit ? "not-allowed" : "pointer", opacity: savingEdit ? 0.75 : 1 }}
            >
              {savingEdit ? "保存中…" : "保存"}
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              disabled={savingEdit}
              style={{ padding: "8px 16px", border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: savingEdit ? "not-allowed" : "pointer" }}
            >
              取消
            </button>
          </div>
        </div>
      )}
      {!loading && list.length === 0 && <p style={{ color: "#666" }}>暂无任务</p>}
    </div>
  );
}
