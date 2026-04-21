import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { applyClientCollabPool, consultClientCollabPool, getClientCollabPool } from "../matchingApi";
import { formatDemandApplyStatus, formatDemandStatus } from "../utils/matchingStatusText";

/** Parse demand detail JSON safely. */
function parseDetail(raw: string | undefined): Record<string, any> {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

/** Client side: influencer demand pool page. */
export default function CollabPoolPage() {
  const { t } = useTranslation();
  const [list, setList] = useState<any[]>([]);
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
    <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 10px 24px rgba(15,23,42,0.08)" }}>
      <h2 style={{ marginTop: 0 }}>{t("达人合作需求广场")}</h2>
      <div style={{ display: "grid", gap: 8, maxWidth: 640, marginBottom: 12 }}>
        <input value={merchantShopName} onChange={(e) => setMerchantShopName(e.target.value)} placeholder={t("商店名称")} />
        <input value={merchantProductType} onChange={(e) => setMerchantProductType(e.target.value)} placeholder={t("商家销售产品类型")} />
        <input value={merchantSalesSummary} onChange={(e) => setMerchantSalesSummary(e.target.value)} placeholder={t("店铺销售额情况")} />
        <input value={merchantShopLink} onChange={(e) => setMerchantShopLink(e.target.value)} placeholder={t("店铺链接")} />
      </div>
      {msg && <p>{msg}</p>}
      {loading ? <p>{t("加载中…")}</p> : null}
      {!loading && list.length === 0 ? <p>{t("暂无需求")}</p> : null}
      <ul>
        {list.map((it) => {
          const detail = parseDetail(it.demand_detail);
          return (
            <li key={it.id} style={{ marginBottom: 12 }}>
              <div>{t("需求")}#{it.id}｜{t("标题：")}{it.title || "-"}｜{t("达人：")}{it.influencer_name || it.influencer_username}</div>
              <div>{t("粉丝量级：")}{detail.fans_level || "-"}｜{t("任务类型：")}{Array.isArray(detail.task_types) ? detail.task_types.join("/") : "-"}</div>
              <div>{t("可接产品品类：")}{detail.categories_can_do || "-"}｜{t("不接品类：")}{detail.categories_not_do || "-"}</div>
              <div>{t("是否需要样品：")}{detail.need_sample || "-"}｜{t("单条报价：")}{it.expected_points ?? "-"}｜{t("出稿时效（天）：")}{detail.delivery_days || "-"}{t("天")}</div>
              <div>{t("状态：")}{t(formatDemandStatus(it.status))}｜{t("我的报名：")}{t(formatDemandApplyStatus(it.my_apply_status))}</div>
              <button type="button" onClick={() => void consult(it.id)} style={{ marginTop: 6 }}>{t("咨询")}</button>
              <button type="button" disabled={it.my_apply_status === "pending" || it.my_apply_status === "selected"} onClick={() => void apply(it.id)} style={{ marginLeft: 8 }}>
                {it.my_apply_status === "pending" || it.my_apply_status === "selected" ? t("已报名") : t("报名")}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
