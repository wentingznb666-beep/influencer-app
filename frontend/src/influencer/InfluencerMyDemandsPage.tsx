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

/** Parse demand detail JSON safely. */
function parseDemandDetail(raw: string | undefined): Record<string, any> {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

/** Influencer side: my demand module. */
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

  /** Load my demand list. */
  const load = async () => {
    setError(null);
    try {
      const demandsRes = await getInfluencerDemands();
      setList((demandsRes.list || []) as DemandItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("加载失败"));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  /** Load applications under one demand. */
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
      setError(e instanceof Error ? e.message : t("加载报名列表失败"));
    } finally {
      setLoadingDemandId(null);
    }
  };

  /** Review one merchant application. */
  const reviewApplication = async (demandId: number, appId: number, action: "select" | "reject") => {
    setError(null);
    setMsg("");
    setActioningAppId(appId);
    try {
      if (action === "select") {
        await selectInfluencerDemandApplication(demandId, appId);
        setMsg(t("已选中商家"));
      } else {
        await rejectInfluencerDemandApplication(demandId, appId);
        setMsg(t("已驳回商家"));
      }
      const ret = await getInfluencerDemandApplications(demandId);
      setApplicationsMap((prev) => ({
        ...prev,
        [demandId]: Array.isArray(ret?.list) ? (ret.list as DemandApplication[]) : [],
      }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("操作失败"));
    } finally {
      setActioningAppId(null);
    }
  };

  return (
    <div>
      <h2 className="xt-inf-page-title">{t("我的需求")}</h2>
      <p className="xt-inf-lead">{t("管理已发布的合作需求与商家报名，状态一目了然。")}</p>
      {msg ? <p style={{ color: "#166534" }}>{msg}</p> : null}
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

      {list.length === 0 ? (
        <div className="xt-inf-empty xt-inf-card">
          <div className="xt-inf-empty-icon" aria-hidden>
            ??
          </div>
          <div>{t("暂无需求")}</div>
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
              {t("擅长领域：")}
              {d.title ? t(d.title) : "-"}
            </div>
            <div>
              {t("粉丝量级：")}
              {fans}
            </div>
            <div>
              {t("任务类型：")}
              {types}
            </div>
            <div>
              {t("单条报价：")}
              {d.expected_points ?? "-"}
            </div>
            <div>
              {t("状态：")}
              {t(formatDemandStatus(d.status))}
            </div>
            <button type="button" className="xt-accent-btn" onClick={() => void openApplications(d.id)} style={{ marginTop: 8 }}>
              {opened ? t("收起商家报名") : t("查看商家报名")}
            </button>

            {opened ? (
              <div style={{ marginTop: 10, padding: 10, borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc" }}>
                {loadingDemandId === d.id ? <p>{t("加载中…")}</p> : null}
                {loadingDemandId !== d.id && apps.length === 0 ? <p>{t("暂无商家报名")}</p> : null}
                {loadingDemandId !== d.id && apps.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {apps.map((a) => (
                      <li key={a.id} style={{ marginBottom: 8 }}>
                        {t("商家：")}
                        {a.client_name || a.client_username || "-"}?{t("状态：")}
                        {t(formatDemandApplyStatus(a.status))}
                        {a.note ? `?${t("备注：")}${a.note}` : ""}
                        <button type="button" className="xt-outline-btn" style={{ marginLeft: 8 }} onClick={() => setDetailApp(a)}>
                          {t("查看订单详情")}
                        </button>
                        {canReview && a.status === "pending" ? (
                          <>
                            <button type="button" disabled={actioningAppId === a.id} onClick={() => void reviewApplication(d.id, a.id, "select")} style={{ marginLeft: 8 }}>
                              {t("选中商家")}
                            </button>
                            <button type="button" disabled={actioningAppId === a.id} onClick={() => void reviewApplication(d.id, a.id, "reject")} style={{ marginLeft: 8 }}>
                              {t("驳回商家")}
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
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "grid", placeItems: "center", zIndex: 1000 }}
          onClick={() => setDetailApp(null)}
        >
          <div style={{ width: "min(640px, 92vw)", background: "#fff", borderRadius: 12, padding: 16 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{t("查看订单详情")}</h3>
            <div style={{ display: "grid", gap: 6 }}>
              <div>{t("商店名称：")}{detailApp.merchant_shop_name || "-"}</div>
              <div>{t("销售产品类型：")}{detailApp.merchant_product_type || "-"}</div>
              <div>{t("店铺评分：")}{detailApp.merchant_shop_rating || "-"}</div>
              <div>{t("用户评价：")}{detailApp.merchant_user_reviews || "-"}</div>
              <div>
                {t("店铺链接：")}
                {detailApp.merchant_shop_link ? (
                  <a href={detailApp.merchant_shop_link} target="_blank" rel="noreferrer">
                    {detailApp.merchant_shop_link}
                  </a>
                ) : (
                  "-"
                )}
              </div>
            </div>
            <button type="button" className="xt-accent-btn" style={{ marginTop: 12 }} onClick={() => setDetailApp(null)}>
              {t("关闭")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
