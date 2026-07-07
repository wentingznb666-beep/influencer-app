import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchWithAuth } from "../fetchWithAuth";

export default function InfluencerVCOrderDetail() {
  const nav = useNavigate(); const params = useParams();
  const id = params.id || "";
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState("");

  const load = async () => {
    try { const r = await fetchWithAuth("/api/influencer/connection-orders"); const data = await r.json(); setOrder((data.list||[]).find((o:any)=>o.id===Number(id))); }
    catch {} finally { setLoading(false); }
  };
  useEffect(()=>{load();},[]);

  const submitWork = async () => {
    await fetchWithAuth(`/api/influencer/connection-orders/${id}/submit`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({submission_content:submission}) });
    setSubmission(""); load();
  };
  const revise = async () => {
    await fetchWithAuth(`/api/influencer/connection-orders/${id}/revise`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({submission_content:submission}) });
    setSubmission(""); load();
  };

  const card: React.CSSProperties = { background: "#fff", borderRadius: 10, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" };
  const si: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8, boxSizing: "border-box", marginTop: 8 };
  const sp: React.CSSProperties = { padding: "6px 14px", border: "none", borderRadius: 8, background: "var(--xt-accent)", color: "#fff", cursor: "pointer", fontSize: 13, marginTop: 8 };

  if (loading) return <p>加载中...</p>;
  if (!order) return <p>订单不存在</p>;

  return (
    <div>
      <button onClick={()=>nav(-1)} style={{padding:"6px 12px",border:"1px solid #dbe1ea",borderRadius:8,background:"#fff",cursor:"pointer",marginBottom:8}}>← 返回</button>
      <h2>订单详情: {order.order_no}</h2>
      <div style={card}>
        <p><strong>标题:</strong> {order.title}</p>
        <p><strong>任务要求:</strong> {order.task_requirements}</p>
        <p><strong>交付标准:</strong> {order.delivery_standards}</p>
        <p><strong>截止时间:</strong> {order.deadline}</p>
        <p><strong>提交方式:</strong> {order.submission_types}</p>
        <p><strong>金额:</strong> {order.amount} THB</p>
        <p><strong>回应:</strong> {order.influencer_response} | <strong>审核:</strong> {order.review_status} | <strong>付款:</strong> {order.payment_status}</p>
        {order.review_note && <p style={{color:"#b91c1c"}}><strong>驳回原因:</strong> {order.review_note}</p>}

        {order.influencer_response==="accepted" && order.review_status==="rejected" && (
          <div style={{marginTop:12}}>
            <p style={{color:"#b91c1c",fontWeight:700}}>需要修改重提</p>
            <textarea value={submission} onChange={e=>setSubmission(e.target.value)} placeholder="修改后的作品内容" style={si} rows={3} />
            <button onClick={revise} style={sp}>修改重提</button>
          </div>
        )}
        {order.influencer_response==="accepted" && !order.submission_content && (
          <div style={{marginTop:12}}>
            <textarea value={submission} onChange={e=>setSubmission(e.target.value)} placeholder="输入作品链接/视频URL/描述" style={si} rows={3} />
            <button onClick={submitWork} style={sp}>提交作品</button>
          </div>
        )}
        {order.submission_content && <p style={{marginTop:12,padding:8,background:"#f0fdf4",borderRadius:8,fontSize:13}}>作品: {order.submission_content}</p>}
        {order.review_status==="approved" && order.payment_status==="paid" && <p style={{color:"#166534",fontWeight:700}}>✅ 已完成付款</p>}
      </div>
    </div>
  );
}
