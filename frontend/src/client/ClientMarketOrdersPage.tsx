import { useState, useEffect, useMemo, useRef, type CSSProperties } from "react";

import { useLocation, useNavigate } from "react-router-dom";

import * as api from "../clientApi";

import OrderDateFilter, { type DateFilterState } from "../components/OrderDateFilter";

import WorkLinksModal from "../components/WorkLinksModal";

import { showToastNotice } from "../utils/showToast";

import { normalizeWorkLinks } from "../utils/workLinks";



type MarketOrder = {

  id: number;

  order_no: string | null;

  title: string | null;

  reward_points: number;

  tier?: "A" | "B" | "C" | string;

  publish_method?: "client_self_publish" | "influencer_publish_with_cart" | string;

  is_public_apply?: number;

  match_status?: string;

  tiktok_link?: string | null;

  publish_link?: string | null;

  sku_codes?: string[] | null;

  sku_images?: string[] | null;

  status: string;

  influencer_id: number | null;

  influencer_username?: string | null;

  influencer_display_name?: string | null;

  client_shop_name?: string | null;

  client_group_chat?: string | null;

  work_links: string[];

  created_at: string;

  updated_at: string;

  completed_at: string | null;

  /** 同一订单内合并的套数（≥1） */

  task_count?: number;

};

type OfflineVideoOrder = api.OfflineVideoOrder;
type OfflineVideoOrderTypeId = api.OfflineVideoOrderTypeId;

type VideoOrderTypeId = "graded_video" | OfflineVideoOrderTypeId;

type UnifiedRow =
  | { kind: "graded"; created_at: string; id: number; order: MarketOrder }
  | { kind: "offline"; created_at: string; id: number; order: OfflineVideoOrder };



type SkuItem = {

  id: number;

  sku_code: string;

  sku_name: string | null;

  sku_images: string[] | null;

};



/**

 * Format timestamp as YYYY-MM-DD HH:mm:ss.

 */

function formatDateTime(value?: string | null): string {

  if (!value) return "?";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return value;

  const pad = (n: number) => String(n).padStart(2, "0");

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

}



/**

 * Resolve claimer display text from available fields.

 */

function resolveClaimerText(order: MarketOrder): string {

  const raw = order as unknown as Record<string, unknown>;

  const username = String(order.influencer_username || raw.influencer_nickname || raw.influencerName || "").trim();

  const display = String(order.influencer_display_name || raw.influencer_display || raw.influencerDisplayName || "").trim();

  if (username && display && username !== display) return `${username} / ${display}`;

  return username || display || "?";

}



/**

 * Resolve TikTok link from compatible field names.

 */

function resolveTikTokLink(order: MarketOrder): string {

  const raw = order as unknown as Record<string, unknown>;

  const link = String(order.tiktok_link || raw.tiktokLink || raw.tiktok_url || "").trim();

  return link;

}

function resolvePublishLink(order: MarketOrder): string {
  const raw = order as unknown as Record<string, unknown>;
  const link = String(order.publish_link || raw.publish_link || raw.publishLink || "").trim();
  return link;
}

