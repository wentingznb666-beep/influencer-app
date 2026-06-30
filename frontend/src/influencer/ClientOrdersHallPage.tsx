import { compactPx } from "../responsive";
import { Fragment, useState, useEffect, useRef, useMemo, type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useLocation } from "react-router-dom";

import * as api from "../influencerApi";
import * as employeeApi from "../employeeApi";
import { useAutoRefresh } from "../hooks/useAutoRefresh";

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

      <div style={{ marginTop: compactPx(8), fontSize: compactPx(13), color: "#334155" }}>

        <div style={{ fontWeight: 700 }}>{t("制作标准")}</div>

        <div style={{ marginTop: compactPx(4) }}>

          <strong>{t("包含配音要求")}</strong>

        </div>

      </div>

    );

  }

  if (tier === "B") {

    return (

      <div style={{ marginTop: compactPx(8), fontSize: compactPx(13), color: "#334155" }}>

        <div style={{ fontWeight: 700 }}>{t("制作标准")}</div>

        <div style={{ marginTop: compactPx(4) }}>{t("包含场景切换 + 特效转场")}</div>

      </div>

    );

  }

  return (

    <div style={{ marginTop: compactPx(8), fontSize: compactPx(13), color: "#334155" }}>

      <div style={{ fontWeight: 700 }}>{t("制作标准")}</div>

      <div style={{ marginTop: compactPx(4) }}>{t("基础功能：背景音乐、文字贴纸")}</div>

    </div>

  );

}

type GradedTier = "A" | "B" | "C";

function normalizeGradedTier(value: unknown): GradedTier {
  const v = String(value || "").toUpperCase();
  if (v === "A" || v === "B" || v === "C") return v;
  return "C";
}

const GRADED_TIER_BENEFITS: Record<GradedTier, { points: number; th: string; zh: string; en: string }> = {
  C: {
    points: 20,
    th: "ระดับ C: ใช้ 20 คะแนน, มีเพลงประกอบ + สติกเกอร์ข้อความ",
    zh: "C类：消耗20积分，包含背景音乐、文字贴纸",
    en: "Tier C: 20 points, background music + text stickers",
  },
  B: {
    points: 40,
    th: "ระดับ B: ใช้ 40 คะแนน, มีระดับ C + เปลี่ยนฉาก + ทรานซิชันเอฟเฟกต์",
    zh: "B类：消耗40积分，含C类功能+场景切换+特效转场",
    en: "Tier B: 40 points, Tier C + scene switching + effect transitions",
  },
  A: {
    points: 60,
    th: "ระดับ A: ใช้ 60 คะแนน, มีระดับ B + บริการพากย์เสียง",
    zh: "A类：消耗60积分，含B类功能+配音服务",
    en: "Tier A: 60 points, Tier B + voice-over service",
  },
};

function tierBadgeStyle(tierOrValue: unknown): CSSProperties {
  const tier = normalizeGradedTier(tierOrValue);
  const base: CSSProperties = { padding: "2px 8px", borderRadius: compactPx(999), fontSize: compactPx(12), fontWeight: 900, border: "1px solid transparent" };
  if (tier === "A") return { ...base, background: "rgba(239,68,68,0.12)", color: "#b91c1c", borderColor: "rgba(239,68,68,0.35)" };
  if (tier === "B") return { ...base, background: "rgba(245,158,11,0.14)", color: "#b45309", borderColor: "rgba(245,158,11,0.40)" };
  return { ...base, background: "rgba(59,130,246,0.12)", color: "#1d4ed8", borderColor: "rgba(59,130,246,0.35)" };
}

function renderGradedTierBenefit(tierOrValue: unknown, t: TFunction): ReactNode {
  const tier = normalizeGradedTier(tierOrValue);
  const item = GRADED_TIER_BENEFITS[tier];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compactPx(4) }}>
      <div style={{ display: "flex", gap: compactPx(8), alignItems: "center", flexWrap: "wrap" }}>
        <span style={tierBadgeStyle(tier)}>
          {t("档位")} {tier}
        </span>
        <span style={{ fontWeight: 800, color: "#0f172a" }}>{item.th}</span>
      </div>
      <div style={{ fontSize: compactPx(12), color: "#64748b", lineHeight: 1.6 }}>
        {item.zh} / {item.en}
      </div>
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

        marginTop: compactPx(10),

        padding: compactPx(12),

        borderRadius: compactPx(10),

        border: "1px solid rgba(224,112,32,0.35)",

        background: "rgba(224,112,32,0.08)",

      }}

    >

      <div style={{ fontWeight: 800, color: "var(--xt-primary)" }}>{t("配音入口")}</div>

      {link ? (

        <div style={{ marginTop: compactPx(6), fontSize: compactPx(14) }}>

          <a href={link} target="_blank" rel="noreferrer" style={{ color: "var(--xt-accent)", fontWeight: 700 }}>

            {t("配音素材下载")}

          </a>

        </div>

      ) : (

        <div style={{ marginTop: compactPx(6), fontSize: compactPx(13), color: "#64748b" }}>{t("（未提供配音素材下载链接）")}</div>

      )}

      {note ? (

        <div style={{ marginTop: compactPx(8), fontSize: compactPx(13), color: "#334155", whiteSpace: "pre-wrap" }}>{note}</div>

      ) : (

        <div style={{ marginTop: compactPx(8), fontSize: compactPx(13), color: "#64748b" }}>{t("（未提供配音要求备注）")}</div>

      )}

    </div>

  );

}

