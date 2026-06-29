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
            {filteredList.map((item) => (
              <div key={item.id} className="xt-inf-card" data-order-id={item.id} style={{ padding: compactPx(14), borderLeft: "4px solid #16a34a" }}>
                <div style={{ fontWeight: 800, color: "var(--xt-primary)", fontSize: compactPx(15) }}>
                  {t("预估收益：")}
                  {estimatedEarningsText(item, i18n.language)}
                </div>
                <div style={{ fontWeight: 600, marginTop: compactPx(6) }}>
                  {t("订单号：")}
                  {item.order_no || `#${item.id}`}
                </div>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t("任务名称：")}
                  {item.title ? t(item.title) : t("未命名")}
                </div>
                <div>
                  {t("商家：")}
                  {item.client_name || item.client_username || "-"}
                </div>
                <div style={{ marginTop: compactPx(10), display: "flex", gap: compactPx(8), flexWrap: "wrap", alignItems: "center" }}>
                  <button type="button" onClick={() => (setActiveOrder(item), setDetailOpen(true))} style={{ padding: "8px 12px", borderRadius: compactPx(10), border: "1px solid var(--xt-border)", background: "#fff", fontWeight: 800 }}>
                    {t("查看详情")}
                  </button>
                  <div style={{ position: "relative" }}>
                    <button type="button" className="xt-accent-btn" disabled={isRecruitFull(item)} onClick={() => void apply(item)} style={{ opacity: isRecruitFull(item) ? 0.6 : 1 }}>
                      {t("一键报名")}
                    </button>
                    {isRecruitFull(item) ? (
                      <button
                        type="button"
                        aria-label={t("招募数量已满")}
                        onClick={() => toastRecruitFull(t)}
                        style={{ position: "absolute", inset: 0, cursor: "not-allowed", background: "transparent", border: "none" }}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
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
              return (
                <div
                  key={it.id}
                  className="xt-inf-card"
                  data-order-id={oid > 0 ? oid : it.id}
                  style={{ padding: compactPx(14), borderLeft: `4px solid ${appliedAccentBorder(it.order_status)}` }}
                >
                  <div style={{ fontWeight: 800, color: "var(--xt-primary)", fontSize: compactPx(15) }}>
                    {t("任务状态：")}
                    {t(orderLabel)}
                  </div>
                  <div style={{ fontWeight: 600, marginTop: compactPx(6) }}>
                    {t("订单号：")}
                    {it.order_no || "-"}
                  </div>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t("任务名称：")}
                    {it.title ? t(it.title) : t("未命名")}
                  </div>
                  <div>
                    {t("报名状态：")}
                    {t(applyLabel)}
                  </div>
                  {Array.isArray(it.work_links) && it.work_links.length > 0 && (() => {
                    const raw = String(it.work_links[0] ?? "").trim();
                    const isUrl = /^https?:\/\//i.test(raw);
                    if (!raw) return null;
                    return (
                      <div>
                        {t("回传短视频：")}
                        {isUrl ? (
                          <a href={raw} target="_blank" rel="noreferrer">{t("查看")}</a>
                        ) : (
                          <span style={{ color: "var(--xt-text-muted)", fontSize: compactPx(13) }}>{raw}</span>
                        )}
                      </div>
                    );
                  })()}
                  {/* 验收状态：仅已完成/已验收订单显示 */}
                  {(it.order_status === "completed" || it.order_status === "accepted") && linkAcceptanceMap[oid]?.length > 0 && (
                    <div style={{ marginTop: compactPx(8), padding: compactPx(10), background: "#f8fafc", borderRadius: compactPx(8), border: "1px solid #e2e8f0" }}>
                      <div style={{ fontWeight: 700, marginBottom: compactPx(6), fontSize: compactPx(13) }}>{t("验收状态：")}</div>
                      {linkAcceptanceMap[oid].map((la, idx: number) => (
                        <div key={idx} style={{ display: "flex", alignItems: "center", gap: compactPx(8), padding: "4px 0", fontSize: compactPx(13) }}>
                          <span>{t("回传链接")}{idx + 1}：</span>
                          {la.accepted ? (
                            <span style={{ color: "#16a34a", fontWeight: 700 }}>✅ {t("已通过")}</span>
                          ) : la.rejected ? (
                            <span style={{ color: "#dc2626", fontWeight: 700 }}>❌ {t("已驳回")}</span>
                          ) : (
                            <span style={{ color: "#64748b" }}>{t("待验收")}</span>
                          )}
                          {la.payment_url && (
                            <a href={la.payment_url} target="_blank" rel="noreferrer" style={{ fontSize: compactPx(12), color: "#10b981", textDecoration: "underline" }}>
                              {t("查看付款截图")}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {lastPublish ? (() => {
                    const isUrl = /^https?:\/\//i.test(lastPublish);
                    return (
                      <div>
                        {t("发布链接：")}
                        {isUrl ? (
                          <a href={lastPublish} target="_blank" rel="noreferrer">{t("查看")}</a>
                        ) : (
                          <span style={{ color: "var(--xt-text-muted)", fontSize: compactPx(13) }}>{lastPublish}</span>
                        )}
                      </div>
                    );
                  })() : null}
                  {canSubmitProof && (
                    <div style={{ marginTop: compactPx(8) }}>
                      <input
                        value={proofMap[oid] || ""}
                        onChange={(e) => setProofMap((m) => ({ ...m, [oid]: e.target.value }))}
                        placeholder={t("回传短视频链接")}
                        style={{ marginRight: compactPx(6), width: 300, maxWidth: "100%" }}
                      />
                      <button type="button" className="xt-accent-btn" onClick={() => void submitProof(oid)}>
                        {t("提交完成凭证")}
                      </button>
                    </div>
                  )}
                  {canSubmitPublish && (
                    <div style={{ marginTop: compactPx(8) }}>
                      <input
                        value={publishMap[oid] || ""}
                        onChange={(e) => setPublishMap((m) => ({ ...m, [oid]: e.target.value }))}
                        placeholder={t("发布链接（TikTok/TAP）")}
                        style={{ marginRight: compactPx(6), width: 300, maxWidth: "100%" }}
                      />
                      <button type="button" className="xt-accent-btn" onClick={() => void submitPublish(oid)}>
                        {t("提交发布链接")}
                      </button>
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
