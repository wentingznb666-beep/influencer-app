import { useState, useEffect } from "react";
import * as api from "../adminApi";

type Influencer = { id: number; username: string; display_name: string | null; created_at: string; show_face: number; tags: string | null; platforms: string | null; blacklisted: number; level: number };

export default function InfluencersPage() {
  const [list, setList] = useState<Influencer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState({ show_face: 0, tags: "", platforms: "", blacklisted: 0, level: 1 });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getInfluencers();
      setList(data.list || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (row: Influencer) => {
    setEditing(row.id);
    setForm({
      show_face: row.show_face,
      tags: row.tags || "",
      platforms: row.platforms || "",
      blacklisted: row.blacklisted,
      level: row.level,
    });
  };

  const saveProfile = async () => {
    if (editing == null) return;
    setError(null);
    try {
      await api.updateInfluencerProfile(editing, {
        show_face: form.show_face,
        tags: form.tags.trim() || undefined,
        platforms: form.platforms.trim() || undefined,
        blacklisted: form.blacklisted,
        level: form.level,
      });
      setEditing(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新失败");
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>达人管理</h2>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      {loading ? <p>加载中…</p> : (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden" }}>
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              <th style={{ padding: 10, textAlign: "left" }}>ID</th>
              <th style={{ padding: 10, textAlign: "left" }}>用户名</th>
              <th style={{ padding: 10, textAlign: "left" }}>露脸</th>
              <th style={{ padding: 10, textAlign: "left" }}>人设/平台</th>
              <th style={{ padding: 10, textAlign: "left" }}>黑名单</th>
              <th style={{ padding: 10, textAlign: "left" }}>等级</th>
              <th style={{ padding: 10 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((row) => (
              <tr key={row.id}>
                <td style={{ padding: 10 }}>{row.id}</td>
                <td style={{ padding: 10 }}>{row.username}</td>
                <td style={{ padding: 10 }}>{row.show_face ? "是" : "否"}</td>
                <td style={{ padding: 10 }}>{(row.tags || "") + (row.platforms ? " / " + row.platforms : "")}</td>
                <td style={{ padding: 10 }}>{row.blacklisted ? "是" : "否"}</td>
                <td style={{ padding: 10 }}>{row.level}</td>
                <td style={{ padding: 10 }}>
                  {editing === row.id ? (
                    <button type="button" onClick={saveProfile} style={{ padding: "4px 10px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>保存</button>
                  ) : (
                    <button type="button" onClick={() => startEdit(row)} style={{ padding: "4px 10px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer" }}>编辑</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing != null && (
        <div style={{ marginTop: 24, padding: 16, background: "#fff", borderRadius: 8 }}>
          <h3>编辑达人资料</h3>
          <div style={{ marginBottom: 8 }}>
            <label>露脸 </label>
            <select value={form.show_face} onChange={(e) => setForm((f) => ({ ...f, show_face: Number(e.target.value) }))} style={{ marginLeft: 8 }}>
              <option value={0}>否</option>
              <option value={1}>是</option>
            </select>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>人设标签</label>
            <input type="text" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} style={{ marginLeft: 8, width: 200, padding: "6px 8px" }} placeholder="如：宝妈/美妆" />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>主攻平台</label>
            <input type="text" value={form.platforms} onChange={(e) => setForm((f) => ({ ...f, platforms: e.target.value }))} style={{ marginLeft: 8, width: 200, padding: "6px 8px" }} placeholder="抖音/小红书" />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>黑名单</label>
            <select value={form.blacklisted} onChange={(e) => setForm((f) => ({ ...f, blacklisted: Number(e.target.value) }))} style={{ marginLeft: 8 }}>
              <option value={0}>否</option>
              <option value={1}>是</option>
            </select>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>等级</label>
            <input type="number" min={1} value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: Number(e.target.value) || 1 }))} style={{ marginLeft: 8, width: 60, padding: "6px 8px" }} />
          </div>
          <button type="button" onClick={() => setEditing(null)} style={{ marginRight: 8, padding: "6px 12px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer" }}>取消</button>
          <button type="button" onClick={saveProfile} style={{ padding: "6px 12px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>保存</button>
        </div>
      )}
      {!loading && list.length === 0 && <p style={{ color: "#666" }}>暂无达人（需先注册角色为 influencer 的用户）</p>}
    </div>
  );
}
