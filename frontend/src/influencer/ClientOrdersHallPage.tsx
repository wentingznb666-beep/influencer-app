import { useState, useEffect, useRef, useMemo, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import * as api from "../influencerApi";
import * as employeeApi from "../employeeApi";

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

type OfflineTypeId = employeeApi.EmployeeVideoOrderTypeId;
type OfflinePhase = employeeApi.EmployeeVideoOrderPhase;
type OfflineOrder = employeeApi.EmployeeVideoOrder;
type OfflineMonthlyDraft = { batchNo: string; videoCount: string; urls: string };
type UnifiedStatusFilter =
  | ""
  | "open"
  | "claimed"
  | "completed"
  | "cancelled"
  | "offline_unassigned"
  | OfflinePhase;
type GradedUnifiedOrder = (OpenOrder & { _source: "graded"; _list_kind: "open" }) | (MyOrder & { _source: "graded"; _list_kind: "mine" });
type OfflineUnifiedOrder = OfflineOrder & { _source: "offline"; _list_kind: "open" | "mine" };
type UnifiedOrder = GradedUnifiedOrder | OfflineUnifiedOrder;



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


function formatDateKey(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getCreatedTime(value?: string | null): number {
  const time = new Date(value || "").getTime();
  return Number.isFinite(time) ? time : 0;
}

function matchesDateFilter(value: string | null | undefined, filter: DateFilterState): boolean {
  if (filter.mode === "all") return true;
  const day = formatDateKey(value);
  if (!day) return false;
  if (filter.mode === "day") return !filter.day || day === filter.day;
  if (filter.mode === "range") {
    if (filter.startDate && day < filter.startDate) return false;
    if (filter.endDate && day > filter.endDate) return false;
    return true;
  }
  return true;
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

  const [typeFilter, setTypeFilter] = useState<"all" | "graded_video" | OfflineTypeId>("all");
  const [offlineList, setOfflineList] = useState<OfflineOrder[]>([]);
  const [offlineDraftUrls, setOfflineDraftUrls] = useState<Record<number, string>>({});
  const [offlinePublishDraft, setOfflinePublishDraft] = useState<Record<number, string>>({});
  const [offlineMonthlyDraft, setOfflineMonthlyDraft] = useState<Record<number, OfflineMonthlyDraft>>({});
  const [offlineActionLoading, setOfflineActionLoading] = useState<Record<string, boolean>>({});
  const [offlineActionError, setOfflineActionError] = useState<Record<number, string>>({});
  const [offlineActionOk, setOfflineActionOk] = useState<Record<number, string>>({});

  const [completeId, setCompleteId] = useState<number | null>(null);

  const [workLinkRows, setWorkLinkRows] = useState<string[]>([""]);

  const [linksModalOpen, setLinksModalOpen] = useState(false);

  const [linksModalLinks, setLinksModalLinks] = useState<string[]>([]);

  const [influencerEditId, setInfluencerEditId] = useState<number | null>(null);

  const [influencerEditDraft, setInfluencerEditDraft] = useState<string[]>([]);

  const [savingInfluencerLinks, setSavingInfluencerLinks] = useState(false);

  const [gradedSearch, setGradedSearch] = useState("");
  const [gradedStatusFilter, setGradedStatusFilter] = useState<UnifiedStatusFilter>("");
  const [gradedDateFilter, setGradedDateFilter] = useState<DateFilterState>({ mode: "all", day: "", startDate: "", endDate: "" });
  const [gradedSortMode, setGradedSortMode] = useState<
    "created_desc" | "created_asc" | "amount_desc" | "amount_asc" | "status_asc" | "status_desc"
  >("created_desc");

  const [publishDraft, setPublishDraft] = useState<Record<number, string>>({});

  const [publishing, setPublishing] = useState<Record<number, boolean>>({});

  const hasInitLoadedRef = useRef(false);

  const offlineTypeText = useMemo(
    () =>
      ({
        high_quality_custom_video: t("② 高质量视频"),
        monthly_package: t("③ 包月合作套餐"),
        creator_review_video: t("④ Creator带货测评"),
      }) as Record<OfflineTypeId, string>,
    [t]
  );

  const offlinePhaseText = useMemo(
    () =>
      ({
        created: t("已创建"),
        paid: t("已付款"),
        assigned: t("已接单"),
        in_progress: t("制作中"),
        submitted: t("已提交"),
        review_pending: t("待审核"),
        review_rejected: t("审核驳回"),
        approved_to_publish: t("可发布"),
        published: t("已发布"),
        delivered: t("已交付"),
        completed: t("已完成"),
        rejected: t("已驳回"),
      }) as Record<OfflinePhase, string>,
    [t]
  );

  function typeBadgeStyle(kind: "graded" | "hq" | "monthly" | "review"): CSSProperties {
    const base: CSSProperties = { padding: "2px 8px", borderRadius: 999, fontSize: 12, fontWeight: 800, border: "1px solid #dbe1ea" };
    if (kind === "graded") return { ...base, background: "#f1f5f9", color: "#0f172a" };
    if (kind === "hq") return { ...base, background: "#dcfce7", color: "#166534", borderColor: "#bbf7d0" };
    if (kind === "monthly") return { ...base, background: "#ffedd5", color: "#9a3412", borderColor: "#fed7aa" };
    return { ...base, background: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" };
  }



  /**

   * 加载大厅与我的订单。

   */

  const load = async (params?: {
    typeFilter?: "all" | "graded_video" | OfflineTypeId;
  }) => {

    setLoading(true);

    setError(null);

    try {

      const nextType = params?.typeFilter ?? typeFilter;
      const [openRes, myRes, offlineRes] = await Promise.all([

        api.getMarketOrders(),

        api.getMyMarketOrders(),

        employeeApi.getEmployeeVideoOrders({
          ...(nextType !== "all" && nextType !== "graded_video" ? { type: nextType } : {}),
          limit: 200,
        }),

      ]);

      setOpenList(openRes.list || []);

      const myRows = (myRes.list || []) as MyOrder[];

      setMyList(myRows.map((r) => ({ ...r, work_links: normalizeWorkLinks(r.work_links) })));

      setOfflineList((offlineRes.list || []) as OfflineOrder[]);

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
      claimed: t("已接单/进行中"),
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

  const handleOfflineClaim = async (orderId: number) => {
    setError(null);
    setOfflineActionError((p) => ({ ...p, [orderId]: "" }));
    setOfflineActionOk((p) => ({ ...p, [orderId]: "" }));
    setOfflineActionLoading((p) => ({ ...p, [`${orderId}:claim`]: true }));
    try {
      await employeeApi.claimEmployeeVideoOrder(orderId);
      setOfflineActionOk((p) => ({ ...p, [orderId]: t("接单成功") }));
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("接单失败");
      setError(msg);
      setOfflineActionError((p) => ({ ...p, [orderId]: msg }));
    } finally {
      setOfflineActionLoading((p) => ({ ...p, [`${orderId}:claim`]: false }));
    }
  };

  const handleOfflineMarkPaid = async (orderId: number) => {
    setError(null);
    setOfflineActionError((p) => ({ ...p, [orderId]: "" }));
    setOfflineActionOk((p) => ({ ...p, [orderId]: "" }));
    setOfflineActionLoading((p) => ({ ...p, [`${orderId}:mark-paid`]: true }));
    try {
      await employeeApi.markEmployeeVideoOrderPaid(orderId);
      setOfflineActionOk((p) => ({ ...p, [orderId]: t("已标记付款并进入制作中") }));
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("操作失败");
      setError(msg);
      setOfflineActionError((p) => ({ ...p, [orderId]: msg }));
    } finally {
      setOfflineActionLoading((p) => ({ ...p, [`${orderId}:mark-paid`]: false }));
    }
  };

  const handleOfflineSubmitProof = async (orderId: number) => {
    const raw = String(offlineDraftUrls[orderId] || "");
    const urls = raw
      .split(/\r?\n/g)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
    if (!urls.length) {
      const msg = t("请至少填写一条交付链接。");
      setError(msg);
      setOfflineActionError((p) => ({ ...p, [orderId]: msg }));
      return;
    }
    setError(null);
    setOfflineActionError((p) => ({ ...p, [orderId]: "" }));
    setOfflineActionOk((p) => ({ ...p, [orderId]: "" }));
    setOfflineActionLoading((p) => ({ ...p, [`${orderId}:submit-proof`]: true }));
    try {
      await employeeApi.submitEmployeeVideoOrderProof(orderId, urls);
      setOfflineDraftUrls((p) => ({ ...p, [orderId]: "" }));
      setOfflineActionOk((p) => ({ ...p, [orderId]: t("已提交交付") }));
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("提交失败");
      setError(msg);
      setOfflineActionError((p) => ({ ...p, [orderId]: msg }));
    } finally {
      setOfflineActionLoading((p) => ({ ...p, [`${orderId}:submit-proof`]: false }));
    }
  };

  const handleOfflinePublish = async (orderId: number) => {
    const link = String(offlinePublishDraft[orderId] || "").trim();
    if (!link) {
      const msg = t("请先填写发布链接。");
      setError(msg);
      setOfflineActionError((p) => ({ ...p, [orderId]: msg }));
      return;
    }
    setError(null);
    setOfflineActionError((p) => ({ ...p, [orderId]: "" }));
    setOfflineActionOk((p) => ({ ...p, [orderId]: "" }));
    setOfflineActionLoading((p) => ({ ...p, [`${orderId}:publish`]: true }));
    try {
      await employeeApi.publishEmployeeVideoOrder(orderId, link);
      setOfflinePublishDraft((p) => ({ ...p, [orderId]: "" }));
      setOfflineActionOk((p) => ({ ...p, [orderId]: t("已提交发布链接") }));
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("提交失败");
      setError(msg);
      setOfflineActionError((p) => ({ ...p, [orderId]: msg }));
    } finally {
      setOfflineActionLoading((p) => ({ ...p, [`${orderId}:publish`]: false }));
    }
  };

  const handleMonthlySubmitBatch = async (orderId: number) => {
    const draft = offlineMonthlyDraft[orderId] || { batchNo: "1", videoCount: "1", urls: "" };
    const bnRaw = Number(draft.batchNo);
    const vcRaw = Number(draft.videoCount);
    const bn = Math.floor(bnRaw);
    const vc = Math.floor(vcRaw);
    if (!Number.isFinite(bnRaw) || bn < 1) {
      const msg = t("请输入有效批次号（>= 1）。");
      setError(msg);
      setOfflineActionError((p) => ({ ...p, [orderId]: msg }));
      return;
    }
    if (!Number.isFinite(vcRaw) || vc < 1) {
      const msg = t("请输入有效数量（>= 1）。");
      setError(msg);
      setOfflineActionError((p) => ({ ...p, [orderId]: msg }));
      return;
    }
    const urls = String(draft.urls || "")
      .split(/\r?\n/g)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
    if (!urls.length) {
      const msg = t("请至少填写一条交付链接。");
      setError(msg);
      setOfflineActionError((p) => ({ ...p, [orderId]: msg }));
      return;
    }
    setError(null);
    setOfflineActionError((p) => ({ ...p, [orderId]: "" }));
    setOfflineActionOk((p) => ({ ...p, [orderId]: "" }));
    setOfflineActionLoading((p) => ({ ...p, [`${orderId}:monthly-submit`]: true }));
    try {
      await employeeApi.submitEmployeeMonthlyBatch(orderId, { batch_no: bn, video_count: vc, video_urls: urls });
      setOfflineMonthlyDraft((p) => ({ ...p, [orderId]: { ...draft, batchNo: String(bn + 1), urls: "" } }));
      setOfflineActionOk((p) => ({ ...p, [orderId]: t("已提交批次交付") }));
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("提交失败");
      setError(msg);
      setOfflineActionError((p) => ({ ...p, [orderId]: msg }));
    } finally {
      setOfflineActionLoading((p) => ({ ...p, [`${orderId}:monthly-submit`]: false }));
    }
  };

  const gradedUnified = useMemo((): GradedUnifiedOrder[] => {
    const open = openList.map((o) => ({ ...o, _source: "graded" as const, _list_kind: "open" as const }));
    const mine = myList.map((o) => ({ ...o, _source: "graded" as const, _list_kind: "mine" as const }));
    return [...open, ...mine];
  }, [openList, myList]);

  const offlineUnified = useMemo(
    (): OfflineUnifiedOrder[] =>
      offlineList.map((o) => ({
        ...o,
        _source: "offline" as const,
        _list_kind: o.assigned_employee_id ? ("mine" as const) : ("open" as const),
      })),
    [offlineList],
  );

  const unifiedOrders = useMemo((): UnifiedOrder[] => {
    if (typeFilter === "graded_video") return gradedUnified;
    if (typeFilter === "all") return [...gradedUnified, ...offlineUnified];
    return offlineUnified.filter((o) => o.type_id === typeFilter);
  }, [gradedUnified, offlineUnified, typeFilter]);

  function statusBadgeStyle(status: string): CSSProperties {
    const base: CSSProperties = {
      padding: "2px 8px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 800,
      border: "1px solid #dbe1ea",
      background: "#f8fafc",
      color: "#334155",
      whiteSpace: "nowrap",
    };
    if (status === "open") return { ...base, background: "rgba(59,130,246,0.10)", borderColor: "rgba(59,130,246,0.30)", color: "#1d4ed8" };
    if (status === "claimed") return { ...base, background: "rgba(15,118,110,0.10)", borderColor: "rgba(15,118,110,0.30)", color: "#0f766e" };
    if (status === "completed") return { ...base, background: "rgba(234,88,12,0.10)", borderColor: "rgba(234,88,12,0.30)", color: "var(--xt-accent)" };
    if (status === "cancelled") return { ...base, background: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.30)", color: "#b91c1c" };
    return base;
  }

  const gradedFilteredSorted = useMemo((): UnifiedOrder[] => {
    const q = gradedSearch.trim();
    const filtered = unifiedOrders.filter((o) => {
      if (gradedStatusFilter) {
        if (o._source === "graded" && String(o.status || "") !== gradedStatusFilter) return false;
        if (gradedStatusFilter === "offline_unassigned") {
          if (o._source !== "offline" || o._list_kind !== "open") return false;
        } else if (o._source === "offline" && String(o.phase || "") !== gradedStatusFilter) {
          return false;
        }
      }
      if (!matchesDateFilter(o.created_at, gradedDateFilter)) return false;
      if (!q) return true;
      const hay =
        o._source === "graded"
          ? `${o.order_no || ""} ${o.title || ""} ${o.client_username || ""} ${o.client_display_name || ""}`.toLowerCase()
          : `${o.title || ""} ${o.client_username || ""} VO-${o.id} ${offlineTypeText[o.type_id] || ""}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });

    const statusRank = (s: string) => {
      if (s === "offline_unassigned") return 1;
      if (s === "open") return 1;
      if (s === "claimed") return 2;
      if (s === "completed") return 3;
      if (s === "cancelled") return 4;
      if (s === "assigned") return 2;
      if (s === "in_progress") return 3;
      if (s === "review_pending") return 4;
      if (s === "review_rejected") return 5;
      if (s === "approved_to_publish") return 6;
      if (s === "published") return 7;
      if (s === "delivered") return 8;
      return 9;
    };

    const getUnifiedStatus = (order: UnifiedOrder) =>
      order._source === "graded" ? String(order.status || "") : order._list_kind === "open" ? "offline_unassigned" : String(order.phase || "");

    const getUnifiedSortKey = (order: UnifiedOrder) =>
      order._source === "graded" ? String(order.order_no || `#${order.id}`) : `VO-${order.id}`;

    const byCreated = (a: UnifiedOrder, b: UnifiedOrder) => getCreatedTime(a.created_at) - getCreatedTime(b.created_at);

    const byAmount = (a: UnifiedOrder, b: UnifiedOrder) => {
      const pa = a._source === "graded" ? hallMarketOrderTotalPoints(a) : Number(a.amount_thb || 0);
      const pb = b._source === "graded" ? hallMarketOrderTotalPoints(b) : Number(b.amount_thb || 0);
      return pa - pb;
    };

    const byStatus = (a: UnifiedOrder, b: UnifiedOrder) => statusRank(getUnifiedStatus(a)) - statusRank(getUnifiedStatus(b));

    const sorted = [...filtered];
    if (gradedSortMode === "created_desc") sorted.sort((a, b) => byCreated(b, a) || getUnifiedSortKey(a).localeCompare(getUnifiedSortKey(b)));
    if (gradedSortMode === "created_asc") sorted.sort((a, b) => byCreated(a, b) || getUnifiedSortKey(a).localeCompare(getUnifiedSortKey(b)));
    if (gradedSortMode === "amount_desc") sorted.sort((a, b) => byAmount(b, a) || byCreated(b, a));
    if (gradedSortMode === "amount_asc") sorted.sort((a, b) => byAmount(a, b) || byCreated(b, a));
    if (gradedSortMode === "status_asc") sorted.sort((a, b) => byStatus(a, b) || byCreated(b, a) || getUnifiedSortKey(a).localeCompare(getUnifiedSortKey(b)));
    if (gradedSortMode === "status_desc") sorted.sort((a, b) => byStatus(b, a) || byCreated(b, a) || getUnifiedSortKey(a).localeCompare(getUnifiedSortKey(b)));
    return sorted;
  }, [unifiedOrders, gradedSearch, gradedStatusFilter, gradedDateFilter, gradedSortMode, offlineTypeText]);

  const renderUnifiedOrderCard = (o: UnifiedOrder) => {
    if (o._source === "graded") {
      return (
        <div key={`${o._source}-${o._list_kind}-${o.id}`} style={{ padding: 16, background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={statusBadgeStyle(String(o.status || ""))}>{statusText[String(o.status || "")] ?? String(o.status || "")}</span>
              <span style={typeBadgeStyle("graded")}>{t("① 分级视频（A/B/C）")}</span>
              <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 12, fontWeight: 800, border: "1px solid #dbe1ea", background: "#f1f5f9", color: "#0f172a" }}>
                {t("订单日期：")}
                {formatDateTime(o.created_at)}
              </span>
            </div>
            <span style={{ color: "#166534", fontWeight: 700 }}>
              +{hallMarketOrderTotalPoints(o)} {t("积分")}
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700 }}>
                {t("订单号：")}
                {o.order_no || `#${o.id}`}
              </div>
              {o.title && (
                <div style={{ marginTop: 6, fontSize: 14, color: "#334155" }}>
                  {t("标题：")}
                  {o.title}
                </div>
              )}
              <div style={{ marginTop: 6, fontSize: 13, color: "#475569" }}>
                {t("下单商家账号：")}
                {o.client_username} ｜ {t("商家名称：")}
                {o.client_display_name}
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>
                {t("订单创建日期：")}
                {formatDateTime(o.created_at)}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "130px 1fr", gap: 8, alignItems: "start" }}>
            <div style={{ color: "#64748b", fontSize: 13 }}>{t("状态")}</div>
            <div style={{ fontSize: 14 }}>{statusText[String(o.status || "")] ?? String(o.status || "")}</div>

            <div style={{ color: "#64748b", fontSize: 13 }}>{t("视频数量/积分")}</div>
            <div style={{ fontSize: 14 }}>
              <div style={{ marginBottom: 4 }}>
                {t("视频数量：")}
                {o.task_count || "-"} {t("条")}
              </div>
              <div>
                {t("金额：")}
                <span style={{ fontWeight: 700, color: "var(--xt-accent)" }}>
                  {hallMarketOrderTotalPoints(o)} {t("积分")}
                </span>
                <span style={{ color: "#64748b", marginLeft: 4 }}>
                  （{t("单套")} {o.reward_points} {t("积分")} × {t("视频数量：")} {hallMarketOrderTaskCount(o)}）
                </span>
              </div>
            </div>

            <div style={{ color: "#64748b", fontSize: 13 }}>{t("发布方式")}</div>
            <div style={{ fontSize: 14 }}>
              {publishMethodText[String(o.publish_method || "client_self_publish")] || publishMethodText.client_self_publish}
            </div>

            <div style={{ color: "#64748b", fontSize: 13 }}>{t("备注")}</div>
            <div style={{ fontSize: 14 }}>{o.voice_note?.trim() ? o.voice_note : "—"}</div>
          </div>

          {renderSkuInfo(o, t)}
          {renderTierStandards(String(o.tier || ""), t)}
          {renderVoiceEntry(o, t)}

          {o._list_kind === "open" ? (
            <button
              type="button"
              onClick={() => handleClaim(o.id)}
              style={{ marginTop: 10, padding: "8px 16px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
            >
              {t("领取")}
            </button>
          ) : (
            <>
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

                  <button
                    type="button"
                    onClick={() => setInfluencerEditDraft((prev) => [...prev, ""])}
                    style={{ padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#f8fafc", cursor: "pointer" }}
                  >
                    {t("+ 新增链接")}
                  </button>

                  <div style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => saveInfluencerWorkLinks(o.id)}
                      disabled={savingInfluencerLinks}
                      style={{
                        padding: "8px 16px",
                        background: "var(--xt-accent)",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        cursor: savingInfluencerLinks ? "not-allowed" : "pointer",
                        marginRight: 8,
                      }}
                    >
                      {savingInfluencerLinks ? t("保存中...") : t("保存链接")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setInfluencerEditId(null)}
                      style={{ padding: "8px 16px", border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer" }}
                    >
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
                      <button
                        type="button"
                        onClick={() => setWorkLinkRows((prev) => [...prev, ""])}
                        style={{ padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#f8fafc", cursor: "pointer", marginBottom: 8 }}
                      >
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
            </>
          )}
        </div>
      );
    }

    return (
      <div key={`${o._source}-${o._list_kind}-${o.id}`} style={{ padding: 14, background: "#fff", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 800, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span>VO-{o.id}</span>
              {o.type_id === "high_quality_custom_video" && <span style={typeBadgeStyle("hq")}>{offlineTypeText[o.type_id]}</span>}
              {o.type_id === "monthly_package" && <span style={typeBadgeStyle("monthly")}>{offlineTypeText[o.type_id]}</span>}
              {o.type_id === "creator_review_video" && <span style={typeBadgeStyle("review")}>{offlineTypeText[o.type_id]}</span>}
              <span style={statusBadgeStyle(o._list_kind === "open" ? "open" : "claimed")}>{o._list_kind === "open" ? t("待接单") : offlinePhaseText[o.phase]}</span>
              <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 12, fontWeight: 800, border: "1px solid #dbe1ea", background: "#f1f5f9", color: "#0f172a" }}>
                {t("订单日期：")}
                {formatDateTime(o.created_at)}
              </span>
            </div>
            <div style={{ marginTop: 6, fontSize: 14, color: "#334155" }}>{o.title}</div>
            <div style={{ marginTop: 6, fontSize: 13, color: "#475569" }}>
              {t("商家")}: {o.client_username} · {t("金额")}: {Number(o.amount_thb || 0).toFixed(2)} ฿ · {t("状态")}: {o._list_kind === "open" ? t("待接单") : offlinePhaseText[o.phase]}
            </div>

            {offlineActionError[o.id] && <div style={{ marginTop: 8, color: "#b91c1c", fontSize: 13, fontWeight: 700 }}>{offlineActionError[o.id]}</div>}
            {offlineActionOk[o.id] && <div style={{ marginTop: 8, color: "#166534", fontSize: 13, fontWeight: 700 }}>{offlineActionOk[o.id]}</div>}

            {Array.isArray(o.proof_links) && o.proof_links.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 13, color: "#334155" }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>{t("交付链接")}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {o.proof_links.slice(0, 20).map((x: any, idx: number) => {
                    const url = String((typeof x === "string" ? x : x?.url) || "").trim();
                    if (!url) return null;
                    return (
                      <a key={`${o.id}-proof-${idx}`} href={url} target="_blank" rel="noreferrer" style={{ color: "var(--xt-accent)", wordBreak: "break-all" }}>
                        {url}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {o._list_kind === "open" ? (
              <button
                type="button"
                onClick={() => void handleOfflineClaim(o.id)}
                style={{ padding: "6px 12px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
              >
                {t("接单")}
              </button>
            ) : (
              <>
                {o.payment_status !== "paid" && (
                  <button
                    type="button"
                    disabled={!!offlineActionLoading[`${o.id}:mark-paid`]}
                    onClick={() => void handleOfflineMarkPaid(o.id)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid #f59e0b",
                      background: "#fff7ed",
                      color: "#9a3412",
                      cursor: "pointer",
                      opacity: offlineActionLoading[`${o.id}:mark-paid`] ? 0.6 : 1,
                    }}
                  >
                    {offlineActionLoading[`${o.id}:mark-paid`] ? t("处理中…") : t("标记已付款")}
                  </button>
                )}

                {o.type_id === "monthly_package" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                    {Array.isArray(o.batch_payload) && o.batch_payload.length > 0 && (
                      <div style={{ width: 320, maxWidth: "80vw", padding: 10, borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc" }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>{t("批次记录")}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {o.batch_payload
                            .slice()
                            .sort((a: any, b: any) => Number(a?.batch_no || 0) - Number(b?.batch_no || 0))
                            .slice(-10)
                            .map((x: any, idx: number) => {
                              const bn = Number(x?.batch_no || 0);
                              const vc = Number(x?.video_count || 0);
                              const st = String(x?.status || "");
                              const submittedAt = String(x?.submitted_at || "").trim();
                              const links = Array.isArray(x?.proof_links) ? x.proof_links : [];
                              const batchStatusText =
                                st === "pending_acceptance" ? t("待验收") : st === "accepted" ? t("已验收") : st === "settled" ? t("已结算") : st || t("未知");
                              return (
                                <div key={`${o.id}-batch-${bn}-${idx}`} style={{ fontSize: 12, color: "#334155" }}>
                                  <div style={{ fontWeight: 700 }}>
                                    {t("批次")} {bn || "-"} · {batchStatusText} · {t("数量")}: {Number.isFinite(vc) && vc > 0 ? vc : "-"}
                                    {submittedAt ? <span style={{ color: "#64748b", fontWeight: 500 }}> · {submittedAt}</span> : null}
                                  </div>
                                  {links.length > 0 && (
                                    <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 4 }}>
                                      {links.slice(0, 5).map((u: any, i: number) => {
                                        const url = String(u || "").trim();
                                        if (!url) return null;
                                        return (
                                          <a key={`${o.id}-batch-${bn}-link-${i}`} href={url} target="_blank" rel="noreferrer" style={{ color: "var(--xt-accent)", wordBreak: "break-all" }}>
                                            {url}
                                          </a>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <input
                        type="number"
                        value={((offlineMonthlyDraft[o.id]?.batchNo ??
                          String(
                            Math.max(
                              0,
                              ...((Array.isArray(o.batch_payload) ? o.batch_payload : [])
                                .map((x: any) => Number(x?.batch_no || 0))
                                .filter((n: number) => Number.isFinite(n) && n > 0)),
                            ) + 1,
                          )) as any)}
                        onChange={(e) => setOfflineMonthlyDraft((p) => ({ ...p, [o.id]: { ...(p[o.id] || { batchNo: "1", videoCount: "1", urls: "" }), batchNo: e.target.value } }))}
                        style={{ width: 96, padding: "6px 10px", borderRadius: 8, border: "1px solid #dbe1ea" }}
                        placeholder={t("批次号")}
                        min={1}
                      />
                      <input
                        type="number"
                        value={(offlineMonthlyDraft[o.id]?.videoCount ?? "1") as any}
                        onChange={(e) => setOfflineMonthlyDraft((p) => ({ ...p, [o.id]: { ...(p[o.id] || { batchNo: "1", videoCount: "1", urls: "" }), videoCount: e.target.value } }))}
                        style={{ width: 110, padding: "6px 10px", borderRadius: 8, border: "1px solid #dbe1ea" }}
                        placeholder={t("数量")}
                        min={1}
                      />
                    </div>
                    <textarea
                      value={offlineMonthlyDraft[o.id]?.urls ?? ""}
                      onChange={(e) => setOfflineMonthlyDraft((p) => ({ ...p, [o.id]: { ...(p[o.id] || { batchNo: "1", videoCount: "1", urls: "" }), urls: e.target.value } }))}
                      placeholder={t("交付链接（多条用换行分隔）")}
                      rows={3}
                      style={{ width: 320, maxWidth: "80vw", padding: "8px 10px", borderRadius: 10, border: "1px solid #dbe1ea", resize: "vertical" }}
                    />
                    <button
                      type="button"
                      disabled={o.payment_status !== "paid" || !!offlineActionLoading[`${o.id}:monthly-submit`]}
                      onClick={() => void handleMonthlySubmitBatch(o.id)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #dbe1ea",
                        background: o.payment_status !== "paid" ? "#f8fafc" : "#fff",
                        cursor: o.payment_status !== "paid" ? "not-allowed" : "pointer",
                        opacity: offlineActionLoading[`${o.id}:monthly-submit`] ? 0.6 : 1,
                      }}
                    >
                      {offlineActionLoading[`${o.id}:monthly-submit`] ? t("提交中…") : t("提交批次")}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                    {(o.phase === "assigned" || o.phase === "in_progress" || o.phase === "review_rejected") && (
                      <textarea
                        value={offlineDraftUrls[o.id] ?? ""}
                        onChange={(e) => setOfflineDraftUrls((p) => ({ ...p, [o.id]: e.target.value }))}
                        placeholder={t("交付链接（多条用换行分隔）")}
                        rows={3}
                        style={{ width: 320, maxWidth: "80vw", padding: "8px 10px", borderRadius: 10, border: "1px solid #dbe1ea", resize: "vertical" }}
                      />
                    )}
                    <button
                      type="button"
                      disabled={!["assigned", "in_progress", "review_rejected"].includes(o.phase) || !!offlineActionLoading[`${o.id}:submit-proof`]}
                      onClick={() => void handleOfflineSubmitProof(o.id)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #dbe1ea",
                        background: !["assigned", "in_progress", "review_rejected"].includes(o.phase) ? "#f8fafc" : "#fff",
                        cursor: !["assigned", "in_progress", "review_rejected"].includes(o.phase) ? "not-allowed" : "pointer",
                        opacity: offlineActionLoading[`${o.id}:submit-proof`] ? 0.6 : 1,
                      }}
                    >
                      {offlineActionLoading[`${o.id}:submit-proof`] ? t("提交中…") : t("提交交付")}
                    </button>
                  </div>
                )}

                {o.type_id === "creator_review_video" && o.phase === "approved_to_publish" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                    <input
                      type="text"
                      value={offlinePublishDraft[o.id] ?? ""}
                      onChange={(e) => setOfflinePublishDraft((p) => ({ ...p, [o.id]: e.target.value }))}
                      placeholder={t("发布链接")}
                      style={{ width: 320, maxWidth: "80vw", padding: "6px 10px", borderRadius: 10, border: "1px solid #dbe1ea" }}
                    />
                    <button
                      type="button"
                      disabled={!!offlineActionLoading[`${o.id}:publish`]}
                      onClick={() => void handleOfflinePublish(o.id)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #dbe1ea",
                        background: "#fff",
                        cursor: "pointer",
                        opacity: offlineActionLoading[`${o.id}:publish`] ? 0.6 : 1,
                      }}
                    >
                      {offlineActionLoading[`${o.id}:publish`] ? t("提交中…") : t("提交发布")}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };





  return (

    <div>

      <h2 style={{ marginTop: 0 }}>{t("视频分级工作台")}</h2>

      <p style={{ color: "#64748b", fontSize: 14, marginBottom: 16 }}>

        {t("统一查看并处理类型1/2/3/4订单，顶部筛选会直接作用于当前统一订单列表。")}

      </p>

      {error && <p style={{ color: "#c00" }}>{error}</p>}

      <div style={{ marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ fontSize: 13, color: "#475569", fontWeight: 700 }}>{t("订单类型")}</div>
        <select
          value={typeFilter}
          onChange={(e) => {
            const next = e.target.value as any;
            setTypeFilter(next);
            load({ typeFilter: next });
          }}
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #dbe1ea", background: "#fff" }}
        >
          <option value="all">{t("全部类型")}</option>
          <option value="graded_video">{t("① 分级视频（A/B/C）")}</option>
          <option value="high_quality_custom_video">{t("② 高质量视频")}</option>
          <option value="monthly_package">{t("③ 包月合作套餐")}</option>
          <option value="creator_review_video">{t("④ Creator带货测评")}</option>
        </select>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, marginTop: 0 }}>{t("统一订单列表")}</h3>
        <div style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            value={gradedSearch}
            onChange={(e) => setGradedSearch(e.target.value)}
            placeholder={t("关键词：订单号/标题/商家（模糊）")}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #dbe1ea", minWidth: 240 }}
          />
          <select
            value={gradedStatusFilter}
            onChange={(e) => {
              const next = (e.target.value as UnifiedStatusFilter) || "";
              setGradedStatusFilter(next);
            }}
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #dbe1ea", background: "#fff" }}
          >
            <option value="">{t("全部状态")}</option>
            <option value="open">{t("待领取（类型1）")}</option>
            <option value="claimed">{t("已接单/进行中（类型1）")}</option>
            <option value="completed">{t("已完成（类型1）")}</option>
            <option value="cancelled">{t("已取消（类型1）")}</option>
            <option value="offline_unassigned">{t("待接单（类型2/3/4）")}</option>
            <option value="assigned">{t("已接单（类型2/3/4）")}</option>
            <option value="in_progress">{t("制作中（类型2/3/4）")}</option>
            <option value="review_pending">{t("待审核（类型2/3/4）")}</option>
            <option value="approved_to_publish">{t("可发布（类型2/3/4）")}</option>
            <option value="delivered">{t("已交付（类型2/3/4）")}</option>
          </select>
          <OrderDateFilter value={gradedDateFilter} onChange={(next) => setGradedDateFilter(next)} />
          <select
            value={gradedSortMode}
            onChange={(e) => setGradedSortMode(e.target.value as any)}
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #dbe1ea", background: "#fff" }}
          >
            <option value="created_desc">{t("创建时间：新→旧")}</option>
            <option value="created_asc">{t("创建时间：旧→新")}</option>
            <option value="amount_desc">{t("金额/积分：高→低")}</option>
            <option value="amount_asc">{t("金额/积分：低→高")}</option>
            <option value="status_asc">{t("状态：待领取→已完成")}</option>
            <option value="status_desc">{t("状态：已完成→待领取")}</option>
          </select>
          <button
            type="button"
            onClick={() => load()}
            style={{ padding: "6px 14px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
          >
            {t("刷新")}
          </button>
        </div>

        {loading ? (
          <p>{t("加载中…")}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {gradedFilteredSorted.map((o) => renderUnifiedOrderCard(o))}

            {gradedFilteredSorted.length === 0 && (
              <div className="xt-inf-empty xt-inf-card" style={{ marginTop: 8 }}>
                <div className="xt-inf-empty-icon" aria-hidden>
                  📋
                </div>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{t("暂无匹配订单，可调整筛选条件或刷新列表")}</div>
                <button type="button" className="xt-accent-btn" onClick={() => load()}>
                  {t("刷新列表")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <WorkLinksModal open={linksModalOpen} onClose={() => setLinksModalOpen(false)} links={linksModalLinks} title={t("交付链接")} />

    </div>

  );

}

