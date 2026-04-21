import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getInfluencerDemandApplications,
  getInfluencerDemands,
  rejectInfluencerDemandApplication,
  selectInfluencerDemandApplication,
} from "../matchingApi";
import { formatDemandApplyStatus, formatDemandStatus } from "../utils/matchingStatusText";

type DemandItem = {
  id: number;
  title?: string;
  demand_detail?: string;
  expected_points?: number | string;
  status: string;
};

type DemandApplication = {
  id: number;
  status: string;
  client_username?: string;
  client_name?: string;
  note?: string;
  merchant_shop_name?: string;
  merchant_product_type?: string;
  merchant_sales_summary?: string;
  merchant_shop_link?: string;
  merchant_shop_rating?: string;
  merchant_user_reviews?: string;
};

/** ???????? JSON? */
function parseDemandDetail(raw: string | undefined): Record<string, any> {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

/** ????????????? */
export default function InfluencerMyDemandsPage() {
  const { t } = useTranslation();
  const [list, setList] = useState<DemandItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");
  const [expandedDemandId, setExpandedDemandId] = useState<number | null>(null);
  const [applicationsMap, setApplicationsMap] = useState<Record<number, DemandApplication[]>>({});
  const [loadingDemandId, setLoadingDemandId] = useState<number | null>(null);
  const [actioningAppId, setActioningAppId] = useState<number | null>(null);
  const [detailApp, setDetailApp] = useState<DemandApplication | null>(null);

  /** ????????? */
  const load = async () => {
    setError(null);
    try {
      const demandsRes = await getInfluencerDemands();
      setList((demandsRes.list || []) as DemandItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("????"));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  /** ?????????????? */
  const openApplications = async (demandId: number) => {
    setError(null);
    setMsg("");
    if (expandedDemandId === demandId) {
      setExpandedDemandId(null);
      return;
    }
    setExpandedDemandId(demandId);
    setLoadingDemandId(demandId);
    try {
      const ret = await getInfluencerDemandApplications(demandId);
      setApplicationsMap((prev) => ({
        ...prev,
        [demandId]: Array.isArray(ret?.list) ? (ret.list as DemandApplication[]) : [],
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("????????"));
    } finally {
      setLoadingDemandId(null);
    }
  };

  /** ????????????? */
  const reviewApplication = async (demandId: number, appId: number, action: "select" | "reject") => {
    setError(null);
    setMsg("");
    setActioningAppId(appId);
    try {
      if (action === "select") {
        await selectInfluencerDemandApplication(demandId, appId);
        setMsg(t("?????"));
      } else {
        await rejectInfluencerDemandApplication(demandId, appId);
        setMsg(t("?????"));
      }
      const ret = await getInfluencerDemandApplications(demandId);
      setApplicationsMap((prev) => ({
        ...prev,
        [demandId]: Array.isArray(ret?.list) ? (ret.list as DemandApplication[]) : [],
      }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("????"));
    } finally {
      setActioningAppId(null);
    }
  };

  return (
    <div>
      <h2 className="xt-inf-page-title">{t("????")}</h2>
      <p className="xt-inf-lead">{t("???????????????????????")}</p>
      {msg ? <p style={{ color: "#166534" }}>{msg}</p> : null}
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

      {list.length === 0 ? (
        <div className="xt-inf-empty xt-inf-card">
          <div className="xt-inf-empty-icon" aria-hidden>
            ??
          </div>
          <div>{t("????")}</div>
        </div>
      ) : null}
      {list.map((d) => {
        const detail = parseDemandDetail(d.demand_detail);
        const apps = applicationsMap[d.id] || [];
        const canReview = d.status === "open";
        const opened = expandedDemandId === d.id;
        const fans = detail.fans_level ? t(String(detail.fans_level)) : "-";
        const types =
          Array.isArray(detail.task_types) && detail.task_types.length
            ? detail.task_types.map((x: string) => t(String(x))).join("/")
            : "-";
        return (
          <div key={d.id} className="xt-inf-card" style={{ padding: 14, marginBottom: 12 }}>
            <div>
              {t("?????")}
              {d.title ? t(d.title) : "-"}
            </div>
            <div>
              {t("?????")}
              {fans}
            </div>
            <div>
              {t("?????")}
              {types}
            </div>
            <div>
              {t("?????")}
              {d.expected_points ?? "-"}
            </div>
            <div>
              {t("???")}
              {t(formatDemandStatus(d.status))}
            </div>
            <button type="button" className="xt-accent-btn" onClick={() => void openApplications(d.id)} style={{ marginTop: 8 }}>
              {opened ? t("??????") : t("??????")}
            </button>

            {opened ? (
              <div style={{ marginTop: 10, padding: 10, borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc" }}>
                {loadingDemandId === d.id ? <p>{t("????")}</p> : null}
                {loadingDemandId !== d.id && apps.length === 0 ? <p>{t("??????")}</p> : null}
                {loadingDemandId !== d.id && apps.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {apps.map((a) => (
                      <li key={a.id} style={{ marginBottom: 8 }}>
                        {t("???")}
                        {a.client_name || a.client_username || "-"}?{t("???")}
                        {t(formatDemandApplyStatus(a.status))}
                        {a.note ? `?${t("???")}${a.note}` : ""}
                        <button type="button" style={{ marginLeft: 8 }} onClick={() => setDetailApp(a)}>
                          {t("??????")}
                        </button>
                        {canReview && a.status === "pending" ? (
                          <>
                            <button type="button" disabled={actioningAppId === a.id} onClick={() => void reviewApplication(d.id, a.id, "select")} style={{ marginLeft: 8 }}>
                              {t("????")}
                            </button>
                            <button type="button" disabled={actioningAppId === a.id} onClick={() => void reviewApplication(d.id, a.id, "reject")} style={{ marginLeft: 8 }}>
                              {t("????")}
                            </button>
                          </>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
      {detailApp ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "grid", placeItems: "center", zIndex: 1000 }} onClick={() => setDetailApp(null)}>
          <div style={{ width: "min(640px, 92vw)", background: "#fff", borderRadius: 12, padding: 16 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{t("??????")}</h3>
            <div style={{ display: "grid", gap: 6 }}>
              <div>{t("?????")}{detailApp.merchant_shop_name || "-"}</div>
              <div>{t("???????")}{detailApp.merchant_product_type || "-"}</div>
              <div>{t("?????")}{detailApp.merchant_shop_rating || "-"}</div>
              <div>{t("?????")}{detailApp.merchant_user_reviews || "-"}</div>
              <div>
                {t("?????")}
                {detailApp.merchant_shop_link ? <a href={detailApp.merchant_shop_link} target="_blank" rel="noreferrer">{detailApp.merchant_shop_link}</a> : "-"}
              </div>
            </div>
            <button type="button" className="xt-accent-btn" style={{ marginTop: 12 }} onClick={() => setDetailApp(null)}>{t("??")}</button>
          </div>
        </div>
      ) : null}

    </div>
  );
}