function extractUrlList(val: unknown): string[] {
  if (val == null) return [];
  if (Array.isArray(val)) {
    return val
      .flatMap((x) => {
        if (typeof x === "string") return [x];
        if (x && typeof x === "object") {
          const o = x as Record<string, unknown>;
          const url = String(o.url || o.link || o.href || "").trim();
          return url ? [url] : [];
        }
        return [];
      })
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof val === "string") {
    return val
      .split(/\r?\n|,/g)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function extractBatchLinks(batch: unknown): string[] {
  if (!batch || typeof batch !== "object") return [];
  const b = batch as Record<string, unknown>;
  const candidates = [b.delivery_links, b.proof_links, b.video_urls, b.links];
  for (const v of candidates) {
    const list = extractUrlList(v);
    if (list.length) return list;
  }
  return [];
}



/**

 * Resolve publish method display text.

 */
function resolvePublishMethodText(method?: string | null): string {
  if (String(method || "").trim() === "influencer_publish_with_cart") return "达人在TikTok账号发布视频和挂在购物车";
  return "视频拍完后自己发布";
}



/**
 *
 * 解析订单合并套数（task_count），默认 1、上限 100。
 */
function marketOrderTaskCount(o: MarketOrder): number {
  const n = Number(o.task_count);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(100, Math.floor(n));
}

/**
 *
 * 订单展示用合计积分：单套积分 × 套数。
 */
function marketOrderTotalRewardPoints(o: MarketOrder): number {
  return marketOrderTaskCount(o) * (o.reward_points || 0);
}

/**

 * 商家端「视频订单」页面：发布要求、查看订单号与标题、搜索、查看状态与交付链接。

 */

export default function ClientMarketOrdersPage() {

  const nav = useNavigate();
  const location = useLocation();

  const [marketOrders, setMarketOrders] = useState<MarketOrder[]>([]);
  const [offlineOrders, setOfflineOrders] = useState<OfflineVideoOrder[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [balance, setBalance] = useState<number | null>(null);

  const [showForm, setShowForm] = useState(false);

  const [orderTypeId, setOrderTypeId] = useState<VideoOrderTypeId>("graded_video");

  const [title, setTitle] = useState("");

  const [clientShopName, setClientShopName] = useState("");

  const [clientGroupChat, setClientGroupChat] = useState("");

  const [tier, setTier] = useState<"C" | "B" | "A">("C");

  const [publishMethod, setPublishMethod] = useState<"client_self_publish" | "influencer_publish_with_cart">("client_self_publish");

  const [offlineAmount, setOfflineAmount] = useState("4000");
  const [offlineRequirement, setOfflineRequirement] = useState("");
  const [offlineTalent, setOfflineTalent] = useState("");
  const [contractMonths, setContractMonths] = useState(1);
  const [monthlyMinVideos, setMonthlyMinVideos] = useState(20);
  const [weeklyBatchEnabled, setWeeklyBatchEnabled] = useState(true);
  const [creatorTaskCount, setCreatorTaskCount] = useState(8);

  const [isPublicApply, setIsPublicApply] = useState(true);

  const [voiceLink, setVoiceLink] = useState("");

  const [tiktokLink, setTiktokLink] = useState("");

  const [selectedSkuIds, setSelectedSkuIds] = useState<number[]>([]);

  const [skuList, setSkuList] = useState<SkuItem[]>([]);

  const [skuKeyword, setSkuKeyword] = useState("");

  const [taskCount, setTaskCount] = useState(1);

  const [searchQ, setSearchQ] = useState("");

  const [dateFilter, setDateFilter] = useState<DateFilterState>({ mode: "all", day: "", startDate: "", endDate: "" });

  const [linksModalOpen, setLinksModalOpen] = useState(false);

  const [linksModalLinks, setLinksModalLinks] = useState<string[]>([]);

  const hasInitLoadedRef = useRef(false);

  const hasInitBalanceRef = useRef(false);

  const hasInitSkusRef = useRef(false);
  const focusOrderIdRef = useRef<number>(0);



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

   * 拉取当前用户的发单列表。

   */

  const load = async (q?: string, filter?: DateFilterState) => {

    setLoading(true);

    setError(null);

    try {

      const query = {

        ...(q?.trim() ? { q: q.trim() } : {}),

        ...resolveDateQuery(filter ?? dateFilter),

      };

      const [marketRes, offlineRes] = await Promise.allSettled([
        api.getMarketOrders(Object.keys(query).length > 0 ? query : undefined),
        api.getClientVideoOrders(),
      ]);

      const errors: string[] = [];
      if (marketRes.status === "fulfilled") {
        const rows = (marketRes.value.list || []) as MarketOrder[];
        const filtered = rows.filter((r) => {
          const orderNo = String(r.order_no || "").trim().toUpperCase();
          return !orderNo.startsWith("MH-");
        });
        setMarketOrders(filtered.map((r) => ({ ...r, work_links: normalizeWorkLinks(r.work_links) })));
      } else {
        errors.push(marketRes.reason instanceof Error ? marketRes.reason.message : "分级订单加载失败");
      }

      if (offlineRes.status === "fulfilled") {
        setOfflineOrders((offlineRes.value.list || []) as OfflineVideoOrder[]);
      } else {
        errors.push(offlineRes.reason instanceof Error ? offlineRes.reason.message : "视频订单加载失败");
      }

      if (errors.length) setError(errors.join("；"));

    } catch (e) {

      setError(e instanceof Error ? e.message : "加载失败");

    } finally {

      setLoading(false);

    }

  };

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const orderId = Number(sp.get("orderId") || 0);
    if (!Number.isFinite(orderId) || orderId < 1) return;
    focusOrderIdRef.current = orderId;
  }, [location.search]);

  useEffect(() => {
    const id = focusOrderIdRef.current;
    if (!id) return;
    if (loading) return;
    const videoEl = document.querySelector<HTMLElement>(`[data-order-kind="video"][data-order-id="${id}"]`);
    const marketEl = document.querySelector<HTMLElement>(`[data-order-kind="market"][data-order-id="${id}"]`);
    const el = videoEl || marketEl;
    if (!el) return;
    focusOrderIdRef.current = 0;
    window.setTimeout(() => el.scrollIntoView({ block: "center" }), 0);
  }, [loading, marketOrders.length, offlineOrders.length]);



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

   * 加载商家维护的 SKU 列表，供发单时勾选。

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

  const canSubmitClientInfo = clientShopName.trim().length > 0 && clientGroupChat.trim().length > 0 && publishMethod.trim().length > 0;

  const monthlyEffectiveMonths = Math.max(1, Math.floor(contractMonths || 1));
  const monthlyEffectiveVideos = Math.max(20, Math.floor(monthlyMinVideos || 20));
  const monthlyEstimatedAmount = 650 * monthlyEffectiveVideos * monthlyEffectiveMonths;

  const canSubmit = useMemo(() => {
    if (orderTypeId === "graded_video") return !!title.trim() && canAfford && canSubmitClientInfo;
    const hasBase = !!title.trim() && !!clientShopName.trim() && !!clientGroupChat.trim();
    if (orderTypeId === "high_quality_custom_video") return hasBase && !!offlineTalent.trim();
    if (orderTypeId === "monthly_package") return hasBase && monthlyEffectiveMonths >= 1 && monthlyEffectiveVideos >= 20;
    return hasBase && creatorTaskCount >= 8 && creatorTaskCount <= 10 && !!offlineTalent.trim();
  }, [orderTypeId, canAfford, canSubmitClientInfo, title, clientShopName, clientGroupChat, offlineTalent, creatorTaskCount, monthlyEffectiveMonths, monthlyEffectiveVideos]);

  const validationErrors = useMemo<string[]>(() => {
    const errors: string[] = [];
    if (!title.trim()) { errors.push("请填写订单标题"); return errors; }
    if (!clientShopName.trim()) { errors.push("请填写商家店铺名称"); return errors; }
    if (!clientGroupChat.trim()) { errors.push("请填写商家对接群聊"); return errors; }
    if (orderTypeId === "graded_video") {
      if (balance != null && balance < totalConsumePoints) errors.push(`积分余额不足（需 ${totalConsumePoints}，当前 ${balance}）`);
      return errors;
    }
    if (orderTypeId === "high_quality_custom_video") {
      if (!offlineTalent.trim()) errors.push("请填写或选择优质 Influencer");
      return errors;
    }
    if (orderTypeId === "monthly_package") {
      if (monthlyEffectiveVideos < 20) errors.push("包月每月数量不能少于20");
      return errors;
    }
    if (orderTypeId === "creator_review_video") {
      if (creatorTaskCount < 8 || creatorTaskCount > 10) errors.push("任务条数需在8-10之间");
      if (!offlineTalent.trim()) errors.push("请填写或选择 Creator 账号");
      return errors;
    }
    return errors;
  }, [title, clientShopName, clientGroupChat, orderTypeId, balance, totalConsumePoints, offlineTalent, monthlyEffectiveVideos, creatorTaskCount]);



  /**

   * 提交新订单（需账户至少有约定奖励积分）。

   */

  const handleCreate = async () => {

    setError(null);

    const titleText = title.trim();

    if (!titleText || titleText.length > 200) {

      setError("请填写订单标题（1–200 字）。");

      return;

    }

    try {
      if (orderTypeId === "graded_video") {
        if (!clientShopName.trim()) {
          setError("请输入商家店铺名称");
          return;
        }

        if (!clientGroupChat.trim()) {
          setError("请输入商家对接群聊（群号/链接）");
          return;
        }

        if (balance != null && balance < consumePoints) {
          setError(`积分余额不足：本次将消耗 ${totalConsumePoints} 积分，当前余额 ${balance}。`);
          return;
        }

        const chosen = skuList.filter((s) => selectedSkuIds.includes(s.id));
        const skuCodes = chosen.map((s) => (s.sku_name ? `${s.sku_code} / ${s.sku_name}` : s.sku_code));
        const skuImages = chosen.flatMap((s) => (Array.isArray(s.sku_images) ? s.sku_images : [])).slice(0, 100);

        await api.createMarketOrder({
          title: titleText,
          client_shop_name: clientShopName.trim(),
          client_group_chat: clientGroupChat.trim(),
          tier,
          voice_link: tier === "A" ? (voiceLink.trim() || undefined) : undefined,
          publish_method: publishMethod,
          is_public_apply: isPublicApply,
          tiktok_link: tiktokLink.trim() || undefined,
          product_images: [],
          sku_ids: selectedSkuIds,
          sku_codes: skuCodes,
          sku_images: skuImages,
          task_count: taskCount,
        });
      } else {
        if (!clientShopName.trim()) {
          setError("请输入商家店铺名称");
          return;
        }
        if (!clientGroupChat.trim()) {
          setError("请输入商家对接群聊（群号/链接）");
          return;
        }
        const req: Record<string, unknown> = {
          requirement: offlineRequirement.trim() || null,
          selected_talent: offlineTalent.trim() || null,
          client_shop_name: clientShopName.trim() || null,
          client_group_chat: clientGroupChat.trim() || null,
        };

        if (orderTypeId === "high_quality_custom_video") {
          if (!offlineTalent.trim()) {
            setError("请填写或选择优质 Influencer");
            return;
          }
          req.price_range = "4000-5000";
        }

        if (orderTypeId === "monthly_package") {
          if (!Number.isFinite(monthlyEffectiveMonths) || monthlyEffectiveMonths < 1) {
            setError("合作周期（月）至少为 1");
            return;
          }
          if (monthlyEffectiveVideos < 20) {
            setError("包月合作每月不少于 20 条");
            return;
          }
          req.contract_months = monthlyEffectiveMonths;
          req.min_videos_per_month = monthlyEffectiveVideos;
          req.weekly_batch_enabled = !!weeklyBatchEnabled;
          req.unit_price = 650;
        }

        if (orderTypeId === "creator_review_video") {
          if (creatorTaskCount < 8 || creatorTaskCount > 10) {
            setError("测评视频任务条数需为 8-10 条");
            return;
          }
          if (!offlineTalent.trim()) {
            setError("请填写或选择 Creator 账号");
            return;
          }
          req.task_count = Math.floor(creatorTaskCount);
          req.must_review_before_publish = true;
        }

        await api.createClientVideoOrder({
          type_id: orderTypeId,
          title: titleText,
          amount_thb: orderTypeId === "high_quality_custom_video" ? (parseFloat(offlineAmount) || 0) : 0,
          requirements: req,
        });
      }

      setShowForm(false);
      setTitle("");
      setClientShopName("");
      setClientGroupChat("");
      setTier("C");
      setPublishMethod("client_self_publish");
      setIsPublicApply(true);
      setVoiceLink("");
      setTiktokLink("");
      setSelectedSkuIds([]);
      setTaskCount(1);

      setOfflineAmount("4000");
      setOfflineRequirement("");
      setOfflineTalent("");
      setContractMonths(1);
      setMonthlyMinVideos(20);
      setWeeklyBatchEnabled(true);
      setCreatorTaskCount(8);

      loadBalance();
      load(searchQ, dateFilter);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    }

  };


  const typeText = (t: VideoOrderTypeId): string => {
    if (t === "graded_video") return "① 分级视频（A/B/C）";
    if (t === "high_quality_custom_video") return "② 高质量视频";
    if (t === "monthly_package") return "③ 包月合作套餐";
    return "④ Creator带货测评";
  };

  const tagStyle = (t: VideoOrderTypeId): CSSProperties => {
    const base: CSSProperties = { padding: "2px 8px", borderRadius: 999, fontSize: 12, fontWeight: 700, border: "1px solid #dbe1ea" };
    if (t === "graded_video") return { ...base, background: "#f1f5f9", color: "#0f172a" };
    if (t === "high_quality_custom_video") return { ...base, background: "#dcfce7", color: "#166534", borderColor: "#bbf7d0" };
    if (t === "monthly_package") return { ...base, background: "#ffedd5", color: "#9a3412", borderColor: "#fed7aa" };
    return { ...base, background: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" };
  };

  const phaseText = (o: OfflineVideoOrder) => {
    const map: Record<string, string> = {
      created: "已创建",
      paid: "已付款",
      assigned: "已分配",
      in_progress: "制作中",
      submitted: "已提交",
      review_pending: "待审核",
      review_rejected: "审核驳回",
      approved_to_publish: "可发布",
      published: "已发布",
      delivered: "已交付",
      completed: "已完成",
      rejected: "已驳回",
    };
    return map[o.phase] || o.phase;
  };

  const combinedRows = useMemo(() => {
    const rows: UnifiedRow[] = [
      ...marketOrders.map((o) => ({ kind: "graded" as const, created_at: o.created_at, id: o.id, order: o })),
      ...offlineOrders.map((o) => ({ kind: "offline" as const, created_at: o.created_at, id: o.id, order: o })),
    ];

    const q = searchQ.trim();
    const matchQ = (text: string) => (q ? text.toLowerCase().includes(q.toLowerCase()) : true);

    const matchDate = (iso: string) => {
      if (dateFilter.mode === "all") return true;
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return true;
      const day = d.toISOString().slice(0, 10);
      if (dateFilter.mode === "day") return !!dateFilter.day && day === dateFilter.day;
      if (dateFilter.mode === "range") {
        const s = dateFilter.startDate || "";
        const e = dateFilter.endDate || "";
        if (s && day < s) return false;
        if (e && day > e) return false;
      }
      return true;
    };

    return rows
      .filter((r) => {
        if (!matchDate(r.created_at)) return false;
        if (!q) return true;
        if (r.kind === "graded") {
          const no = r.order.order_no || String(r.order.id);
          const title = String(r.order.title || "");
          return matchQ(no) || matchQ(title);
        }
        const no = `VO-${r.order.id}`;
        const title = r.order.title || "";
        return matchQ(no) || matchQ(title);
      })
      .sort((a, b) => {
        const ta = new Date(a.created_at).getTime();
        const tb = new Date(b.created_at).getTime();
        if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return tb - ta;
        return b.id - a.id;
      });
  }, [marketOrders, offlineOrders, searchQ, dateFilter]);



  // const statusText: Record<string, string> = {
  //   pending_selection: "待选达人",
  //   open: "待领取",
  //   claimed: "已领取/进行中",
  //   completed: "已完成",
  //   cancelled: "已取消",
  // };



  /**

   * 软删除订单：仅 open 状态可删（后端会校验）。

   */

  const handleDelete = async (id: number) => {

    const ok = window.confirm("确认删除该订单？仅“待领取”状态可删除。");

    if (!ok) return;

    setError(null);

    try {

      await api.deleteMarketOrder(id);

      load(searchQ, dateFilter);

    } catch (e) {

      setError(e instanceof Error ? e.message : "删除失败");

    }

  };

  const handleOfflineAccept = async (id: number) => {
    setError(null);
    try {
      await api.acceptClientVideoOrder(id);
      showToastNotice(`✅ 订单 VO-${id} 验收通过！订单状态已更新`, { variant: "success", placement: "top-right", durationMs: 4200, closable: true });
      load(searchQ, dateFilter);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "操作失败";
      setError(msg);
      showToastNotice(`❌ 订单 VO-${id} 验收失败，请重新操作`, { variant: "error", placement: "top-right", durationMs: 4200, closable: true });
    }
  };

  const handleOfflineReject = async (id: number) => {
    const note = window.prompt("请输入驳回原因（可留空）", "") || "";
    setError(null);
    try {
      await api.rejectClientVideoOrder(id, note);
      showToastNotice(`✅ 订单 VO-${id} 已驳回，订单状态已更新`, { variant: "success", placement: "top-right", durationMs: 4200, closable: true });
      load(searchQ, dateFilter);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "操作失败";
      setError(msg);
      showToastNotice(`❌ 订单 VO-${id} 驳回失败，请重新操作`, { variant: "error", placement: "top-right", durationMs: 4200, closable: true });
    }
  };

  const handleMonthlyBatchAccept = async (orderId: number, batchNo: number) => {
    const raw = window.prompt("请输入验收数量（accepted_count）", "1") || "1";
    const accepted = Math.max(1, Math.floor(Number(raw) || 0));
    const note = window.prompt("验收备注（可留空）", "") || "";
    setError(null);
    try {
      const ret = await api.acceptClientMonthlyBatch(orderId, batchNo, { accepted_count: accepted, note });
      const updatedBatch = (ret as any)?.batch ?? null;
      if (updatedBatch && typeof updatedBatch === "object") {
        setOfflineOrders((prev) =>
          prev.map((order) => {
            if (order.id !== orderId) return order;
            const list = Array.isArray(order.batch_payload) ? (order.batch_payload as any[]) : [];
            const next = list.map((b) => (Number(b?.batch_no || 0) === batchNo ? { ...b, ...updatedBatch } : b));
            return { ...order, batch_payload: next };
          }),
        );
      }
      showToastNotice(`✅ 订单 VO-${orderId} 批次${batchNo} 验收通过！订单状态已更新`, { variant: "success", placement: "top-right", durationMs: 4200, closable: true });
      void load(searchQ, dateFilter);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "操作失败";
      setError(msg);
      showToastNotice(`❌ 订单 VO-${orderId} 批次${batchNo} 验收失败，请重新操作`, { variant: "error", placement: "top-right", durationMs: 4200, closable: true });
    }
  };

  const handleMonthlyBatchSettle = async (orderId: number, batchNo: number) => {
    const raw = window.prompt("请输入结算金额（THB）", "0") || "0";
    const amt = Math.max(0, Math.round((Number(raw) || 0) * 100) / 100);
    setError(null);
    try {
      await api.settleClientMonthlyBatch(orderId, batchNo, { settled_amount: amt });
      load(searchQ, dateFilter);
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    }
  };



  return (

    <div>

      <h2 style={{ marginTop: 0 }}>视频订单</h2>

      <p style={{ color: "#64748b", fontSize: 14, marginBottom: 16, lineHeight: 1.7 }}>
        本模块支持 4 类视频订单：①分级视频（A/B/C）②高质量视频③包月合作套餐④Creator带货测评。仅①分级视频会扣除积分（20/40/60，按 C/B/A），其余类型不扣积分。
      </p>

      {error && <p style={{ color: "#c00" }}>{error}</p>}

      <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>

        <input

          type="text"

          value={searchQ}

          onChange={(e) => setSearchQ(e.target.value)}

          placeholder="搜索：订单号或标题（精准）"

          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #dbe1ea", minWidth: 260 }}

        />

        <button type="button" onClick={() => load(searchQ, dateFilter)} style={{ padding: "8px 16px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>

          搜索

        </button>

        <button

          type="button"

          onClick={() => {

            setSearchQ("");

            const emptyFilter: DateFilterState = { mode: "all", day: "", startDate: "", endDate: "" };

            setDateFilter(emptyFilter);

            load("", emptyFilter);

          }}

          style={{ padding: "8px 16px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer" }}

        >

          清空

        </button>

        <OrderDateFilter value={dateFilter} onChange={setDateFilter} />

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

          <label htmlFor="title">订单标题（必填，1–200 字）</label>

          <input

            id="title"

            type="text"

            value={title}

            onChange={(e) => setTitle(e.target.value)}

            placeholder="简短标题，如：春季露脸种草视频"

            maxLength={200}

            style={{ display: "block", marginTop: 8, marginBottom: 12, width: "100%", maxWidth: 560, padding: "8px 10px", boxSizing: "border-box", borderRadius: 8, border: "1px solid #ddd" }}

          />

          <label htmlFor="orderType">订单类型（4类）</label>
          <select
            id="orderType"
            value={orderTypeId}
            onChange={(e) => setOrderTypeId(e.target.value as VideoOrderTypeId)}
            style={{ display: "block", marginTop: 8, marginBottom: 12, width: "100%", maxWidth: 560, padding: "8px 10px", boxSizing: "border-box", borderRadius: 8, border: "1px solid #ddd", background: "#fff" }}
          >
            <option value="graded_video">① 分级视频（A/B/C）- 扣积分</option>
            <option value="high_quality_custom_video">② 高质量视频（4000-5000฿/条）</option>
            <option value="monthly_package">③ 包月合作套餐（650฿/条，≥20条/月）</option>
            <option value="creator_review_video">④ Creator带货测评（8-10条/次，单价待配置）</option>
          </select>

          <label htmlFor="clientShopName">商家店铺名称（必填）</label>

          <input

            id="clientShopName"

            type="text"

            value={clientShopName}

            onChange={(e) => setClientShopName(e.target.value)}

            placeholder="请输入商家店铺名称"

            maxLength={200}

            style={{ display: "block", marginTop: 8, marginBottom: 4, width: "100%", maxWidth: 560, padding: "8px 10px", boxSizing: "border-box", borderRadius: 8, border: "1px solid #ddd" }}

          />

          {orderTypeId === "graded_video" && !clientShopName.trim() && <div style={{ marginBottom: 10, fontSize: 12, color: "#b91c1c" }}>请输入商家店铺名称</div>}

          <label htmlFor="clientGroupChat">商家对接群聊（必填）</label>

          <input

            id="clientGroupChat"

            type="text"

            value={clientGroupChat}

            onChange={(e) => setClientGroupChat(e.target.value)}

            placeholder="请输入商家对接群聊（群号/链接）"

            maxLength={2000}

            style={{ display: "block", marginTop: 8, marginBottom: 4, width: "100%", maxWidth: 560, padding: "8px 10px", boxSizing: "border-box", borderRadius: 8, border: "1px solid #ddd" }}

          />

          {orderTypeId === "graded_video" && !clientGroupChat.trim() && <div style={{ marginBottom: 10, fontSize: 12, color: "#b91c1c" }}>请输入商家对接群聊（群号/链接）</div>}

          {orderTypeId === "graded_video" ? (
            <>
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

              <label htmlFor="publishMethod">发布方式（必填）</label>
              <select
                id="publishMethod"
                value={publishMethod}
                onChange={(e) => setPublishMethod(e.target.value as "client_self_publish" | "influencer_publish_with_cart")}
                style={{ display: "block", marginTop: 8, marginBottom: 12, width: "100%", maxWidth: 560, padding: "8px 10px", boxSizing: "border-box", borderRadius: 8, border: "1px solid #ddd", background: "#fff" }}
              >
                <option value="client_self_publish">视频拍完后自己发布</option>
                <option value="influencer_publish_with_cart">达人在TikTok账号发布视频和挂在购物车</option>
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
                </>
              )}

              <label htmlFor="taskCount">购买数量（同一 SKU 多数量合并为一条订单）</label>
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
            </>
          ) : (
            <>
              {orderTypeId === "high_quality_custom_video" && (
                <>
                  <label htmlFor="offlineAmount">单价（THB/条）</label>
                  <input
                    id="offlineAmount"
                    type="text"
                    value={offlineAmount}
                    onChange={(e) => setOfflineAmount(e.target.value)}
                    style={{ display: "block", marginTop: 8, marginBottom: 12, width: "100%", maxWidth: 240, padding: "8px 10px", boxSizing: "border-box", borderRadius: 8, border: "1px solid #ddd" }}
                  />
                </>
              )}

              {orderTypeId === "monthly_package" && (
                <>
                  <label htmlFor="contractMonths">合作周期（月，必填）</label>
                  <input
                    id="contractMonths"
                    type="number"
                    min={1}
                    max={12}
                    value={contractMonths}
                    onChange={(e) => setContractMonths(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
                    style={{ display: "block", marginTop: 8, marginBottom: 12, width: "100%", maxWidth: 240, padding: "8px 10px", boxSizing: "border-box", borderRadius: 8, border: "1px solid #ddd" }}
                  />

                  <label htmlFor="monthlyMinVideos">每月条数（≥20，必填）</label>
                  <input
                    id="monthlyMinVideos"
                    type="number"
                    min={20}
                    max={999}
                    value={monthlyMinVideos}
                    onChange={(e) => setMonthlyMinVideos(Math.max(0, Number(e.target.value) || 0))}
                    style={{ display: "block", marginTop: 8, marginBottom: 6, width: "100%", maxWidth: 240, padding: "8px 10px", boxSizing: "border-box", borderRadius: 8, border: "1px solid #ddd" }}
                  />
                  <div style={{ marginBottom: 12, color: "#64748b", fontSize: 13 }}>
                    预计金额：{monthlyEstimatedAmount} ฿（650 × {monthlyEffectiveVideos} × {monthlyEffectiveMonths}）
                  </div>

                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <input type="checkbox" checked={weeklyBatchEnabled} onChange={(e) => setWeeklyBatchEnabled(e.target.checked)} />
                    按周分批验收与结算
                  </label>
                </>
              )}

              {orderTypeId === "creator_review_video" && (
                <>
                  <label htmlFor="creatorTaskCount">任务条数（8-10）</label>
                  <input
                    id="creatorTaskCount"
                    type="number"
                    min={8}
                    max={10}
                    value={creatorTaskCount}
                    onChange={(e) => setCreatorTaskCount(Math.max(0, Number(e.target.value) || 0))}
                    style={{ display: "block", marginTop: 8, marginBottom: 12, width: "100%", maxWidth: 240, padding: "8px 10px", boxSizing: "border-box", borderRadius: 8, border: "1px solid #ddd" }}
                  />
                  <div style={{ marginBottom: 12, color: "#64748b", fontSize: 13 }}>
                    本单单价由平台统一配置。
                  </div>
                </>
              )}

              <label htmlFor="offlineTalent">
                {orderTypeId === "high_quality_custom_video"
                  ? "Influencer/Creator账号（必填，商家需从平台选择）"
                  : orderTypeId === "monthly_package"
                    ? "Creator账号（可选，可由我方匹配）"
                    : "Creator账号（必填，商家需从平台选择）"}
              </label>
              <input
                id="offlineTalent"
                type="text"
                value={offlineTalent}
                onChange={(e) => setOfflineTalent(e.target.value)}
                placeholder={
                  orderTypeId === "monthly_package" ? "可留空，由我方匹配" : "请输入平台内已选账号/昵称"
                }
                style={{ display: "block", marginTop: 8, marginBottom: 12, width: "100%", maxWidth: 560, padding: "8px 10px", boxSizing: "border-box", borderRadius: 8, border: "1px solid #ddd" }}
              />

              <label htmlFor="offlineRequirement">需求说明（可选）</label>
              <textarea
                id="offlineRequirement"
                value={offlineRequirement}
                onChange={(e) => setOfflineRequirement(e.target.value)}
                placeholder="可填写脚本/参考视频/审核要求/修改说明等"
                rows={4}
                style={{ display: "block", marginTop: 8, marginBottom: 12, width: "100%", maxWidth: 560, padding: "8px 10px", boxSizing: "border-box", borderRadius: 8, border: "1px solid #ddd" }}
              />
            </>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>

            {validationErrors.length > 0 && (
              <div style={{
                background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "6px 14px",
                color: "#b91c1c", fontSize: 13, lineHeight: 1.8, whiteSpace: "nowrap",
              }}>
                {validationErrors.map((err, i) => (
                  <div key={i}>• {err}</div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleCreate}
              disabled={!canSubmit}
              style={{
                padding: "8px 16px",
                background: "var(--xt-accent)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor: !canSubmit ? "not-allowed" : "pointer",
                opacity: !canSubmit ? 0.6 : 1,
              }}
            >
              发布
            </button>

            {orderTypeId === "graded_video" ? (
              <span style={{ fontSize: 13, color: canAfford ? "#64748b" : "#c00" }}>
                本次将消耗 <strong>{totalConsumePoints}</strong> 积分（{consumePoints} × {taskCount}）
                {balance != null ? `（当前余额 ${balance}）` : ""}
              </span>
            ) : (
              <span style={{ fontSize: 13, color: "#64748b" }}>
                {orderTypeId === "high_quality_custom_video" && `金额：${offlineAmount} ฿/条`}
                {orderTypeId === "monthly_package" && `金额：${monthlyEstimatedAmount} ฿（650 × ${monthlyEffectiveVideos} × ${monthlyEffectiveMonths}）`}
                {orderTypeId === "creator_review_video" && "金额：本单单价由平台统一配置"}
              </span>
            )}

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

          {combinedRows.map((row) => {
            if (row.kind === "graded") {
              const o = row.order;
              return (
                <div
                  key={`m-${o.id}`}
                  data-order-kind="market"
                  data-order-id={o.id}
                  style={{ padding: 16, background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
                >
                  <div style={{ marginBottom: 10, padding: "6px 10px", borderRadius: 8, background: "#f1f5f9", color: "#0f172a", fontWeight: 700, fontSize: 13 }}>
                    订单日期：{formatDateTime(o.created_at)}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span>订单号：{o.order_no || `（内部ID ${o.id}）`}</span>
                        <span style={tagStyle("graded_video")}>{typeText("graded_video")}</span>
                      </div>
                      {o.title && <div style={{ marginTop: 6, fontSize: 14, color: "#334155" }}>标题：{o.title}</div>}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <div style={{ color: "#64748b", fontSize: 13 }}>视频数量/积分</div>
                      <div style={{ fontSize: 14 }}>
                        <div style={{ marginBottom: 4 }}>视频数量：{o.task_count || "-"} 条</div>
                        <div>
                          金额：
                          <span style={{ fontWeight: 600, color: "var(--xt-accent)" }}>{marketOrderTotalRewardPoints(o)} 积分</span>
                          <span style={{ color: "#64748b", marginLeft: 4 }}>（单套 {o.reward_points} 积分 × 视频数量：{marketOrderTaskCount(o)}）</span>
                        </div>
                      </div>

                      {o.status === "open" && (
                        <>
                          <button type="button" onClick={() => nav(`/client/market-orders/${o.id}/edit`)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #dbe1ea", background: "#fff", cursor: "pointer" }}>
                            编辑
                          </button>

                          <button type="button" onClick={() => handleDelete(o.id)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #fecaca", background: "#fff", color: "#b91c1c", cursor: "pointer" }}>
                            删除
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {(o.status === "claimed" || o.status === "completed" || !!o.influencer_id || !!o.influencer_username) && (
                    <p style={{ margin: "8px 0 0", fontSize: 14, fontWeight: 600, color: "#0f766e" }}>领取达人账号昵称：{resolveClaimerText(o)}</p>
                  )}

                  <p style={{ margin: "8px 0 0", fontSize: 13, color: "#475569" }}>发布方式：{resolvePublishMethodText(o.publish_method)}</p>

                  {!!resolveTikTokLink(o) && (
                    <p style={{ margin: "8px 0 0", fontSize: 13 }}>
                      TikTok：
                      <a href={resolveTikTokLink(o)} target="_blank" rel="noreferrer">
                        {resolveTikTokLink(o)}
                      </a>
                    </p>
                  )}

                  {!!resolvePublishLink(o) && (
                    <p style={{ margin: "8px 0 0", fontSize: 13 }}>
                      发布链接：
                      <a href={resolvePublishLink(o)} target="_blank" rel="noreferrer">
                        {resolvePublishLink(o)}
                      </a>
                    </p>
                  )}

                  {(Array.isArray(o.sku_codes) && o.sku_codes.length > 0) || (Array.isArray(o.sku_images) && o.sku_images.length > 0) ? (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 13, color: "#475569" }}>SKU 信息</div>
                      {Array.isArray(o.sku_codes) && o.sku_codes.length > 0 && <div style={{ marginTop: 4, fontSize: 13, color: "#334155" }}>{o.sku_codes.join("，")}</div>}
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

                  <p style={{ margin: "8px 0 0", fontSize: 13, color: "#475569" }}>
                    店铺名称：{o.client_shop_name?.trim() || "未填写"} · 对接群聊：{o.client_group_chat?.trim() || "未填写"}
                  </p>

                  <p style={{ margin: "8px 0 0", fontSize: 14 }}>
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
                  </p>

                  <p style={{ margin: "8px 0 0", fontSize: 12, color: "#999" }}>{o.completed_at ? `完成：${formatDateTime(o.completed_at)}` : "完成：—"}</p>
                </div>
              );
            }

            const o = row.order;
            const req = (o.requirements || {}) as Record<string, any>;
            const shopName = String(req.client_shop_name || "").trim();
            const groupChat = String(req.client_group_chat || "").trim();
            const proofLinks = (Array.isArray(o.proof_links) ? o.proof_links : [])
              .map((x: any) => (typeof x === "string" ? x : String(x?.url || x?.link || "")).trim())
              .filter(Boolean);
            const publishLinks = (Array.isArray(o.publish_links) ? o.publish_links : [])
              .map((x: any) => (typeof x === "string" ? x : String(x?.url || x?.link || "")).trim())
              .filter(Boolean);
            const batches = Array.isArray(o.batch_payload) ? (o.batch_payload as any[]) : [];

            const canAccept =
              o.payment_status === "paid" &&
              (o.type_id === "creator_review_video" ? o.phase === "published" : o.phase === "delivered");
            const canReject = o.payment_status === "paid" && ["delivered", "published"].includes(o.phase);

            return (
              <div
                key={`v-${o.id}`}
                data-order-kind="video"
                data-order-id={o.id}
                style={{ padding: 16, background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
              >
                <div style={{ marginBottom: 10, padding: "6px 10px", borderRadius: 8, background: "#f1f5f9", color: "#0f172a", fontWeight: 700, fontSize: 13 }}>
                  订单日期：{formatDateTime(o.created_at)}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span>订单号：VO-{o.id}</span>
                      <span style={tagStyle(o.type_id)}>{typeText(o.type_id)}</span>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 14, color: "#334155" }}>标题：{o.title}</div>
                    <div style={{ marginTop: 6, fontSize: 13, color: "#475569" }}>
                      付款：{o.payment_status === "paid" ? "已付款" : "未付款"} · 状态：{phaseText(o)}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <div style={{ color: "#64748b", fontSize: 13 }}>金额(฿)</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--xt-accent)" }}>{Number(o.amount_thb || 0).toFixed(2)}</div>

                    <button
                      type="button"
                      disabled={!canAccept}
                      onClick={() => handleOfflineAccept(o.id)}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #bbf7d0", background: "#fff", color: "#166534", cursor: canAccept ? "pointer" : "not-allowed", opacity: canAccept ? 1 : 0.5 }}
                    >
                      验收通过
                    </button>

                    <button
                      type="button"
                      disabled={!canReject}
                      onClick={() => handleOfflineReject(o.id)}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #fecaca", background: "#fff", color: "#b91c1c", cursor: canReject ? "pointer" : "not-allowed", opacity: canReject ? 1 : 0.5 }}
                    >
                      驳回
                    </button>
                  </div>
                </div>

                {(shopName || groupChat) && (
                  <p style={{ margin: "8px 0 0", fontSize: 13, color: "#475569" }}>
                    店铺名称：{shopName || "未填写"} · 对接群聊：{groupChat || "未填写"}
                  </p>
                )}

                {Array.isArray(proofLinks) && proofLinks.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 13 }}>
                    <div style={{ color: "#475569" }}>交付链接</div>
                    <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 4 }}>
                      {proofLinks.slice(0, 8).map((url, i) => (
                        <a key={`proof-${o.id}-${i}`} href={url} target="_blank" rel="noreferrer">
                          {url}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {Array.isArray(publishLinks) && publishLinks.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 13 }}>
                    <div style={{ color: "#475569" }}>发布链接</div>
                    <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 4 }}>
                      {publishLinks.slice(0, 8).map((url, i) => (
                        <a key={`pub-${o.id}-${i}`} href={url} target="_blank" rel="noreferrer">
                          {url}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {o.type_id === "monthly_package" && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 13, color: "#475569", marginBottom: 6 }}>批次验收 / 结算</div>
                    {batches.length === 0 ? (
                      <div style={{ fontSize: 13, color: "#94a3b8" }}>暂无批次（员工提交后会生成）</div>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #e2e8f0" }}>批次</th>
                              <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #e2e8f0" }}>提交</th>
                              <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #e2e8f0" }}>交付链接</th>
                              <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #e2e8f0" }}>验收</th>
                              <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #e2e8f0" }}>状态</th>
                              <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #e2e8f0" }}>结算(฿)</th>
                              <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #e2e8f0" }}>操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            {batches.map((b) => {
                              const bn = Number(b?.batch_no || 0);
                              const status = String(b?.status || "");
                              const canBatchAccept = o.payment_status === "paid" && status === "pending_acceptance";
                              const canBatchSettle = o.payment_status === "paid" && status === "accepted";
                              const links = extractBatchLinks(b);
                              return (
                                <tr key={`batch-${o.id}-${bn}`}>
                                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #f1f5f9" }}>{bn || "-"}</td>
                                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #f1f5f9" }}>{Number(b?.video_count || 0) || 0}</td>
                                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #f1f5f9" }}>
                                    {links.length > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setLinksModalLinks(links);
                                          setLinksModalOpen(true);
                                        }}
                                        style={{ padding: "4px 8px", borderRadius: 8, border: "1px solid #dbe1ea", background: "#fff", cursor: "pointer" }}
                                      >
                                        查看（{links.length}）
                                      </button>
                                    ) : (
                                      <span style={{ color: "#94a3b8" }}>暂无</span>
                                    )}
                                  </td>
                                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #f1f5f9" }}>{Number(b?.accepted_count || 0) || 0}</td>
                                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #f1f5f9" }}>{status || "-"}</td>
                                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #f1f5f9" }}>{Number(b?.settled_amount || 0).toFixed(2)}</td>
                                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #f1f5f9" }}>
                                    <button
                                      type="button"
                                      disabled={!canBatchAccept}
                                      onClick={() => handleMonthlyBatchAccept(o.id, bn)}
                                      style={{ padding: "4px 8px", borderRadius: 8, border: "1px solid #bbf7d0", background: "#fff", color: "#166534", cursor: canBatchAccept ? "pointer" : "not-allowed", opacity: canBatchAccept ? 1 : 0.5, marginRight: 6 }}
                                    >
                                      验收
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!canBatchSettle}
                                      onClick={() => handleMonthlyBatchSettle(o.id, bn)}
                                      style={{ padding: "4px 8px", borderRadius: 8, border: "1px solid #dbe1ea", background: "#fff", cursor: canBatchSettle ? "pointer" : "not-allowed", opacity: canBatchSettle ? 1 : 0.5 }}
                                    >
                                      结算
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

        </div>

      )}

      {!loading && combinedRows.length === 0 && <p style={{ color: "#666" }}>暂无订单</p>}

      <WorkLinksModal open={linksModalOpen} onClose={() => setLinksModalOpen(false)} links={linksModalLinks} title="交付链接" />

    </div>

  );

}

