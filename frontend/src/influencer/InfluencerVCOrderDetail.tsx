import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchWithAuth } from "../fetchWithAuth";

export default function InfluencerVCOrderDetail() {
  const nav = useNavigate(); const params = useParams();
  const id = params.id || "";
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [textContent, setTextContent] = useState("");

  const load = async () => {
    try {
      const r = await fetchWithAuth("/api/influencer/connection-orders");
      const data = await r.json();
      const o = (data.list||[]).find((x:any)=>String(x.id)===String(id));
      setOrder(o||null);
      if (o?.submission_content) {
        setSubmitted(true);
        setTextContent(o.submission_content);
      }
    } catch {} finally { setLoading(false); }
  };
  useEffect(()=>{load();},[]);

  const submissionTypes = (order?.submission_types || "").toLowerCase().split(",").map((s:string)=>s.trim()).filter(Boolean);
  if (submissionTypes.length === 0) submissionTypes.push("text");

  const buildContent = () => {
    const parts: string[] = [];
    if (submissionTypes.includes("link") && linkUrl.trim()) parts.push(`[链接] ${linkUrl.trim()}`);
    if (submissionTypes.includes("video") && videoUrl.trim()) parts.push(`[视频] ${videoUrl.trim()}`);
    if (submissionTypes.includes("image") && imageUrl.trim()) parts.push(`[图片] ${imageUrl.trim()}`);
    if (submissionTypes.includes("text") && textContent.trim()) parts.push(textContent.trim());
    return parts.join("\n") || textContent.trim();
  };

  const submitWork = async () => {
    if (!confirm("确定提交作品？")) return;
    const content = buildContent();
    await fetchWithAuth(`/api/influencer/connection-orders/${id}/submit`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({submission_content: content}) });
    setSubmitted(true); load();
  };

  const revise = async () => {
    const content = buildContent();
    await fetchWithAuth(`/api/influencer/connection-orders/${id}/revise`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({submission_content: content}) });
    setSubmitted(true); load();
  };

  if (loading) return <p>加载中...</p>;
  if (!order) return <p>订单不存在</p>;

  const canSubmit = order.influencer_response==="accepted" && (!order.submission_content || order.review_status==="rejected");

  return (
    <div>
      <button onClick={()=>nav("/influencer/vertical-connections/orders")} style={sb}>← 返回派单列表</button>
      <h2 style={{marginTop:0}}>订单详情: {order.order_no}</h2>

      <div style={card}>
        <p><strong>商家:</strong> {order.client_username||`#${order.client_id}`}</p>
        <p><strong>标题:</strong> {order.title}</p>
        <p><strong>任务要求:</strong> {order.task_requirements}</p>
        <p><strong>交付标准:</strong> {order.delivery_standards}</p>
        <p><strong>截止时间:</strong> {order.deadline}</p>
        <p><strong>金额:</strong> {order.amount} THB</p>
        <p><strong>状态:</strong> {order.review_status} | 付款: {order.payment_status}</p>
      </div>

      {/* Rejected note */}
      {order.review_note && (
        <div style={{background:"#fee2e2",borderRadius:8,padding:12,marginBottom:12,border:"1px solid #fecaca"}}>
          <strong style={{color:"#b91c1c"}}>商家驳回原因：</strong>
          <p style={{margin:"4px 0 0",color:"#b91c1c"}}>{order.review_note}</p>
        </div>
      )}

      {/* Submitted status */}
      {submitted && order.submission_content && order.review_status!=="rejected" && (
        <div style={{background:"#dcfce7",borderRadius:8,padding:12,marginBottom:12,textAlign:"center"}}>
          <p style={{color:"#166534",fontWeight:700,margin:0}}>✅ 已提交，等待商家审核</p>
          {order.submission_content && <p style={{fontSize:12,color:"#475569",marginTop:4}}>{order.submission_content}</p>}
        </div>
      )}

      {/* Submission form */}
      {canSubmit && (
        <div style={card}>
          <h3 style={{marginTop:0}}>{order.review_status==="rejected"?"修改重提":"提交作品"}</h3>
          <p style={{fontSize:13,color:"#64748b",marginBottom:12}}>
            提交方式: {submissionTypes.map((t:string)=>t==="link"?"链接":t==="video"?"视频":t==="image"?"图片":"文本").join(" / ")}
          </p>

          {submissionTypes.includes("link") && (
            <div style={{marginBottom:10}}>
              <label style={lab}>🔗 作品链接 URL</label>
              <input value={linkUrl} onChange={e=>setLinkUrl(e.target.value)} style={si} placeholder="https://..." />
            </div>
          )}
          {submissionTypes.includes("video") && (
            <div style={{marginBottom:10}}>
              <label style={lab}>🎬 视频 URL</label>
              <input value={videoUrl} onChange={e=>setVideoUrl(e.target.value)} style={si} placeholder="https://..." />
            </div>
          )}
          {submissionTypes.includes("image") && (
            <div style={{marginBottom:10}}>
              <label style={lab}>🖼️ 图片 URL</label>
              <input value={imageUrl} onChange={e=>setImageUrl(e.target.value)} style={si} placeholder="https://... 或粘贴图片链接" />
            </div>
          )}
          {(submissionTypes.includes("text") || submissionTypes.length===0) && (
            <div style={{marginBottom:10}}>
              <label style={lab}>📝 作品描述</label>
              <textarea value={textContent} onChange={e=>setTextContent(e.target.value)} style={si} rows={4} placeholder="输入作品描述或链接" />
            </div>
          )}

          <button onClick={order.review_status==="rejected"?revise:submitWork} disabled={submitted} style={{...btnPri,marginTop:8,opacity:submitted?0.5:1,cursor:submitted?"not-allowed":"pointer"}}>
            {submitted ? "已提交" : order.review_status==="rejected" ? "修改重提" : "提交作品"}
          </button>
        </div>
      )}
    </div>
  );
}
const sb: React.CSSProperties = { padding:"6px 12px",border:"1px solid #dbe1ea",borderRadius:8,background:"#fff",cursor:"pointer",marginBottom:8 };
const card: React.CSSProperties = { background:"#fff",borderRadius:12,padding:16,boxShadow:"0 1px 3px rgba(0,0,0,0.08)",marginBottom:12 };
const si: React.CSSProperties = { width:"100%",padding:"8px 10px",border:"1px solid #dbe1ea",borderRadius:8,boxSizing:"border-box",marginTop:4 };
const lab: React.CSSProperties = { fontSize:13,fontWeight:600,color:"#475569" };
const btnPri: React.CSSProperties = { padding:"8px 20px",border:"none",borderRadius:8,background:"var(--xt-accent)",color:"#fff",cursor:"pointer",fontWeight:700 };
