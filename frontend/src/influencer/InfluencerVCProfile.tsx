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

export default function InfluencerVCProfile() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState<any>({ source: "contact_them", can_live: false });
  const [isNew, setIsNew] = useState(true);
  const [categoryLocked, setCategoryLocked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetchWithAuth("/api/influencer/profile");
        const p = await r.json();
        if (p && p.influencer_code) {
          setForm(p);
          setIsNew(false);
          setCategoryLocked(!!p.category);
        }
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const save = async () => {
    if (!form.influencer_code || !form.source || !form.category) { setErr("请填写所有必填字段（编号、来源、类目）"); return; }
    setSaving(true);
    try {
      if (isNew) {
        await fetchWithAuth("/api/admin/influencer-profiles", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({...form, user_id: null}) });
      } else {
        await fetchWithAuth("/api/influencer/profile", { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify(form) });
      }
      setMsg("资料已保存！");
      setTimeout(()=>nav("/influencer/vertical-connections"), 1000);
    } catch(e:any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const si: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8, boxSizing: "border-box", marginTop: 2 };
  const lab: React.CSSProperties = { fontSize: 12, color: "#64748b", fontWeight: 600 };

  if (loading) return <p>加载中...</p>;

  return (
    <div>
      <h2 style={{marginTop:0}}>{isNew ? "首次填写达人资料" : "编辑达人资料"}</h2>
      {isNew && <p style={{color:"#b91c1c",fontWeight:700,fontSize:14}}>⚠ 请先完善以下信息，才能使用垂直达人建联功能</p>}
      {err && <p style={{color:"#c00"}}>{err}</p>}
      {msg && <p style={{color:"#166534",fontWeight:700}}>{msg}</p>}

      <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", maxWidth: 700 }}>
        <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 12, alignItems: "center" }}>
          <label style={lab}>达人编号 *</label>
          <input value={form.influencer_code||""} onChange={e=>setForm((f:any)=>({...f,influencer_code:e.target.value}))} style={si} placeholder="รหัสครีเอเตอร์" />
          
          <label style={lab}>来源 *</label>
          <select value={form.source||"contact_them"} onChange={e=>setForm((f:any)=>({...f,source:e.target.value}))} style={si}>
            <option value="contact_us">我方主动联系 (contact_us)</option>
            <option value="contact_them">达人主动联系 (contact_them)</option>
          </select>
          
          <label style={lab}>类目 * {categoryLocked?"(不可更改)":""}</label>
          <select value={form.category||""} onChange={e=>setForm((f:any)=>({...f,category:e.target.value}))} style={si} disabled={categoryLocked}>
            <option value="">-- 请选择 --</option>
            {CATEGORIES.map(c=><option key={c.th} value={c.th}>{c.zh} / {c.th}</option>)}
          </select>
          
          <label style={lab}>粉丝</label><input value={form.followers||""} onChange={e=>setForm((f:any)=>({...f,followers:e.target.value}))} style={si} />
          <label style={lab}>GMV 销售额</label><input value={form.gmv_sales||""} onChange={e=>setForm((f:any)=>({...f,gmv_sales:e.target.value}))} style={si} />
          <label style={lab}>每月挂车视频</label><input value={form.monthly_cart_videos||""} onChange={e=>setForm((f:any)=>({...f,monthly_cart_videos:e.target.value}))} style={si} />
          <label style={lab}>销售件数</label><input value={form.units_sold||""} onChange={e=>setForm((f:any)=>({...f,units_sold:e.target.value}))} style={si} />
          <label style={lab}>可直播</label><input type="checkbox" checked={!!form.can_live} onChange={e=>setForm((f:any)=>({...f,can_live:e.target.checked}))} />
          <label style={lab}>直播销售额</label><input value={form.live_sales||""} onChange={e=>setForm((f:any)=>({...f,live_sales:e.target.value}))} style={si} />
          <label style={lab}>每周直播次数</label><input value={form.weekly_live_count||""} onChange={e=>setForm((f:any)=>({...f,weekly_live_count:e.target.value}))} style={si} />
          <label style={lab}>平均直播时长</label><input value={form.avg_live_hours_per_week||""} onChange={e=>setForm((f:any)=>({...f,avg_live_hours_per_week:e.target.value}))} style={si} />
          <label style={lab}>备注</label><textarea value={form.remark||""} onChange={e=>setForm((f:any)=>({...f,remark:e.target.value}))} style={si} rows={2} />
          <label style={lab}>收款方式</label><textarea value={form.payment_info||""} onChange={e=>setForm((f:any)=>({...f,payment_info:e.target.value}))} style={si} rows={2} placeholder="泰国银行账户 / PromptPay" />
        </div>
        {form.grade && <p style={{marginTop:12,fontSize:13,color:"#64748b"}}>当前等级: <strong style={{color:"var(--xt-primary)"}}>{form.grade}</strong>（自动计算）</p>}
        <button onClick={save} disabled={saving} style={{ marginTop: 16, padding: "10px 24px", border: "none", borderRadius: 8, background: saving ? "#94a3b8" : "var(--xt-accent)", color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 15 }}>{saving ? "保存中..." : "提交资料"}</button>
      </div>
    </div>
  );
}
