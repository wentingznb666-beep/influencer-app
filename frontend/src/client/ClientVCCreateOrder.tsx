import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { fetchWithAuth } from "../fetchWithAuth";

export default function ClientVCCreateOrder() {
  const nav = useNavigate(); const params = useParams();
  const [sp] = useSearchParams();
  const connectionId = params.id || "";
  const influencerId = sp.get("influencer") || "";
  const [form, setForm] = useState({ title: "", task_requirements: "", delivery_standards: "", deadline: "", submission_types: "", amount: "" });
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!form.title || !form.task_requirements || !form.delivery_standards || !form.deadline || !form.amount) { setErr("请填写所有必填字段"); return; }
    setSending(true);
    try {
      await fetchWithAuth("/api/client/connection-orders", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ connection_id: Number(connectionId), influencer_id: Number(influencerId), ...form }) });
      nav("/client/vertical-connections/my-list");
    } catch(e:any) { setErr(e.message); }
    finally { setSending(false); }
  };

  const si: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8, boxSizing: "border-box", marginTop: 4 };

  return (
    <div>
      <button onClick={()=>nav(-1)} style={{ padding: "6px 12px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer", marginBottom: 12 }}>← 返回</button>
      <h2 style={{marginTop:0}}>定向派单</h2>
      {err && <p style={{color:"#c00"}}>{err}</p>}
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", maxWidth: 600 }}>
        <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 10, alignItems: "center" }}>
          <label>任务标题*</label><input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} style={si} />
          <label>任务要求*</label><textarea value={form.task_requirements} onChange={e=>setForm(f=>({...f,task_requirements:e.target.value}))} style={si} rows={3} />
          <label>交付标准*</label><textarea value={form.delivery_standards} onChange={e=>setForm(f=>({...f,delivery_standards:e.target.value}))} style={si} rows={3} />
          <label>截止时间*</label><input type="datetime-local" value={form.deadline} onChange={e=>setForm(f=>({...f,deadline:e.target.value}))} style={si} />
          <label>提交方式</label><input value={form.submission_types} onChange={e=>setForm(f=>({...f,submission_types:e.target.value}))} style={si} placeholder="link,video,image 逗号分隔" />
          <label>订单金额*</label><input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} style={si} />
        </div>
        <button onClick={submit} disabled={sending} style={{ marginTop: 16, padding: "8px 20px", border: "none", borderRadius: 8, background: sending ? "#94a3b8" : "var(--xt-accent)", color: "#fff", cursor: sending ? "not-allowed" : "pointer", fontWeight: 600 }}>{sending ? "提交中..." : "提交派单"}</button>
      </div>
    </div>
  );
}
