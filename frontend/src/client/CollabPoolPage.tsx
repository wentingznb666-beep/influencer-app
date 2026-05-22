import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { applyClientCollabPool, consultClientCollabPool, getClientCollabPool } from "../matchingApi";
import { formatDemandApplyStatus, formatDemandStatus } from "../utils/matchingStatusText";

type CollabPoolItem = {
  id: number;
  demand_detail?: string;
  title?: string | null;
  influencer_name?: string | null;
  influencer_username?: string | null;
  expected_points?: number | string | null;
  status?: string | null;
  my_apply_status?: string | null;
};

/** Parse demand detail JSON safely. */
function parseDetail(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

function detailText(detail: Record<string, unknown>, key: string): string {
  const value = detail[key];
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/** Client side: influencer demand pool page. */
export default function CollabPoolPage() {
  const { t } = useTranslation();
  const [list, setList] = useState<CollabPoolItem[]>([]);
  const [msg, setMsg] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [merchantShopName, setMerchantShopName] = useState("");
  const [merchantProductType, setMerchantProductType] = useState("");
  const [merchantSalesSummary, setMerchantSalesSummary] = useState("");
  const [merchantShopLink, setMerchantShopLink] = useState("");

  /** Load pool data. */
  const load = async () => {
    setLoading(true);
    try {
      const data = await getClientCollabPool();
      setList(Array.isArray(data?.list) ? data.list : []);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t("加载失败"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  /** Apply to an influencer demand. */
  const apply = async (id: number) => {
    setMsg("");
    if (!merchantShopName.trim() || !merchantProductType.trim() || !merchantSalesSummary.trim() || !merchantShopLink.trim()) {
      setMsg(t("请先完善商家信息后再报名"));
      return;
    }
    try {
      await applyClientCollabPool(id, {
        merchant_shop_name: merchantShopName.trim(),
        merchant_product_type: merchantProductType.trim(),
        merchant_sales_summary: merchantSalesSummary.trim(),
        merchant_shop_link: merchantShopLink.trim(),
      });
      setMsg(t("报名成功，等待达人选择"));
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t("报名失败"));
    }
  };

  /** Send consultation message. */
  const consult = async (id: number) => {
    const note = window.prompt(t("请输入咨询内容"));
    if (!note || !note.trim()) return;
    setMsg("");
    try {
      await consultClientCollabPool(id, note.trim());
      setMsg(t("咨询已发送"));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t("发送失败"));
    }
  };

  return (
    <div className="xt-card" style={{ padding: 20 }}>
      <div className="xt-page-header">
        <h2 className="xt-page-title">{t("达人合作需求广场")}</h2>
      </div>
      <div className="xt-form" style={{ maxWidth: 640, marginBottom: 16 }}>
        <input className="xt-input" style={{ width: "100%", boxSizing: "border-box" }} value={merchantShopName} onChange={(e) => setMerchantShopName(e.target.value)} placeholder={t("商店名称")} />
        <input className="xt-input" style={{ width: "100%", boxSizing: "border-box" }} value={merchantProductType} onChange={(e) => setMerchantProductType(e.target.value)} placeholder={t("商家销售产品类型")} />
        <input className="xt-input" style={{ width: "100%", boxSizing: "border-box" }} value={merchantSalesSummary} onChange={(e) => setMerchantSalesSummary(e.target.value)} placeholder={t("店铺销售额情况")} />
        <input className="xt-input" style={{ width: "100%", boxSizing: "border-box" }} value={merchantShopLink} onChange={(e) => setMerchantShopLink(e.target.value)} placeholder={t("店铺链接")} />
      </div>
      {msg && <p style={{ padding: "8px 12px", borderRadius: 8, background: msg.includes("成功") ? "#dcfce7" : "#fee2e2", color: msg.includes("成功") ? "#15803d" : "#b91c1c", fontWeight: 600, fontSize: 13 }}>{msg}</p>}
      {loading ? <p>{t("加载中…")}</p> : null}
      {!loading && list.length === 0 ? <p>{t("暂无需求")}</p> : null}
      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
        {list.map((it) => {
          const detail = parseDetail(it.demand_detail);
          const taskTypes = Array.isArray(detail.task_types) ? detail.task_types.map((x) => String(x || "").trim()).filter(Boolean).join("/") : "";
          return (
            <li key={it.id} style={{ background: "var(--xt-bg)", borderRadius: 12, padding: 16, border: "1px solid var(--xt-border)" }}>
              <div>{t("需求")}#{it.id}｜{t("标题：")}{it.title || "-"}｜{t("达人：")}{it.influencer_name || it.influencer_username}</div>
              <div>{t("粉丝量级：")}{detailText(detail, "fans_level") || "-"}｜{t("任务类型：")}{taskTypes || "-"}</div>
              <div>{t("可接产品品类：")}{detailText(detail, "categories_can_do") || "-"}｜{t("不接品类：")}{detailText(detail, "categories_not_do") || "-"}</div>
              <div>{t("是否需要样品：")}{detailText(detail, "need_sample") || "-"}｜{t("单条报价：")}{it.expected_points ?? "-"}｜{t("出稿时效（天）：")}{detailText(detail, "delivery_days") || "-"}{t("天")}</div>
              <div>{t("状态：")}{t(formatDemandStatus(it.status || undefined))}｜{t("我的报名：")}{t(formatDemandApplyStatus(it.my_apply_status || undefined))}</div>
              <button type="button" className="xt-btn-outline" style={{ marginTop: 8 }} onClick={() => void consult(it.id)}>{t("咨询")}</button>
              <button type="button" className="xt-accent-btn" style={{ marginLeft: 8, marginTop: 8 }} disabled={it.my_apply_status === "pending" || it.my_apply_status === "selected"} onClick={() => void apply(it.id)}>
                {it.my_apply_status === "pending" || it.my_apply_status === "selected" ? t("已报名") : t("报名")}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