function renderSkuInfo(o: { id: number; sku_codes?: string[] | null; sku_images?: string[] | null }, t: TFunction) {

  if ((!Array.isArray(o.sku_codes) || o.sku_codes.length === 0) && (!Array.isArray(o.sku_images) || o.sku_images.length === 0)) return null;

  return (

    <div style={{ marginTop: compactPx(8) }}>

      <div style={{ fontSize: compactPx(13), color: "#475569" }}>{t("SKU 信息")}</div>

      {Array.isArray(o.sku_codes) && o.sku_codes.length > 0 && <div style={{ marginTop: compactPx(4), fontSize: compactPx(13), color: "#334155" }}>{o.sku_codes.join("，")}</div>}

      {Array.isArray(o.sku_images) && o.sku_images.length > 0 && (

        <div style={{ marginTop: compactPx(6), display: "flex", gap: compactPx(6), flexWrap: "wrap" }}>

          {o.sku_images.slice(0, 6).map((url, idx) => (

            <a key={`${o.id}-sku-${idx}`} href={url} target="_blank" rel="noreferrer">

              <img src={url} alt={`sku-${o.id}-${idx}`} style={{ width: 48, height: 48, borderRadius: compactPx(6), objectFit: "cover", border: "1px solid #eee" }} />

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
  const location = useLocation();
  const focusOrderIdRef = useRef<number>(0);

  const [openList, setOpenList] = useState<OpenOrder[]>([]);

  const [myList, setMyList] = useState<MyOrder[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const orderId = Number(sp.get("orderId") || 0);
    if (!Number.isFinite(orderId) || orderId < 1) return;
    focusOrderIdRef.current = orderId;
  }, [location.search]);

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
    const base: CSSProperties = { padding: "2px 8px", borderRadius: compactPx(999), fontSize: compactPx(12), fontWeight: 800, border: "1px solid #dbe1ea" };
    if (kind === "graded") return { ...base, background: "#f1f5f9", color: "#0f172a" };
    if (kind === "hq") return { ...base, background: "#dcfce7", color: "#166534", borderColor: "#bbf7d0" };
    if (kind === "monthly") return { ...base, background: "#ffedd5", color: "#9a3412", borderColor: "#fed7aa" };
    return { ...base, background: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" };
  }



  /**

   * 加载大厅与我的订单。

   */

  const load = async () => {

    setLoading(true);

    setError(null);

    try {

      const [openRes, myRes] = await Promise.all([

        api.getMarketOrders(),

        api.getMyMarketOrders(),

      ]);

      setOpenList(openRes.list || []);

      const myRows = (myRes.list || []) as MyOrder[];

      setMyList(myRows.map((r) => ({ ...r, work_links: normalizeWorkLinks(r.work_links) })));

      setOfflineList([]);

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

  // 自动轮询：每 30 秒检测新订单并播放提示音
  const loadRef = useRef(load);
  loadRef.current = load;
  useAutoRefresh({
    fetchCount: async () => {
      try {
        const [openRes, myRes] = await Promise.all([
          api.getMarketOrders(),
          api.getMyMarketOrders(),
        ]);
        const openLen = ((openRes.list || []) as unknown[]).length;
        const myLen = ((myRes.list || []) as unknown[]).length;
        return openLen + myLen;
      } catch {
        return 0;
      }
    },
    onNewOrder: () => loadRef.current(),
  });



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

  const handleMonthlySubmitBatch = async (orderId: number, batchNo: number, allSubmitted: boolean) => {
    if (allSubmitted) return;
    const draft = offlineMonthlyDraft[orderId] || { batchNo: "1", videoCount: "1", urls: "" };
    const vcRaw = Number(draft.videoCount);
    const vc = Math.floor(vcRaw);
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
      await employeeApi.submitEmployeeMonthlyBatch(orderId, { batch_no: batchNo, video_count: vc, video_urls: urls });
      setOfflineMonthlyDraft((p) => ({ ...p, [orderId]: { ...draft, urls: "" } }));
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

  const unifiedOrders = useMemo((): UnifiedOrder[] => [...gradedUnified, ...offlineUnified], [gradedUnified, offlineUnified]);

  function statusBadgeStyle(status: string): CSSProperties {
    const base: CSSProperties = {
      padding: "2px 8px",
      borderRadius: compactPx(999),
      fontSize: compactPx(12),
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
    const detailGridStyle: CSSProperties = {
      display: "grid",
      gridTemplateColumns: "112px minmax(0,1fr)",
      gap: "6px 10px",
      alignItems: "start",
      marginTop: compactPx(8),
    };
    const detailLabelStyle: CSSProperties = { color: "#64748b", fontSize: compactPx(13), lineHeight: 1.5 };
    const detailValueStyle: CSSProperties = { fontSize: compactPx(13), color: "#0f172a", lineHeight: 1.5, wordBreak: "break-word", whiteSpace: "pre-wrap" };

    const renderDetailRows = (rows: Array<{ label: string; value: ReactNode }>) => (
      <div style={detailGridStyle}>
        {rows.map((row, idx) => (
          <Fragment key={`${row.label}-${idx}`}>
            <div style={detailLabelStyle}>{row.label}</div>
            <div style={detailValueStyle}>{row.value}</div>
          </Fragment>
        ))}
      </div>
    );

    if (o._source === "graded") {
      const tier = normalizeGradedTier(o.tier);
      const gradedDetails: Array<{ label: string; value: ReactNode }> = [
        { label: t("订单标题"), value: o.title || "—" },
        { label: t("下单商家账号"), value: o.client_username || "—" },
        { label: t("商家名称"), value: o.client_display_name || "—" },
        { label: t("订单创建日期"), value: formatDateTime(o.created_at) },
        { label: t("订单状态"), value: statusText[String(o.status || "")] || String(o.status || "") || "—" },
        { label: t("档位"), value: renderGradedTierBenefit(tier, t) },
        {
          label: t("视频数量/积分金额"),
          value: (
            <>
              <span>
                {t("视频数量：")}
                {o.task_count || "-"} {t("条")}
              </span>
              <span style={{ marginLeft: compactPx(10), fontWeight: 700, color: "var(--xt-accent)" }}>
                {hallMarketOrderTotalPoints(o)} {t("积分")}
              </span>
              <span style={{ marginLeft: compactPx(6), color: "#64748b" }}>
                ({t("单套")} {o.reward_points} {t("积分")} x {hallMarketOrderTaskCount(o)})
              </span>
            </>
          ),
        },
        {
          label: t("发布方式"),
          value: publishMethodText[String(o.publish_method || "client_self_publish")] || publishMethodText.client_self_publish,
        },
        { label: t("备注"), value: o.voice_note?.trim() ? o.voice_note : "—" },
      ];

      return (
        <div
          key={`${o._source}-${o._list_kind}-${o.id}`}
          data-order-id={o.id}
          style={{ padding: compactPx(12), background: "#fff", borderRadius: compactPx(8), boxShadow: "0 1px 3px rgba(0,0,0,0.08)", width: "100%", boxSizing: "border-box", overflow: "hidden" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: compactPx(8), marginBottom: compactPx(8) }}>
            <div style={{ display: "flex", gap: compactPx(8), alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 800, color: "#0f172a" }}>
                {t("订单号：")}
                {o.order_no || `#${o.id}`}
              </span>
              <span style={statusBadgeStyle(String(o.status || ""))}>{statusText[String(o.status || "")] ?? String(o.status || "")}</span>
              <span style={typeBadgeStyle("graded")}>{t("① 分级视频（A/B/C）")}</span>
              <span style={tierBadgeStyle(tier)}>
                {t("档位")} {tier} · {GRADED_TIER_BENEFITS[tier].points}
                {t("积分")}
              </span>
              <span style={{ padding: "2px 8px", borderRadius: compactPx(999), fontSize: compactPx(12), fontWeight: 800, border: "1px solid #dbe1ea", background: "#f1f5f9", color: "#0f172a" }}>
                {t("订单日期：")}
                {formatDateTime(o.created_at)}
              </span>
            </div>
            <span style={{ color: "#166534", fontWeight: 700 }}>
              +{hallMarketOrderTotalPoints(o)} {t("积分")}
            </span>
          </div>

          {renderDetailRows(gradedDetails)}

          {renderSkuInfo(o, t)}
          {renderTierStandards(String(o.tier || ""), t)}
          {renderVoiceEntry(o, t)}

          {o._list_kind === "open" ? (
            <button
              type="button"
              onClick={() => handleClaim(o.id)}
              style={{ marginTop: compactPx(10), padding: "8px 16px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: compactPx(8), cursor: "pointer" }}
            >
              {t("领取")}
            </button>
          ) : (
            <>
              <p style={{ marginTop: compactPx(8), marginBottom: 0, fontSize: compactPx(14) }}>
                <button
                  type="button"
                  onClick={() => {
                    setLinksModalLinks(o.work_links);
                    setLinksModalOpen(true);
                  }}
                  style={{ padding: "6px 10px", borderRadius: compactPx(8), border: "1px solid #dbe1ea", background: "#fff", cursor: "pointer" }}
                >
                  {t("查看链接")}
                </button>
              </p>

              {String(o.publish_link || "").trim() ? (
                <p style={{ marginTop: compactPx(6), marginBottom: 0, fontSize: compactPx(14) }}>
                  {t("发布链接：")}
                  <a href={String(o.publish_link)} target="_blank" rel="noreferrer" style={{ marginLeft: compactPx(6) }}>
                    {t("查看")}
                  </a>
                </p>
              ) : null}

              {String(o.publish_method || "") === "influencer_publish_with_cart" && o.status === "completed" && !String(o.publish_link || "").trim() ? (
                <div style={{ marginTop: compactPx(10), display: "flex", gap: compactPx(8), flexWrap: "wrap", alignItems: "center" }}>
                  <input
                    type="url"
                    inputMode="url"
                    value={publishDraft[o.id] || ""}
                    onChange={(e) => setPublishDraft((p) => ({ ...p, [o.id]: e.target.value }))}
                    placeholder={t("发布链接（TikTok/TAP）")}
                    style={{ flex: 1, minWidth: 0, maxWidth: "100%", padding: "8px 10px", borderRadius: compactPx(8), border: "1px solid #ddd" }}
                  />
                  <button
                    type="button"
                    disabled={!!publishing[o.id]}
                    onClick={() => void submitPublishLink(o.id)}
                    style={{ padding: "8px 16px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: compactPx(8), cursor: publishing[o.id] ? "not-allowed" : "pointer" }}
                  >
                    {publishing[o.id] ? t("提交中...") : t("提交发布链接")}
                  </button>
                </div>
              ) : null}

              {o.status === "completed" && influencerEditId === o.id && (
                <div style={{ marginTop: compactPx(10) }}>
                  {influencerEditDraft.map((line, idx) => (
                    <div key={idx} style={{ display: "flex", gap: compactPx(6), marginBottom: compactPx(8), alignItems: "center", flexWrap: "wrap" }}>
                      <input
                        value={line}
                        onChange={(e) => {
                          const v = e.target.value;
                          setInfluencerEditDraft((prev) => prev.map((p, i) => (i === idx ? v : p)));
                        }}
                        placeholder="https://..."
                        style={{ flex: 1, minWidth: 0, maxWidth: "100%", padding: "6px 8px", borderRadius: compactPx(8), border: "1px solid #dbe1ea" }}
                      />
                      <button
                        type="button"
                        onClick={() => setInfluencerEditDraft((prev) => prev.filter((_, i) => i !== idx))}
                        style={{ padding: "4px 8px", border: "1px solid #fecaca", borderRadius: compactPx(8), background: "#fff", cursor: "pointer", color: "#b91c1c" }}
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => setInfluencerEditDraft((prev) => [...prev, ""])}
                    style={{ padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: compactPx(8), background: "#f8fafc", cursor: "pointer" }}
                  >
                    {t("+ 新增链接")}
                  </button>

                  <div style={{ marginTop: compactPx(8) }}>
                    <button
                      type="button"
                      onClick={() => saveInfluencerWorkLinks(o.id)}
                      disabled={savingInfluencerLinks}
                      style={{
                        padding: "8px 16px",
                        background: "var(--xt-accent)",
                        color: "#fff",
                        border: "none",
                        borderRadius: compactPx(8),
                        cursor: savingInfluencerLinks ? "not-allowed" : "pointer",
                        marginRight: compactPx(8),
                      }}
                    >
                      {savingInfluencerLinks ? t("保存中...") : t("保存链接")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setInfluencerEditId(null)}
                      style={{ padding: "8px 16px", border: "1px solid #ddd", borderRadius: compactPx(8), background: "#fff", cursor: "pointer" }}
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
                  style={{ marginTop: compactPx(8), padding: "6px 12px", borderRadius: compactPx(8), border: "1px solid #dbe1ea", background: "#fff", cursor: "pointer" }}
                >
                  {t("编辑交付链接")}
                </button>
              )}

              {o.status === "claimed" && (
                <div style={{ marginTop: compactPx(12) }}>
                  {completeId === o.id ? (
                    <div>
                      {workLinkRows.map((line, idx) => (
                        <div key={idx} style={{ display: "flex", gap: compactPx(6), marginBottom: compactPx(8), alignItems: "center", flexWrap: "wrap" }}>
                          <input
                            type="url"
                            inputMode="url"
                            value={line}
                            onChange={(e) => {
                              const v = e.target.value;
                              setWorkLinkRows((prev) => prev.map((p, i) => (i === idx ? v : p)));
                            }}
                            placeholder="https://..."
                            style={{ flex: 1, minWidth: 0, maxWidth: "100%", padding: "8px 10px", borderRadius: compactPx(8), border: "1px solid #ddd" }}
                          />
                          <button
                            type="button"
                            onClick={() => setWorkLinkRows((prev) => prev.filter((_, i) => i !== idx))}
                            style={{ padding: "4px 8px", border: "1px solid #fecaca", borderRadius: compactPx(8), background: "#fff", cursor: "pointer", color: "#b91c1c" }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setWorkLinkRows((prev) => [...prev, ""])}
                        style={{ padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: compactPx(8), background: "#f8fafc", cursor: "pointer", marginBottom: compactPx(8) }}
                      >
                        {t("+ 新增链接")}
                      </button>
                      <button type="button" onClick={handleComplete} style={{ padding: "8px 16px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: compactPx(8), cursor: "pointer", marginTop: compactPx(8) }}>
                        {t("确认提交")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCompleteId(null);
                          setWorkLinkRows([""]);
                        }}
                        style={{ marginLeft: compactPx(8), padding: "8px 16px", border: "1px solid #ddd", borderRadius: compactPx(8), background: "#fff", cursor: "pointer", marginTop: compactPx(8) }}
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
                      style={{ padding: "8px 16px", background: "#0f766e", color: "#fff", border: "none", borderRadius: compactPx(8), cursor: "pointer" }}
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

    const req = (o.requirements || {}) as Record<string, unknown>;
    const shopName = String(req.client_shop_name || "").trim();
    const requirementText = String(req.requirement || "").trim();
    const selectedTalent = String(req.selected_talent || "").trim();
    const groupChat = String(req.client_group_chat || "").trim();
    const proofLinks = (Array.isArray(o.proof_links) ? o.proof_links : [])
      .map((x: unknown) => String((typeof x === "string" ? x : (x as Record<string, unknown>)?.url || (x as Record<string, unknown>)?.link || "") || "").trim())
      .filter(Boolean);
    const publishLinks = (Array.isArray(o.publish_links) ? o.publish_links : [])
      .map((x: unknown) => String((typeof x === "string" ? x : (x as Record<string, unknown>)?.url || (x as Record<string, unknown>)?.link || "") || "").trim())
      .filter(Boolean);
    const toBatchTime = (v: unknown) => {
      if (typeof v === "number") {
        if (!Number.isFinite(v)) return 0;
        return v > 1e12 ? v : v * 1000;
      }
      const s = String(v || "").trim();
      if (!s) return 0;
      const ms = Date.parse(s);
      return Number.isFinite(ms) ? ms : 0;
    };
    const batchListChrono = Array.isArray(o.batch_payload)
      ? o.batch_payload.slice().sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
          const ta = toBatchTime(a?.submitted_at ?? a?.created_at ?? a?.updated_at);
          const tb = toBatchTime(b?.submitted_at ?? b?.created_at ?? b?.updated_at);
          if (ta !== tb) return ta - tb;
          return Number(a?.batch_no || 0) - Number(b?.batch_no || 0);
        })
      : [];
    const expectedBatchCount = (() => {
      const months = Math.max(1, Math.floor(Number(req.contract_months || 0) || 1));
      const weeklyEnabled = req.weekly_batch_enabled !== false;
      const perMonthBatches = weeklyEnabled ? 4 : 1;
      return Math.max(1, months * perMonthBatches);
    })();
    const submittedBatchCount = batchListChrono.filter((x: Record<string, unknown>) => {
      const st = String(x?.status || "");
      if (st === "rejected") return false;
      const links = Array.isArray(x?.proof_links) ? x.proof_links : [];
      return links.some((u: unknown) => String(u || "").trim());
    }).length;
    const allSubmitted = o.type_id === "monthly_package" && submittedBatchCount >= expectedBatchCount;
    const nextBatchNo = allSubmitted ? expectedBatchCount : Math.max(1, submittedBatchCount + 1);
    const monthlyPlanSummary =
      o.type_id === "monthly_package"
        ? `${Number(req.contract_months || 0) || 1}${t("个月")} / ${Number(req.min_videos_per_month || 0) || 20}${t("条/月")}`
        : "—";
    const offlinePublishMode =
      o.type_id === "creator_review_video"
        ? t("审核通过后发布")
        : o.type_id === "monthly_package"
          ? t("按批次交付")
          : t("商家自行发布");
    const offlineTypeSummary = (() => {
      if (o.type_id === "high_quality_custom_video") {
        const price = Number(o.amount_thb || 0);
        const display = Number.isFinite(price) && price > 0 ? String(price) : "—";
        return `${t("高质量视频")} | ${t("单价")}${display} ${t("THB/条")} | ${t("可修改1-2次")}`;
      }
      if (o.type_id === "monthly_package") {
        const months = Math.max(1, Math.floor(Number(req.contract_months || 0) || 1));
        const perMonth = Math.max(20, Math.floor(Number(req.min_videos_per_month || 0) || 20));
        const weekly = req.weekly_batch_enabled === false ? t("非按周结算") : t("按周结算");
        return `${t("包月合作")} | ${t("周期")}${months}${t("月")}/${t("每月")}${perMonth}${t("条")} | ${weekly}`;
      }
      const task = Math.max(0, Math.floor(Number(req.task_count || 0) || 0));
      const taskText = task > 0 ? String(task) : "—";
      return `${t("带货测评")} | ${t("任务")}${taskText}${t("条")} | ${t("需挂车能力")}`;
    })();

    const offlineDetails: Array<{ label: string; value: ReactNode }> = [
      { label: t("订单标题"), value: o.title || "—" },
      { label: t("商家账号"), value: o.client_username || "—" },
      { label: t("商家名称"), value: shopName || "—" },
      { label: t("订单创建日期"), value: formatDateTime(o.created_at) },
      { label: t("订单状态"), value: o._list_kind === "open" ? t("待接单") : offlinePhaseText[o.phase] || o.phase || "—" },
      { label: t("付款状态"), value: o.payment_status === "paid" ? t("已付款") : t("未付款") },
      {
        label: t("视频数量/积分金额"),
        value:
          o.type_id === "monthly_package"
            ? `${t("金额")}：${Number(o.amount_thb || 0).toFixed(2)} ฿ ｜ ${t("合作周期")}：${monthlyPlanSummary}`
            : o.type_id === "creator_review_video"
              ? `${t("视频数量")}：${Number(req.task_count || 0) || "-"} ${t("条")} ｜ ${t("金额")}：${Number(o.amount_thb || 0).toFixed(2)} ฿`
              : `${t("金额")}：${Number(o.amount_thb || 0).toFixed(2)} ฿`,
      },
      { label: t("发布方式"), value: offlinePublishMode },
      { label: t("备注"), value: String(o.review_note || "").trim() || "—" },
      { label: t("制作标准"), value: requirementText || "—" },
      { label: t("包含配音要求"), value: String(req.voice_note || "").trim() || "—" },
      { label: t("指定达人"), value: selectedTalent || "—" },
      { label: t("对接群聊"), value: groupChat || "—" },
    ];

    return (
      <div
        key={`${o._source}-${o._list_kind}-${o.id}`}
        data-order-id={o.id}
        style={{ padding: compactPx(12), background: "#fff", borderRadius: compactPx(10), boxShadow: "0 1px 3px rgba(0,0,0,0.08)", width: "100%", boxSizing: "border-box", overflow: "hidden" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: compactPx(12), flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 520px", minWidth: 0, maxWidth: "100%" }}>
            <div style={{ fontWeight: 800, display: "flex", gap: compactPx(8), alignItems: "center", flexWrap: "wrap" }}>
              <span>VO-{o.id}</span>
              {o.type_id === "high_quality_custom_video" && <span style={typeBadgeStyle("hq")}>{offlineTypeText[o.type_id]}</span>}
              {o.type_id === "monthly_package" && <span style={typeBadgeStyle("monthly")}>{offlineTypeText[o.type_id]}</span>}
              {o.type_id === "creator_review_video" && <span style={typeBadgeStyle("review")}>{offlineTypeText[o.type_id]}</span>}
              <span style={statusBadgeStyle(o._list_kind === "open" ? "open" : "claimed")}>{o._list_kind === "open" ? t("待接单") : offlinePhaseText[o.phase]}</span>
              <span style={{ padding: "2px 8px", borderRadius: compactPx(999), fontSize: compactPx(12), fontWeight: 800, border: "1px solid #dbe1ea", background: "#f1f5f9", color: "#0f172a" }}>
                {t("订单日期：")}
                {formatDateTime(o.created_at)}
              </span>
            </div>
            <div style={{ marginTop: compactPx(6), fontSize: compactPx(12), color: "#64748b", lineHeight: 1.5, wordBreak: "break-word", whiteSpace: "pre-wrap" }}>{offlineTypeSummary}</div>

            {renderDetailRows(offlineDetails)}

            {offlineActionError[o.id] && <div style={{ marginTop: compactPx(8), color: "#b91c1c", fontSize: compactPx(13), fontWeight: 700 }}>{offlineActionError[o.id]}</div>}
            {offlineActionOk[o.id] && <div style={{ marginTop: compactPx(8), color: "#166534", fontSize: compactPx(13), fontWeight: 700 }}>{offlineActionOk[o.id]}</div>}

            {proofLinks.length > 0 && (
              <div style={{ marginTop: compactPx(10), fontSize: compactPx(13), color: "#334155" }}>
                <div style={{ fontWeight: 800, marginBottom: compactPx(4) }}>{t("交付链接")}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: compactPx(4) }}>
                  {proofLinks.slice(0, 20).map((url: string, idx: number) => (
                    <a key={`${o.id}-proof-${idx}`} href={url} target="_blank" rel="noreferrer" style={{ color: "var(--xt-accent)", wordBreak: "break-all" }}>
                      {url}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {publishLinks.length > 0 && (
              <div style={{ marginTop: compactPx(10), fontSize: compactPx(13), color: "#334155" }}>
                <div style={{ fontWeight: 800, marginBottom: compactPx(4) }}>{t("发布链接")}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: compactPx(4) }}>
                  {publishLinks.slice(0, 20).map((url: string, idx: number) => (
                    <a key={`${o.id}-publish-${idx}`} href={url} target="_blank" rel="noreferrer" style={{ color: "var(--xt-accent)", wordBreak: "break-all" }}>
                      {url}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ flex: "1 1 320px", minWidth: 0, maxWidth: "100%", display: "flex", flexDirection: "column", gap: compactPx(8), alignItems: "stretch" }}>
            {o._list_kind === "open" ? (
              <button
                type="button"
                onClick={() => void handleOfflineClaim(o.id)}
                style={{ alignSelf: "flex-end", padding: "6px 12px", background: "#0f766e", color: "#fff", border: "none", borderRadius: compactPx(8), cursor: "pointer" }}
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
                      alignSelf: "flex-end",
                      padding: "6px 10px",
                      borderRadius: compactPx(8),
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
                  <div style={{ display: "flex", flexDirection: "column", gap: compactPx(8), alignItems: "stretch" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: compactPx(8) }}>
                      <div style={{ padding: "8px 10px", borderRadius: compactPx(10), border: "1px solid #e2e8f0", background: "#fff" }}>
                        <div style={{ fontSize: compactPx(12), color: "#64748b", marginBottom: 2 }}>{t("已交付批次：")}</div>
                        <div style={{ fontSize: compactPx(16), fontWeight: 800, color: "#0f172a" }}>{submittedBatchCount}</div>
                      </div>
                      <div style={{ padding: "8px 10px", borderRadius: compactPx(10), border: "1px solid #e2e8f0", background: "#fff" }}>
                        <div style={{ fontSize: compactPx(12), color: "#64748b", marginBottom: 2 }}>{t("应交付批次：")}</div>
                        <div style={{ fontSize: compactPx(16), fontWeight: 800, color: "#0f172a" }}>{expectedBatchCount}</div>
                      </div>
                    </div>

                    {batchListChrono.length > 0 && (
                      <div style={{ width: "100%", padding: compactPx(10), borderRadius: compactPx(10), border: "1px solid #e2e8f0", background: "#f8fafc" }}>
                        <div style={{ fontSize: compactPx(13), fontWeight: 800, color: "#0f172a", marginBottom: compactPx(8) }}>{t("批次记录")}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: compactPx(8), maxHeight: 220, overflowY: "auto" }}>
                          {batchListChrono.map((x: Record<string, unknown>, idx: number) => {
                            const displayNo = Number(x?.batch_no || idx + 1);
                            const vc = Number(x?.video_count || 0);
                            const st = String(x?.status || "");
                            const submittedAt = String(x?.submitted_at || "").trim();
                            const links = Array.isArray(x?.proof_links) ? x.proof_links : [];
                            const batchStatusText =
                              st === "pending_acceptance" ? t("待验收") : st === "accepted" ? t("已验收") : st === "settled" ? t("已结算") : st || t("未知");
                            return (
                              <div key={`${o.id}-batch-${displayNo}`} style={{ fontSize: compactPx(12), color: "#334155" }}>
                                <div style={{ fontWeight: 700, lineHeight: 1.5 }}>
                                  {t("批次")} {displayNo}
                                  {t("：")} {batchStatusText} ｜ {t("数量")}：{Number.isFinite(vc) && vc > 0 ? vc : "-"}
                                  {submittedAt ? <span style={{ color: "#64748b", fontWeight: 500 }}> ｜ {submittedAt}</span> : null}
                                </div>
                                {links.length > 0 && (
                                  <div style={{ marginTop: compactPx(4), display: "flex", flexDirection: "column", gap: compactPx(4) }}>
                                    {links.slice(0, 5).map((u: unknown, i: number) => {
                                      const url = String(u || "").trim();
                                      if (!url) return null;
                                      return (
                                        <a
                                          key={`${o.id}-batch-${displayNo}-link-${i}`}
                                          href={url}
                                          target="_blank"
                                          rel="noreferrer"
                                          style={{ color: "var(--xt-accent)", wordBreak: "break-all" }}
                                        >
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

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: compactPx(10), flexWrap: "wrap" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: compactPx(8), flex: "1 1 220px", minWidth: 0 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: compactPx(4), fontSize: compactPx(12), color: "#64748b" }}>
                          <span>{t("批次号")}</span>
                          <div style={{ width: "100%", padding: "6px 10px", borderRadius: compactPx(8), border: "1px solid #dbe1ea", background: "#f8fafc", color: "#0f172a", fontWeight: 800 }}>
                            {nextBatchNo}
                          </div>
                        </div>
                        {!allSubmitted && (
                          <label style={{ display: "flex", flexDirection: "column", gap: compactPx(4), fontSize: compactPx(12), color: "#64748b" }}>
                            <span>{t("本次交付数量")}</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              value={offlineMonthlyDraft[o.id]?.videoCount ?? "1"}
                              onChange={(e) =>
                                setOfflineMonthlyDraft((p) => ({
                                  ...p,
                                  [o.id]: { ...(p[o.id] || { batchNo: "1", videoCount: "1", urls: "" }), videoCount: e.target.value },
                                }))
                              }
                              style={{ width: "100%", padding: "6px 10px", borderRadius: compactPx(8), border: "1px solid #dbe1ea" }}
                              placeholder={t("数量")}
                              min={1}
                            />
                          </label>
                        )}
                      </div>

                      {allSubmitted && (
                        <span style={{ padding: "2px 10px", borderRadius: compactPx(999), fontSize: compactPx(12), fontWeight: 800, border: "1px solid rgba(22,163,74,0.35)", background: "rgba(22,163,74,0.10)", color: "#166534", whiteSpace: "nowrap" }}>
                          {t("已全部提交")}
                        </span>
                      )}
                    </div>

                    {!allSubmitted && (
                      <>
                        <label style={{ display: "flex", flexDirection: "column", gap: compactPx(4), fontSize: compactPx(12), color: "#64748b" }}>
                          <span>{t("交付链接（多条用换行分隔）")}</span>
                          <textarea
                            value={offlineMonthlyDraft[o.id]?.urls ?? ""}
                            onChange={(e) =>
                              setOfflineMonthlyDraft((p) => ({
                                ...p,
                                [o.id]: { ...(p[o.id] || { batchNo: "1", videoCount: "1", urls: "" }), urls: e.target.value },
                              }))
                            }
                            placeholder={t("交付链接（多条用换行分隔）")}
                            rows={3}
                            style={{ width: "100%", padding: "8px 10px", borderRadius: compactPx(10), border: "1px solid #dbe1ea", resize: "vertical", boxSizing: "border-box" }}
                          />
                        </label>
                        <button
                          type="button"
                          disabled={o.payment_status !== "paid" || !!offlineActionLoading[`${o.id}:monthly-submit`]}
                          onClick={() => void handleMonthlySubmitBatch(o.id, nextBatchNo, allSubmitted)}
                          style={{
                            alignSelf: "flex-end",
                            padding: "6px 10px",
                            borderRadius: compactPx(8),
                            border: "1px solid #dbe1ea",
                            background: o.payment_status !== "paid" ? "#f8fafc" : "#fff",
                            cursor: o.payment_status !== "paid" ? "not-allowed" : "pointer",
                            opacity: offlineActionLoading[`${o.id}:monthly-submit`] ? 0.6 : 1,
                          }}
                        >
                          {offlineActionLoading[`${o.id}:monthly-submit`] ? t("提交中…") : t("提交批次")}
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: compactPx(8), alignItems: "stretch" }}>
                    {(o.phase === "assigned" || o.phase === "in_progress" || o.phase === "review_rejected") && (
                      <label style={{ display: "flex", flexDirection: "column", gap: compactPx(4), fontSize: compactPx(12), color: "#64748b" }}>
                        <span>{t("交付链接（多条用换行分隔）")}</span>
                        <textarea
                          value={offlineDraftUrls[o.id] ?? ""}
                          onChange={(e) => setOfflineDraftUrls((p) => ({ ...p, [o.id]: e.target.value }))}
                          placeholder={t("交付链接（多条用换行分隔）")}
                          rows={3}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: compactPx(10), border: "1px solid #dbe1ea", resize: "vertical", boxSizing: "border-box" }}
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      disabled={!["assigned", "in_progress", "review_rejected"].includes(o.phase) || !!offlineActionLoading[`${o.id}:submit-proof`]}
                      onClick={() => void handleOfflineSubmitProof(o.id)}
                      style={{
                        alignSelf: "flex-end",
                        padding: "6px 10px",
                        borderRadius: compactPx(8),
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
                  <div style={{ display: "flex", flexDirection: "column", gap: compactPx(8), alignItems: "stretch" }}>
                    <input
                      type="text"
                      value={offlinePublishDraft[o.id] ?? ""}
                      onChange={(e) => setOfflinePublishDraft((p) => ({ ...p, [o.id]: e.target.value }))}
                      placeholder={t("发布链接")}
                      style={{ width: "100%", padding: "6px 10px", borderRadius: compactPx(10), border: "1px solid #dbe1ea", boxSizing: "border-box" }}
                    />
                    <button
                      type="button"
                      disabled={!!offlineActionLoading[`${o.id}:publish`]}
                      onClick={() => void handleOfflinePublish(o.id)}
                      style={{
                        alignSelf: "flex-end",
                        padding: "6px 10px",
                        borderRadius: compactPx(8),
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

  useEffect(() => {
    const id = focusOrderIdRef.current;
    if (!id) return;
    if (loading) return;
    const el = document.querySelector<HTMLElement>(`[data-order-id="${id}"]`);
    if (!el) return;
    focusOrderIdRef.current = 0;
    window.setTimeout(() => el.scrollIntoView({ block: "center" }), 0);
  }, [loading, gradedFilteredSorted.length]);





  return (

    <div>

      <h2 style={{ marginTop: 0 }}>{t("视频分级工作台")}</h2>

      <p style={{ color: "#64748b", fontSize: compactPx(14), marginBottom: compactPx(16) }}>

        {t("统一查看并处理类型1/2/3/4订单。")}

      </p>

      {error && <p style={{ color: "#c00" }}>{error}</p>}

      <div style={{ marginBottom: compactPx(16) }}>
        <h3 style={{ fontSize: compactPx(16), marginTop: 0 }}>{t("统一订单列表")}</h3>
        <div className="sticky-search" style={{ marginBottom: compactPx(12), display: "flex", gap: compactPx(8), flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="text"
            value={gradedSearch}
            onChange={(e) => setGradedSearch(e.target.value)}
            placeholder={t("关键词：订单号/标题/商家（模糊）")}
            style={{ padding: "8px 12px", borderRadius: compactPx(8), border: "1px solid #dbe1ea", minWidth: 240 }}
          />
          <select
            value={gradedStatusFilter}
            onChange={(e) => {
              const next = (e.target.value as UnifiedStatusFilter) || "";
              setGradedStatusFilter(next);
            }}
            style={{ padding: "6px 10px", borderRadius: compactPx(8), border: "1px solid #dbe1ea", background: "#fff" }}
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
            onChange={(e) => setGradedSortMode(e.target.value as "created_desc" | "created_asc" | "amount_desc" | "amount_asc" | "status_asc" | "status_desc")}
            style={{ padding: "6px 10px", borderRadius: compactPx(8), border: "1px solid #dbe1ea", background: "#fff" }}
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
            style={{ padding: "6px 14px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: compactPx(8), cursor: "pointer" }}
          >
            {t("刷新")}
          </button>
        </div>

        {loading && (
          <p style={{ padding: "8px 0" }}>{t("加载中…")}</p>
        )}
        {!loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: compactPx(12) }}>
            {gradedFilteredSorted.map((o) => renderUnifiedOrderCard(o))}

            {gradedFilteredSorted.length === 0 && (
              <div className="xt-inf-empty xt-inf-card" style={{ marginTop: compactPx(8) }}>
                <div className="xt-inf-empty-icon" aria-hidden>
                  📋
                </div>
                <div style={{ fontWeight: 700, marginBottom: compactPx(8) }}>{t("暂无匹配订单，可调整筛选条件或刷新列表")}</div>
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

