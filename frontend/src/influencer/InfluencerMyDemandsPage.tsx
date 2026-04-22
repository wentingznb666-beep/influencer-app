import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getInfluencerDemandApplications,
  getInfluencerDemands,
  rejectInfluencerDemandApplication,
  selectInfluencerDemandApplication,
  updateInfluencerDemand,
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

type DemandEditForm = {
  specialty: string;
  fans_level: string;
  task_types: string[];
  categories_can_do: string;
  categories_not_do: string;
  need_sample: "是" | "否";
  unit_price: string;
  delivery_days: string;
  revise_times: string;
  intro: string;
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
  const [editingDemand, setEditingDemand] = useState<DemandItem | null>(null);
  const [editForm, setEditForm] = useState<DemandEditForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

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

  /** 打开需求编辑弹窗并回填字段。 */
  const startEdit = (d: DemandItem) => {
    const detail = parseDemandDetail(d.demand_detail);
    setEditingDemand(d);
    setEditForm({
      specialty: String(d.title || ""),
      fans_level: String(detail.fans_level || "1万以内"),
      task_types: Array.isArray(detail.task_types) ? detail.task_types.map((x: unknown) => String(x || "")).filter(Boolean) : ["短视频"],
      categories_can_do: String(detail.categories_can_do || ""),
      categories_not_do: String(detail.categories_not_do || ""),
      need_sample: detail.need_sample === "否" ? "否" : "是",
      unit_price: String(d.expected_points ?? ""),
      delivery_days: String(detail.delivery_days || "3"),
      revise_times: String(detail.revise_times || "2"),
      intro: String(detail.intro || ""),
    });
  };

  /** 保存需求编辑。 */
  const saveEdit = async () => {
    if (!editingDemand || !editForm) return;
    setError(null);
    setMsg("");
    if (!editForm.specialty.trim() || !editForm.fans_level.trim() || editForm.task_types.length === 0 || !editForm.categories_can_do.trim() || !editForm.categories_not_do.trim() || !editForm.intro.trim()) {
      setError(t("请完整填写需求信息"));
      return;
    }
    setSavingEdit(true);
    try {
      await updateInfluencerDemand(editingDemand.id, {
        specialty: editForm.specialty.trim(),
        fans_level: editForm.fans_level,
        task_types: editForm.task_types,
        categories_can_do: editForm.categories_can_do.trim(),
        categories_not_do: editForm.categories_not_do.trim(),
        need_sample: editForm.need_sample,
        unit_price: Number(editForm.unit_price),
        delivery_days: Number(editForm.delivery_days),
        revise_times: Number(editForm.revise_times),
        intro: editForm.intro.trim(),
      });
      setMsg(t("需求已更新并重新发布"));
      setEditingDemand(null);
      setEditForm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("保存失败"));
    } finally {
      setSavingEdit(false);
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
          <div className="xt-inf-empty-icon" aria-hidden>📭</div>
          <div>{t("暂无需求")}</div>
        </div>
      ) : null}
      {list.map((d) => {
        const detail = parseDemandDetail(d.demand_detail);
        const apps = applicationsMap[d.id] || [];
        const canReview = d.status === "open";
        const canEdit = d.status === "open" || d.status === "rejected";
        const opened = expandedDemandId === d.id;
        const fans = detail.fans_level ? t(String(detail.fans_level)) : "-";
        const types = Array.isArray(detail.task_types) && detail.task_types.length ? detail.task_types.map((x: string) => t(String(x))).join("/") : "-";
        return (
          <div key={d.id} className="xt-inf-card" style={{ padding: 14, marginBottom: 12 }}>
            <div>{t("擅长领域：")}{d.title ? t(d.title) : "-"}</div>
            <div>{t("粉丝量级：")}{fans}</div>
            <div>{t("任务类型：")}{types}</div>
            <div>{t("单条报价：")}{d.expected_points ?? "-"}</div>
            <div>{t("状态：")}{t(formatDemandStatus(d.status))}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <button type="button" className="xt-accent-btn" onClick={() => void openApplications(d.id)}>{opened ? t("收起商家报名") : t("查看商家报名")}</button>
              {canEdit ? <button type="button" className="xt-outline-btn" onClick={() => startEdit(d)}>{t("编辑需求")}</button> : null}
            </div>

            {opened ? (
              <div style={{ marginTop: 10, padding: 10, borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc" }}>
                {loadingDemandId === d.id ? <p>{t("加载中…")}</p> : null}
                {loadingDemandId !== d.id && apps.length === 0 ? <p>{t("暂无商家报名")}</p> : null}
                {loadingDemandId !== d.id && apps.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {apps.map((a) => (
                      <li key={a.id} style={{ marginBottom: 8 }}>
                        {t("商家：")}{a.client_name || a.client_username || "-"}｜{t("状态：")}{t(formatDemandApplyStatus(a.status))}
                        {a.note ? `｜${t("备注：")}${a.note}` : ""}
                        <button type="button" className="xt-outline-btn" style={{ marginLeft: 8 }} onClick={() => setDetailApp(a)}>{t("查看订单详情")}</button>
                        {canReview && a.status === "pending" ? (
                          <>
                            <button type="button" disabled={actioningAppId === a.id} onClick={() => void reviewApplication(d.id, a.id, "select")} style={{ marginLeft: 8 }}>{t("选中商家")}</button>
                            <button type="button" disabled={actioningAppId === a.id} onClick={() => void reviewApplication(d.id, a.id, "reject")} style={{ marginLeft: 8 }}>{t("驳回商家")}</button>
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
            <h3 style={{ marginTop: 0 }}>{t("查看订单详情")}</h3>
            <div style={{ display: "grid", gap: 6 }}>
              <div>{t("商店名称：")}{detailApp.merchant_shop_name || "-"}</div>
              <div>{t("销售产品类型：")}{detailApp.merchant_product_type || "-"}</div>
              <div>{t("店铺评分：")}{detailApp.merchant_shop_rating || "-"}</div>
              <div>{t("用户评价：")}{detailApp.merchant_user_reviews || "-"}</div>
              <div>{t("店铺链接：")}{detailApp.merchant_shop_link ? <a href={detailApp.merchant_shop_link} target="_blank" rel="noreferrer">{detailApp.merchant_shop_link}</a> : "-"}</div>
            </div>
            <button type="button" className="xt-accent-btn" style={{ marginTop: 12 }} onClick={() => setDetailApp(null)}>{t("关闭")}</button>
          </div>
        </div>
      ) : null}

      {editingDemand && editForm ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "grid", placeItems: "center", zIndex: 1100 }} onClick={() => setEditingDemand(null)}>
          <div style={{ width: "min(720px, 94vw)", maxHeight: "90vh", overflowY: "auto", background: "#fff", borderRadius: 12, padding: 16 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{t("编辑需求")}</h3>
            <div style={{ display: "grid", gap: 8 }}>
              <label>{t("擅长领域")}<input value={editForm.specialty} onChange={(e) => setEditForm((f) => (f ? { ...f, specialty: e.target.value } : f))} /></label>
              <label>{t("粉丝量级")}<input value={editForm.fans_level} onChange={(e) => setEditForm((f) => (f ? { ...f, fans_level: e.target.value } : f))} /></label>
              <label>{t("任务类型（逗号分隔）")}<input value={editForm.task_types.join(",")} onChange={(e) => setEditForm((f) => (f ? { ...f, task_types: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) } : f))} /></label>
              <label>{t("可接产品品类")}<input value={editForm.categories_can_do} onChange={(e) => setEditForm((f) => (f ? { ...f, categories_can_do: e.target.value } : f))} /></label>
              <label>{t("不接品类")}<input value={editForm.categories_not_do} onChange={(e) => setEditForm((f) => (f ? { ...f, categories_not_do: e.target.value } : f))} /></label>
              <label>{t("是否需要样品")}<select value={editForm.need_sample} onChange={(e) => setEditForm((f) => (f ? { ...f, need_sample: e.target.value as "是" | "否" } : f))}><option value="是">{t("是")}</option><option value="否">{t("否")}</option></select></label>
              <label>{t("单条报价")}<input type="number" value={editForm.unit_price} onChange={(e) => setEditForm((f) => (f ? { ...f, unit_price: e.target.value } : f))} /></label>
              <label>{t("出稿时效（天）")}<input type="number" value={editForm.delivery_days} onChange={(e) => setEditForm((f) => (f ? { ...f, delivery_days: e.target.value } : f))} /></label>
              <label>{t("可修改次数")}<input type="number" value={editForm.revise_times} onChange={(e) => setEditForm((f) => (f ? { ...f, revise_times: e.target.value } : f))} /></label>
              <label>{t("自我介绍/个人优势")}<textarea rows={4} value={editForm.intro} onChange={(e) => setEditForm((f) => (f ? { ...f, intro: e.target.value } : f))} /></label>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button type="button" className="xt-outline-btn" onClick={() => setEditingDemand(null)}>{t("取消")}</button>
              <button type="button" className="xt-accent-btn" disabled={savingEdit} onClick={() => void saveEdit()}>{savingEdit ? t("提交中...") : t("保存并重新提交")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
