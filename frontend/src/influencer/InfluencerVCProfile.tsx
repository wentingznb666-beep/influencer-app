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

const requiredFields = [
  "influencer_code","source","followers","category","quoted_price","cooperation_conditions",
  "gmv_sales","monthly_cart_videos","units_sold","live_sales","weekly_live_count","avg_live_hours_per_week"
];
const fieldLabels: Record<string,string> = {
  influencer_code:"达人编号",source:"达人来源",followers:"达人粉丝",category:"类目",
  quoted_price:"报价",cooperation_conditions:"合作条件",gmv_sales:"GMV 销售额",
  monthly_cart_videos:"每月挂车视频数量",units_sold:"销售件数",
  live_sales:"直播销售额",weekly_live_count:"每周直播次数",avg_live_hours_per_week:"平均直播时长"
};
const numberFields = ["quoted_price","followers","gmv_sales","live_sales","weekly_live_count","avg_live_hours_per_week","units_sold","monthly_cart_videos"];

export default function InfluencerVCProfile() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState<{type:"success"|"error",msg:string}|null>(null);
  const [showErrors, setShowErrors] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [form, setForm] = useState<any>({ source: "contact_them", can_live: false });
  const [isNew, setIsNew] = useState(true);
  const [categoryLocked, setCategoryLocked] = useState(false);
  const autoSaveTimer = useRef<any>(null);
  const initialForm = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetchWithAuth("/api/influencer/profile");
        const p = await r.json();
        if (p && p.influencer_code) { setForm(p); setIsNew(false); setCategoryLocked(!!p.category); initialForm.current = JSON.stringify(p); }
      } catch {} finally { setLoading(false); }
    })();
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, []);

  const handleChange = (field: string, value: any) => {
    setForm((f: any) => { const next = { ...f, [field]: value }; autoSave(next); return next; });
    setDirty(true); setSaved(false);
  };

  const autoSave = (data: any) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      // 仅当 profile 已存在（首次手动保存成功）后才执行自动保存，避免创建不完整的记录
      if (!data.influencer_code || !initialForm.current) return;
      try {
        await fetchWithAuth("/api/influencer/profile", { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify(data) });
        initialForm.current = JSON.stringify(data);
      } catch {}
    }, 1500);
  };

  const validate = (): string[] => {
    const errors: string[] = [];
    for (const f of requiredFields) {
      const v = form[f];
      if (v === undefined || v === null || String(v).trim() === "") errors.push(`${fieldLabels[f] || f} 不能为空`);
    }
    for (const f of numberFields) {
      const v = form[f];
      if (v !== undefined && v !== null && String(v).trim() !== "" && isNaN(Number(v))) errors.push(`${fieldLabels[f] || f} 必须为数字`);
    }
    if (form.quoted_price && !isNaN(Number(form.quoted_price)) && Number(form.quoted_price) <= 0) errors.push("报价必须为大于 0 的数字");
    return errors;
  };

  const save = async () => {
    const errors = validate();
    if (errors.length > 0) { setShowErrors(errors); return; }
    setShowErrors([]); setSaving(true);
    try {
      const r = await fetchWithAuth("/api/influencer/profile", { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify(form) });
      if (!r.ok) {
        const errData = await r.json().catch(() => ({}));
        throw new Error(errData.message || `保存失败 (${r.status})`);
      }
      setIsNew(false);
      initialForm.current = JSON.stringify(form);
      setSaved(true); setDirty(false);
      setToast({type:"success",msg:"保存成功"});
      setTimeout(()=>{setToast(null);nav("/influencer/vertical-connections");},1200);
    } catch(e:any) { setToast({type:"error",msg:e.message||"保存失败，请重试"}); }
    finally { setSaving(false); }
  };

  const clearForm = () => {
    if (!confirm("确定要清除已填写的所有资料吗？")) return;
    const empty = { source: "contact_them", can_live: false };
    setForm(empty); setDirty(false); setSaved(false);
    setToast({type:"success",msg:"表单已清除"});
    setTimeout(()=>setToast(null),1500);
    if (!isNew) fetchWithAuth("/api/influencer/profile", { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify({influencer_code:"",source:"",followers:"",quoted_price:null,cooperation_conditions:"",gmv_sales:"",monthly_cart_videos:"",units_sold:"",live_sales:"",weekly_live_count:"",avg_live_hours_per_week:"",remark:""}) }).catch(()=>{});
  };

  const si: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8, boxSizing: "border-box", marginTop: 2 };
  const lab: React.CSSProperties = { fontSize: 12, color: "#64748b", fontWeight: 600 };
  const rLab: React.CSSProperties = { ...lab, color: "#b91c1c" };

  if (loading) return <p>加载中...</p>;

  return (
    <div>
      <h2 style={{marginTop:0}}>{isNew ? "首次填写达人资料" : "我的资料"}</h2>
      {isNew && <p style={{color:"#b91c1c",fontWeight:700,fontSize:14}}>所有字段（除备注外）均为必填，填写后自动保存</p>}
      {form.grade && <p style={{fontSize:13,margin:0}}>当前等级: <strong style={{color:"var(--xt-primary)"}}>{form.grade}</strong></p>}

      {/* Progress bar */}
      {(()=>{const total=13;const fields=["influencer_code","source","followers","category","quoted_price","cooperation_conditions","gmv_sales","monthly_cart_videos","units_sold","live_sales","weekly_live_count","avg_live_hours_per_week","can_live"];const filled=fields.filter(f=>{const v=form[f];return v!==null&&v!==undefined&&String(v).trim()!==""&&v!==false;}).length;const pct=Math.round(filled/fields.length*100);const bar=pct<50?"#dc2626":pct<80?"#f59e0b":"#166534";return(
        <div style={{background:"#fff",borderRadius:8,padding:"10px 14px",marginBottom:8,boxShadow:"0 1px 2px rgba(0,0,0,0.04)"}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#475569",marginBottom:4}}><span>资料完整度</span><span>{filled}/{fields.length} 字段</span></div>
          <div style={{background:"#f1f5f9",borderRadius:99,height:6,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:bar,borderRadius:99,transition:"0.3s"}} /></div>
        </div>
      );})()}

      {/* Toast */}
      {toast && (
        <div style={{position:"fixed",top:20,right:20,background:toast.type==="success"?"#166534":"#b91c1c",color:"#fff",padding:"12px 20px",borderRadius:8,zIndex:2000,fontWeight:700,boxShadow:"0 4px 12px rgba(0,0,0,0.2)"}}>
          {toast.type==="success"?"✅":"❌"} {toast.msg}
          <button onClick={()=>setToast(null)} style={{marginLeft:12,background:"none",border:"none",color:"#fff",cursor:"pointer",fontWeight:700}}>×</button>
        </div>
      )}

      {/* Validation error modal */}
      {showErrors.length > 0 && (
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}} onClick={()=>setShowErrors([])}>
          <div style={{background:"#fff",borderRadius:12,padding:24,maxWidth:450,width:"90%"}} onClick={e=>e.stopPropagation()}>
            <h3 style={{color:"#b91c1c",marginTop:0}}>⚠️ 请完善以下信息</h3>
            <ul style={{color:"#475569",fontSize:14,lineHeight:2.2}}>{showErrors.map((e,i)=><li key={i}>· {e}</li>)}</ul>
            <button onClick={()=>setShowErrors([])} style={{padding:"8px 20px",border:"1px solid #dbe1ea",borderRadius:8,background:"#fff",cursor:"pointer",marginTop:8}}>关闭</button>
          </div>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", maxWidth: 700, marginTop: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 12, alignItems: "center" }}>
          <label style={rLab}>达人编号 *</label><input value={form.influencer_code||""} onChange={e=>handleChange("influencer_code",e.target.value)} style={si} />
          <label style={rLab}>达人来源 *</label><select value={form.source||"contact_them"} onChange={e=>handleChange("source",e.target.value)} style={si}><option value="contact_us">我方主动联系</option><option value="contact_them">达人主动联系</option></select>
          <label style={rLab}>达人粉丝 *</label><input value={form.followers||""} onChange={e=>handleChange("followers",e.target.value)} style={si} />
          <label style={rLab}>类目 * {categoryLocked?"(不可更改)":""}</label><select value={form.category||""} onChange={e=>handleChange("category",e.target.value)} style={si} disabled={categoryLocked}><option value="">-- 请选择 --</option>{CATEGORIES.map(c=><option key={c.th} value={c.th}>{c.zh} / {c.th}</option>)}</select>
          <label style={rLab}>报价 (THB) *</label><input type="number" value={form.quoted_price||""} onChange={e=>handleChange("quoted_price",e.target.value)} style={si} placeholder="商家可见，必须大于0" />
          <label style={rLab}>合作条件 *</label><textarea value={form.cooperation_conditions||""} onChange={e=>handleChange("cooperation_conditions",e.target.value)} style={si} rows={3} placeholder="填写合作要求和条件说明" />
          <label style={rLab}>GMV 销售额 *</label><input value={form.gmv_sales||""} onChange={e=>handleChange("gmv_sales",e.target.value)} style={si} />
          <label style={rLab}>每月挂车视频 *</label><input value={form.monthly_cart_videos||""} onChange={e=>handleChange("monthly_cart_videos",e.target.value)} style={si} />
          <label style={rLab}>销售件数 *</label><input value={form.units_sold||""} onChange={e=>handleChange("units_sold",e.target.value)} style={si} />
          <label style={rLab}>可直播 *</label><input type="checkbox" checked={!!form.can_live} onChange={e=>handleChange("can_live",e.target.checked)} />
          <label style={rLab}>直播销售额 *</label><input value={form.live_sales||""} onChange={e=>handleChange("live_sales",e.target.value)} style={si} />
          <label style={rLab}>每周直播次数 *</label><input value={form.weekly_live_count||""} onChange={e=>handleChange("weekly_live_count",e.target.value)} style={si} />
          <label style={rLab}>平均直播时长 *</label><input value={form.avg_live_hours_per_week||""} onChange={e=>handleChange("avg_live_hours_per_week",e.target.value)} style={si} />
          <label style={lab}>备注</label><textarea value={form.remark||""} onChange={e=>handleChange("remark",e.target.value)} style={si} rows={2} />
        </div>
        <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
          <button onClick={save} disabled={saving || saved} style={{ padding: "10px 24px", border: "none", borderRadius: 8, background: saving ? "#94a3b8" : saved ? "#e2e8f0" : "var(--xt-accent)", color: saving ? "#fff" : saved ? "#94a3b8" : "#fff", cursor: saving||saved ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 15 }}>
            {saving ? "保存中..." : saved ? "已保存 ✓" : dirty ? "保存" : "已保存 ✓"}
          </button>
          <button onClick={clearForm} style={{ padding: "10px 24px", border: "1px solid #fecaca", borderRadius: 8, background: "#fff", color: "#b91c1c", cursor: "pointer", fontWeight: 700, fontSize: 15 }}>清除</button>
          <button onClick={()=>setShowPreview(true)} style={{ padding: "10px 24px", border: "1px solid var(--xt-accent)", borderRadius: 8, background: "#fff", color: "var(--xt-accent)", cursor: "pointer", fontWeight: 700, fontSize: 15 }}>👁 预览商家视角</button>
        </div>
      </div>

      {/* Preview modal */}
      {showPreview && (
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}} onClick={()=>setShowPreview(false)}>
          <div style={{background:"#fff",borderRadius:12,padding:24,maxWidth:480,width:"90%",maxHeight:"80vh",overflow:"auto"}} onClick={e=>e.stopPropagation()}>
            <h3 style={{marginTop:0}}>商家看到的资料</h3>
            <div style={{fontSize:13,lineHeight:2}}>
              <p><strong>达人编号:</strong> {form.influencer_code||"—"}</p>
              <p><strong>等级:</strong> <span style={{color:"var(--xt-accent)",fontWeight:700}}>{form.grade||"未评级"}</span></p>
              <p><strong>报价:</strong> <span style={{background:"#fef3c7",padding:"2px 10px",borderRadius:6,fontWeight:700,color:"#92400e"}}>{form.quoted_price||"—"} THB</span></p>
              <p><strong>合作条件:</strong> {form.cooperation_conditions||"—"}</p>
              <p><strong>GMV:</strong> {form.gmv_sales||"—"} | <strong>销量:</strong> {form.units_sold||"—"}</p>
              <p><strong>可直播:</strong> {form.can_live?"是":"否"} | <strong>直播销售:</strong> {form.live_sales||"—"}</p>
              <p><strong>周直播:</strong> {form.weekly_live_count||"—"} | <strong>时长:</strong> {form.avg_live_hours_per_week||"—"}</p>
            </div>
            <p style={{fontSize:12,color:"#94a3b8",marginTop:8}}>联系方式、收款方式不在此展示</p>
            <button onClick={()=>setShowPreview(false)} style={{marginTop:12,padding:"8px 20px",border:"1px solid #dbe1ea",borderRadius:8,background:"#fff",cursor:"pointer"}}>关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}
