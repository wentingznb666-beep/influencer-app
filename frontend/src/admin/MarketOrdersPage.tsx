import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import * as api from "../adminApi";
import { getStoredUser } from "../authApi";
import OrderDateFilter, { type DateFilterState } from "../components/OrderDateFilter";
import WorkLinksModal from "../components/WorkLinksModal";
import { normalizeWorkLinks } from "../utils/workLinks";

type Row = {
  id: number;
  order_no: string | null;
  title: string | null;
  tier: "A" | "B" | "C" | string;
  client_pay_points: number;
  creator_reward_points: number;
  platform_profit_points: number;
  status: string;
  client_username: string;
  client_display_name?: string | null;
  client_shop_name?: string | null;
  client_group_chat?: string | null;
  influencer_username: string | null;
  influencer_display_name?: string | null;
  work_links: string[];
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
 * 判断文本是否为可跳转链接（http/https）。
 */
function isHttpUrl(value?: string | null): boolean {
  if (!value) return false;
  return /^https?:\/\//i.test(value.trim());
}

/**
 * 管理员端：达人领单全量列表，采用与客户订单一致的表格风格。
 */
export default function MarketOrdersPage() {
  const user = getStoredUser();
  const isEmployee = user?.role === "employee";
  const [searchParams, setSearchParams] = useSearchParams();
  const [list, setList] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilterState>({ mode: "all", day: "", startDate: "", endDate: "" });
  const [detailOrder, setDetailOrder] = useState<Row | null>(null);
  const [detailWorkLinksDraft, setDetailWorkLinksDraft] = useState<string[]>([]);
  const [savingWorkLinks, setSavingWorkLinks] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [linksModalOpen, setLinksModalOpen] = useState(false);
  const [linksModalLinks, setLinksModalLinks] = useState<string[]>([]);
  const [savingClientInfo, setSavingClientInfo] = useState(false);
  const hasInitLoadedRef = useRef(false);

  /**
   * 将日期筛选状态转换为接口查询参数。
   */
  const resolveDateQuery = (filter: DateFilterState): { start_date?: string; end_date?: string } => {
    if (filter.mode === "day" && filter.day) return { start_date: filter.day, end_date: filter.day };
    if (filter.mode === "range") {
      const out: { start_date?: string; end_date?: string } = {};
      if (filter.startDate) out.start_date = filter.startDate;
      if (filter.endDate) out.end_date = filter.endDate;
      return out;
    }
    return {};
  };

  /**
   * 拉取列表（可选搜索关键词）。
   */
  const load = async (q?: string, filter?: DateFilterState) => {
    setLoading(true);
    setError(null);
    try {
      const query = {
        ...(q?.trim() ? { q: q.trim() } : {}),
        ...resolveDateQuery(filter ?? dateFilter),
      };
      const data = await api.getAdminMarketOrders(Object.keys(query).length > 0 ? query : undefined);
      const raw = (data.list as Row[]) || [];
      setList(raw.map((r) => ({ ...r, work_links: normalizeWorkLinks(r.work_links) })));
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
    const qFromUrl = searchParams.get("q") || "";
    const startDate = searchParams.get("start_date") || "";
    const endDate = searchParams.get("end_date") || "";
    const mode: DateFilterState["mode"] = startDate && endDate && startDate === endDate ? "day" : startDate || endDate ? "range" : "all";
    const initFilter: DateFilterState = { mode, day: mode === "day" ? startDate : "", startDate: mode === "range" ? startDate : "", endDate: mode === "range" ? endDate : "" };
    setSearchQ(qFromUrl);
    setDateFilter(initFilter);
    load(qFromUrl, initFilter);
  }, []);

  useEffect(() => {
    if (!detailOrder) return;
    setDetailWorkLinksDraft(normalizeWorkLinks(detailOrder.work_links));
  }, [detailOrder?.id]);

  const statusText: Record<string, string> = {
    open: "待领取",
    claimed: "已领取/进行中",
    completed: "已完成",
    cancelled: "已取消",
  };

  /**
   * 同步搜索词到 URL，支持按订单号深链定位。
   */
  const syncQToUrl = (nextQ: string, filter: DateFilterState) => {
    const params = new URLSearchParams();
    if (nextQ.trim()) params.set("q", nextQ.trim());
    const dateQuery = resolveDateQuery(filter);
    if (dateQuery.start_date) params.set("start_date", dateQuery.start_date);
    if (dateQuery.end_date) params.set("end_date", dateQuery.end_date);
    setSearchParams(params, { replace: true });
  };

  /**
   * 复制文本到剪贴板，并在抽屉顶部显示反馈。
   */
  const copyText = async (text: string, successLabel: string) => {
    try {
      if (!text) {
        setCopyMsg("无可复制内容");
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopyMsg(`已复制：${successLabel}`);
    } catch {
      setCopyMsg("复制失败，请检查浏览器权限");
    }
  };

  /**
   * 保存详情中的多条交付链接（管理端 PATCH）。
   */
  const saveWorkLinks = async () => {
    if (!detailOrder) return;
    const next = detailWorkLinksDraft.map((s) => s.trim()).filter((s) => s.length > 0);
    setSavingWorkLinks(true);
    setError(null);
    try {
      await api.updateAdminOrderWorkLinks(detailOrder.id, { work_links: next });
      setList((prev) => prev.map((row) => (row.id === detailOrder.id ? { ...row, work_links: next } : row)));
      setDetailOrder((prev) => (prev ? { ...prev, work_links: next } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSavingWorkLinks(false);
    }
  };

  /**
   * 管理员端回写客户基础信息并同步更新当前列表。
   */
  const saveClientInfo = async () => {
    if (!detailOrder) return;
    const shopName = String(detailOrder.client_shop_name ?? "").trim();
    const groupChat = String(detailOrder.client_group_chat ?? "").trim();
    if (!shopName) {
      setError("请输入客户店铺名称");
      return;
    }
    if (!groupChat) {
      setError("请输入客户对接群聊（群号/链接）");
      return;
    }
    setSavingClientInfo(true);
    setError(null);
    try {
      await api.updateAdminOrderClientInfo(detailOrder.id, { client_shop_name: shopName, client_group_chat: groupChat });
      setList((prev) => prev.map((row) => (row.id === detailOrder.id ? { ...row, client_shop_name: shopName, client_group_chat: groupChat } : row)));
      setDetailOrder((prev) => (prev ? { ...prev, client_shop_name: shopName, client_group_chat: groupChat } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新失败");
    } finally {
      setSavingClientInfo(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>达人领单</h2>
      <p style={{ fontSize: 14, color: "#64748b" }}>查看客户端发布的达人领单；布局与“客户订单”页保持一致，便于跨页核对。</p>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="输入订单号或标题（精准）"
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #dbe1ea", minWidth: 280 }}
        />
        <button
          type="button"
          onClick={() => {
            syncQToUrl(searchQ, dateFilter);
            load(searchQ, dateFilter);
          }}
          style={{ padding: "8px 16px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
        >
          搜索
        </button>
        <button
          type="button"
          onClick={() => {
            setSearchQ("");
            const emptyFilter: DateFilterState = { mode: "all", day: "", startDate: "", endDate: "" };
            setDateFilter(emptyFilter);
            syncQToUrl("", emptyFilter);
            load("", emptyFilter);
          }}
          style={{ padding: "8px 16px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer" }}
        >
          清空
        </button>
        <OrderDateFilter value={dateFilter} onChange={setDateFilter} />
      </div>
      {loading ? (
        <p>加载中…</p>
      ) : (
        <div style={{ overflowX: "auto", background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1280 }}>
            <thead>
              <tr style={{ background: "#f5f5f5" }}>
                <th style={{ padding: 10, textAlign: "left" }}>订单号</th>
                <th style={{ padding: 10, textAlign: "left" }}>客户账号/名称</th>
                <th style={{ padding: 10, textAlign: "left" }}>领取达人</th>
                <th style={{ padding: 10, textAlign: "left" }}>状态</th>
                <th style={{ padding: 10, textAlign: "left" }}>金额</th>
                <th style={{ padding: 10, textAlign: "left" }}>订单详情</th>
                <th style={{ padding: 10, textAlign: "left" }}>交付链接</th>
                <th style={{ padding: 10, textAlign: "left" }}>创建时间</th>
                <th style={{ padding: 10, textAlign: "left" }}>完成时间</th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id}>
                  <td style={{ padding: 10, borderBottom: "1px solid #eef2f7", whiteSpace: "nowrap" }}>
                    <button
                      type="button"
                      onClick={() => setDetailOrder(o)}
                      style={{ padding: 0, border: "none", background: "transparent", color: "var(--xt-accent)", cursor: "pointer", textDecoration: "underline" }}
                    >
                      {o.order_no || `#${o.id}`}
                    </button>
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eef2f7" }}>
                    {o.client_username}
                    <br />
                    <span style={{ color: "#64748b" }}>{o.client_display_name || o.client_username}</span>
                    <br />
                    <span style={{ color: "#64748b" }}>店铺：{o.client_shop_name?.trim() || "未填写"}</span>
                    <br />
                    <span style={{ color: "#64748b" }}>
                      群聊：
                      {isHttpUrl(o.client_group_chat) ? (
                        <a href={String(o.client_group_chat).trim()} target="_blank" rel="noreferrer">
                          {String(o.client_group_chat).trim()}
                        </a>
                      ) : (
                        o.client_group_chat?.trim() || "未填写"
                      )}
                    </span>
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eef2f7" }}>
                    {o.influencer_username ? (
                      <span>
                        {o.influencer_username}
                        <br />
                        <span style={{ color: "#64748b" }}>{o.influencer_display_name || o.influencer_username}</span>
                      </span>
                    ) : (
                      <span style={{ color: "#94a3b8" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eef2f7" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 12, background: o.status === "open" ? "#ffedd5" : o.status === "claimed" ? "#dbeafe" : "#dcfce7", color: "#334155" }}>
                      {statusText[o.status] ?? o.status}
                    </span>
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eef2f7", whiteSpace: "nowrap" }}>
                    客户支付：{o.client_pay_points}
                    {!isEmployee && (
                      <>
                        <br />
                        达人收益：{o.creator_reward_points}
                      </>
                    )}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eef2f7", maxWidth: 380 }}>
                    <div style={{ fontWeight: 600 }}>{o.title || "未命名订单"}</div>
                    <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>档位：{o.tier}</div>
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eef2f7", whiteSpace: "nowrap" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setLinksModalLinks(normalizeWorkLinks(o.work_links));
                        setLinksModalOpen(true);
                      }}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #dbe1ea", background: "#fff", cursor: "pointer" }}
                    >
                      查看链接
                    </button>
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eef2f7", whiteSpace: "nowrap" }}>{formatDateTime(o.created_at)}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #eef2f7", whiteSpace: "nowrap" }}>{formatDateTime(o.completed_at)}</td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: 14, color: "var(--xt-text-muted)" }}>
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <WorkLinksModal open={linksModalOpen} onClose={() => setLinksModalOpen(false)} links={linksModalLinks} title="交付链接" />
      {detailOrder && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", justifyContent: "flex-end", zIndex: 80 }} onClick={() => setDetailOrder(null)}>
          <div
            style={{ width: "min(680px, 100vw)", height: "100%", background: "#fff", boxShadow: "-6px 0 24px rgba(15,23,42,0.2)", padding: 20, overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0 }}>订单详情：{detailOrder.order_no || `#${detailOrder.id}`}</h3>
              <button type="button" onClick={() => setDetailOrder(null)} style={{ padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer" }}>
                关闭
              </button>
            </div>
            <div style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button type="button" onClick={() => copyText(String(detailOrder.id), `订单ID ${detailOrder.id}`)} style={{ padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer" }}>
                复制订单ID
              </button>
              <button type="button" onClick={() => copyText(detailOrder.order_no || "", `订单号 ${detailOrder.order_no || ""}`)} style={{ padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer" }}>
                复制订单号
              </button>
              <button type="button" onClick={() => copyText(detailOrder.client_username || "", "客户账号")} style={{ padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer" }}>
                复制客户账号
              </button>
              <button type="button" onClick={() => copyText(detailOrder.influencer_username || "", "达人账号")} style={{ padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer" }}>
                复制达人账号
              </button>
              <button
                type="button"
                onClick={() => copyText(detailWorkLinksDraft.filter((s) => s.trim()).join("\n"), "全部交付链接")}
                style={{ padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer" }}
              >
                复制全部交付链接
              </button>
              {copyMsg && <span style={{ color: "#0f766e", fontSize: 13 }}>{copyMsg}</span>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: 10, alignItems: "start", fontSize: 14 }}>
              <div style={{ color: "#64748b" }}>订单ID</div><div>{detailOrder.id}</div>
              <div style={{ color: "#64748b" }}>订单号</div><div>{detailOrder.order_no || "—"}</div>
              <div style={{ color: "#64748b" }}>客户账号/名称</div><div>{detailOrder.client_username} / {detailOrder.client_display_name || detailOrder.client_username}</div>
              <div style={{ color: "#64748b" }}>客户店铺名称</div>
              <div>
                <input
                  value={detailOrder.client_shop_name || ""}
                  onChange={(e) => setDetailOrder((prev) => (prev ? { ...prev, client_shop_name: e.target.value } : prev))}
                  placeholder="请输入客户店铺名称"
                  style={{ width: "100%", maxWidth: 360, padding: "6px 8px", borderRadius: 8, border: "1px solid #dbe1ea" }}
                />
              </div>
              <div style={{ color: "#64748b" }}>客户对接群聊</div>
              <div>
                <input
                  value={detailOrder.client_group_chat || ""}
                  onChange={(e) => setDetailOrder((prev) => (prev ? { ...prev, client_group_chat: e.target.value } : prev))}
                  placeholder="群号或链接"
                  style={{ width: "100%", maxWidth: 360, padding: "6px 8px", borderRadius: 8, border: "1px solid #dbe1ea" }}
                />
                <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>
                  {isHttpUrl(detailOrder.client_group_chat) ? (
                    <a href={String(detailOrder.client_group_chat).trim()} target="_blank" rel="noreferrer">
                      跳转群聊链接
                    </a>
                  ) : (
                    "当前为群号文本"
                  )}
                </div>
              </div>
              <div style={{ color: "#64748b" }}>领取达人</div><div>{detailOrder.influencer_username ? `${detailOrder.influencer_username} / ${detailOrder.influencer_display_name || detailOrder.influencer_username}` : "—"}</div>
              <div style={{ color: "#64748b" }}>状态</div><div>{statusText[detailOrder.status] ?? detailOrder.status}</div>
              <div style={{ color: "#64748b" }}>档位</div><div>{detailOrder.tier}</div>
              <div style={{ color: "#64748b" }}>客户支付</div><div>{detailOrder.client_pay_points}</div>
              {!isEmployee && (
                <>
                  <div style={{ color: "#64748b" }}>达人收益</div><div>{detailOrder.creator_reward_points}</div>
                  <div style={{ color: "#64748b" }}>平台利润</div><div>{detailOrder.platform_profit_points}</div>
                </>
              )}
              <div style={{ color: "#64748b" }}>标题</div><div>{detailOrder.title || "未命名订单"}</div>
              <div style={{ color: "#64748b", alignSelf: "start" }}>交付链接</div>
              <div>
                {detailWorkLinksDraft.map((line, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      value={line}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDetailWorkLinksDraft((prev) => prev.map((p, i) => (i === idx ? v : p)));
                      }}
                      placeholder="https://..."
                      style={{ flex: 1, minWidth: 200, padding: "6px 8px", borderRadius: 8, border: "1px solid #dbe1ea" }}
                    />
                    <button
                      type="button"
                      onClick={() => setDetailWorkLinksDraft((prev) => prev.filter((_, i) => i !== idx))}
                      style={{ padding: "4px 8px", border: "1px solid #fecaca", borderRadius: 8, background: "#fff", cursor: "pointer", color: "#b91c1c" }}
                      aria-label="删除该条链接"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setDetailWorkLinksDraft((prev) => [...prev, ""])}
                  style={{ padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#f8fafc", cursor: "pointer" }}
                >
                  + 新增链接
                </button>
                <div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={saveWorkLinks}
                    disabled={savingWorkLinks}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "none",
                      background: "var(--xt-accent)",
                      color: "#fff",
                      cursor: savingWorkLinks ? "not-allowed" : "pointer",
                      opacity: savingWorkLinks ? 0.65 : 1,
                    }}
                  >
                    {savingWorkLinks ? "保存中..." : "保存交付链接"}
                  </button>
                </div>
              </div>
              <div style={{ color: "#64748b" }}>创建时间</div><div>{formatDateTime(detailOrder.created_at)}</div>
              <div style={{ color: "#64748b" }}>更新时间</div><div>{formatDateTime(detailOrder.updated_at)}</div>
              <div style={{ color: "#64748b" }}>完成时间</div><div>{formatDateTime(detailOrder.completed_at)}</div>
            </div>
            <div style={{ marginTop: 14 }}>
              <button
                type="button"
                onClick={saveClientInfo}
                disabled={savingClientInfo}
                style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "var(--xt-accent)", color: "#fff", cursor: savingClientInfo ? "not-allowed" : "pointer", opacity: savingClientInfo ? 0.65 : 1 }}
              >
                {savingClientInfo ? "保存中..." : "保存客户信息"}
              </button>
            </div>
          </div>
        </div>
      )}
      {!loading && list.length === 0 && <p style={{ color: "#666" }}>暂无数据</p>}
    </div>
  );
}
