import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { fetchWithAuth } from "../fetchWithAuth";

export default function ClientVCCreateOrder() {
  const nav = useNavigate(); const params = useParams();
  const [sp] = useSearchParams();
  const connectionId = params.connectionId || "";
  const influencerId = sp.get("influencer") || "";
  const [form, setForm] = useState({ title: "", task_requirements: "", delivery_standards: "", deadline: "", submission_types: "", amount: "" });
  const [submissionChecks, setSubmissionChecks] = useState({ link: false, video: false, image: false, text: false });
  const toggleSubCheck = (k: string) => {
    setSubmissionChecks(s => {
      const n = { ...s, [k]: !(s as any)[k] };
      setForm(f => ({ ...f, submission_types: Object.entries(n).filter(([_,v]) => v).map(([k]) => k).join(",") }));
      return n;
    });
  };
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  // 自动获取达人报价填入金额字段（influencerId 为资料 ID，直接查询单条记录）
  useEffect(() => {
    (async () => {
      if (!influencerId) return;
      try {
        const res = await fetchWithAuth(`/api/admin/influencer-profiles/${influencerId}`);
        if (!res.ok) return;
        const profile = await res.json();
        if (profile?.quoted_price) setForm(f => ({ ...f, amount: profile.quoted_price }));
      } catch {}
    })();
  }, [influencerId]);

  const [templates, setTemplates] = useState<any[]>(()=>{try{return JSON.parse(localStorage.getItem("vc_templates")||"[]");}catch{return[];}});
  const saveTemplate = () => {
    if(!form.title){setErr("请先填写任务标题");return;}
    const t = {title:form.title,task_requirements:form.task_requirements,delivery_standards:form.delivery_standards,submission_types:form.submission_types};
    const next = [...templates, t].slice(0,10);
    setTemplates(next); localStorage.setItem("vc_templates",JSON.stringify(next));
    alert("模板已保存");
  };
  const applyTemplate = (e: any) => {
    const t = templates[Number(e.target.value)];
    if(t) setForm(f=>({...f,title:t.title,task_requirements:t.task_requirements,delivery_standards:t.delivery_standards,submission_types:t.submission_types}));
  };

  const submit = async () => {
    if (!form.title || !form.task_requirements || !form.delivery_standards || !form.deadline) { setErr("请填写所有必填字段"); return; }
    setSending(true);
    try {
      await fetchWithAuth("/api/client/connection-orders", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ connection_id: Number(connectionId), influencer_id: Number(influencerId), ...form }) });
      nav("/client/vertical-connections/my");
    } catch(e:any) { setErr(e.message); }
    finally { setSending(false); }
  };

  const sb: React.CSSProperties = { padding: "6px 12px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer" };
  const si: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8, boxSizing: "border-box", marginTop: 4 };

  return (
    <div>
      <button onClick={()=>nav(-1)} style={{ padding: "6px 12px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer", marginBottom: 12 }}>← 返回</button>
      <h2 style={{marginTop:0}}>定向派单</h2>
      {err && <p style={{color:"#c00"}}>{err}</p>}
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", maxWidth: 600 }}>
        <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 10, alignItems: "center" }}>
          {templates.length > 0 && <><label>选择模板</label><select onChange={applyTemplate} style={si}><option value="">-- 选择 --</option>{templates.map((t:any,i:number)=><option key={i} value={i}>{t.title}</option>)}</select></>}
          <label></label><button type="button" onClick={saveTemplate} style={{...sb,marginTop:4}}>💾 保存为模板</button>
          <label>任务标题*</label><input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} style={si} />
          <label>任务要求*</label><textarea value={form.task_requirements} onChange={e=>setForm(f=>({...f,task_requirements:e.target.value}))} style={si} rows={3} />
          <label>交付标准*</label><textarea value={form.delivery_standards} onChange={e=>setForm(f=>({...f,delivery_standards:e.target.value}))} style={si} rows={3} />
          <label>截止时间*</label><input type="datetime-local" value={form.deadline} onChange={e=>setForm(f=>({...f,deadline:e.target.value}))} style={si} />
          <label>提交方式</label><div style={{display:"flex",gap:12,flexWrap:"wrap",paddingTop:4}}>{["link","video","image","text"].map(k=>(<label key={k} style={{fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}><input type="checkbox" checked={(submissionChecks as any)[k]} onChange={()=>toggleSubCheck(k)} />{k==="link"?"链接":k==="video"?"视频":k==="image"?"图片":"文本"}</label>))}</div>
          <label>订单金额（达人报价）</label><div style={{...si,background:"#f8fafc",color:"#475569",display:"flex",alignItems:"center",fontWeight:700}}>{form.amount ? `${form.amount} THB` : "加载中..."}</div>
        </div>
        <button onClick={submit} disabled={sending} style={{ marginTop: 16, padding: "8px 20px", border: "none", borderRadius: 8, background: sending ? "#94a3b8" : "var(--xt-accent)", color: "#fff", cursor: sending ? "not-allowed" : "pointer", fontWeight: 600 }}>{sending ? "提交中..." : "提交派单"}</button>
      </div>
    </div>
  );
}
