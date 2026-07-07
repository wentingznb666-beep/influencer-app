import { useTranslation } from 'react-i18next';
import { useEffect, useState } from "react";
import { fetchWithAuth } from "../fetchWithAuth";

const CATEGORIES = [
  { th: "ความงาม", zh: "美妆类" },{ th: "รีวิวทั่วไป", zh: "测评类" },{ th: "ไลฟ์สไตล์", zh: "生活类" },
  { th: "แฟชั่น", zh: "时尚类" },{ th: "อาหาร", zh: "美食类" },{ th: "อิเล็กเทอร์นิกส์", zh: "3C 类" },
  { th: "ของใช้ทั่วไป", zh: "日用品类" },{ th: "แม่และเด็ก", zh: "母婴" },{ th: "อาหารเสริม", zh: "健康保健品" },
  { th: "สายสุขภาพ", zh: "健康" },{ th: "เฟอร์นิเจอร์", zh: "家具类" },{ th: "กีฬาและกิจกรรมกลางแจ้ง", zh: "运动户外类" },
  { th: "มอเตอร์และยานยนต์", zh: "汽摩" },{ th: "กางเกงยีนส์", zh: "牛仔裤" },{ th: "กระเป๋า", zh: "包包" },
  { th: "เสื้อผ้า", zh: "衣服" },{ th: "ชุดนอน", zh: "睡衣" },{ th: "กางเกงใน", zh: "内衣" },
  { th: "เครื่องใช้ไฟฟ้า", zh: "家电" },{ th: "พัดลมพกพา", zh: "便携风扇" },{ th: "Power Bank", zh: "电宝" },
  { th: "แคมป์ปิ้ง", zh: "露营" },{ th: "กระเป๋าสตาง", zh: "钱包" },{ th: "รองเท้า", zh: "鞋子" },
  { th: "สินค้าสาวอวบ", zh: "微胖女生" },{ th: "กางเกงผู้ชาย", zh: "男士裤子" },{ th: "อุปกรณ์เสริมมือถือ", zh: "手机配件" },
  { th: "หูฟัง", zh: "耳机" },{ th: "ลำโพง", zh: "音箱" },{ th: "วัสดุตกแต่ง/ปรับปรุงบ้าน", zh: "家装建材" },
  { th: "การเกษตร", zh: "农业品类" },{ th: "ชุดว่ายน้ำ", zh: "泳衣" },
];

type Profile = {
  id: number; influencer_code: string; source: string; followers: string | null;
  category: string; grade: string | null; gmv_sales: string | null;
  monthly_cart_videos: string | null; units_sold: string | null; can_live: boolean;
  live_sales: string | null; weekly_live_count: string | null;
  avg_live_hours_per_week: string | null; remark: string | null;
  contact_info: string | null; payment_info: string | null; user_id: number | null;
  status: string;
};

