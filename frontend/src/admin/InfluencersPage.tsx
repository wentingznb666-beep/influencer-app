import { useTranslation } from 'react-i18next';
import { compactPx } from "../responsive";
import { useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as api from "../adminApi";



type Influencer = { id: number; username: string; display_name: string | null; created_at: string; show_face: number; tags: string | null; platforms: string | null; blacklisted: number; level: number };

const LEVEL_OPTIONS = [
  { value: 1, label: "A" },
  { value: 2, label: "B" },
  { value: 3, label: "C" },
] as const;

function formatLevel(level: number | string): string {
  const n = typeof level === "number" ? level : Number(level);
  const found = LEVEL_OPTIONS.find((opt) => opt.value === n);
  return found ? found.label : String(level ?? "—");
}



export default function InfluencersPage() {
  const { t } = useTranslation();

  const nav = useNavigate();
  const location = useLocation();
  const [list, setList] = useState<Influencer[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<number | null>(null);

  const [form, setForm] = useState({ show_face: 0, tags: "", platforms: "", blacklisted: 0, level: 1 });

  const basePath = useMemo(() => {
    const p = String(location.pathname || "");
    if (p.startsWith("/employee/")) return "/employee";
    return "/admin";
  }, [location.pathname]);


  const load = async () => {

    setLoading(true);

    setError(null);

    try {

      const data = await api.getInfluencers();

      setList(data.list || []);

    } catch (e) {

      setError(e instanceof Error ? e.message : t("加载失败"));

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

      setError(e instanceof Error ? e.message : t("更新失败"));

    }

  };



  return (

    <div>

      <div className="xt-page-header">
        <h2 className="xt-page-title">达人管理</h2>
      </div>

      {error && <p style={{ color: "#c00" }}>{error}</p>}

      {loading ? <p>加载中…</p> : (

        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: compactPx(8), overflow: "hidden" }}>

          <thead>

            <tr style={{ background: "#f5f5f5" }}>

              <th style={{ padding: compactPx(10), textAlign: "left" }}>ID</th>

              <th style={{ padding: compactPx(10), textAlign: "left" }}>用户名</th>

              <th style={{ padding: compactPx(10), textAlign: "left" }}>露脸</th>

              <th style={{ padding: compactPx(10), textAlign: "left" }}>人设/平台</th>

              <th style={{ padding: compactPx(10), textAlign: "left" }}>黑名单</th>

              <th style={{ padding: compactPx(10), textAlign: "left" }}>等级</th>

              <th style={{ padding: compactPx(10) }}>操作</th>

            </tr>

          </thead>

          <tbody>

            {list.map((row) => (

              <tr key={row.id}>

                <td style={{ padding: compactPx(10) }}>{row.id}</td>

                <td style={{ padding: compactPx(10) }}>{row.username}</td>

                <td style={{ padding: compactPx(10) }}>{row.show_face ? t("是") : "否"}</td>

                <td style={{ padding: compactPx(10) }}>{(row.tags || "") + (row.platforms ? " / " + row.platforms : "")}</td>

                <td style={{ padding: compactPx(10) }}>{row.blacklisted ? t("是") : "否"}</td>

                <td style={{ padding: compactPx(10) }}>{formatLevel(row.level)}</td>

                <td style={{ padding: compactPx(10) }}>

                  {editing === row.id ? (

                    <div style={{ display: "flex", gap: compactPx(8), justifyContent: "center", flexWrap: "wrap" }}>
                      <button type="button" onClick={saveProfile} style={{ padding: "4px 10px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: compactPx(6), cursor: "pointer" }}>保存</button>
                      <button type="button" onClick={() => setEditing(null)} style={{ padding: "4px 10px", border: "1px solid #ddd", borderRadius: compactPx(6), cursor: "pointer", background: "#fff" }}>取消</button>
                    </div>
                  ) : (

                    <div style={{ display: "flex", gap: compactPx(8), justifyContent: "center", flexWrap: "wrap" }}>
                      <button type="button" onClick={() => startEdit(row)} style={{ padding: "4px 10px", border: "1px solid #ddd", borderRadius: compactPx(6), cursor: "pointer", background: "#fff" }}>编辑</button>
                      <button type="button" onClick={() => nav(`${basePath}/influencers/${row.id}`)} style={{ padding: "4px 10px", border: "1px solid rgba(26,35,126,0.22)", borderRadius: compactPx(6), cursor: "pointer", background: "#fff", color: "var(--xt-primary)" }}>查看达人详情</button>
                    </div>
                  )}

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      )}

      {editing != null && (

        <div style={{ marginTop: compactPx(24), padding: compactPx(16), background: "#fff", borderRadius: compactPx(8) }}>

          <h3>编辑达人资料</h3>

          <div style={{ marginBottom: compactPx(8) }}>

            <label>露脸 </label>

            <select value={form.show_face} onChange={(e) => setForm((f) => ({ ...f, show_face: Number(e.target.value) }))} style={{ marginLeft: compactPx(8) }}>

              <option value={0}>否</option>

              <option value={1}>是</option>

            </select>

          </div>

          <div style={{ marginBottom: compactPx(8) }}>

            <label>人设标签</label>

            <input type="text" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} style={{ marginLeft: compactPx(8), width: 200, padding: "6px 8px" }} placeholder="如：宝妈/美妆" />

          </div>

          <div style={{ marginBottom: compactPx(8) }}>

            <label>主攻平台</label>

            <input type="text" value={form.platforms} onChange={(e) => setForm((f) => ({ ...f, platforms: e.target.value }))} style={{ marginLeft: compactPx(8), width: 200, padding: "6px 8px" }} placeholder="抖音/小红书" />

          </div>

          <div style={{ marginBottom: compactPx(8) }}>

            <label>黑名单</label>

            <select value={form.blacklisted} onChange={(e) => setForm((f) => ({ ...f, blacklisted: Number(e.target.value) }))} style={{ marginLeft: compactPx(8) }}>

              <option value={0}>否</option>

              <option value={1}>是</option>

            </select>

          </div>

          <div style={{ marginBottom: compactPx(8) }}>

            <label>等级</label>

            <select value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: Number(e.target.value) }))} style={{ marginLeft: compactPx(8), padding: "6px 8px" }}>
              {LEVEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

          </div>

          <button type="button" onClick={() => setEditing(null)} style={{ marginRight: compactPx(8), padding: "6px 12px", border: "1px solid #ddd", borderRadius: compactPx(6), cursor: "pointer" }}>取消</button>

          <button type="button" onClick={saveProfile} style={{ padding: "6px 12px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: compactPx(6), cursor: "pointer" }}>保存</button>

        </div>

      )}

      {!loading && list.length === 0 && <p style={{ color: "#666" }}>暂无达人（需先注册角色为 influencer 的用户）</p>}

    </div>

  );

}

