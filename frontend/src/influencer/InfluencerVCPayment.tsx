import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../fetchWithAuth";

const BANKS = [
  { th: "ธนาคารกรุงเทพ", zh: "曼谷银行" },
  { th: "ธนาคารกสิกรไทย", zh: "开泰银行" },
  { th: "ธนาคารไทยพาณิชย์", zh: "汇商银行" },
  { th: "ธนาคารกรุงไทย", zh: "泰京银行" },
  { th: "ธนาคารกรุงศรีอยุธยา", zh: "大城银行" },
  { th: "ธนาคารทหารไทยธนชาต", zh: "军人银行" },
  { th: "ธนาคารออมสิน", zh: "储蓄银行" },
];

export default function InfluencerVCPayment() {
  const nav = useNavigate();
  const [form, setForm] = useState({ bank: "", account_no: "", account_no_confirm: "", account_name: "", account_name_en: "", promptpay: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState<{type:"success"|"error",msg:string}|null>(null);
  const [showErrors, setShowErrors] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try { const r = await fetchWithAuth("/api/influencer/payment-info"); const d = await r.json();
        if (d.payment_info) { try { const p = JSON.parse(d.payment_info); setForm(p); } catch { setForm(f=>({...f,account_no:d.payment_info})); } }
      } catch {}
    })();
  }, []);

  const handleChange = (f: string, v: string) => { setForm(ff=>({...ff,[f]:v})); setDirty(true); setSaved(false); };

  const validate = (): string[] => {
    const e: string[] = [];
    if (!form.bank) e.push("请选择收款银行");
    if (!form.account_no?.trim()) e.push("收款账号号码不能为空");
    else if (!/^\d+$/.test(form.account_no.trim())) e.push("收款账号号码必须为数字");
    if (form.account_no_confirm !== form.account_no) e.push("两次输入的账号不一致");
    if (!form.account_name?.trim()) e.push("收款人姓名不能为空");
    return e;
  };

  const save = async () => {
    const errors = validate();
    if (errors.length > 0) { setShowErrors(errors); return; }
    setShowErrors([]); setSaving(true);
    try {
      const payload = JSON.stringify(form);
      await fetchWithAuth("/api/influencer/payment-info", { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify({payment_info: payload}) });
      setSaved(true); setDirty(false);
      setToast({type:"success",msg:"收款信息保存成功"});
      setTimeout(()=>setToast(null),2500);
    } catch(e:any) { setToast({type:"error",msg:e.message||"保存失败，请重试"}); }
    finally { setSaving(false); }
  };

  const si: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8, boxSizing: "border-box", marginTop: 4 };
  const lab: React.CSSProperties = { fontSize: 13, color: "#475569", fontWeight: 600, marginTop: 12, display: "block" };
  const rLab: React.CSSProperties = { ...lab, color: "#b91c1c" };

  return (
    <div>
      <h2 style={{marginTop:0}}>收款设置</h2>

      {toast && (
        <div style={{position:"fixed",top:20,right:20,background:toast.type==="success"?"#166534":"#b91c1c",color:"#fff",padding:"12px 20px",borderRadius:8,zIndex:2000,fontWeight:700,boxShadow:"0 4px 12px rgba(0,0,0,0.2)"}}>
          {toast.type==="success"?"✅":"❌"} {toast.msg}
          <button onClick={()=>setToast(null)} style={{marginLeft:12,background:"none",border:"none",color:"#fff",cursor:"pointer",fontWeight:700}}>×</button>
        </div>
      )}

      {showErrors.length > 0 && (
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}} onClick={()=>setShowErrors([])}>
          <div style={{background:"#fff",borderRadius:12,padding:24,maxWidth:450,width:"90%"}} onClick={e=>e.stopPropagation()}>
            <h3 style={{color:"#b91c1c",marginTop:0}}>请修正以下问题</h3>
            <ul style={{color:"#475569",fontSize:14,lineHeight:2.2}}>{showErrors.map((e,i)=><li key={i}>· {e}</li>)}</ul>
            <button onClick={()=>setShowErrors([])} style={{padding:"8px 20px",border:"1px solid #dbe1ea",borderRadius:8,background:"#fff",cursor:"pointer",marginTop:8}}>关闭</button>
          </div>
        </div>
      )}

      <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 3px rgba(0,0,0,0.08)",maxWidth:520}}>
        <label style={rLab}>收款银行 *</label>
        <select value={form.bank||""} onChange={e=>handleChange("bank",e.target.value)} style={si}>
          <option value="">-- 请选择 --</option>
          {BANKS.map(b=><option key={b.th} value={b.th}>{b.zh} / {b.th}</option>)}
        </select>

        <label style={rLab}>收款账号号码 *</label>
        <input value={form.account_no||""} onChange={e=>handleChange("account_no",e.target.value)} style={si} placeholder="仅数字" />

        <label style={rLab}>确认账号号码 *</label>
        <input value={form.account_no_confirm||""} onChange={e=>handleChange("account_no_confirm",e.target.value)} style={si} placeholder="再次输入账号号码" />
        {form.account_no && form.account_no_confirm && form.account_no !== form.account_no_confirm && <p style={{color:"#b91c1c",fontSize:12,margin:"4px 0 0"}}>两次输入的账号不一致</p>}

        <label style={rLab}>收款人姓名 *</label>
        <input value={form.account_name||""} onChange={e=>handleChange("account_name",e.target.value)} style={si} placeholder="泰文姓名" />

        <label style={lab}>收款人姓名（英文 / 泰文）</label>
        <input value={form.account_name_en||""} onChange={e=>handleChange("account_name_en",e.target.value)} style={si} placeholder="英文或泰文姓名（选填）" />

        <label style={lab}>PromptPay 号码</label>
        <input value={form.promptpay||""} onChange={e=>handleChange("promptpay",e.target.value)} style={si} placeholder="PromptPay 号码（选填）" />

        <p style={{fontSize:12,color:"#94a3b8",marginTop:8}}>此信息仅在商家验收通过你的作品后对其展示</p>

        <button onClick={save} disabled={saving||saved} style={{ marginTop: 16, padding: "10px 24px", border: "none", borderRadius: 8, background: saving?"#94a3b8":saved?"#e2e8f0":"var(--xt-accent)", color: saving?"#fff":saved?"#94a3b8":"#fff", cursor: saving||saved?"not-allowed":"pointer", fontWeight: 700, fontSize: 15 }}>
          {saving ? "保存中..." : saved ? "已保存 ✓" : dirty ? "保存" : "已保存 ✓"}
        </button>
      </div>
    </div>
  );
}
