import { useState, useEffect } from "react";
import * as api from "../clientApi";

type MarketOrder = {
  id: number;
  order_no: string | null;
  title: string | null;
  requirements: string;
  reward_points: number;
  status: string;
  influencer_id: number | null;
  work_link: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

/**
 * 客户端「达人领单」页面：发布要求、查看订单号与标题、搜索、查看状态与交付链接。
 */
export default function ClientMarketOrdersPage() {
  const [list, setList] = useState<MarketOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [requirements, setRequirements] = useState("");
  const [title, setTitle] = useState("");
  const [tier, setTier] = useState<"C" | "B" | "A">("C");
  const [voiceLink, setVoiceLink] = useState("");
  const [voiceNote, setVoiceNote] = useState("");
  const [searchQ, setSearchQ] = useState("");

  /**
   * 拉取当前用户的发单列表。
   */
  const load = async (q?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMarketOrders(q?.trim() ? { q: q.trim() } : undefined);
      setList(data.list || []);
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
   * 拉取当前积分余额，用于下单前校验与展示。
   */
  const loadBalance = async () => {
    try {
      const data = await api.getPoints();
      setBalance(typeof data?.balance === "number" ? data.balance : 0);
    } catch {
      setBalance(null);
    }
  };

  useEffect(() => {
    loadBalance();
  }, []);

  const consumePoints = tier === "A" ? 60 : tier === "B" ? 40 : 20;
  const canAfford = balance == null ? true : balance >= consumePoints;

  /**
   * 提交新订单（需账户至少有约定奖励积分）。
   */
  const handleCreate = async () => {
    setError(null);
    const text = requirements.trim();
    if (!text) {
      setError("请填写任务要求。");
      return;
    }
    if (balance != null && balance < consumePoints) {
      setError(`积分余额不足：本次将消耗 ${consumePoints} 积分，当前余额 ${balance}。`);
      return;
    }
    try {
      await api.createMarketOrder({
        requirements: text,
        title: title.trim() || undefined,
        tier,
        voice_link: tier === "A" ? (voiceLink.trim() || undefined) : undefined,
        voice_note: tier === "A" ? (voiceNote.trim() || undefined) : undefined,
      });
      setShowForm(false);
      setRequirements("");
      setTitle("");
      setTier("C");
      setVoiceLink("");
      setVoiceNote("");
      loadBalance();
      load(searchQ);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    }
  };

  const statusText: Record<string, string> = {
    open: "待领取",
    claimed: "已领取/进行中",
    completed: "已完成",
    cancelled: "已取消",
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>达人领单</h2>
      <p style={{ color: "#64748b", fontSize: 14, marginBottom: 16 }}>
        填写任务要求后发布订单，系统将生成唯一订单号；达人领取并在完成后上传交付链接。发单时将从您的积分余额中扣除{" "}
        <strong>20/40/60</strong> 积分（按订单档位 C/B/A）。
      </p>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="搜索：订单号、标题或要求全文（精准）"
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #dbe1ea", minWidth: 260 }}
        />
        <button type="button" onClick={() => load(searchQ)} style={{ padding: "8px 16px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
          搜索
        </button>
        <button
          type="button"
          onClick={() => {
            setSearchQ("");
            load();
          }}
          style={{ padding: "8px 16px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer" }}
        >
          清空
        </button>
      </div>
      <div style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          style={{ padding: "8px 16px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
        >
          {showForm ? "取消" : "发布新订单"}
        </button>
      </div>
      {showForm && (
        <div style={{ marginBottom: 24, padding: 16, background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <label htmlFor="title">订单标题（可选，便于搜索；不填则使用要求摘要）</label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="简短标题，如：春季露脸种草视频"
            maxLength={200}
            style={{ display: "block", marginTop: 8, marginBottom: 12, width: "100%", maxWidth: 560, padding: "8px 10px", boxSizing: "border-box", borderRadius: 8, border: "1px solid #ddd" }}
          />
          <label htmlFor="req">任务要求</label>
          <textarea
            id="req"
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            placeholder="说明需要达人完成的内容、风格、截止时间等"
            rows={5}
            style={{ display: "block", marginTop: 8, marginBottom: 12, width: "100%", maxWidth: 560, padding: "8px 10px", boxSizing: "border-box", borderRadius: 8, border: "1px solid #ddd" }}
          />
          <label htmlFor="tier">订单档位（决定扣除积分）</label>
          <select
            id="tier"
            value={tier}
            onChange={(e) => setTier(e.target.value as "C" | "B" | "A")}
            style={{ display: "block", marginTop: 8, marginBottom: 12, width: "100%", maxWidth: 240, padding: "8px 10px", boxSizing: "border-box", borderRadius: 8, border: "1px solid #ddd", background: "#fff" }}
          >
            <option value="C">C 类：消耗 20 积分（基础功能：背景音乐、文字贴纸）</option>
            <option value="B">B 类：消耗 40 积分（含 C 类功能 + 场景切换 + 特效转场）</option>
            <option value="A">A 类：消耗 60 积分（含 B 类功能 + 配音服务）</option>
          </select>
          {tier === "A" && (
            <>
              <label htmlFor="voiceLink">配音素材下载链接（可选）</label>
              <input
                id="voiceLink"
                type="url"
                value={voiceLink}
                onChange={(e) => setVoiceLink(e.target.value)}
                placeholder="https://..."
                style={{ display: "block", marginTop: 8, marginBottom: 12, width: "100%", maxWidth: 560, padding: "8px 10px", boxSizing: "border-box", borderRadius: 8, border: "1px solid #ddd" }}
              />
              <label htmlFor="voiceNote">配音要求备注（可选）</label>
              <textarea
                id="voiceNote"
                value={voiceNote}
                onChange={(e) => setVoiceNote(e.target.value)}
                placeholder="如：语速/情绪/关键词/禁用词等"
                rows={3}
                style={{ display: "block", marginTop: 8, marginBottom: 12, width: "100%", maxWidth: 560, padding: "8px 10px", boxSizing: "border-box", borderRadius: 8, border: "1px solid #ddd" }}
              />
            </>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!canAfford}
              style={{
                padding: "8px 16px",
                background: "var(--xt-accent)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor: !canAfford ? "not-allowed" : "pointer",
                opacity: !canAfford ? 0.6 : 1,
              }}
            >
              发布
            </button>
            <span style={{ fontSize: 13, color: canAfford ? "#64748b" : "#c00" }}>
              本次将消耗 <strong>{consumePoints}</strong> 积分
              {balance != null ? `（当前余额 ${balance}）` : ""}
            </span>
            <button
              type="button"
              onClick={loadBalance}
              style={{ padding: "8px 12px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer" }}
            >
              刷新余额
            </button>
          </div>
        </div>
      )}
      {loading ? (
        <p>加载中…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {list.map((o) => (
            <div key={o.id} style={{ padding: 16, background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>订单号：{o.order_no || `（内部ID ${o.id}）`}</div>
                  {o.title && <div style={{ marginTop: 6, fontSize: 14, color: "#334155" }}>标题：{o.title}</div>}
                </div>
                <span style={{ color: "#666" }}>
                  {statusText[o.status] ?? o.status} · 奖励 {o.reward_points} 分
                </span>
              </div>
              <p style={{ margin: "10px 0 0", fontSize: 14, whiteSpace: "pre-wrap" }}>{o.requirements}</p>
              {o.work_link && (
                <p style={{ margin: "8px 0 0", fontSize: 14 }}>
                  交付链接：
                  <a href={o.work_link} target="_blank" rel="noreferrer">
                    {o.work_link}
                  </a>
                </p>
              )}
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "#999" }}>
                创建：{o.created_at}
                {o.completed_at ? ` · 完成：${o.completed_at}` : ""}
              </p>
            </div>
          ))}
        </div>
      )}
      {!loading && list.length === 0 && <p style={{ color: "#666" }}>暂无订单</p>}
    </div>
  );
}
