import { useState, useEffect, useRef } from "react";
import * as api from "../influencerApi";
import OrderDateFilter, { type DateFilterState } from "../components/OrderDateFilter";

type OpenOrder = {
  id: number;
  order_no: string | null;
  title: string | null;
  requirements: string;
  reward_points: number;
  tier: "A" | "B" | "C" | string;
  voice_link?: string | null;
  voice_note?: string | null;
  sku_codes?: string[] | null;
  sku_images?: string[] | null;
  client_id: number;
  client_username: string;
  client_display_name: string;
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
  sku_codes?: string[] | null;
  sku_images?: string[] | null;
  client_id: number;
  client_username: string;
  client_display_name: string;
  status: string;
  work_link: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
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
 * 渲染订单 SKU 信息（编码/名称 + 缩略图）。
 */
function renderSkuInfo(o: { id: number; sku_codes?: string[] | null; sku_images?: string[] | null }) {
  if ((!Array.isArray(o.sku_codes) || o.sku_codes.length === 0) && (!Array.isArray(o.sku_images) || o.sku_images.length === 0)) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 13, color: "#475569" }}>SKU 信息</div>
      {Array.isArray(o.sku_codes) && o.sku_codes.length > 0 && <div style={{ marginTop: 4, fontSize: 13, color: "#334155" }}>{o.sku_codes.join("，")}</div>}
      {Array.isArray(o.sku_images) && o.sku_images.length > 0 && (
        <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {o.sku_images.slice(0, 6).map((url, idx) => (
            <a key={`${o.id}-sku-${idx}`} href={url} target="_blank" rel="noreferrer">
              <img src={url} alt={`sku-${o.id}-${idx}`} style={{ width: 48, height: 48, borderRadius: 6, objectFit: "cover", border: "1px solid #eee" }} />
            </a>
          ))}
        </div>
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
  const [openDateFilter, setOpenDateFilter] = useState<DateFilterState>({ mode: "all", day: "", startDate: "", endDate: "" });
  const [myDateFilter, setMyDateFilter] = useState<DateFilterState>({ mode: "all", day: "", startDate: "", endDate: "" });
  const hasInitLoadedRef = useRef(false);

  /**
   * 将日期筛选状态转换为接口查询参数。
   */
  function resolveDateQuery(filter: DateFilterState): { start_date?: string; end_date?: string } {
    if (filter.mode === "day" && filter.day) return { start_date: filter.day, end_date: filter.day };
    if (filter.mode === "range") {
      const out: { start_date?: string; end_date?: string } = {};
      if (filter.startDate) out.start_date = filter.startDate;
      if (filter.endDate) out.end_date = filter.endDate;
      return out;
    }
    return {};
  }

  /**
   * 加载大厅与我的订单。
   */
  const load = async (qOpen?: string, qMy?: string, nextOpenDateFilter?: DateFilterState, nextMyDateFilter?: DateFilterState) => {
    setLoading(true);
    setError(null);
    try {
      const oq = qOpen !== undefined ? qOpen : searchOpen;
      const mq = qMy !== undefined ? qMy : searchMy;
      const openDate = nextOpenDateFilter ?? openDateFilter;
      const myDate = nextMyDateFilter ?? myDateFilter;
      const [openRes, myRes] = await Promise.all([
        api.getMarketOrders({
          ...(oq.trim() ? { q: oq.trim() } : {}),
          ...resolveDateQuery(openDate),
        }),
        api.getMyMarketOrders({
          ...(mq.trim() ? { q: mq.trim() } : {}),
          ...resolveDateQuery(myDate),
        }),
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
    // React StrictMode 开发模式会重复执行 effect，这里确保初始化请求只触发一次。
    if (hasInitLoadedRef.current) return;
    hasInitLoadedRef.current = true;
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
        领取商家发布的任务，完成后提交交付链接即可获得固定 <strong>5</strong> 积分收益。可使用搜索或手动刷新保持最新数据。
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
        <button type="button" onClick={() => load(searchOpen, undefined, openDateFilter, undefined)} style={{ padding: "6px 14px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
          搜索
        </button>
        <button
          type="button"
          onClick={() => {
            setSearchOpen("");
            const emptyFilter: DateFilterState = { mode: "all", day: "", startDate: "", endDate: "" };
            setOpenDateFilter(emptyFilter);
            load("", undefined, emptyFilter, undefined);
          }}
          style={{ padding: "6px 14px", border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer" }}
        >
          清空
        </button>
        <OrderDateFilter value={openDateFilter} onChange={setOpenDateFilter} />
      </div>
      {loading ? (
        <p>加载中…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
          {openList.map((o) => (
            <div key={o.id} style={{ padding: 16, background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <div style={{ marginBottom: 10, padding: "6px 10px", borderRadius: 8, background: "#f1f5f9", color: "#0f172a", fontWeight: 700, fontSize: 13 }}>
                订单日期：{formatDateTime(o.created_at)}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>订单号：{o.order_no || `#${o.id}`}</div>
                  {o.title && <div style={{ marginTop: 6, fontSize: 14, color: "#334155" }}>标题：{o.title}</div>}
                  <div style={{ marginTop: 6, fontSize: 13, color: "#475569" }}>
                    下单客户账号：{o.client_username} ｜ 客户名称：{o.client_display_name}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>订单创建日期：{formatDateTime(o.created_at)}</div>
                </div>
                <span style={{ color: "#166534", fontWeight: 600 }}>+{o.reward_points} 积分</span>
              </div>
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "130px 1fr", gap: 8, alignItems: "start" }}>
                <div style={{ color: "#64748b", fontSize: 13 }}>完整订单详情</div>
                <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{o.requirements}</div>
                <div style={{ color: "#64748b", fontSize: 13 }}>状态</div>
                <div style={{ fontSize: 14 }}>{statusText[o.status] ?? o.status}</div>
                <div style={{ color: "#64748b", fontSize: 13 }}>金额</div>
                <div style={{ fontSize: 14 }}>{o.reward_points} 积分</div>
                <div style={{ color: "#64748b", fontSize: 13 }}>备注</div>
                <div style={{ fontSize: 14 }}>{o.voice_note?.trim() ? o.voice_note : "—"}</div>
              </div>
              {renderSkuInfo(o)}
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
        <button type="button" onClick={() => load(undefined, searchMy, undefined, myDateFilter)} style={{ padding: "6px 14px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
          搜索
        </button>
        <button
          type="button"
          onClick={() => {
            setSearchMy("");
            const emptyFilter: DateFilterState = { mode: "all", day: "", startDate: "", endDate: "" };
            setMyDateFilter(emptyFilter);
            load(undefined, "", undefined, emptyFilter);
          }}
          style={{ padding: "6px 14px", border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer" }}
        >
          清空
        </button>
        <OrderDateFilter value={myDateFilter} onChange={setMyDateFilter} />
      </div>
      {!loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {myList.map((o) => (
            <div key={o.id} style={{ padding: 16, background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <div style={{ marginBottom: 10, padding: "6px 10px", borderRadius: 8, background: "#f1f5f9", color: "#0f172a", fontWeight: 700, fontSize: 13 }}>
                订单日期：{formatDateTime(o.created_at)}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>订单号：{o.order_no || `#${o.id}`}</div>
                  {o.title && <div style={{ marginTop: 6, fontSize: 14, color: "#334155" }}>标题：{o.title}</div>}
                  <div style={{ marginTop: 6, fontSize: 13, color: "#475569" }}>
                    下单客户账号：{o.client_username} ｜ 客户名称：{o.client_display_name}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>订单创建日期：{formatDateTime(o.created_at)}</div>
                </div>
                <span style={{ color: "#666" }}>{statusText[o.status] ?? o.status}</span>
              </div>
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "130px 1fr", gap: 8, alignItems: "start" }}>
                <div style={{ color: "#64748b", fontSize: 13 }}>完整订单详情</div>
                <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{o.requirements}</div>
                <div style={{ color: "#64748b", fontSize: 13 }}>状态</div>
                <div style={{ fontSize: 14 }}>{statusText[o.status] ?? o.status}</div>
                <div style={{ color: "#64748b", fontSize: 13 }}>金额</div>
                <div style={{ fontSize: 14 }}>{o.reward_points} 积分</div>
                <div style={{ color: "#64748b", fontSize: 13 }}>备注</div>
                <div style={{ fontSize: 14 }}>{o.voice_note?.trim() ? o.voice_note : "—"}</div>
              </div>
              {renderSkuInfo(o)}
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
