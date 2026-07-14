import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { fetchWithAuth } from "../fetchWithAuth";

const CATEGORIES = [
  { th: "ความงาม", zh: "美妆类" },{ th: "รีวิวทั่วไป", zh: "测评类" },{ th: "ไลฟ์สไตล์", zh: "生活类" },
  { th: "แฟชั่น", zh: "时尚类" },{ th: "อาหาร", zh: "美食类" },{ th: "อิเล็กเทอร์นิกส์", zh: "3C 类" },
  { th: "ของใช้ทั่วไป", zh: "日用品类" },{ th: "แม่และเด็ก", zh: "母婴" },{ th: "อาหารเสริม", zh: "健康保健品" },
  { th: "สายสุขภาพ", zh: "健康" },{ th: "เฟอร์นิเจอร์", zh: "家具类" },{ th: "ของใช้ในบ้าน", zh: "家居用品" },{ th: "กีฬาและกิจกรรมกลางแจ้ง", zh: "运动户外类" },
  { th: "มอเตอร์และยานยนต์", zh: "汽摩" },{ th: "กางเกงยีนส์", zh: "牛仔裤" },{ th: "กระเป๋า", zh: "包包" },
  { th: "เสื้อผ้า", zh: "衣服" },{ th: "ชุดนอน", zh: "睡衣" },{ th: "กางเกงใน", zh: "内衣" },
  { th: "เครื่องใช้ไฟฟ้า", zh: "家电" },{ th: "พัดลมพกพา", zh: "便携风扇" },{ th: "Power Bank", zh: "电宝" },
  { th: "แคมป์ปิ้ง", zh: "露营" },{ th: "กระเป๋าสตาง", zh: "钱包" },{ th: "รองเท้า", zh: "鞋子" },
  { th: "สินค้าสาวอวบ", zh: "微胖女生" },{ th: "กางเกงผู้ชาย", zh: "男士裤子" },{ th: "อุปกรณ์เสริมมือถือ", zh: "手机配件" },
  { th: "หูฟัง", zh: "耳机" },{ th: "ลำโพง", zh: "音箱" },{ th: "วัสดุตกแต่ง/ปรับปรุงบ้าน", zh: "家装建材" },
  { th: "การเกษตร", zh: "农业品类" },{ th: "ชุดว่ายน้ำ", zh: "泳衣" },
];

type Influencer = {
  id: number; influencer_code: string; source: string; followers: string | null;
  category: string; grade: string; gmv_sales: string | null;
  monthly_cart_videos: string | null; units_sold: string | null; can_live: boolean;
  live_sales: string | null; weekly_live_count: string | null;
  avg_live_hours_per_week: string | null; remark: string | null;
};

type Connection = {
  id: number; influencer_id: number; influencer_profile_id: number;
  category: string; grade: string | null; brief: string | null; budget: string | null;
  start_date: string; end_date: string; status: string; renewal_count: number;
  influencer_code?: string; influencer_username?: string; profile_grade?: string; gmv_sales?: string;
};

