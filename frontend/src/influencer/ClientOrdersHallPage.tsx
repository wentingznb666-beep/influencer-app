import { useState, useEffect } from "react";
import * as api from "../influencerApi";

type OpenOrder = {
  id: number;
  order_no: string | null;
  title: string | null;
  requirements: string;
  reward_points: number;
  tier: "A" | "B" | "C" | string;
  voice_link?: string | null;
  voice_note?: string | null;
  status: string;
  created_at: string;
};

type MyOrder = {
  id: number;
  order_no: string | null;
  title: string | null;
  requirements: string;
  reward_points: number;
  tier: "A" | "B" | "C" | string;
  voice_link?: string | null;
  voice_note?: string | null;
  status: string;
  work_link: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

/**
 * 按订单级别生成制作标准提示文案。
 */
function renderTierStandards(tier: string) {
  if (tier === "A") {
    return (
      <div style={{ marginTop: 8, fontSize: 13, color: "#334155" }}>
        <div style={{ fontWeight: 700 }}>制作标准</div>
        <div style={{ marginTop: 4 }}>
          <strong>包含配音要求</strong>
        </div>
      </div>
    );
  }
  if (tier === "B") {
    return (
      <div style={{ marginTop: 8, fontSize: 13, color: "#334155" }}>
        <div style={{ fontWeight: 700 }}>制作标准</div>
        <div style={{ marginTop: 4 }}>包含场景切换 + 特效转场</div>
      </div>
    );
  }
  return (
    <div style={{ marginTop: 8, fontSize: 13, color: "#334155" }}>
      <div style={{ fontWeight: 700 }}>制作标准</div>
      <div style={{ marginTop: 4 }}>基础功能：背景音乐、文字贴纸</div>
    </div>
  );
}

/**
 * A 类配音入口：显眼展示下载链接或备注内容。
 */
function renderVoiceEntry(o: { tier: string; voice_link?: string | null; voice_note?: string | null }) {
  if (o.tier !== "A") return null;
  const link = (o.voice_link || "").trim();
  const note = (o.voice_note || "").trim();
  return (
    <div
      style={{
        marginTop: 10,
        padding: 12,
        borderRadius: 10,
        border: "1px solid rgba(224,112,32,0.35)",
        background: "rgba(224,112,32,0.08)",
      }}
    >
      <div style={{ fontWeight: 800, color: "var(--xt-primary)" }}>配音入口</div>
      {link ? (
        <div style={{ marginTop: 6, fontSize: 14 }}>
          <a href={link} target="_blank" rel="noreferrer" style={{ color: "var(--xt-accent)", fontWeight: 700 }}>
            配音素材下载
          </a>
        </div>
      ) : (
        <div style={{ marginTop: 6, fontSize: 13, color: "#64748b" }}>（未提供配音素材下载链接）</div>
      )}
      {note ? (
        <div style={{ marginTop: 8, fontSize: 13, color: "#334155", whiteSpace: "pre-wrap" }}>{note}</div>
      ) : (
        <div style={{ marginTop: 8, fontSize: 13, color: "#64748b" }}>（未提供配音要求备注）</div>
      )}
    </div>
  );
}

/**
 * 达人端：客户端发单大厅与我的领单，展示订单号/标题，支持按订单号或标题或要求精准搜索。
 */
export default function ClientOrdersHallPage() {
  const [openList, setOpenList] = useState<OpenOrder[]>([]);
  const [myList, setMyList] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completeId, setCompleteId] = useState<number | null>(null);
  const [workLink, setWorkLink] = useState("");
  const [searchOpen, setSearchOpen] = useState("");
  const [searchMy, setSearchMy] = useState("");

  /**
   * 加载大厅与我的订单。
   */
  const load = async (qOpen?: string, qMy?: string) => {
    setLoading(true);
    setError(null);
    try {
      const oq = qOpen !== undefined ? qOpen : searchOpen;
      const mq = qMy !== undefined ? qMy : searchMy;
      const [openRes, myRes] = await Promise.all([
        api.getMarketOrders(oq.trim() ? { q: oq.trim() } : undefined),
        api.getMyMarketOrders(mq.trim() ? { q: mq.trim() } : undefined),
      ]);
      setOpenList(openRes.list || []);
      setMyList(myRes.list || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /**
   * 领取一条待处理订单。
   * @param orderId 订单 ID
   */
  const handleClaim = async (orderId: number) => {
    setError(null);
    try {
      await api.claimMarketOrder(orderId);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "领取失败");
    }
  };

  /**
   * 提交完成与交付链接以结算积分。
   */
  const handleComplete = async () => {
    if (completeId == null) return;
    const link = workLink.trim();
    if (!link) {
      setError("请填写交付链接。");
      return;
    }
    setError(null);
    try {
      await api.completeMarketOrder(completeId, link);
      setCompleteId(null);
      setWorkLink("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败");
    }
  };

  const statusText: Record<string, string> = {
    open: "待领取",
    claimed: "进行中",
    completed: "已完成",
    cancelled: "已取消",
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>客户端发单</h2>
      <p style={{ color: "#64748b", fontSize: 14, marginBottom: 16 }}>
        领取商家发布的任务，完成后提交交付链接即可获得固定 <strong>5</strong> 积分收益。订单号与标题可用于精准搜索。
      </p>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <button type="button" onClick={() => load()} style={{ marginBottom: 16, padding: "6px 12px", border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer" }}>
        刷新全部
      </button>

      <h3 style={{ fontSize: 16 }}>待领取</h3>
      <div style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          value={searchOpen}
          onChange={(e) => setSearchOpen(e.target.value)}
          placeholder="搜索订单号、标题或要求（精准）"
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #dbe1ea", minWidth: 240 }}
        />
        <button type="button" onClick={() => load(searchOpen, undefined)} style={{ padding: "6px 14px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
          搜索
        </button>
        <button
          type="button"
          onClick={() => {
            setSearchOpen("");
            load("", undefined);
          }}
          style={{ padding: "6px 14px", border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer" }}
        >
          清空
        </button>
      </div>
      {loading ? (
        <p>加载中…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
          {openList.map((o) => (
            <div key={o.id} style={{ padding: 16, background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>订单号：{o.order_no || `#${o.id}`}</div>
                  {o.title && <div style={{ marginTop: 6, fontSize: 14, color: "#334155" }}>标题：{o.title}</div>}
                </div>
                <span style={{ color: "#166534", fontWeight: 600 }}>+{o.reward_points} 积分</span>
              </div>
              <p style={{ margin: "10px 0", fontSize: 14, whiteSpace: "pre-wrap" }}>{o.requirements}</p>
              {renderTierStandards(String(o.tier || ""))}
              {renderVoiceEntry(o)}
              <button type="button" onClick={() => handleClaim(o.id)} style={{ padding: "8px 16px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
                领取
              </button>
            </div>
          ))}
          {openList.length === 0 && <p style={{ color: "#666" }}>暂无待领取订单</p>}
        </div>
      )}

      <h3 style={{ fontSize: 16 }}>我的领单</h3>
      <div style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          value={searchMy}
          onChange={(e) => setSearchMy(e.target.value)}
          placeholder="搜索订单号、标题或要求（精准）"
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #dbe1ea", minWidth: 240 }}
        />
        <button type="button" onClick={() => load(undefined, searchMy)} style={{ padding: "6px 14px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
          搜索
        </button>
        <button
          type="button"
          onClick={() => {
            setSearchMy("");
            load(undefined, "");
          }}
          style={{ padding: "6px 14px", border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer" }}
        >
          清空
        </button>
      </div>
      {!loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {myList.map((o) => (
            <div key={o.id} style={{ padding: 16, background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>订单号：{o.order_no || `#${o.id}`}</div>
                  {o.title && <div style={{ marginTop: 6, fontSize: 14, color: "#334155" }}>标题：{o.title}</div>}
                </div>
                <span style={{ color: "#666" }}>{statusText[o.status] ?? o.status}</span>
              </div>
              <p style={{ margin: "10px 0", fontSize: 14, whiteSpace: "pre-wrap" }}>{o.requirements}</p>
              {renderTierStandards(String(o.tier || ""))}
              {renderVoiceEntry(o)}
              {o.work_link && (
                <p style={{ fontSize: 14 }}>
                  交付：
                  <a href={o.work_link} target="_blank" rel="noreferrer">
                    {o.work_link}
                  </a>
                </p>
              )}
              {o.status === "claimed" && (
                <div style={{ marginTop: 12 }}>
                  {completeId === o.id ? (
                    <div>
                      <input
                        type="url"
                        value={workLink}
                        onChange={(e) => setWorkLink(e.target.value)}
                        placeholder="https://..."
                        style={{ width: "100%", maxWidth: 400, padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", marginRight: 8 }}
                      />
                      <button type="button" onClick={handleComplete} style={{ padding: "8px 16px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", marginTop: 8 }}>
                        确认提交
                      </button>
                      <button type="button" onClick={() => { setCompleteId(null); setWorkLink(""); }} style={{ marginLeft: 8, padding: "8px 16px", border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer", marginTop: 8 }}>
                        取消
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => { setCompleteId(o.id); setWorkLink(""); }} style={{ padding: "8px 16px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
                      完成并上传链接
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {myList.length === 0 && <p style={{ color: "#666" }}>暂无记录</p>}
        </div>
      )}
    </div>
  );
}
