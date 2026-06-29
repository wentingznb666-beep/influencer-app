import { compactPx } from "../responsive";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { applyMatchingOrder, getInfluencerMatchingTaskHall, getMyLinkAcceptance, getMyMatchingApplies, publishMatchingOrder, submitMatchingProof } from "../influencerApi";
import { showToastNotice } from "../utils/showToast";
import { useScrollLock } from "../hooks/useScrollLock";

type TaskItem = {
  id: number;
  order_id?: number;
  order_no: string | null;
  title: string | null;
  client_name?: string;
  client_username?: string;
  task_amount: number | string | null;
  created_at: string;
  detail_json?: Record<string, unknown> | null;
  attachment_urls?: unknown;
  applied_count?: number | null;
  apply_status?: string;
  order_status?: string;
  work_links?: string[];
  cooperation_type_id?: unknown;
  coop_phase?: unknown;
  coop_publish_links?: unknown;
};

type LinkAcceptanceItem = {
  link?: string;
  url?: string;
  accepted?: boolean;
  rejected?: boolean;
  payment_url?: string;
};

/** 统一报名状态文案（中文键，供 t() 映射）。 */
function formatApplyStatus(status: string | undefined): string {
  if (status === "pending") return "待选择";
  if (status === "selected") return "已选中";
  if (status === "rejected") return "已拒绝";
  return status || "-";
}

/** 统一订单状态文案（中文键，供 t() 映射）。 */
function formatOrderStatus(status: string | undefined): string {
  if (status === "claimed") return "进行中";
  if (status === "completed") return "已完成";
  if (status === "accepted") return "已验收";
  return status || "-";
}

/**
 * 已报名卡片左侧强调色：进行中黄、完成灰、默认可接绿。
 */
function appliedAccentBorder(status: string | undefined) {
  if (status === "claimed") return "#f59e0b";
  if (status === "completed" || status === "accepted") return "#94a3b8";
  return "#16a34a";
}

function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url);
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v|avi)(\?|$)/i.test(url);
}

function detailObj(item: TaskItem | null): Record<string, unknown> {
  const d = item?.detail_json;
  return d && typeof d === "object" ? (d as Record<string, unknown>) : {};
}

function detailValue(item: TaskItem | null, key: string): unknown {
  const d = detailObj(item);
  return d[key];
}

function detailText(item: TaskItem | null, key: string): string {
  const v = detailValue(item, key);
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function arrayText(item: TaskItem | null, key: string): string[] {
  const v = detailValue(item, key);
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x || "").trim()).filter(Boolean);
}

function recruitTotal(item: TaskItem | null): number {
  const n = Number(detailValue(item, "recruit_count") || 0);
  return Number.isFinite(n) ? n : 0;
}

function appliedCount(item: TaskItem | null): number {
  const n = Number(item?.applied_count || 0);
  return Number.isFinite(n) ? n : 0;
}

function isRecruitFull(item: TaskItem | null): boolean {
  const total = recruitTotal(item);
  if (total <= 0) return false;
  return appliedCount(item) >= total;
}

function attachments(item: TaskItem | null): string[] {
  const raw = item?.attachment_urls;
  const rawObj = raw && typeof raw === "object" ? (raw as { urls?: unknown }) : null;
  const arr: unknown[] = Array.isArray(raw) ? raw : Array.isArray(rawObj?.urls) ? rawObj.urls : [];
  return arr.map((x: unknown) => String(x || "").trim()).filter(Boolean);
}

function toastRecruitFull(t: (k: string) => string): void {
  showToastNotice(t("招募数量已满"), { variant: "error", placement: "top-right" });
}

