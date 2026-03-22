import { useState, useEffect, type FormEvent } from "react";
import * as api from "../adminApi";

type Material = { id: number; title: string; type: string; cloud_link: string; platforms: string | null; remark: string | null; status: string; created_at: string };

export default function MaterialsPage() {
  const [list, setList] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", type: "explain", cloud_link: "", platforms: "", remark: "" });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMaterials({ status: filterStatus || undefined, type: filterType || undefined });
      setList(data.list || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filterStatus, filterType]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.cloud_link.trim()) return;
    setError(null);
    try {
      await api.createMaterial({
        title: form.title.trim(),
        type: form.type,
        cloud_link: form.cloud_link.trim(),
        platforms: form.platforms.trim() || undefined,
        remark: form.remark.trim() || undefined,
      });
      setForm({ title: "", type: "explain", cloud_link: "", platforms: "", remark: "" });
      setShowForm(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    }
  };

  const toggleStatus = async (id: number, current: string) => {
    try {
      await api.updateMaterial(id, { status: current === "online" ? "offline" : "online" });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新失败");
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>素材管理</h2>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: "6px 10px" }}>
          <option value="">全部状态</option>
          <option value="online">上架</option>
          <option value="offline">下架</option>
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ padding: "6px 10px" }}>
          <option value="">全部类型</option>
          <option value="face">露脸</option>
          <option value="explain">讲解</option>
        </select>
        <button type="button" onClick={() => setShowForm(!showForm)} style={{ padding: "8px 16px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
          {showForm ? "取消" : "新增素材"}
        </button>
      </div>
      {showForm && (
        <form onSubmit={handleSubmit} style={{ marginBottom: 24, padding: 16, background: "#fff", borderRadius: 8 }}>
          <div style={{ marginBottom: 8 }}>
            <label>标题</label>
            <input type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required style={{ marginLeft: 8, width: 300, padding: "6px 8px" }} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>类型</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} style={{ marginLeft: 8, padding: "6px 8px" }}>
              <option value="face">露脸</option>
              <option value="explain">讲解</option>
            </select>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>云盘链接</label>
            <input type="url" value={form.cloud_link} onChange={(e) => setForm((f) => ({ ...f, cloud_link: e.target.value }))} required style={{ marginLeft: 8, width: 400, padding: "6px 8px" }} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>适合平台</label>
            <input type="text" value={form.platforms} onChange={(e) => setForm((f) => ({ ...f, platforms: e.target.value }))} placeholder="抖音/小红书" style={{ marginLeft: 8, width: 200, padding: "6px 8px" }} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>备注</label>
            <input type="text" value={form.remark} onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))} style={{ marginLeft: 8, width: 300, padding: "6px 8px" }} />
          </div>
          <button type="submit" style={{ padding: "8px 16px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>保存</button>
        </form>
      )}
      {loading ? <p>加载中…</p> : (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden" }}>
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              <th style={{ padding: 10, textAlign: "left" }}>ID</th>
              <th style={{ padding: 10, textAlign: "left" }}>标题</th>
              <th style={{ padding: 10, textAlign: "left" }}>类型</th>
              <th style={{ padding: 10, textAlign: "left" }}>链接</th>
              <th style={{ padding: 10, textAlign: "left" }}>状态</th>
              <th style={{ padding: 10 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((m) => (
              <tr key={m.id}>
                <td style={{ padding: 10 }}>{m.id}</td>
                <td style={{ padding: 10 }}>{m.title}</td>
                <td style={{ padding: 10 }}>{m.type === "face" ? "露脸" : "讲解"}</td>
                <td style={{ padding: 10, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}><a href={m.cloud_link} target="_blank" rel="noreferrer">打开</a></td>
                <td style={{ padding: 10 }}>{m.status === "online" ? "上架" : "下架"}</td>
                <td style={{ padding: 10 }}>
                  <button type="button" onClick={() => toggleStatus(m.id, m.status)} style={{ padding: "4px 10px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer" }}>{m.status === "online" ? "下架" : "上架"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!loading && list.length === 0 && <p style={{ color: "#666" }}>暂无素材</p>}
    </div>
  );
}
