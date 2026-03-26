import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as api from "../clientApi";

type MarketOrder = {
  id: number;
  order_no: string | null;
  title: string | null;
  requirements: string;
  reward_points: number;
  tier?: "A" | "B" | "C" | string;
  tiktok_link?: string | null;
  sku_codes?: string[] | null;
  sku_images?: string[] | null;
  status: string;
  influencer_id: number | null;
  influencer_username?: string | null;
  influencer_display_name?: string | null;
  work_link: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

type SkuItem = {
  id: number;
  sku_code: string;
  sku_name: string | null;
  sku_images: string[] | null;
};

/**
 * 将后端时间统一格式化为“年-月-日 时分秒”。
 */
function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * 客户端「达人领单」页面：发布要求、查看订单号与标题、搜索、查看状态与交付链接。
 */
export default function ClientMarketOrdersPage() {
  const nav = useNavigate();
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
  const [tiktokLink, setTiktokLink] = useState("");
  const [selectedSkuIds, setSelectedSkuIds] = useState<number[]>([]);
  const [skuList, setSkuList] = useState<SkuItem[]>([]);
  const [skuKeyword, setSkuKeyword] = useState("");
  const [taskCount, setTaskCount] = useState(1);
  const [searchQ, setSearchQ] = useState("");
  const hasInitLoadedRef = useRef(false);
  const hasInitBalanceRef = useRef(false);
  const hasInitSkusRef = useRef(false);

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
    // React StrictMode 开发模式会重复执行 effect，这里确保初始化请求只触发一次。
    if (hasInitLoadedRef.current) return;
    hasInitLoadedRef.current = true;
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
    // React StrictMode 下避免余额初始化重复请求。
    if (hasInitBalanceRef.current) return;
    hasInitBalanceRef.current = true;
    loadBalance();
  }, []);

  /**
   * 加载客户维护的 SKU 列表，供发单时勾选。
   */
  const loadSkus = async () => {
    try {
      const data = await api.getSkus();
      setSkuList((data.list || []) as SkuItem[]);
    } catch {
      setSkuList([]);
    }
  };

  useEffect(() => {
    // React StrictMode 下避免 SKU 初始化重复请求。
    if (hasInitSkusRef.current) return;
    hasInitSkusRef.current = true;
    loadSkus();
  }, []);

  /**
   * 根据关键词过滤 SKU 勾选列表，支持 SKU 编码/名称模糊匹配。
   */
  const filteredSkuList = useMemo(() => {
    const keyword = skuKeyword.trim().toLowerCase();
    if (!keyword) return skuList;
    return skuList.filter((s) => {
      const text = `${s.sku_code} ${s.sku_name || ""}`.toLowerCase();
      return text.includes(keyword);
    });
  }, [skuKeyword, skuList]);

  const consumePoints = tier === "A" ? 60 : tier === "B" ? 40 : 20;
  const totalConsumePoints = consumePoints * taskCount;
  const canAfford = balance == null ? true : balance >= totalConsumePoints;

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
      setError(`积分余额不足：本次将消耗 ${totalConsumePoints} 积分，当前余额 ${balance}。`);
      return;
    }
    try {
      const chosen = skuList.filter((s) => selectedSkuIds.includes(s.id));
      const skuCodes = chosen.map((s) => (s.sku_name ? `${s.sku_code} / ${s.sku_name}` : s.sku_code));
      const skuImages = chosen.flatMap((s) => (Array.isArray(s.sku_images) ? s.sku_images : [])).slice(0, 100);
      await api.createMarketOrder({
        requirements: text,
        title: title.trim() || undefined,
        tier,
        voice_link: tier === "A" ? (voiceLink.trim() || undefined) : undefined,
        voice_note: tier === "A" ? (voiceNote.trim() || undefined) : undefined,
        tiktok_link: tiktokLink.trim() || undefined,
        product_images: [],
        sku_ids: selectedSkuIds,
        sku_codes: skuCodes,
        sku_images: skuImages,
        task_count: taskCount,
      });
      setShowForm(false);
      setRequirements("");
      setTitle("");
      setTier("C");
      setVoiceLink("");
      setVoiceNote("");
      setTiktokLink("");
      setSelectedSkuIds([]);
      setTaskCount(1);
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

  /**
   * 软删除订单：仅 open 状态可删（后端会校验）。
   */
  const handleDelete = async (id: number) => {
    const ok = window.confirm("确认删除该订单？仅“待领取”状态可删除。");
    if (!ok) return;
    setError(null);
    try {
      await api.deleteMarketOrder(id);
      load(searchQ);
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    }
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
          <label htmlFor="taskCount">发布数量（批量创建）</label>
          <input
            id="taskCount"
            type="number"
            min={1}
            max={100}
            value={taskCount}
            onChange={(e) => setTaskCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
            style={{ display: "block", marginTop: 8, marginBottom: 12, width: "100%", maxWidth: 180, padding: "8px 10px", boxSizing: "border-box", borderRadius: 8, border: "1px solid #ddd" }}
          />
          <label htmlFor="tiktokLink">TikTok 链接（可选）</label>
          <input
            id="tiktokLink"
            type="url"
            value={tiktokLink}
            onChange={(e) => setTiktokLink(e.target.value)}
            placeholder="https://www.tiktok.com/..."
            style={{ display: "block", marginTop: 8, marginBottom: 12, width: "100%", maxWidth: 560, padding: "8px 10px", boxSizing: "border-box", borderRadius: 8, border: "1px solid #ddd" }}
          />
          <div style={{ marginBottom: 12 }}>
            <label>SKU 信息（从 SKU 列表勾选）</label>
            <input
              value={skuKeyword}
              onChange={(e) => setSkuKeyword(e.target.value)}
              placeholder="搜索 SKU 编码/名称"
              style={{ display: "block", marginTop: 8, marginBottom: 8, width: "100%", maxWidth: 420, padding: "8px 10px", boxSizing: "border-box", borderRadius: 8, border: "1px solid #ddd" }}
            />
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredSkuList.map((s) => (
                <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <input
                    type="checkbox"
                    checked={selectedSkuIds.includes(s.id)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSelectedSkuIds((prev) => (checked ? Array.from(new Set([...prev, s.id])) : prev.filter((id) => id !== s.id)));
                    }}
                  />
                  <span>{s.sku_name ? `${s.sku_code} / ${s.sku_name}` : s.sku_code}</span>
                </label>
              ))}
              {skuList.length === 0 && <span style={{ color: "#64748b", fontSize: 13 }}>暂无 SKU，可先前往「SKU 列表」维护。</span>}
              {skuList.length > 0 && filteredSkuList.length === 0 && <span style={{ color: "#64748b", fontSize: 13 }}>无匹配 SKU</span>}
            </div>
          </div>
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
              本次将消耗 <strong>{totalConsumePoints}</strong> 积分（{consumePoints} × {taskCount}）
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
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <span style={{ color: "#666" }}>
                    {statusText[o.status] ?? o.status} · 奖励 {o.reward_points} 分
                  </span>
                  {o.status === "open" && (
                    <>
                      <button
                        type="button"
                        onClick={() => nav(`/client/market-orders/${o.id}/edit`)}
                        style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #dbe1ea", background: "#fff", cursor: "pointer" }}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(o.id)}
                        style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #fecaca", background: "#fff", color: "#b91c1c", cursor: "pointer" }}
                      >
                        删除
                      </button>
                    </>
                  )}
                </div>
              </div>
              <p style={{ margin: "10px 0 0", fontSize: 14, whiteSpace: "pre-wrap" }}>{o.requirements}</p>
              {o.status === "claimed" && (
                <p style={{ margin: "8px 0 0", fontSize: 14, fontWeight: 600, color: "#0f766e" }}>
                  领取达人账号昵称：{o.influencer_username || "—"}{o.influencer_display_name ? ` / ${o.influencer_display_name}` : ""}
                </p>
              )}
              {!!o.tiktok_link && (
                <p style={{ margin: "8px 0 0", fontSize: 13 }}>
                  TikTok：
                  <a href={o.tiktok_link} target="_blank" rel="noreferrer">
                    {o.tiktok_link}
                  </a>
                </p>
              )}
              {(Array.isArray(o.sku_codes) && o.sku_codes.length > 0) || (Array.isArray(o.sku_images) && o.sku_images.length > 0) ? (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 13, color: "#475569" }}>SKU 信息</div>
                  {Array.isArray(o.sku_codes) && o.sku_codes.length > 0 && (
                    <div style={{ marginTop: 4, fontSize: 13, color: "#334155" }}>{o.sku_codes.join("，")}</div>
                  )}
                  {Array.isArray(o.sku_images) && o.sku_images.length > 0 && (
                    <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {o.sku_images.slice(0, 6).map((url, i) => (
                        <a key={`${o.id}-sku-${i}`} href={url} target="_blank" rel="noreferrer">
                          <img src={url} alt={`sku-${o.id}-${i}`} style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6, border: "1px solid #eee" }} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
              {o.work_link && (
                <p style={{ margin: "8px 0 0", fontSize: 14 }}>
                  交付链接：
                  <a href={o.work_link} target="_blank" rel="noreferrer">
                    {o.work_link}
                  </a>
                </p>
              )}
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "#999" }}>
                创建：{formatDateTime(o.created_at)}
                {o.completed_at ? ` · 完成：${formatDateTime(o.completed_at)}` : ""}
              </p>
            </div>
          ))}
        </div>
      )}
      {!loading && list.length === 0 && <p style={{ color: "#666" }}>暂无订单</p>}
    </div>
  );
}
