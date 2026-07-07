import { useEffect, useState, useRef } from "react";
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
  const [showErrors, setShowErrors] = useState<string[]>([]);
  const autoSaveTimer = useRef<any>(null);

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
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, []);

  const autoSave = (data: any) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      if (!data.influencer_code) return;
      try {
        if (isNew) {
          await fetchWithAuth("/api/admin/influencer-profiles", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({...data, user_id: null}) });
          setIsNew(false);
        } else {
          await fetchWithAuth("/api/influencer/profile", { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify(data) });
        }
      } catch {}
    }, 2000);
  };

  const handleChange = (field: string, value: any) => {
    setForm((f: any) => { const next = { ...f, [field]: value }; autoSave(next); return next; });
  };

  const validate = (): string[] => {
    const errors: string[] = [];
    if (!form.influencer_code?.trim()) errors.push("达人编号不能为空");
    if (!form.source) errors.push("达人来源必须选择");
    if (!form.category) errors.push("类目必须选择");
    if (!form.quoted_price || isNaN(Number(form.quoted_price)) || Number(form.quoted_price) <= 0) errors.push("报价必须为大于 0 的数字");
    if (!form.cooperation_conditions?.trim()) errors.push("合作条件不能为空");
    if (form.followers && isNaN(Number(form.followers))) errors.push("达人粉丝必须为数字");
    if (form.gmv_sales && isNaN(Number(form.gmv_sales))) errors.push("GMV 销售额必须为数字");
    if (form.live_sales && isNaN(Number(form.live_sales))) errors.push("直播销售额必须为数字");
    if (form.weekly_live_count && isNaN(Number(form.weekly_live_count))) errors.push("每周直播次数必须为数字");
    if (form.avg_live_hours_per_week && isNaN(Number(form.avg_live_hours_per_week))) errors.push("平均直播时长必须为数字");
    return errors;
  };

  const save = async () => {
    const errors = validate();
    if (errors.length > 0) { setShowErrors(errors); return; }
    setShowErrors([]);
    setSaving(true);
    try {
      if (isNew) {
        await fetchWithAuth("/api/admin/influencer-profiles", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({...form, user_id: null}) });
        setIsNew(false);
      } else {
        await fetchWithAuth("/api/influencer/profile", { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify(form) });
      }
      setMsg("资料已保存！"); setTimeout(()=>setMsg(""),2000);
    } catch(e:any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const clearForm = () => {
    if (!confirm("确定要清除已填写的所有资料吗？")) return;
    setForm({ source: "contact_them", can_live: false });
    setMsg("表单已清除");
    if (!isNew) fetchWithAuth("/api/influencer/profile", { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ influencer_code:"",source:"",followers:"",quoted_price:null,cooperation_conditions:"",gmv_sales:"",monthly_cart_videos:"",units_sold:"",live_sales:"",weekly_live_count:"",avg_live_hours_per_week:"",remark:"" }) }).catch(()=>{});
  };

  const si: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8, boxSizing: "border-box", marginTop: 2 };
  const lab: React.CSSProperties = { fontSize: 12, color: "#64748b", fontWeight: 600 };
  const reqLab: React.CSSProperties = { ...lab, color: "#b91c1c" };

  if (loading) return <p>加载中...</p>;

  return (
    <div>
      <h2 style={{marginTop:0}}>{isNew ? "首次填写达人资料（必填）" : "我的资料"}</h2>
      {isNew && <p style={{color:"#b91c1c",fontWeight:700,fontSize:14}}>填写后自动保存，切换页面数据不丢失</p>}
      {err && <p style={{color:"#c00"}}>{err}</p>}
      {msg && <p style={{color:"#166534",fontWeight:700}}>{msg}</p>}
      {form.grade && <p style={{fontSize:13,color:"#64748b"}}>当前等级: <strong style={{color:"var(--xt-primary)"}}>{form.grade}</strong></p>}

      {/* Error modal */}
      {showErrors.length > 0 && (
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}} onClick={()=>setShowErrors([])}>
          <div style={{background:"#fff",borderRadius:12,padding:24,maxWidth:450,width:"90%"}} onClick={e=>e.stopPropagation()}>
            <h3 style={{color:"#b91c1c",marginTop:0}}>请修正以下问题</h3>
            <ul style={{color:"#475569",fontSize:14,lineHeight:2}}>{showErrors.map((e,i)=><li key={i}>{e}</li>)}</ul>
            <button onClick={()=>setShowErrors([])} style={{padding:"8px 20px",border:"1px solid #dbe1ea",borderRadius:8,background:"#fff",cursor:"pointer",marginTop:8}}>关闭</button>
          </div>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", maxWidth: 700 }}>
        <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 12, alignItems: "center" }}>
          <label style={reqLab}>达人编号 *</label><input value={form.influencer_code||""} onChange={e=>handleChange("influencer_code",e.target.value)} style={si} />
          <label style={reqLab}>来源 *</label><select value={form.source||"contact_them"} onChange={e=>handleChange("source",e.target.value)} style={si}><option value="contact_us">我方主动联系</option><option value="contact_them">达人主动联系</option></select>
          <label style={reqLab}>类目 * {categoryLocked?"(不可更改)":""}</label><select value={form.category||""} onChange={e=>handleChange("category",e.target.value)} style={si} disabled={categoryLocked}><option value="">-- 请选择 --</option>{CATEGORIES.map(c=><option key={c.th} value={c.th}>{c.zh} / {c.th}</option>)}</select>
          <label style={lab}>粉丝</label><input value={form.followers||""} onChange={e=>handleChange("followers",e.target.value)} style={si} />
          <label style={reqLab}>报价 (THB) *</label><input type="number" value={form.quoted_price||""} onChange={e=>handleChange("quoted_price",e.target.value)} style={si} placeholder="商家可见" />
          <label style={reqLab}>合作条件 *</label><textarea value={form.cooperation_conditions||""} onChange={e=>handleChange("cooperation_conditions",e.target.value)} style={si} rows={3} placeholder="商家可见" />
          <label style={lab}>GMV 销售额</label><input value={form.gmv_sales||""} onChange={e=>handleChange("gmv_sales",e.target.value)} style={si} />
          <label style={lab}>每月挂车视频</label><input value={form.monthly_cart_videos||""} onChange={e=>handleChange("monthly_cart_videos",e.target.value)} style={si} />
          <label style={lab}>销售件数</label><input value={form.units_sold||""} onChange={e=>handleChange("units_sold",e.target.value)} style={si} />
          <label style={lab}>可直播</label><input type="checkbox" checked={!!form.can_live} onChange={e=>handleChange("can_live",e.target.checked)} />
          <label style={lab}>直播销售额</label><input value={form.live_sales||""} onChange={e=>handleChange("live_sales",e.target.value)} style={si} />
          <label style={lab}>每周直播次数</label><input value={form.weekly_live_count||""} onChange={e=>handleChange("weekly_live_count",e.target.value)} style={si} />
          <label style={lab}>平均直播时长</label><input value={form.avg_live_hours_per_week||""} onChange={e=>handleChange("avg_live_hours_per_week",e.target.value)} style={si} />
          <label style={lab}>备注</label><textarea value={form.remark||""} onChange={e=>handleChange("remark",e.target.value)} style={si} rows={2} />
        </div>
        <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
          <button onClick={save} disabled={saving} style={{ padding: "10px 24px", border: "none", borderRadius: 8, background: saving ? "#94a3b8" : "var(--xt-accent)", color: "#fff", cursor: saving ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 15 }}>{saving ? "保存中..." : "保存资料"}</button>
          <button onClick={clearForm} style={{ padding: "10px 24px", border: "1px solid #fecaca", borderRadius: 8, background: "#fff", color: "#b91c1c", cursor: "pointer", fontWeight: 700, fontSize: 15 }}>清除</button>
        </div>
      </div>
    </div>
  );
}
