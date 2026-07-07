import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { fetchWithAuth } from "../fetchWithAuth";

export default function ClientVCInviteForm() {
  const nav = useNavigate(); const params = useParams();
  const [sp] = useSearchParams();
  const influencerId = params.id || "";
  const category = sp.get("category") || "";
  const code = sp.get("code") || "";
  const grade = sp.get("grade") || "";
  const [form, setForm] = useState({ brief: "", budget: "" });
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!form.brief) { setErr("请填写合作内容简述"); return; }
    setSending(true);
    try {
      await fetchWithAuth("/api/client/connections", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ influencer_id: Number(influencerId), influencer_profile_id: Number(influencerId), category, grade, brief: form.brief, budget: form.budget }) });
      setMsg("建联邀请已发送！30天内有效");
      setTimeout(()=>nav("/client/vertical-connections/my"), 1500);
    } catch(e:any) { setErr(e.message); }
    finally { setSending(false); }
  };

  return (
    <div>
      <button onClick={()=>nav(-1)} style={{ padding: "6px 12px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer", marginBottom: 12 }}>← 返回</button>
      <h2 style={{ marginTop: 0 }}>发起建联邀请</h2>
      {msg && <p style={{ color: "#166534", fontWeight: 700 }}>{msg}</p>}
      {err && <p style={{ color: "#c00" }}>{err}</p>}
      <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", maxWidth: 500 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13, color: "#64748b" }}>达人编号</label>
          <p style={{ fontWeight: 700 }}>{code}</p>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13, color: "#64748b" }}>类目</label>
          <p>{category} | 等级: {grade}</p>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13, color: "#64748b" }}>合作内容简述 *</label>
          <textarea value={form.brief} onChange={e=>setForm(f=>({...f,brief:e.target.value}))} style={{ width: "100%", padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8, boxSizing: "border-box", marginTop: 4 }} rows={4} placeholder="描述合作内容和期望" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13, color: "#64748b" }}>预算范围</label>
          <input value={form.budget} onChange={e=>setForm(f=>({...f,budget:e.target.value}))} style={{ width: "100%", padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8, boxSizing: "border-box", marginTop: 4 }} placeholder="如：5000-10000 THB" />
        </div>
        <button onClick={submit} disabled={sending} style={{ padding: "8px 20px", border: "none", borderRadius: 8, background: sending ? "#94a3b8" : "var(--xt-accent)", color: "#fff", cursor: sending ? "not-allowed" : "pointer", fontWeight: 600 }}>{sending ? "发送中..." : "发送邀请"}</button>
      </div>
    </div>
  );
}
