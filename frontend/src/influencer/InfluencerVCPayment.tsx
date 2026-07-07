import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../fetchWithAuth";

export default function InfluencerVCPayment() {
  const nav = useNavigate();
  const [paymentInfo, setPaymentInfo] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try { const r = await fetchWithAuth("/api/influencer/payment-info"); setPaymentInfo((await r.json()).payment_info||""); } catch {}
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await fetchWithAuth("/api/influencer/payment-info", { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify({payment_info: paymentInfo}) });
      setMsg("收款方式已保存");
    } catch {} finally { setSaving(false); }
  };

  const si: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8, boxSizing: "border-box", marginTop: 8 };

  return (
    <div>
      <button onClick={()=>nav("/influencer/vertical-connections")} style={{padding:"6px 12px",border:"1px solid #dbe1ea",borderRadius:8,background:"#fff",cursor:"pointer",marginBottom:8}}>← 返回</button>
      <h2 style={{marginTop:0}}>收款方式设置</h2>
      {msg && <p style={{color:"#166534"}}>{msg}</p>}
      <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 3px rgba(0,0,0,0.08)",maxWidth:500}}>
        <label style={{fontSize:13,color:"#64748b"}}>收款方式（泰国银行账户 / PromptPay）</label>
        <textarea value={paymentInfo} onChange={e=>setPaymentInfo(e.target.value)} style={si} rows={4} placeholder="银行名称、账号、账户名 或 PromptPay 号码" />
        <p style={{fontSize:12,color:"#94a3b8",marginTop:4}}>此信息仅在商家验收通过你的作品后对其展示</p>
        <button onClick={save} disabled={saving} style={{marginTop:12,padding:"8px 20px",border:"none",borderRadius:8,background:saving?"#94a3b8":"var(--xt-accent)",color:"#fff",cursor:saving?"not-allowed":"pointer",fontWeight:600}}>{saving?"保存中...":"保存"}</button>
      </div>
    </div>
  );
}
