import { useTranslation } from 'react-i18next';
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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

type Profile = any;

export default function AdminVCProfilesPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
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
      if (editing?.id) {
        await fetchWithAuth(`/api/admin/influencer-profiles/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        await fetchWithAuth("/api/admin/influencer-profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      setEditing(null); setForm({}); load();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const startNew = () => { setEditing({ id: 0 } as any); setForm({ source: "contact_us", category: CATEGORIES[0].th, status: "active" }); };
  const del = async (id: number) => { if (!confirm("确认删除？")) return; await fetchWithAuth(`/api/admin/influencer-profiles/${id}`, { method: "DELETE" }); load(); };
  const autoGrade = async () => { await fetchWithAuth("/api/admin/influencer-profiles/auto-grade"); load(); };

  const i = (f: string, p?: string) => <input value={String(form[f] || "")} onChange={e => setForm(ff => ({ ...ff, [f]: e.target.value }))} placeholder={p || f} style={si} />;
  const sel = (f: string, o: string[]) => <select value={String(form[f] || "")} onChange={e => setForm(ff => ({ ...ff, [f]: e.target.value }))} style={si}>{o.map(v => <option key={v} value={v}>{v}</option>)}</select>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <button onClick={() => nav("/admin/vertical-connections")} style={sb}>← 返回概览</button>
        <h2 style={{ margin: 0 }}>达人资料管理</h2>
      </div>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input placeholder="搜索编号/粉丝" value={filter.q} onChange={e => setFilter(f => ({ ...f, q: e.target.value }))} style={si} />
        <select value={filter.category} onChange={e => setFilter(f => ({ ...f, category: e.target.value }))} style={si}>
          <option value="">全部类目</option>{CATEGORIES.map(c => <option key={c.th} value={c.th}>{c.zh}</option>)}
        </select>
        <select value={filter.grade} onChange={e => setFilter(f => ({ ...f, grade: e.target.value }))} style={si}>
          <option value="">全部等级</option>{["A+","B+","C+","A","B","C"].map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <button onClick={load} style={sb}>搜索</button>
        <button onClick={startNew} style={sp}>新增达人</button>
        <button onClick={autoGrade} style={sb}>重新计算全部等级</button>
      </div>
      {editing !== null && (
        <div style={{ background: "#fff", padding: 16, borderRadius: 12, marginBottom: 12, border: "1px solid #e2e8f0" }}>
          <h3>{editing?.id ? `编辑 #${editing.id}` : "新增达人"}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
            <label>达人编号*</label>{i("influencer_code")}
            <label>来源*</label>{sel("source", ["contact_us","contact_them"])}
            <label>粉丝</label>{i("followers")}
            <label>类目*</label>{sel("category", CATEGORIES.map(c => c.th))}
            <label>等级</label>{sel("grade", ["A+","B+","C+","A","B","C"])}
            <label>GMV销售额</label>{i("gmv_sales")}
            <label>每月挂车视频</label>{i("monthly_cart_videos")}
            <label>销售件数</label>{i("units_sold")}
            <label>可直播</label><input type="checkbox" checked={!!form.can_live} onChange={e => setForm(f => ({ ...f, can_live: e.target.checked }))} />
            <label>直播销售额</label>{i("live_sales")}
            <label>每周直播次数</label>{i("weekly_live_count")}
            <label>平均直播时长</label>{i("avg_live_hours_per_week")}
            <label>备注</label><textarea value={String(form.remark || "")} onChange={e => setForm(f => ({ ...f, remark: e.target.value }))} style={si} rows={2} />
            <label>联系方式</label><textarea value={String(form.contact_info || "")} onChange={e => setForm(f => ({ ...f, contact_info: e.target.value }))} style={si} rows={2} />
            <label>收款方式</label><textarea value={String(form.payment_info || "")} onChange={e => setForm(f => ({ ...f, payment_info: e.target.value }))} style={si} rows={2} />
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <button onClick={save} disabled={saving} style={sp}>{saving ? "保存中..." : "保存"}</button>
            <button onClick={() => setEditing(null)} style={sb}>取消</button>
          </div>
        </div>
      )}
      {loading ? <p>加载中...</p> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", fontSize: 12 }}>
            <thead><tr style={{ background: "#f8fafc" }}>{["ID","编号","来源","粉丝","类目","等级","GMV","挂车","件数","直播","直播销售","状态","操作"].map(h => <th key={h} style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #e2e8f0", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
            <tbody>
              {list.map((p: any) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "6px 8px", fontSize: 12 }}>{p.id}</td><td style={{ padding: "6px 8px", fontSize: 12 }}>{p.influencer_code}</td><td style={{ padding: "6px 8px", fontSize: 12 }}>{p.source}</td><td style={{ padding: "6px 8px", fontSize: 12 }}>{p.followers||"-"}</td><td style={{ padding: "6px 8px", fontSize: 12 }}>{p.category}</td><td style={{ padding: "6px 8px", fontSize: 12 }}>{p.grade||"未达标"}</td><td style={{ padding: "6px 8px", fontSize: 12 }}>{p.gmv_sales||"-"}</td><td style={{ padding: "6px 8px", fontSize: 12 }}>{p.monthly_cart_videos||"-"}</td><td style={{ padding: "6px 8px", fontSize: 12 }}>{p.units_sold||"-"}</td><td style={{ padding: "6px 8px", fontSize: 12 }}>{p.can_live?"是":"否"}</td><td style={{ padding: "6px 8px", fontSize: 12 }}>{p.live_sales||"-"}</td><td style={{ padding: "6px 8px", fontSize: 12 }}>{p.status}</td>
                  <td style={{ padding: "6px 8px", fontSize: 12 }}>
                    <button onClick={() => { setEditing(p); setForm({...p}); }} style={ssm}>编辑</button>
                    <button onClick={() => del(p.id)} style={{ ...ssm, color: "#b91c1c", marginLeft: 4 }}>删除</button>
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
const si: React.CSSProperties = { padding: "6px 8px", border: "1px solid #dbe1ea", borderRadius: 8, width: "100%", boxSizing: "border-box" };
const sb: React.CSSProperties = { padding: "6px 12px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer" };
const sp: React.CSSProperties = { padding: "6px 12px", border: "none", borderRadius: 8, background: "var(--xt-accent)", color: "#fff", cursor: "pointer" };
const ssm: React.CSSProperties = { padding: "4px 8px", border: "1px solid #dbe1ea", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 11 };
