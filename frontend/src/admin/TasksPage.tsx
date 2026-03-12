import { useState, useEffect, type FormEvent } from "react";
import * as api from "../adminApi";

type Task = { id: number; material_id: number; material_title: string; type: string; platform: string; max_claim_count: number | null; point_reward: number; status: string; created_at: string };
type Material = { id: number; title: string; type: string; status: string };

export default function TasksPage() {
  const [list, setList] = useState<Task[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ material_id: 0, type: "explain", platform: "抖音", max_claim_count: "" as number | "", point_reward: 10 });

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
      await api.createTask({
        material_id: form.material_id,
        type: form.type,
        platform: form.platform,
        max_claim_count: form.max_claim_count === "" ? undefined : Number(form.max_claim_count),
        point_reward: form.point_reward,
      });
      setShowForm(false);
      setForm({ material_id: materials[0]?.id ?? 0, type: "explain", platform: "抖音", max_claim_count: "", point_reward: 10 });
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
          style={{ padding: "8px 16px", background: "#007aff", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
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
          <button type="submit" style={{ padding: "8px 16px", background: "#007aff", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>保存草稿</button>
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
                <td style={{ padding: 10 }}>{t.status === "published" ? "已发布" : "草稿"}</td>
                <td style={{ padding: 10 }}>
                  {t.status === "draft" && (
                    <button type="button" onClick={() => publish(t.id)} style={{ padding: "4px 10px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer" }}>发布</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!loading && list.length === 0 && <p style={{ color: "#666" }}>暂无任务</p>}
    </div>
  );
}
