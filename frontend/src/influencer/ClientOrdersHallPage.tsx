import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import * as api from "../influencerApi";

import OrderDateFilter, { type DateFilterState } from "../components/OrderDateFilter";

import WorkLinksModal from "../components/WorkLinksModal";

import { normalizeWorkLinks } from "../utils/workLinks";



type OpenOrder = {

  id: number;

  order_no: string | null;

  title: string | null;

  reward_points: number;

  tier: "A" | "B" | "C" | string;

  publish_method?: "client_self_publish" | "influencer_publish_with_cart" | string;

  voice_link?: string | null;

  voice_note?: string | null;

  sku_codes?: string[] | null;

  sku_images?: string[] | null;

  client_id: number;

  client_username: string;

  client_display_name: string;

  status: string;

  created_at: string;

  task_count?: number;

};



type MyOrder = {

  id: number;

  order_no: string | null;

  title: string | null;

  reward_points: number;

  tier: "A" | "B" | "C" | string;

  publish_method?: "client_self_publish" | "influencer_publish_with_cart" | string;

  publish_link?: string | null;

  voice_link?: string | null;

  voice_note?: string | null;

  sku_codes?: string[] | null;

  sku_images?: string[] | null;

  client_id: number;

  client_username: string;

  client_display_name: string;

  status: string;

  work_links: string[];

  created_at: string;

  updated_at: string;

  completed_at: string | null;

  task_count?: number;

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

 * 解析领单大厅订单的合并套数（默认 1，上限 100）。

 */

function hallMarketOrderTaskCount(o: { reward_points: number; task_count?: number }): number {

  const n = Number(o.task_count);

  if (!Number.isFinite(n) || n < 1) return 1;

  return Math.min(100, Math.floor(n));

}



/**

 * 达人侧展示的订单总积分：单套积分 × 套数。

 */

function hallMarketOrderTotalPoints(o: {

  reward_points: number;

  task_count?: number;

  reward_points_total?: number;

}): number {

  const t = Number(o.reward_points_total);

  if (Number.isFinite(t) && t >= 0) return t;

  return hallMarketOrderTaskCount(o) * (o.reward_points || 0);

}



/**

 * 按订单级别生成制作标准提示文案。

 */

function renderTierStandards(tier: string, t: TFunction) {

  if (tier === "A") {

    return (

      <div style={{ marginTop: 8, fontSize: 13, color: "#334155" }}>

        <div style={{ fontWeight: 700 }}>{t("制作标准")}</div>

        <div style={{ marginTop: 4 }}>

          <strong>{t("包含配音要求")}</strong>

        </div>

      </div>

    );

  }

  if (tier === "B") {

    return (

      <div style={{ marginTop: 8, fontSize: 13, color: "#334155" }}>

        <div style={{ fontWeight: 700 }}>{t("制作标准")}</div>

        <div style={{ marginTop: 4 }}>{t("包含场景切换 + 特效转场")}</div>

      </div>

    );

  }

  return (

    <div style={{ marginTop: 8, fontSize: 13, color: "#334155" }}>

      <div style={{ fontWeight: 700 }}>{t("制作标准")}</div>

      <div style={{ marginTop: 4 }}>{t("基础功能：背景音乐、文字贴纸")}</div>

    </div>

  );

}

function renderVoiceEntry(o: { tier: string; voice_link?: string | null; voice_note?: string | null }, t: TFunction) {

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

      <div style={{ fontWeight: 800, color: "var(--xt-primary)" }}>{t("配音入口")}</div>

      {link ? (

        <div style={{ marginTop: 6, fontSize: 14 }}>

          <a href={link} target="_blank" rel="noreferrer" style={{ color: "var(--xt-accent)", fontWeight: 700 }}>

            {t("配音素材下载")}

          </a>

        </div>

      ) : (

        <div style={{ marginTop: 6, fontSize: 13, color: "#64748b" }}>{t("（未提供配音素材下载链接）")}</div>

      )}

      {note ? (

        <div style={{ marginTop: 8, fontSize: 13, color: "#334155", whiteSpace: "pre-wrap" }}>{note}</div>

      ) : (

        <div style={{ marginTop: 8, fontSize: 13, color: "#64748b" }}>{t("（未提供配音要求备注）")}</div>

      )}

    </div>

  );

}