export default function ClientConnectionsPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const loc = useLocation();
  const queryTab = new URLSearchParams(loc.search).get("tab") || "";

  // Category selection -> Influencer list
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [loadingInfluencers, setLoadingInfluencers] = useState(false);

  // Invite form
  const [inviteTarget, setInviteTarget] = useState<Influencer | null>(null);
  const [inviteForm, setInviteForm] = useState({ brief: "", budget: "" });
  const [inviting, setInviting] = useState(false);

  // Connections list
  const [tab, setTab] = useState(queryTab || "active");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const selectCategory = async (cat: string) => {
    setSelectedCategory(cat);
    setInviteTarget(null);
    setLoadingInfluencers(true);
    try {
      const res = await fetchWithAuth(`/api/client/influencers?category=${encodeURIComponent(cat)}`);
      const data = await res.json();
      setInfluencers(data.list || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoadingInfluencers(false); }
  };

  const loadConnections = async (t: string) => {
    setLoadingConnections(true);
    try {
      const res = await fetchWithAuth(`/api/client/connections?tab=${t}`);
      const data = await res.json();
      setConnections(data.list || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoadingConnections(false); }
  };

  useEffect(() => { loadConnections(tab); }, [tab]);

  const sendInvite = async () => {
    if (!inviteTarget) return;
    setInviting(true);
    try {
      await fetchWithAuth("/api/client/connections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ influencer_id: inviteTarget.id, influencer_profile_id: inviteTarget.id, category: inviteTarget.category, grade: inviteTarget.grade, brief: inviteForm.brief, budget: inviteForm.budget }) });
      setMsg("邀请已发送");
      setInviteTarget(null);
      setInviteForm({ brief: "", budget: "" });
    } catch (e: any) { setError(e.message); }
    finally { setInviting(false); }
  };

  const renew = async (id: number) => {
    try {
      await fetchWithAuth(`/api/client/connections/${id}/renew`, { method: "POST" });
      loadConnections(tab);
      setMsg("已续约30天");
    } catch (e: any) { setError(e.message); }
  };

  const daysLeft = (end: string) => Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / 86400000));

  return (
    <div>
      <h2>垂直达人建联</h2>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      {msg && <p style={{ color: "#166534" }}>{msg}</p>}

      {/* Tabs: category selection | my connections */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => { setSelectedCategory(""); setInviteTarget(null); }} style={{ ...tabStyle, fontWeight: !selectedCategory ? 700 : 400 }}>选择类目</button>
        <button onClick={() => { setSelectedCategory(""); setInviteTarget(null); loadConnections(tab); }} style={{ ...tabStyle, fontWeight: selectedCategory ? 400 : 700 }}>我的建联列表</button>
      </div>

      {!selectedCategory && !inviteTarget ? (
        /* ===== 我的建联列表 ===== */
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {["active","expired"].map(tb => (
              <button key={tb} onClick={() => setTab(tb)} style={{ ...tabStyle, background: tab === tb ? "var(--xt-accent)" : "#fff", color: tab === tb ? "#fff" : "#334155" }}>
                {tb === "active" ? "建联中" : "已到期"}
              </button>
            ))}
          </div>
          {connections.length === 0 ? <p style={{ color: "#64748b" }}>暂无建联记录</p> : connections.map(c => (
            <div key={c.id} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <strong>{c.influencer_code || c.influencer_username || `达人#${c.influencer_id}`}</strong>
                <span style={tagStyle(c.status)}>{c.status === "active" ? "建联中" : c.status === "expired" ? "已到期" : c.status}</span>
              </div>
              <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>类目: {c.category} | 等级: {c.grade || "-"} | 剩余 {daysLeft(c.end_date)} 天</div>
              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                {c.status === "active" && <button onClick={() => nav(`/client/connection-orders?connection=${c.id}&influencer=${c.influencer_id}`)} style={btnPrimary}>定向派单</button>}
                {c.status === "active" && <button onClick={() => renew(c.id)} style={btnDefault}>续约</button>}
                {c.status === "expired" && <span style={{ color: "#b91c1c", fontSize: 12 }}>请先续约再派单</span>}
              </div>
            </div>
          ))}
        </div>
      ) : !selectedCategory ? (
        /* ===== 类目选择 ===== */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
          {CATEGORIES.map(c => (
            <div key={c.th} onClick={() => selectCategory(c.th)} style={{ ...cardStyle, cursor: "pointer", transition: "0.2s", border: "1px solid var(--xt-border)" }}>
              <div style={{ fontWeight: 700, color: "var(--xt-primary)" }}>{c.zh}</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>{c.th}</div>
            </div>
          ))}
        </div>
      ) : !inviteTarget ? (
        /* ===== 达人类目列表 ===== */
        <div>
          <button onClick={() => setSelectedCategory("")} style={btnDefault}>← 返回类目列表</button>
          <h3 style={{ marginTop: 12 }}>{selectedCategory} 达人列表</h3>
          {loadingInfluencers ? <p>加载中...</p> : influencers.length === 0 ? <p>该类目下暂无有等级的达人</p> : influencers.map(inf => (
            <div key={inf.id} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap" }}>
                <strong>{inf.influencer_code}</strong>
                <span style={tagStyle(inf.grade)}>{inf.grade}</span>
              </div>
              <div style={{ fontSize: 12, color: "#475569", marginTop: 4, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                <span>粉丝: {inf.followers || "-"}</span><span>GMV: {inf.gmv_sales || "-"}</span>
                <span>挂车视频/月: {inf.monthly_cart_videos || "-"}</span><span>销量: {inf.units_sold || "-"}</span>
                <span>可直播: {inf.can_live ? "是" : "否"}</span><span>直播销售: {inf.live_sales || "-"}</span>
                <span>周直播次数: {inf.weekly_live_count || "-"}</span><span>直播时长: {inf.avg_live_hours_per_week || "-"}</span>
              </div>
              {inf.remark && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>备注: {inf.remark}</div>}
              <button onClick={() => { setInviteTarget(inf); setInviteForm({ brief: "", budget: "" }); }} style={{ ...btnPrimary, marginTop: 8 }}>发起邀请</button>
            </div>
          ))}
        </div>
      ) : (
        /* ===== 发起邀请表单 ===== */
        <div style={cardStyle}>
          <h3>发起建联邀请</h3>
          <div style={{ fontSize: 13, color: "#475569" }}>
            <p>达人编号: {inviteTarget.influencer_code}</p>
            <p>类目: {inviteTarget.category} | 等级: {inviteTarget.grade}</p>
          </div>
          <div style={{ marginTop: 12 }}>
            <label>合作内容简述</label>
            <textarea value={inviteForm.brief} onChange={e => setInviteForm(f => ({ ...f, brief: e.target.value }))} style={inputStyle} rows={3} placeholder="描述合作内容" />
          </div>
          <div style={{ marginTop: 8 }}>
            <label>预算范围</label>
            <input value={inviteForm.budget} onChange={e => setInviteForm(f => ({ ...f, budget: e.target.value }))} style={inputStyle} placeholder="如：5000-10000 THB" />
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button onClick={sendInvite} disabled={inviting || !inviteForm.brief} style={btnPrimary}>{inviting ? "发送中..." : "发送邀请"}</button>
            <button onClick={() => setInviteTarget(null)} style={btnDefault}>取消</button>
          </div>
        </div>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: "#fff", borderRadius: 10, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 8 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8, boxSizing: "border-box", marginTop: 4 };
const btnPrimary: React.CSSProperties = { padding: "6px 14px", border: "none", borderRadius: 8, background: "var(--xt-accent)", color: "#fff", cursor: "pointer", fontSize: 13 };
const btnDefault: React.CSSProperties = { padding: "6px 14px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 13 };
const tabStyle: React.CSSProperties = { padding: "6px 14px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 13 };
const tagStyle = (v?: string | null): React.CSSProperties => {
  const colors: Record<string, string> = { "A+": "#047857", "A": "#047857", "B+": "#1d4ed8", "B": "#1d4ed8", "C+": "#92400e", "C": "#92400e", active: "#166534", expired: "#b91c1c", pending: "#92400e", rejected: "#b91c1c" };
  return { display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: (colors[v || ""] || "#f1f5f9") + "22", color: colors[v || ""] || "#475569", border: `1px solid ${(colors[v || ""] || "#e2e8f0")}44` };
};