export default function AdminInfluencerProfilesPage() {
  const { t } = useTranslation();
  const [list, setList] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [form, setForm] = useState<Partial<Profile>>({});
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState({ category: "", grade: "", source: "", q: "" });

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.category) params.set("category", filter.category);
      if (filter.grade) params.set("grade", filter.grade);
      if (filter.source) params.set("source", filter.source);
      if (filter.q) params.set("q", filter.q);
      const res = await fetchWithAuth(`/api/admin/influencer-profiles?${params}`);
      const data = await res.json();
      setList(data.list || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const body = { ...form };
      if (editing) {
        await fetchWithAuth(`/api/admin/influencer-profiles/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        await fetchWithAuth("/api/admin/influencer-profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      setEditing(null); setForm({});
      load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const startEdit = (p: Profile) => { setEditing(p); setForm({ ...p }); };
  const startNew = () => { setEditing(null as any); setForm({ source: "contact_us", category: CATEGORIES[0].th, status: "active" }); };

  const del = async (id: number) => {
    if (!confirm("确认删除？")) return;
    await fetchWithAuth(`/api/admin/influencer-profiles/${id}`, { method: "DELETE" });
    load();
  };

  const autoGrade = async () => {
    await fetchWithAuth("/api/admin/influencer-profiles/auto-grade");
    load();
  };

  const input = (field: string, placeholder?: string) => (
    <input value={String(form[field as keyof typeof form] || "")} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} placeholder={placeholder || field} style={s.input} />
  );
  const sel = (field: string, options: string[]) => (
    <select value={String(form[field as keyof typeof form] || "")} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} style={s.input}>
      <option value="">--</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  return (
    <div>
      <h2>垂直达人建联管理</h2>
      {error && <p style={{ color: "#c00" }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input placeholder="搜索编号/粉丝" value={filter.q} onChange={e => setFilter(f => ({ ...f, q: e.target.value }))} style={s.input} />
        <select value={filter.category} onChange={e => setFilter(f => ({ ...f, category: e.target.value }))} style={s.input}>
          <option value="">全部类目</option>
          {CATEGORIES.map(c => <option key={c.th} value={c.th}>{c.zh} / {c.th}</option>)}
        </select>
        <select value={filter.grade} onChange={e => setFilter(f => ({ ...f, grade: e.target.value }))} style={s.input}>
          <option value="">全部等级</option>
          {["A+","B+","C+","A","B","C"].map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <button onClick={load} style={s.btn}>搜索</button>
        <button onClick={startNew} style={s.btnPrimary}>新增达人</button>
        <button onClick={autoGrade} style={s.btn}>重新计算全部等级</button>
      </div>

      {editing !== null ? (
        <div style={{ background: "#fff", padding: 16, borderRadius: 12, marginBottom: 12, border: "1px solid #e2e8f0" }}>
          <h3>{editing ? `编辑 #${(editing as Profile).id}` : "新增达人"}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
            <label>达人编号*</label>{input("influencer_code")}
            <label>来源*</label>{sel("source", ["contact_us","contact_them"])}
            <label>粉丝</label>{input("followers")}
            <label>类目*</label>{sel("category", CATEGORIES.map(c => c.th))}
            <label>等级</label>{sel("grade", ["A+","B+","C+","A","B","C"])}
            <label>GMV销售额</label>{input("gmv_sales")}
            <label>每月挂车视频</label>{input("monthly_cart_videos")}
            <label>销售件数</label>{input("units_sold")}
            <label>可直播</label><input type="checkbox" checked={!!form.can_live} onChange={e => setForm(f => ({ ...f, can_live: e.target.checked }))} />
            <label>直播销售额</label>{input("live_sales")}
            <label>每周直播次数</label>{input("weekly_live_count")}
            <label>平均直播时长</label>{input("avg_live_hours_per_week")}
            <label>备注</label><textarea value={String(form.remark || "")} onChange={e => setForm(f => ({ ...f, remark: e.target.value }))} style={s.input} rows={2} />
            <label>联系方式</label><textarea value={String(form.contact_info || "")} onChange={e => setForm(f => ({ ...f, contact_info: e.target.value }))} style={s.input} rows={2} />
            <label>收款方式</label><textarea value={String(form.payment_info || "")} onChange={e => setForm(f => ({ ...f, payment_info: e.target.value }))} style={s.input} rows={2} />
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <button onClick={save} disabled={saving} style={s.btnPrimary}>{saving ? "保存中..." : "保存"}</button>
            <button onClick={() => setEditing(null)} style={s.btn}>取消</button>
          </div>
        </div>
      ) : null}

      {loading ? <p>加载中...</p> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={s.th}>ID</th><th style={s.th}>编号</th><th style={s.th}>来源</th><th style={s.th}>粉丝</th><th style={s.th}>类目</th><th style={s.th}>等级</th><th style={s.th}>GMV</th><th style={s.th}>挂车</th><th style={s.th}>件数</th><th style={s.th}>直播</th><th style={s.th}>直播销售</th><th style={s.th}>状态</th><th style={s.th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {list.map(p => (
                <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={s.td}>{p.id}</td><td style={s.td}>{p.influencer_code}</td><td style={s.td}>{p.source === "contact_us" ? "我方联系" : "达人联系"}</td><td style={s.td}>{p.followers || "-"}</td><td style={s.td}>{p.category}</td><td style={s.td}>{p.grade || "未达标"}</td><td style={s.td}>{p.gmv_sales || "-"}</td><td style={s.td}>{p.monthly_cart_videos || "-"}</td><td style={s.td}>{p.units_sold || "-"}</td><td style={s.td}>{p.can_live ? "是" : "否"}</td><td style={s.td}>{p.live_sales || "-"}</td><td style={s.td}>{p.status}</td>
                  <td style={s.td}>
                    <button onClick={() => startEdit(p)} style={s.btnSm}>编辑</button>
                    <button onClick={() => del(p.id)} style={{ ...s.btnSm, color: "#b91c1c", marginLeft: 4 }}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  input: { padding: "6px 8px", border: "1px solid #dbe1ea", borderRadius: 8, width: "100%", boxSizing: "border-box" },
  btn: { padding: "6px 12px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer" },
  btnPrimary: { padding: "6px 12px", border: "none", borderRadius: 8, background: "var(--xt-accent)", color: "#fff", cursor: "pointer" },
  btnSm: { padding: "4px 8px", border: "1px solid #dbe1ea", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 11 },
  th: { padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #e2e8f0", fontWeight: 700, whiteSpace: "nowrap" },
  td: { padding: "6px 8px", textAlign: "left", fontSize: 12 },
};