function parseRangeFromText(text: string): { min: number; max: number } | null {
  const nums = String(text || "")
    .replace(/,/g, "")
    .match(/\d+(?:\.\d+)?/g);
  if (!nums || nums.length < 2) return null;
  const a = Number(nums[0]);
  const b = Number(nums[1]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  if (min <= 0 || max <= 0) return null;
  if (min === max) return null;
  return { min, max };
}

function estimatedEarningsText(item: TaskItem | null, lang: string): string {
  const rawReward = detailText(item, "reward_text");
  const range = rawReward ? parseRangeFromText(rawReward) : null;
  if (range) {
    if (String(lang || "").toLowerCase().startsWith("th")) return `${range.min}-${range.max} บาท/วิดีโอ`;
    return `${range.min}-${range.max}泰铢/条视频`;
  }
  const v = item?.task_amount;
  if (v === null || v === undefined || String(v).trim() === "") return "—";
  return String(v);
}

function OrderDetailModal({
  open,
  onClose,
  item,
  t,
  lang,
}: {
  open: boolean;
  onClose: () => void;
  item: TaskItem | null;
  t: (k: string) => string;
  lang: string;
}) {
  useScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const title = detailText(item, "task_name") || (item?.title ? t(item.title) : t("未命名"));
  const orderNo = item?.order_no || (item?.id ? `#${item.id}` : "-");
  const merchantInfo = (detailValue(item, "merchant_info") || null) as { shop_name?: unknown; product_type?: unknown; shop_link?: unknown } | null;
  const merchantShopName = String(merchantInfo?.shop_name || "").trim() || detailText(item, "merchant_shop_name") || "-";
  const merchantProductType = String(merchantInfo?.product_type || "").trim() || detailText(item, "merchant_product_type") || "-";
  const merchantShopLink = String(merchantInfo?.shop_link || "").trim() || detailText(item, "merchant_shop_link") || "";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: compactPx(16),
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: compactPx(12),
          boxShadow: "0 10px 40px rgba(15,23,42,0.2)",
          maxWidth: compactPx(860),
          width: "100%",
          maxHeight: "80vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid #eef2f7" }}>
          <div style={{ fontWeight: 900, color: "var(--xt-primary)" }}>{t("订单详情")}</div>
          <button type="button" onClick={onClose} style={{ padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: compactPx(8), background: "#fff", cursor: "pointer" }}>
            {t("关闭")}
          </button>
        </div>

        <div style={{ padding: compactPx(16), overflow: "auto" }}>
          <div className="xt-inf-card" style={{ padding: compactPx(14), border: "1px solid var(--xt-border)", borderRadius: compactPx(12) }}>
            <div style={{ fontWeight: 900, fontSize: compactPx(16), color: "var(--xt-primary)" }}>{title}</div>
            <div style={{ marginTop: compactPx(6), color: "#475569", fontSize: compactPx(13) }}>
              {t("订单编号")}：{orderNo} ｜ {t("预估收益")}：{estimatedEarningsText(item, lang)}
            </div>
            <div style={{ marginTop: compactPx(6), color: "#64748b", fontSize: compactPx(12) }}>{t("最终收益根据视频互动数据结算")}</div>
            <div style={{ marginTop: compactPx(6), color: "#475569", fontSize: compactPx(13) }}>
              {t("招募人数")}：{recruitTotal(item) || "-"} ｜ {t("已报名人数")}：{appliedCount(item)}
            </div>
          </div>

          <div style={{ marginTop: compactPx(12), display: "grid", gap: compactPx(10) }}>
            <div className="xt-inf-card" style={{ padding: compactPx(14) }}>
              <div style={{ fontWeight: 900, marginBottom: compactPx(8) }}>{t("商家基础信息")}</div>
              <div style={{ display: "grid", gap: compactPx(6), fontSize: compactPx(14) }}>
                <div>
                  {t("商家")}：{item?.client_name || item?.client_username || "-"}
                </div>
                <div>
                  {t("店铺名称")}：{merchantShopName}
                </div>
                <div>
                  {t("产品类型")}：{merchantProductType}
                </div>
                <div style={{ wordBreak: "break-all" }}>
                  {t("店铺链接")}：
                  {merchantShopLink ? (
                    <a href={merchantShopLink} target="_blank" rel="noreferrer">
                      {merchantShopLink}
                    </a>
                  ) : (
                    "-"
                  )}
                </div>
                <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {t("销售概述")}：{detailText(item, "merchant_sales_summary") || "-"}
                </div>
              </div>
            </div>

            <div className="xt-inf-card" style={{ padding: compactPx(14) }}>
              <div style={{ fontWeight: 900, marginBottom: compactPx(8) }}>{t("任务基础信息")}</div>
              <div style={{ display: "grid", gap: compactPx(6), fontSize: compactPx(14) }}>
                <div>
                  {t("任务名称")}：{detailText(item, "task_name") || title}
                </div>
                <div>
                  {t("任务类型")}：{detailText(item, "task_type") || "-"}
                </div>
                <div>
                  {t("行业")}：{detailText(item, "industry") || "-"}
                </div>
                <div>
                  {t("任务开始时间")}：{detailText(item, "start_date") || "-"}
                </div>
                <div>
                  {t("接单截止时间")}：{detailText(item, "order_deadline") || "-"}
                </div>
                <div>
                  {t("内容发布截止时间")}：{detailText(item, "publish_deadline") || "-"}
                </div>
              </div>
            </div>

            <div className="xt-inf-card" style={{ padding: compactPx(14) }}>
              <div style={{ fontWeight: 900, marginBottom: compactPx(8) }}>{t("合作内容要求")}</div>
              <div style={{ display: "grid", gap: compactPx(6), fontSize: compactPx(14) }}>
                <div>
                  {t("推广产品/品牌")}：{detailText(item, "product_name") || "-"}
                </div>
                <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {t("产品核心卖点")}：{detailText(item, "selling_points") || "-"}
                </div>
                <div>
                  {t("内容形式")}：{detailText(item, "content_form") || "-"}
                </div>
                <div>
                  {t("视频时长")}：{detailText(item, "video_duration") || "-"}
                </div>
                <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {t("文案要求")}：{detailText(item, "copy_requirement") || "-"}
                </div>
                <div>
                  {t("必须包含元素")}：
                  {arrayText(item, "must_elements").length ? (
                    <span style={{ marginLeft: compactPx(6) }}>{arrayText(item, "must_elements").join(" / ")}</span>
                  ) : (
                    <span style={{ marginLeft: compactPx(6) }}>-</span>
                  )}
                </div>
                <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {t("禁用内容")}：{detailText(item, "forbidden_content") || "-"}
                </div>
              </div>
            </div>

            <div className="xt-inf-card" style={{ padding: compactPx(14) }}>
              <div style={{ fontWeight: 900, marginBottom: compactPx(8) }}>{t("样品说明")}</div>
              <div style={{ display: "grid", gap: compactPx(6), fontSize: compactPx(14) }}>
                <div>
                  {t("是否提供样品")}：{String(detailValue(item, "provide_sample") ?? "-")}
                </div>
                <div>
                  {t("样品数量")}：{detailText(item, "sample_count") || "-"}
                </div>
                <div>
                  {t("样品是否回收")}：{String(detailValue(item, "sample_recycle") ?? "-")}
                </div>
                <div>
                  {t("运费承担方")}：{detailText(item, "freight_side") || "-"}
                </div>
              </div>
            </div>

            <div className="xt-inf-card" style={{ padding: compactPx(14) }}>
              <div style={{ fontWeight: 900, marginBottom: compactPx(8) }}>{t("发货与验收标准")}</div>
              <div style={{ display: "grid", gap: compactPx(6), fontSize: compactPx(14) }}>
                <div>
                  {t("准时发布")}：{String(detailValue(item, "standard_publish_on_time") ?? "-")}
                </div>
                <div>
                  {t("无违规")}：{String(detailValue(item, "standard_clear_no_violation") ?? "-")}
                </div>
                <div>
                  {t("内容保留天数")}：{detailText(item, "keep_days") || "-"}
                </div>
                <div>
                  {t("修改次数")}：{detailText(item, "revise_times") || "-"}
                </div>
                <div>
                  {t("不合格处理")}：{detailText(item, "unqualified_action") || "-"}
                </div>
              </div>
            </div>

            <div className="xt-inf-card" style={{ padding: compactPx(14) }}>
              <div style={{ fontWeight: 900, marginBottom: compactPx(8) }}>{t("平台规则 / 版权协议")}</div>
              <div style={{ display: "grid", gap: compactPx(6), fontSize: compactPx(14) }}>
                <div>
                  {t("授权可用于推广")}：{String(detailValue(item, "rights_granted") ?? "-")}
                </div>
                <div>
                  {t("禁止作弊")}：{String(detailValue(item, "no_cheat") ?? "-")}
                </div>
                <div>
                  {t("违规处理")}：{detailText(item, "violation_action") || "-"}
                </div>
              </div>
            </div>

            <div className="xt-inf-card" style={{ padding: compactPx(14) }}>
              <div style={{ fontWeight: 900, marginBottom: compactPx(8) }}>{t("结算信息")}</div>
              <div style={{ display: "grid", gap: compactPx(6), fontSize: compactPx(14) }}>
                <div>
                  {t("单条佣金")}：{detailText(item, "unit_commission") || "-"}
                </div>
              </div>
            </div>

            <div className="xt-inf-card" style={{ padding: compactPx(14) }}>
              <div style={{ fontWeight: 900, marginBottom: compactPx(8) }}>{t("附件")}</div>
              {attachments(item).length ? (
                <div style={{ display: "grid", gap: compactPx(10) }}>
                  {attachments(item).map((url, idx) => (
                    <div key={`${idx}-${url.slice(0, 24)}`} style={{ border: "1px solid #eef2f7", borderRadius: compactPx(12), padding: compactPx(10), background: "#fff" }}>
                      {isImageUrl(url) ? (
                        <img src={url} alt="" style={{ width: "100%", maxHeight: 360, objectFit: "contain", borderRadius: compactPx(10), background: "#f8fafc" }} />
                      ) : isVideoUrl(url) ? (
                        <video src={url} controls style={{ width: "100%", maxHeight: 420, borderRadius: compactPx(10), background: "#000" }} />
                      ) : (
                        <a href={url} target="_blank" rel="noreferrer">
                          {url}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: "#94a3b8" }}>-</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 达人任务大厅：可报名与已报名双标签。 */
export default function TaskHallPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const focusOrderIdRef = useRef<number>(0);
  const [tab, setTab] = useState<"available" | "applied">("available");
  const [list, setList] = useState<TaskItem[]>([]);
  const [myApplies, setMyApplies] = useState<TaskItem[]>([]);
  const [proofMap, setProofMap] = useState<Record<number, string>>({});
  const [publishMap, setPublishMap] = useState<Record<number, string>>({});
  const [linkAcceptanceMap, setLinkAcceptanceMap] = useState<Record<number, LinkAcceptanceItem[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeOrder, setActiveOrder] = useState<TaskItem | null>(null);

  /** 拉取任务大厅与我的报名。 */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [hallData, myData] = await Promise.all([getInfluencerMatchingTaskHall(), getMyMatchingApplies()]);
      setList((hallData?.list || []) as TaskItem[]);
      setMyApplies((myData?.list || []) as TaskItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("加载失败"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  /** 加载所有已报名订单的验收状态 */
  const loadLinkAcceptance = useCallback(async (applies: TaskItem[]) => {
    const map: Record<number, LinkAcceptanceItem[]> = {};
    await Promise.all(applies.map(async (it) => {
      const oid = Number(it.order_id || 0);
      if (!oid) return;
      try {
        const data = await getMyLinkAcceptance(oid);
        if (data?.list?.length) map[oid] = data.list;
      } catch {}
    }));
    setLinkAcceptanceMap(map);
  }, []);

  useEffect(() => {
    if (tab === "applied" && myApplies.length > 0) {
      void loadLinkAcceptance(myApplies);
    }
  }, [tab, myApplies, loadLinkAcceptance]);

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const orderId = Number(sp.get("orderId") || 0);
    if (!Number.isFinite(orderId) || orderId < 1) return;
    focusOrderIdRef.current = orderId;
    setTab("applied");
  }, [location.search]);

  useEffect(() => {
    const id = focusOrderIdRef.current;
    if (!id) return;
    if (loading) return;
    const el = document.querySelector<HTMLElement>(`[data-order-id="${id}"]`);
    if (!el) return;
    focusOrderIdRef.current = 0;
    window.setTimeout(() => el.scrollIntoView({ block: "center" }), 0);
  }, [loading, tab, list.length, myApplies.length]);

  /** 报名商家任务。 */
  const apply = async (item: TaskItem) => {
    setError(null);
    setMsg("");
    try {
      if (isRecruitFull(item)) {
        toastRecruitFull(t);
        return;
      }
      await applyMatchingOrder(item.id);
      await load();
      setTab("applied");
      setMsg(t("报名成功"));
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : t("报名失败");
      setError(errMsg);
      if (errMsg.includes("招募数量已满")) toastRecruitFull(t);
      if (errMsg.includes("请先完善达人信息")) {
        window.alert(t("请先完善达人信息后再报名任务"));
        navigate("/influencer/profile");
      }
    }
  };

  /** 提交完成回传短视频。 */
  const submitProof = async (orderId: number) => {
    const videoUrl = (proofMap[orderId] || "").trim();
    if (!videoUrl) {
      setError(t("请先填写短视频链接"));
      return;
    }
    setError(null);
    setMsg("");
    try {
      await submitMatchingProof(orderId, videoUrl);
      await load();
      setMsg(t("回传成功，等待商家验收"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("提交失败"));
    }
  };

  const submitPublish = async (orderId: number) => {
    const publishUrl = (publishMap[orderId] || "").trim();
    if (!publishUrl) {
      setError(t("请先填写发布链接"));
      return;
    }
    setError(null);
    setMsg("");
    try {
      await publishMatchingOrder(orderId, publishUrl);
      await load();
      setMsg(t("发布链接已提交"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("提交失败"));
    }
  };

  /** 当前已报名列表。 */
  const appliedList = useMemo(() => myApplies, [myApplies]);

  /** 任务分类筛选 */
  const CATEGORY_ALL = "全部";
  const TASK_CATEGORIES: { key: string; label: string; thLabel: string }[] = [
    { key: "全部", label: "全部任务", thLabel: "งานทั้งหมด" },
    { key: "creator_review_video", label: "Creator 带货测评", thLabel: "Creator รีวิวสินค้า" },
    { key: "high_quality_custom_video", label: "高质量定制视频", thLabel: "วิดีโอคุณภาพสูง" },
    { key: "monthly_package", label: "包月合作套餐", thLabel: "แพ็กเกจรายเดือน" },
  ];
  const [taskCategory, setTaskCategory] = useState(CATEGORY_ALL);
  // 记录哪些卡片展开了详情
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const toggleCard = (id: number) => setExpandedCards(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const filteredList = useMemo(() => {
    if (taskCategory === CATEGORY_ALL) return list;
    return list.filter((item) => {
      const ct = String(item.cooperation_type_id || "").trim();
      if (!ct) return false;
      // 模糊匹配：允许子类型归入大类
      return ct === taskCategory || ct.startsWith(taskCategory + "_");
    });
  }, [list, taskCategory]);

  return (
    <div>
      <h2 className="xt-inf-page-title">{t("任务大厅（撮合模式）")}</h2>
      <p className="xt-inf-lead">{t("浏览可报名任务或查看已报名进度；收益与状态以卡片内展示为准。")}</p>
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      {msg && <p style={{ color: "#166534" }}>{msg}</p>}
      <div style={{ display: "flex", gap: compactPx(8), marginBottom: compactPx(12), flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => setTab("available")}
          disabled={tab === "available"}
          style={{
            padding: "8px 14px",
            borderRadius: compactPx(8),
            border: "1px solid var(--xt-border)",
            background: tab === "available" ? "rgba(21,42,69,0.08)" : "#fff",
            fontWeight: 700,
          }}
        >
          {t("可报名")}
        </button>
        <button
          type="button"
          onClick={() => setTab("applied")}
          disabled={tab === "applied"}
          style={{
            padding: "8px 14px",
            borderRadius: compactPx(8),
            border: "1px solid var(--xt-border)",
            background: tab === "applied" ? "rgba(21,42,69,0.08)" : "#fff",
            fontWeight: 700,
          }}
        >
          {t("已报名")}
        </button>
        <button type="button" className="xt-accent-btn" onClick={() => void load()} style={{ marginLeft: "auto" }}>
          {t("刷新")}
        </button>
      </div>
      {loading ? <p>{t("加载中…")}</p> : null}

      {!loading && tab === "available" && (
        <>
          {/* 任务分类筛选 */}
          <div style={{ display: "flex", gap: compactPx(6), marginBottom: compactPx(12), flexWrap: "wrap" }}>
            {TASK_CATEGORIES.map((cat) => {
              const label = i18n.language === "th" ? cat.thLabel : cat.label;
              const active = taskCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setTaskCategory(cat.key)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: compactPx(20),
                    border: active ? "1px solid var(--xt-accent)" : "1px solid var(--xt-border)",
                    background: active ? "rgba(21,42,69,0.08)" : "#fff",
                    color: active ? "var(--xt-accent)" : "#64748b",
                    fontWeight: active ? 700 : 500,
                    fontSize: compactPx(13),
                    cursor: "pointer",
                  }}
                >
                  {t(label)}
                </button>
              );
            })}
          </div>

          {filteredList.length === 0 ? (
            <div className="xt-inf-empty xt-inf-card">
              <div className="xt-inf-empty-icon" aria-hidden>
                📋
              </div>
              <div>{list.length === 0 ? t("暂无可报名任务") : t("该分类暂无任务")}</div>
            </div>
          ) : null}
          <div style={{ display: "grid", gap: compactPx(10) }}>
            {filteredList.map((item) => {
              const isExpanded = expandedCards.has(item.id);
              const title = item.title ? t(item.title) : t("未命名");
              const merchant = item.client_name || item.client_username || "-";
              return (
              <div key={item.id} className="xt-inf-card" data-order-id={item.id} style={{ padding: compactPx(14), borderLeft: "4px solid #16a34a", cursor: "pointer" }} onClick={() => toggleCard(item.id)}>
                {/* 第一行：订单号 + 商家 */}
                <div style={{ display: "flex", gap: compactPx(12), flexWrap: "wrap", alignItems: "baseline", marginBottom: compactPx(4) }}>
                  <span style={{ fontWeight: 600, color: "#334155", fontSize: compactPx(12) }}>
                    {item.order_no || `#${item.id}`}
                  </span>
                  <span style={{ color: "#94a3b8", fontSize: compactPx(12) }}>
                    {merchant}
                  </span>
                </div>

                {/* 第二行：标题（截断）+ 收益 */}
                <div style={{ display: "flex", alignItems: "center", gap: compactPx(10) }}>
                  <span style={{
                    fontWeight: 700, color: "var(--xt-primary)", fontSize: compactPx(15),
                    flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {title}
                  </span>
                  <span style={{ fontWeight: 800, color: "var(--xt-accent)", fontSize: compactPx(15), whiteSpace: "nowrap", flexShrink: 0 }}>
                    {estimatedEarningsText(item, i18n.language)}
                  </span>
                </div>

                {/* 第三行：招募数 + 操作 */}
                <div style={{ display: "flex", alignItems: "center", gap: compactPx(10), marginTop: compactPx(6) }}>
                  <span style={{ fontSize: compactPx(12), color: "#94a3b8" }}>
                    {recruitTotal(item) || "-"}{t("人招募")} · {appliedCount(item)}{t("人已报")}
                  </span>
                  <span style={{
                    fontSize: compactPx(10), color: "var(--xt-accent)", fontWeight: 600,
                    transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                  }}>
                    {isExpanded ? "▲" : "▼"} {isExpanded ? t("收起") : t("展开")}
                  </span>
                  <div style={{ marginLeft: "auto", display: "flex", gap: compactPx(8) }} onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => (setActiveOrder(item), setDetailOpen(true))}
                      style={{ padding: "4px 10px", borderRadius: compactPx(6), border: "1px solid var(--xt-border)", background: "#fff", fontWeight: 600, fontSize: compactPx(12), cursor: "pointer" }}>
                      📋
                    </button>
                    <button type="button" className="xt-accent-btn" disabled={isRecruitFull(item)} onClick={() => void apply(item)}
                      style={{ opacity: isRecruitFull(item) ? 0.6 : 1, fontSize: compactPx(12), padding: "4px 12px" }}>
                      {t("报名")}
                    </button>
                  </div>
                </div>

                {/* 展开：完整内容 */}
                {isExpanded && (
                  <div onClick={(e) => e.stopPropagation()} style={{ marginTop: compactPx(10), padding: compactPx(12), background: "#f8fafc", borderRadius: compactPx(10), border: "1px solid #eef2f7", fontSize: compactPx(13), color: "#475569", lineHeight: 1.6 }}>
                    {item.title && String(item.title).length > 0 && (
                      <div style={{ marginBottom: compactPx(4) }}><span style={{ color: "#94a3b8" }}>{t("任务名称")}：</span>{title}</div>
                    )}
                    <div style={{ marginBottom: compactPx(4) }}><span style={{ color: "#94a3b8" }}>{t("商家")}：</span>{merchant}</div>
                    <div><span style={{ color: "#94a3b8" }}>{t("预估收益")}：</span>{estimatedEarningsText(item, i18n.language)}</div>
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </>
      )}

      {!loading && tab === "applied" && (
        <>
          {appliedList.length === 0 ? (
            <div className="xt-inf-empty xt-inf-card">
              <div className="xt-inf-empty-icon" aria-hidden>
                🗂️
              </div>
              <div>{t("暂无报名记录")}</div>
            </div>
          ) : null}
          <div style={{ display: "grid", gap: compactPx(10) }}>
            {appliedList.map((it) => {
              const oid = Number(it.order_id || 0);
              const canSubmitProof = it.apply_status === "selected" && it.order_status === "claimed" && oid > 0;
              const coopType = String(it.cooperation_type_id || "").trim();
              const coopPhase = String(it.coop_phase || "").trim();
              const publishLinks = Array.isArray(it.coop_publish_links) ? (it.coop_publish_links as unknown[]) : [];
              const lastPublish = publishLinks.map((x) => String(x || "").trim()).filter(Boolean).slice(-1)[0] || "";
              const canSubmitPublish = it.apply_status === "selected" && it.order_status === "completed" && oid > 0 && coopType === "creator_review_video" && coopPhase === "approved_to_publish";
              const orderLabel = formatOrderStatus(it.order_status);
              const applyLabel = formatApplyStatus(it.apply_status);
              const isExpanded = expandedCards.has(it.id);
              const statusColor = appliedAccentBorder(it.order_status);
              return (
                <div
                  key={it.id}
                  className="xt-inf-card"
                  data-order-id={oid > 0 ? oid : it.id}
                  style={{ padding: 0, borderLeft: `4px solid ${statusColor}`, overflow: "hidden" }}
                >
                  {/* 紧凑摘要行 */}
                  <div
                    onClick={() => toggleCard(it.id)}
                    style={{ padding: `${compactPx(12)}px ${compactPx(14)}px`, display: "flex", alignItems: "center", gap: compactPx(10), cursor: "pointer", userSelect: "none" }}
                  >
                    <span style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: compactPx(20), height: compactPx(20), borderRadius: "50%",
                      background: statusColor, color: "#fff", fontSize: compactPx(11),
                      fontWeight: 700, flexShrink: 0, transition: "transform 0.2s",
                      transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    }}>▼</span>
                    <span style={{ fontWeight: 800, color: "var(--xt-primary)", fontSize: compactPx(15), flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {it.title ? t(it.title) : t("未命名")}
                    </span>
                    <span style={{
                      display: "inline-block", padding: "2px 8px", borderRadius: compactPx(10),
                      fontSize: compactPx(11), fontWeight: 700, whiteSpace: "nowrap",
                      background: orderLabel === "已完成" || orderLabel === "已验收" ? "#dcfce7" : orderLabel === "进行中" ? "#fef3c7" : "#f1f5f9",
                      color: orderLabel === "已完成" || orderLabel === "已验收" ? "#166534" : orderLabel === "进行中" ? "#92400e" : "#64748b",
                    }}>
                      {t(orderLabel)} · {t(applyLabel)}
                    </span>
                  </div>

                  {/* 展开详情区 */}
                  {isExpanded && (
                    <div style={{ padding: `0 ${compactPx(14)}px ${compactPx(14)}px`, borderTop: "1px solid var(--xt-border)", background: "#fafbfc" }}>
                      <div style={{ display: "grid", gap: compactPx(6), paddingTop: compactPx(10), fontSize: compactPx(13), color: "#475569" }}>
                        <div style={{ display: "flex", gap: compactPx(4) }}>
                          <span style={{ color: "#94a3b8", flexShrink: 0 }}>{t("订单号")}：</span>
                          <span style={{ fontWeight: 600, color: "#334155" }}>{it.order_no || "-"}</span>
                        </div>
                      </div>

                      {Array.isArray(it.work_links) && it.work_links.length > 0 && (() => {
                        const raw = String(it.work_links[0] ?? "").trim();
                        const isUrl = /^https?:\/\//i.test(raw);
                        if (!raw) return null;
                        return (
                          <div style={{ marginTop: compactPx(6), display: "flex", gap: compactPx(4), fontSize: compactPx(13) }}>
                            <span style={{ color: "#94a3b8", flexShrink: 0 }}>{t("回传短视频")}：</span>
                            {isUrl ? (
                              <a href={raw} target="_blank" rel="noreferrer" style={{ color: "var(--xt-accent)" }}>{t("查看")}</a>
                            ) : (
                              <span style={{ color: "var(--xt-text-muted)" }}>{raw}</span>
                            )}
                          </div>
                        );
                      })()}

                      {(it.order_status === "completed" || it.order_status === "accepted") && linkAcceptanceMap[oid]?.length > 0 && (
                        <div style={{ marginTop: compactPx(8), padding: compactPx(10), background: "#f0fdf4", borderRadius: compactPx(8), border: "1px solid #bbf7d0" }}>
                          <div style={{ fontWeight: 700, marginBottom: compactPx(4), fontSize: compactPx(12) }}>{t("验收状态")}</div>
                          {linkAcceptanceMap[oid].map((la, idx: number) => (
                            <div key={idx} style={{ display: "flex", alignItems: "center", gap: compactPx(6), padding: "2px 0", fontSize: compactPx(12) }}>
                              <span style={{ color: "#94a3b8" }}>{idx + 1}.</span>
                              {la.accepted ? (
                                <span style={{ color: "#16a34a", fontWeight: 700 }}>✅ {t("已通过")}</span>
                              ) : la.rejected ? (
                                <span style={{ color: "#dc2626", fontWeight: 700 }}>❌ {t("已驳回")}</span>
                              ) : (
                                <span style={{ color: "#64748b" }}>{t("待验收")}</span>
                              )}
                              {la.payment_url && (
                                <a href={la.payment_url} target="_blank" rel="noreferrer" style={{ fontSize: compactPx(11), color: "#10b981", textDecoration: "underline", marginLeft: "auto" }}>
                                  💰 {t("付款截图")}
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {lastPublish ? (() => {
                        const isUrl = /^https?:\/\//i.test(lastPublish);
                        return (
                          <div style={{ marginTop: compactPx(6), display: "flex", gap: compactPx(4), fontSize: compactPx(13) }}>
                            <span style={{ color: "#94a3b8", flexShrink: 0 }}>{t("发布链接")}：</span>
                            {isUrl ? (
                              <a href={lastPublish} target="_blank" rel="noreferrer" style={{ color: "var(--xt-accent)" }}>{t("查看")}</a>
                            ) : (
                              <span style={{ color: "var(--xt-text-muted)" }}>{lastPublish}</span>
                            )}
                          </div>
                        );
                      })() : null}

                      {canSubmitProof && (
                        <div style={{ marginTop: compactPx(10), display: "flex", gap: compactPx(6), alignItems: "center" }}>
                          <input
                            value={proofMap[oid] || ""}
                            onChange={(e) => setProofMap((m) => ({ ...m, [oid]: e.target.value }))}
                            placeholder={t("回传短视频链接")}
                            style={{ flex: 1, padding: "6px 10px", borderRadius: compactPx(8), border: "1px solid var(--xt-border)", fontSize: compactPx(13) }}
                          />
                          <button type="button" className="xt-accent-btn" onClick={() => void submitProof(oid)} style={{ fontSize: compactPx(12), padding: "6px 12px", whiteSpace: "nowrap" }}>
                            {t("提交完成凭证")}
                          </button>
                        </div>
                      )}
                      {canSubmitPublish && (
                        <div style={{ marginTop: compactPx(8), display: "flex", gap: compactPx(6), alignItems: "center" }}>
                          <input
                            value={publishMap[oid] || ""}
                            onChange={(e) => setPublishMap((m) => ({ ...m, [oid]: e.target.value }))}
                            placeholder={t("发布链接（TikTok/TAP）")}
                            style={{ flex: 1, padding: "6px 10px", borderRadius: compactPx(8), border: "1px solid var(--xt-border)", fontSize: compactPx(13) }}
                          />
                          <button type="button" className="xt-accent-btn" onClick={() => void submitPublish(oid)} style={{ fontSize: compactPx(12), padding: "6px 12px", whiteSpace: "nowrap" }}>
                            {t("提交发布链接")}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
      <OrderDetailModal
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setActiveOrder(null);
        }}
        item={activeOrder}
        t={t}
        lang={i18n.language}
      />
    </div>
  );
}
