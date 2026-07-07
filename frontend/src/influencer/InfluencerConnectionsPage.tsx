import { useEffect, useState } from "react";
import { useTranslation } from 'react-i18next';
import { fetchWithAuth } from "../fetchWithAuth";

type Connection = { id: number; client_id: number; category: string; grade: string | null; brief: string | null; budget: string | null; start_date: string; end_date: string; status: string; client_username?: string; };
type Order = { id: number; connection_id: number; client_id: number; order_no: string; title: string; task_requirements: string; delivery_standards: string; deadline: string; submission_types: string; amount: string; influencer_response: string; influencer_reject_reason: string | null; submission_content: string | null; status: string; review_status: string; review_note: string | null; review_count: number; payment_status: string; client_username?: string; };
type Profile = any;

export default function InfluencerConnectionsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("pending");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  // Profile
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editProfile, setEditProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<any>({});

  // Order respond
  const [rejectTarget, setRejectTarget] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [submissionContent, setSubmissionContent] = useState("");

  const loadConnections = async (t: string) => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/influencer/connections?tab=${t}`);
      const data = await res.json();
      setConnections(data.list || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const loadOrders = async () => {
    try {
      const res = await fetchWithAuth("/api/influencer/connection-orders");
      const data = await res.json();
      setOrders(data.list || []);
    } catch {}
  };

  const loadProfile = async () => {
    try {
      const res = await fetchWithAuth("/api/influencer/profile");
      const data = await res.json();
      setProfile(data);
      if (data) setProfileForm(data);
    } catch {}
  };

  useEffect(() => { loadConnections(tab); loadOrders(); loadProfile(); }, [tab]);

  const respond = async (orderId: number, action: "accept" | "reject") => {
    try {
      await fetchWithAuth(`/api/influencer/connection-orders/${orderId}/respond`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reject_reason: action === "reject" ? rejectReason : undefined })
      });
      setRejectTarget(null); setRejectReason("");
      loadOrders(); setMsg(action === "accept" ? "已接受" : "已拒绝");
    } catch (e: any) { setError(e.message); }
  };

  const submitWork = async (orderId: number) => {
    try {
      await fetchWithAuth(`/api/influencer/connection-orders/${orderId}/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_content: submissionContent })
      });
      setSubmissionContent(""); loadOrders(); setMsg("已提交");
    } catch (e: any) { setError(e.message); }
  };

  const revise = async (orderId: number) => {
    try {
      await fetchWithAuth(`/api/influencer/connection-orders/${orderId}/revise`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_content: submissionContent })
      });
      setSubmissionContent(""); loadOrders(); setMsg("已修改重提");
    } catch (e: any) { setError(e.message); }
  };

  const respondConnection = async (id: number, action: "accept" | "reject") => {
    try {
      await fetchWithAuth(`/api/influencer/connections/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      loadConnections(tab); loadOrders();
      setMsg(action === "accept" ? "已接受建联" : "已拒绝建联");
    } catch (e: any) { setError(e.message); }
  };

  const saveProfile = async () => {
    try {
      await fetchWithAuth("/api/influencer/profile", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm)
      });
      setEditProfile(false); loadProfile(); setMsg("资料已保存，等级已重新计算");
    } catch (e: any) { setError(e.message); }
  };

  const pendingCount = connections.filter(c => c.status === "pending").length;

  return (
    <div>
      <h2>建联邀请 {pendingCount > 0 && `(${pendingCount})`}</h2>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      {msg && <p style={{ color: "#166534" }}>{msg}</p>}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["pending","active","rejected","expired"].map(tb => (
          <button key={tb} onClick={() => setTab(tb)} style={{ padding: "6px 14px", border: "1px solid #dbe1ea", borderRadius: 8, background: tab === tb ? "var(--xt-accent)" : "#fff", color: tab === tb ? "#fff" : "#334155", cursor: "pointer", fontSize: 13, fontWeight: tb === "pending" && pendingCount > 0 ? 800 : 400 }}>
            {tb === "pending" ? `待处理${pendingCount > 0 ? ` (${pendingCount})` : ""}` : tb === "active" ? "建联中" : tb === "rejected" ? "已拒绝" : "已到期"}
          </button>
        ))}
        <button onClick={() => setEditProfile(!editProfile)} style={{ padding: "6px 14px", border: "1px solid var(--xt-accent)", borderRadius: 8, background: "#fff", color: "var(--xt-accent)", cursor: "pointer", fontSize: 13, marginLeft: "auto" }}>
          {editProfile ? "取消编辑" : "编辑我的资料"}
        </button>
      </div>

      {/* Profile editor */}
      {editProfile && (
        <div style={cardStyle}>
          <h3>编辑达人资料</h3>
          <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 8 }}>
            {["influencer_code","source","followers","gmv_sales","monthly_cart_videos","units_sold","live_sales","weekly_live_count","avg_live_hours_per_week","remark","contact_info"].map(f => (
              <div key={f}>
                <label style={{ fontSize: 12, color: "#64748b" }}>{f}</label>
                <input value={String(profileForm[f] || "")} onChange={e => setProfileForm((p: any) => ({ ...p, [f]: e.target.value }))} style={inputS} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 12, color: "#64748b" }}>可直播</label>
              <input type="checkbox" checked={!!profileForm.can_live} onChange={e => setProfileForm((p: any) => ({ ...p, can_live: e.target.checked }))} />
            </div>
            {profile?.category && <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "#92400e" }}>类目 ({profile.category}) 选择后不可更改 | 等级 ({profile.grade || "未达标"}) 由系统自动计算</div>}
          </div>
          <button onClick={saveProfile} style={{ ...btnPrimary, marginTop: 12 }}>保存资料</button>
        </div>
      )}

      {/* Connections */}
      {loading ? <p>加载中...</p> : connections.length === 0 ? <p style={{ color: "#64748b" }}>暂无记录</p> : connections.map(c => (
        <div key={c.id} style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div>
              <strong>{c.client_username || `商家#${c.client_id}`}</strong>
              <span style={{ marginLeft: 8, fontSize: 13, color: "#64748b" }}>{c.category} | {c.grade || "-"}</span>
            </div>
            <span style={tagStyle(c.status)}>{c.status}</span>
          </div>
          {c.brief && <p style={{ fontSize: 13, margin: "4px 0" }}>合作简述: {c.brief}</p>}
          {c.budget && <p style={{ fontSize: 13, margin: 0, color: "#64748b" }}>预算: {c.budget}</p>}
          {c.status === "pending" && (
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <button onClick={() => respondConnection(c.id, "accept")} style={btnPrimary}>接受</button>
              <button onClick={() => respondConnection(c.id, "reject")} style={btnDanger}>拒绝</button>
            </div>
          )}
        </div>
      ))}

      {/* Orders section */}
      {orders.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3>定向派单</h3>
          {orders.map(o => (
            <div key={o.id} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{o.order_no} - {o.title}</strong>
                <span style={tagStyle(o.status)}>{o.status}</span>
              </div>
              <p style={{ fontSize: 13, margin: "4px 0", color: "#475569" }}>{o.amount} THB | 商家: {o.client_username || `#${o.client_id}`}</p>
              {o.review_note && <p style={{ fontSize: 12, color: "#b91c1c" }}>驳回原因: {o.review_note}</p>}

              {o.influencer_response === "pending" && (
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <button onClick={() => respond(o.id, "accept")} style={btnPrimary}>接受</button>
                  <button onClick={() => setRejectTarget(o.id)} style={btnDanger}>拒绝</button>
                  {rejectTarget === o.id && (
                    <div style={{ display: "flex", gap: 4 }}>
                      <input placeholder="拒绝原因（必填）" value={rejectReason} onChange={e => setRejectReason(e.target.value)} style={inputS} />
                      <button onClick={() => respond(o.id, "reject")} disabled={!rejectReason} style={btnDanger}>确认拒绝</button>
                    </div>
                  )}
                </div>
              )}
              {o.influencer_response === "accepted" && (
                <div style={{ marginTop: 8 }}>
                  {o.review_status === "rejected" ? (
                    <div>
                      <textarea value={submissionContent} onChange={e => setSubmissionContent(e.target.value)} placeholder="修改后的作品内容" style={inputS} rows={2} />
                      <button onClick={() => revise(o.id)} style={{ ...btnPrimary, marginTop: 4 }}>修改重提</button>
                    </div>
                  ) : o.submission_content ? (
                    <p style={{ fontSize: 12, color: "#166534" }}>已提交作品 | 审核: {o.review_status} | 付款: {o.payment_status}</p>
                  ) : (
                    <div>
                      <p style={{ fontSize: 12, margin: 0 }}>提交方式: {o.submission_types}</p>
                      <textarea value={submissionContent} onChange={e => setSubmissionContent(e.target.value)} placeholder="输入作品链接/视频URL/描述" style={inputS} rows={3} />
                      <button onClick={() => submitWork(o.id)} style={{ ...btnPrimary, marginTop: 4 }}>提交作品</button>
                    </div>
                  )}
                </div>
              )}
              {o.review_status === "approved" && o.payment_status === "paid" && (
                <p style={{ fontSize: 12, color: "#166534" }}>✅ 已完成付款</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: "#fff", borderRadius: 10, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 8 };
const inputS: React.CSSProperties = { padding: "6px 8px", border: "1px solid #dbe1ea", borderRadius: 8, width: "100%", boxSizing: "border-box" };
const btnPrimary: React.CSSProperties = { padding: "6px 14px", border: "none", borderRadius: 8, background: "var(--xt-accent)", color: "#fff", cursor: "pointer", fontSize: 13 };
const btnDanger: React.CSSProperties = { padding: "6px 14px", border: "1px solid #fecaca", borderRadius: 8, background: "#fff", color: "#b91c1c", cursor: "pointer", fontSize: 13 };
const tagStyle = (s: string): React.CSSProperties => {
  const c: Record<string, string> = { pending: "#92400e", active: "#166534", rejected: "#b91c1c", expired: "#64748b", submitted: "#1d4ed8", completed: "#166534" };
  return { display: "inline-block", padding: "1px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: (c[s] || "#f1f5f9") + "22", color: c[s] || "#475569" };
};