function renderSkuInfo(o: { id: number; sku_codes?: string[] | null; sku_images?: string[] | null }, t: TFunction) {

  if ((!Array.isArray(o.sku_codes) || o.sku_codes.length === 0) && (!Array.isArray(o.sku_images) || o.sku_images.length === 0)) return null;

  return (

    <div style={{ marginTop: 8 }}>

      <div style={{ fontSize: 13, color: "#475569" }}>{t("SKU 信息")}</div>

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

 * 达人端：



/**

 * 达人端：商家端发单大厅与我的领单，展示订单号/标题，支持按订单号或标题精准搜索。

 */

export default function ClientOrdersHallPage() {

  const { t } = useTranslation();

  const [openList, setOpenList] = useState<OpenOrder[]>([]);

  const [myList, setMyList] = useState<MyOrder[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [completeId, setCompleteId] = useState<number | null>(null);

  const [workLinkRows, setWorkLinkRows] = useState<string[]>([""]);

  const [linksModalOpen, setLinksModalOpen] = useState(false);

  const [linksModalLinks, setLinksModalLinks] = useState<string[]>([]);

  const [influencerEditId, setInfluencerEditId] = useState<number | null>(null);

  const [influencerEditDraft, setInfluencerEditDraft] = useState<string[]>([]);

  const [savingInfluencerLinks, setSavingInfluencerLinks] = useState(false);

  const [searchOpen, setSearchOpen] = useState("");

  const [searchMy, setSearchMy] = useState("");

  const [publishDraft, setPublishDraft] = useState<Record<number, string>>({});

  const [publishing, setPublishing] = useState<Record<number, boolean>>({});

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

      const myRows = (myRes.list || []) as MyOrder[];

      setMyList(myRows.map((r) => ({ ...r, work_links: normalizeWorkLinks(r.work_links) })));

    } catch (e) {

      setError(e instanceof Error ? e.message : t("加载失败"));

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

      setError(e instanceof Error ? e.message : t("领取失败"));

    }

  };



  /**

   * 提交完成与交付链接以结算积分。

   */

  const handleComplete = async () => {

    if (completeId == null) return;

    const links = workLinkRows.map((s) => s.trim()).filter((s) => s.length > 0);

    if (links.length === 0) {

      setError(t("请至少填写一条交付链接。"));

      return;

    }

    setError(null);

    try {

      await api.completeMarketOrder(completeId, links);

      setCompleteId(null);

      setWorkLinkRows([""]);

      setInfluencerEditId(null);

      load();

    } catch (e) {

      setError(e instanceof Error ? e.message : t("提交失败"));

    }

  };



  /**

   * 达人修改已提交的多条交付链接（已领取/已完成）。

   */

  const saveInfluencerWorkLinks = async (orderId: number) => {

    const next = influencerEditDraft.map((s) => s.trim()).filter((s) => s.length > 0);

    setSavingInfluencerLinks(true);

    setError(null);

    try {

      await api.updateInfluencerOrderWorkLinks(orderId, { work_links: next });

      setInfluencerEditId(null);

      load();

    } catch (e) {

      setError(e instanceof Error ? e.message : t("保存失败"));

    } finally {

      setSavingInfluencerLinks(false);

    }

  };

  const submitPublishLink = async (orderId: number) => {
    const link = String(publishDraft[orderId] || "").trim();
    if (!link) {
      setError(t("请先填写发布链接。"));
      return;
    }
    setPublishing((p) => ({ ...p, [orderId]: true }));
    setError(null);
    try {
      await api.publishMarketOrder(orderId, link);
      setPublishDraft((p) => ({ ...p, [orderId]: "" }));
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("提交失败"));
    } finally {
      setPublishing((p) => ({ ...p, [orderId]: false }));
    }
  };



  const statusText = useMemo(
    (): Record<string, string> => ({
      open: t("待领取"),
      claimed: t("进行中"),
      completed: t("已完成"),
      cancelled: t("已取消"),
    }),
    [t],
  );

  const publishMethodText = useMemo(
    (): Record<string, string> => ({
      client_self_publish: t("视频拍完后自己发布"),
      influencer_publish_with_cart: t("达人在TikTok账号发布视频和挂在购物车"),
    }),
    [t],
  );





  return (

    <div>

      <h2 style={{ marginTop: 0 }}>{t("商家端发单")}</h2>

      <p style={{ color: "#64748b", fontSize: 14, marginBottom: 16 }}>

        {t("领取商家发布的任务，完成后提交交付链接即可获得固定 5 积分收益。可使用搜索或手动刷新保持最新数据。")}

      </p>

      {error && <p style={{ color: "#c00" }}>{error}</p>}

      <button type="button" onClick={() => load()} style={{ marginBottom: 16, padding: "6px 12px", border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer" }}>

        {t("刷新全部")}

      </button>



      <h3 style={{ fontSize: 16 }}>{t("待领取")}</h3>

      <div style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>

        <input

          type="text"

          value={searchOpen}

          onChange={(e) => setSearchOpen(e.target.value)}

          placeholder={t("搜索订单号或标题（精准）")}

          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #dbe1ea", minWidth: 240 }}

        />

        <button type="button" onClick={() => load(searchOpen, undefined, openDateFilter, undefined)} style={{ padding: "6px 14px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>

          {t("搜索")}

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

          {t("清空")}

        </button>

        <OrderDateFilter value={openDateFilter} onChange={setOpenDateFilter} />

      </div>

      {loading ? (

        <p>{t("加载中…")}</p>

      ) : (

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>

          {openList.map((o) => (

            <div key={o.id} style={{ padding: 16, background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>

              <div style={{ marginBottom: 10, padding: "6px 10px", borderRadius: 8, background: "#f1f5f9", color: "#0f172a", fontWeight: 700, fontSize: 13 }}>

                {t("订单日期：")}{formatDateTime(o.created_at)}

              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>

                <div>

                  <div style={{ fontWeight: 600 }}>{t("订单号：")}{o.order_no || `#${o.id}`}</div>

                  {o.title && <div style={{ marginTop: 6, fontSize: 14, color: "#334155" }}>{t("标题：")}{o.title}</div>}

                  <div style={{ marginTop: 6, fontSize: 13, color: "#475569" }}>

                    {t("下单商家账号：")}{o.client_username} ｜ {t("商家名称：")}{o.client_display_name}

                  </div>

                  <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>{t("订单创建日期：")}{formatDateTime(o.created_at)}</div>

                </div>

                <span style={{ color: "#166534", fontWeight: 600 }}>+{hallMarketOrderTotalPoints(o)} {t("积分")}</span>

              </div>

              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "130px 1fr", gap: 8, alignItems: "start" }}>

                <div style={{ color: "#64748b", fontSize: 13 }}>{t("状态")}</div>

                <div style={{ fontSize: 14 }}>{statusText[o.status] ?? o.status}</div>

                <div style={{ color: "#64748b", fontSize: 13 }}>{t("视频数量/积分")}</div>
                <div style={{ fontSize: 14 }}>
                  <div style={{ marginBottom: 4 }}>
                    {t("视频数量：")}{o.task_count || "-"} {t("条")}
                  </div>
                  <div>
                    {t("金额：")}
                    <span style={{ fontWeight: 600, color: "var(--xt-accent)" }}>
                      {hallMarketOrderTotalPoints(o)} {t("积分")}
                    </span>
                    <span style={{ color: "#64748b", marginLeft: 4 }}>
                      （{t("单套")} {o.reward_points} {t("积分")} × {t("视频数量：")} {hallMarketOrderTaskCount(o)}）
                    </span>
                  </div>
                </div>

                <div style={{ color: "#64748b", fontSize: 13 }}>{t("发布方式")}</div>

                <div style={{ fontSize: 14 }}>{publishMethodText[String(o.publish_method || "client_self_publish")] || publishMethodText.client_self_publish}</div>

                <div style={{ color: "#64748b", fontSize: 13 }}>{t("备注")}</div>

                <div style={{ fontSize: 14 }}>{o.voice_note?.trim() ? o.voice_note : "—"}</div>

              </div>

              {renderSkuInfo(o, t)}

              {renderTierStandards(String(o.tier || ""), t)}

              {renderVoiceEntry(o, t)}

              <button type="button" onClick={() => handleClaim(o.id)} style={{ padding: "8px 16px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>

                {t("领取")}

              </button>

            </div>

          ))}

          {openList.length === 0 && (
            <div className="xt-inf-empty xt-inf-card" style={{ marginTop: 8 }}>
              <div className="xt-inf-empty-icon" aria-hidden>
                📋
              </div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>{t("暂无待领取订单")}</div>
              <div style={{ fontSize: 14, marginBottom: 12 }}>{t("可调整搜索条件或稍后再试。")}</div>
              <button type="button" className="xt-accent-btn" onClick={() => load()}>
                {t("刷新列表")}
              </button>
            </div>
          )}

        </div>

      )}



      <h3 style={{ fontSize: 16 }}>{t("我的领单")}</h3>

      <div style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>

        <input

          type="text"

          value={searchMy}

          onChange={(e) => setSearchMy(e.target.value)}

          placeholder={t("搜索订单号或标题（精准）")}

          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #dbe1ea", minWidth: 240 }}

        />

        <button type="button" onClick={() => load(undefined, searchMy, undefined, myDateFilter)} style={{ padding: "6px 14px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>

          {t("搜索")}

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

          {t("清空")}

        </button>

        <OrderDateFilter value={myDateFilter} onChange={setMyDateFilter} />

      </div>

      {!loading && (

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {myList.map((o) => (

            <div key={o.id} style={{ padding: 16, background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>

              <div style={{ marginBottom: 10, padding: "6px 10px", borderRadius: 8, background: "#f1f5f9", color: "#0f172a", fontWeight: 700, fontSize: 13 }}>

                {t("订单日期：")}{formatDateTime(o.created_at)}

              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>

                <div>

                  <div style={{ fontWeight: 600 }}>{t("订单号：")}{o.order_no || `#${o.id}`}</div>

                  {o.title && <div style={{ marginTop: 6, fontSize: 14, color: "#334155" }}>{t("标题：")}{o.title}</div>}

                  <div style={{ marginTop: 6, fontSize: 13, color: "#475569" }}>

                    {t("下单商家账号：")}{o.client_username} ｜ {t("商家名称：")}{o.client_display_name}

                  </div>

                  <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>{t("订单创建日期：")}{formatDateTime(o.created_at)}</div>

                </div>

                <span style={{ color: "#666" }}>{statusText[o.status] ?? o.status}</span>

              </div>

              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "130px 1fr", gap: 8, alignItems: "start" }}>

                <div style={{ color: "#64748b", fontSize: 13 }}>{t("状态")}</div>

                <div style={{ fontSize: 14 }}>{statusText[o.status] ?? o.status}</div>

                <div style={{ color: "#64748b", fontSize: 13 }}>{t("视频数量/积分")}</div>
                <div style={{ fontSize: 14 }}>
                  <div style={{ marginBottom: 4 }}>
                    {t("视频数量：")}{o.task_count || "-"} {t("条")}
                  </div>
                  <div>
                    {t("金额：")}
                    <span style={{ fontWeight: 600, color: "var(--xt-accent)" }}>
                      {hallMarketOrderTotalPoints(o)} {t("积分")}
                    </span>
                    <span style={{ color: "#64748b", marginLeft: 4 }}>
                      （{t("单套")} {o.reward_points} {t("积分")} × {t("视频数量：")} {hallMarketOrderTaskCount(o)}）
                    </span>
                  </div>
                </div>

                <div style={{ color: "#64748b", fontSize: 13 }}>{t("发布方式")}</div>

                <div style={{ fontSize: 14 }}>{publishMethodText[String(o.publish_method || "client_self_publish")] || publishMethodText.client_self_publish}</div>

                <div style={{ color: "#64748b", fontSize: 13 }}>{t("备注")}</div>

                <div style={{ fontSize: 14 }}>{o.voice_note?.trim() ? o.voice_note : "—"}</div>

              </div>

              {renderSkuInfo(o, t)}

              {renderTierStandards(String(o.tier || ""), t)}

              {renderVoiceEntry(o, t)}

              <p style={{ marginTop: 8, fontSize: 14 }}>

                <button

                  type="button"

                  onClick={() => {

                    setLinksModalLinks(o.work_links);

                    setLinksModalOpen(true);

                  }}

                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #dbe1ea", background: "#fff", cursor: "pointer" }}

                >

                  {t("查看链接")}

                </button>

              </p>

              {String(o.publish_link || "").trim() ? (
                <p style={{ marginTop: 6, fontSize: 14 }}>
                  {t("发布链接：")}
                  <a href={String(o.publish_link)} target="_blank" rel="noreferrer" style={{ marginLeft: 6 }}>
                    {t("查看")}
                  </a>
                </p>
              ) : null}

              {String(o.publish_method || "") === "influencer_publish_with_cart" && o.status === "completed" && !String(o.publish_link || "").trim() ? (
                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <input
                    type="url"
                    value={publishDraft[o.id] || ""}
                    onChange={(e) => setPublishDraft((p) => ({ ...p, [o.id]: e.target.value }))}
                    placeholder={t("发布链接（TikTok/TAP）")}
                    style={{ flex: 1, minWidth: 220, padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
                  />
                  <button
                    type="button"
                    disabled={!!publishing[o.id]}
                    onClick={() => void submitPublishLink(o.id)}
                    style={{ padding: "8px 16px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: 8, cursor: publishing[o.id] ? "not-allowed" : "pointer" }}
                  >
                    {publishing[o.id] ? t("提交中...") : t("提交发布链接")}
                  </button>
                </div>
              ) : null}

              {o.status === "completed" && influencerEditId === o.id && (

                <div style={{ marginTop: 10 }}>

                  {influencerEditDraft.map((line, idx) => (

                    <div key={idx} style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>

                      <input

                        value={line}

                        onChange={(e) => {

                          const v = e.target.value;

                          setInfluencerEditDraft((prev) => prev.map((p, i) => (i === idx ? v : p)));

                        }}

                        placeholder="https://..."

                        style={{ flex: 1, minWidth: 200, padding: "6px 8px", borderRadius: 8, border: "1px solid #dbe1ea" }}

                      />

                      <button

                        type="button"

                        onClick={() => setInfluencerEditDraft((prev) => prev.filter((_, i) => i !== idx))}

                        style={{ padding: "4px 8px", border: "1px solid #fecaca", borderRadius: 8, background: "#fff", cursor: "pointer", color: "#b91c1c" }}

                      >

                        ×

                      </button>

                    </div>

                  ))}

                  <button type="button" onClick={() => setInfluencerEditDraft((prev) => [...prev, ""])} style={{ padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#f8fafc", cursor: "pointer" }}>

                    {t("+ 新增链接")}

                  </button>

                  <div style={{ marginTop: 8 }}>

                    <button

                      type="button"

                      onClick={() => saveInfluencerWorkLinks(o.id)}

                      disabled={savingInfluencerLinks}

                      style={{ padding: "8px 16px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: 8, cursor: savingInfluencerLinks ? "not-allowed" : "pointer", marginRight: 8 }}

                    >

                      {savingInfluencerLinks ? t("保存中...") : t("保存链接")}

                    </button>

                    <button type="button" onClick={() => setInfluencerEditId(null)} style={{ padding: "8px 16px", border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer" }}>

                      {t("取消")}

                    </button>

                  </div>

                </div>

              )}

              {o.status === "completed" && influencerEditId !== o.id && completeId !== o.id && (

                <button

                  type="button"

                  onClick={() => {

                    setInfluencerEditId(o.id);

                    const base = o.work_links.length ? [...o.work_links] : [""];

                    setInfluencerEditDraft(base.length ? base : [""]);

                  }}

                  style={{ marginTop: 8, padding: "6px 12px", borderRadius: 8, border: "1px solid #dbe1ea", background: "#fff", cursor: "pointer" }}

                >

                  {t("编辑交付链接")}

                </button>

              )}

              {o.status === "claimed" && (

                <div style={{ marginTop: 12 }}>

                  {completeId === o.id ? (

                    <div>

                      {workLinkRows.map((line, idx) => (

                        <div key={idx} style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>

                          <input

                            type="url"

                            value={line}

                            onChange={(e) => {

                              const v = e.target.value;

                              setWorkLinkRows((prev) => prev.map((p, i) => (i === idx ? v : p)));

                            }}

                            placeholder="https://..."

                            style={{ flex: 1, minWidth: 200, padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}

                          />

                          <button

                            type="button"

                            onClick={() => setWorkLinkRows((prev) => prev.filter((_, i) => i !== idx))}

                            style={{ padding: "4px 8px", border: "1px solid #fecaca", borderRadius: 8, background: "#fff", cursor: "pointer", color: "#b91c1c" }}

                          >

                            ×

                          </button>

                        </div>

                      ))}

                      <button type="button" onClick={() => setWorkLinkRows((prev) => [...prev, ""])} style={{ padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#f8fafc", cursor: "pointer", marginBottom: 8 }}>

                        {t("+ 新增链接")}

                      </button>

                      <button type="button" onClick={handleComplete} style={{ padding: "8px 16px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", marginTop: 8 }}>

                        {t("确认提交")}

                      </button>

                      <button

                        type="button"

                        onClick={() => {

                          setCompleteId(null);

                          setWorkLinkRows([""]);

                        }}

                        style={{ marginLeft: 8, padding: "8px 16px", border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer", marginTop: 8 }}

                      >

                        {t("取消")}

                      </button>

                    </div>

                  ) : (

                    <button

                      type="button"

                      onClick={() => {

                        setCompleteId(o.id);

                        setWorkLinkRows([""]);

                        setInfluencerEditId(null);

                      }}

                      style={{ padding: "8px 16px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}

                    >

                      {t("完成并上传链接")}

                    </button>

                  )}

                </div>

              )}

            </div>

          ))}

          {myList.length === 0 && (
            <div className="xt-inf-empty xt-inf-card">
              <div className="xt-inf-empty-icon" aria-hidden>
                🗂️
              </div>
              <div>{t("暂无我的领单记录")}</div>
            </div>
          )}

        </div>

      )}

      <WorkLinksModal open={linksModalOpen} onClose={() => setLinksModalOpen(false)} links={linksModalLinks} title={t("交付链接")} />

    </div>

  );

}

