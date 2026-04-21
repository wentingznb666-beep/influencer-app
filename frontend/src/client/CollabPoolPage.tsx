import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { applyClientCollabPool, consultClientCollabPool, getClientCollabPool } from "../matchingApi";
import { formatDemandApplyStatus, formatDemandStatus } from "../utils/matchingStatusText";

/** ???????? JSON? */
function parseDetail(raw: string | undefined): Record<string, any> {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

/** ????????????????????? */
export default function CollabPoolPage() {
  const { t } = useTranslation();
  const [list, setList] = useState<any[]>([]);
  const [msg, setMsg] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [merchantShopName, setMerchantShopName] = useState("");
  const [merchantProductType, setMerchantProductType] = useState("");
  const [merchantSalesSummary, setMerchantSalesSummary] = useState("");
  const [merchantShopLink, setMerchantShopLink] = useState("");

  /** ??????????? */
  const load = async () => {
    setLoading(true);
    try {
      const data = await getClientCollabPool();
      setList(Array.isArray(data?.list) ? data.list : []);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t("????"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  /** ????????? */
  const apply = async (id: number) => {
    setMsg("");
    if (!merchantShopName.trim() || !merchantProductType.trim() || !merchantSalesSummary.trim() || !merchantShopLink.trim()) {
      setMsg(t("??????????????"));
      return;
    }
    try {
      await applyClientCollabPool(id, {
        merchant_shop_name: merchantShopName.trim(),
        merchant_product_type: merchantProductType.trim(),
        merchant_sales_summary: merchantSalesSummary.trim(),
        merchant_shop_link: merchantShopLink.trim(),
      });
      setMsg(t("??????"));
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t("????"));
    }
  };

  /** ????????? */
  const consult = async (id: number) => {
    const note = window.prompt(t("???????"));
    if (!note || !note.trim()) return;
    setMsg("");
    try {
      await consultClientCollabPool(id, note.trim());
      setMsg(t("?????"));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t("????"));
    }
  };

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 10px 24px rgba(15,23,42,0.08)" }}>
      <h2 style={{ marginTop: 0 }}>{t("????????")}</h2>
      <div style={{ display: "grid", gap: 8, maxWidth: 640, marginBottom: 12 }}>
        <input value={merchantShopName} onChange={(e) => setMerchantShopName(e.target.value)} placeholder={t("????")} />
        <input value={merchantProductType} onChange={(e) => setMerchantProductType(e.target.value)} placeholder={t("????????")} />
        <input value={merchantSalesSummary} onChange={(e) => setMerchantSalesSummary(e.target.value)} placeholder={t("???????")} />
        <input value={merchantShopLink} onChange={(e) => setMerchantShopLink(e.target.value)} placeholder={t("????")} />
      </div>
      {msg && <p>{msg}</p>}
      {loading ? <p>{t("????")}</p> : null}
      {!loading && list.length === 0 ? <p>{t("??????")}</p> : null}
      <ul>
        {list.map((it) => {
          const detail = parseDetail(it.demand_detail);
          return (
            <li key={it.id} style={{ marginBottom: 12 }}>
              <div>{t("??")}#{it.id}?{t("?????")}{it.title || "-"}?{t("???")}{it.influencer_name || it.influencer_username}</div>
              <div>{t("?????")}{detail.fans_level || "-"}?{t("???????")}{Array.isArray(detail.task_types) ? detail.task_types.join("/") : "-"}</div>
              <div>{t("?????")}{detail.categories_can_do || "-"}?{t("?????")}{detail.categories_not_do || "-"}</div>
              <div>{t("???????")}{detail.need_sample || "-"}?{t("?????")}{it.expected_points ?? "-"}?{t("?????")}{detail.delivery_days || "-"}{t("?")}</div>
              <div>{t("???")}{t(formatDemandStatus(it.status))}?{t("?????")}{t(formatDemandApplyStatus(it.my_apply_status))}</div>
              <button type="button" onClick={() => void consult(it.id)} style={{ marginTop: 6 }}>{t("??")}</button>
              <button type="button" disabled={it.my_apply_status === "pending" || it.my_apply_status === "selected"} onClick={() => void apply(it.id)} style={{ marginLeft: 8 }}>
                {it.my_apply_status === "pending" || it.my_apply_status === "selected" ? t("?????") : t("????")}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
