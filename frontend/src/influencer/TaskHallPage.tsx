import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { applyMatchingOrder, getInfluencerMatchingTaskHall, getMyMatchingApplies, submitMatchingProof } from "../influencerApi";

type TaskItem = {
  id: number;
  order_id?: number;
  order_no: string | null;
  title: string | null;
  client_name?: string;
  client_username?: string;
  task_amount: number | string | null;
  created_at: string;
  apply_status?: string;
  order_status?: string;
  work_links?: string[];
  detail_json?: Record<string, any> | null;
};

/** ????????? */
function formatApplyStatus(status: string | undefined): string {
  if (status === "pending") return "???";
  if (status === "selected") return "???";
  if (status === "rejected") return "???";
  return status || "-";
}

/** ????????? */
function formatOrderStatus(status: string | undefined): string {
  if (status === "claimed") return "???";
  if (status === "completed") return "???";
  if (status === "accepted") return "???";
  return status || "-";
}

/** ??????????? */
function appliedAccentBorder(status: string | undefined) {
  if (status === "claimed") return "#f59e0b";
  if (status === "completed" || status === "accepted") return "#94a3b8";
  return "#16a34a";
}

/** ?????????????????? */
export default function TaskHallPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"available" | "applied">("available");
  const [list, setList] = useState<TaskItem[]>([]);
  const [myApplies, setMyApplies] = useState<TaskItem[]>([]);
  const [proofMap, setProofMap] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");
  const [detailOpenId, setDetailOpenId] = useState<number | null>(null);

  /** ?????????????? */
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [hallData, myData] = await Promise.all([getInfluencerMatchingTaskHall(), getMyMatchingApplies()]);
      setList((hallData?.list || []) as TaskItem[]);
      setMyApplies((myData?.list || []) as TaskItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("????"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  /** ??????? */
  const apply = async (id: number) => {
    setError(null);
    setMsg("");
    try {
      await applyMatchingOrder(id);
      await load();
      setTab("applied");
      setMsg(t("????"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("????"));
    }
  };

  /** ?????????? */
  const submitProof = async (orderId: number) => {
    const videoUrl = (proofMap[orderId] || "").trim();
    if (!videoUrl) {
      setError(t("?????????"));
      return;
    }
    setError(null);
    setMsg("");
    try {
      await submitMatchingProof(orderId, videoUrl);
      await load();
      setMsg(t("???????????"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("????"));
    }
  };

  /** ??????????? + ?????? */
  const renderOrderDetail = (item: TaskItem) => {
    const detail = (item.detail_json && typeof item.detail_json === "object" ? item.detail_json : {}) as Record<string, any>;
    const merchant = (detail.merchant_info && typeof detail.merchant_info === "object" ? detail.merchant_info : {}) as Record<string, any>;
    return (
      <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
        <div>{t("?????")}{String(merchant.shop_name || "-")}</div>
        <div>{t("???????")}{String(merchant.product_type || "-")}</div>
        <div>{t("?????")}{String(merchant.shop_rating || "-")}</div>
        <div>{t("?????")}{String(merchant.user_reviews || "-")}</div>
        <div>
          {t("?????")}
          {merchant.shop_link ? <a href={String(merchant.shop_link)} target="_blank" rel="noreferrer">{String(merchant.shop_link)}</a> : "-"}
        </div>
        <div>{t("?????")}{String(detail.selling_points || detail.requirement || "-")}</div>
        <div>{t("???")}{String(item.task_amount || "-")}</div>
        <div>{t("?????????????")}</div>
      </div>
    );
  };

  /** ????? memo? */
  const appliedList = useMemo(() => myApplies, [myApplies]);

  return (
    <div>
      <h2 className="xt-inf-page-title">{t("??????????")}</h2>
      <p className="xt-inf-lead">{t("??????????????????????????????")}</p>
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      {msg && <p style={{ color: "#166534" }}>{msg}</p>}
      {loading ? <p>{t("????")}</p> : null}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={() => setTab("available")}>{t("???")}</button>
        <button type="button" onClick={() => setTab("applied")}>{t("???")}</button>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {(tab === "available" ? list : appliedList).map((item) => {
          const oid = Number(item.order_id || item.id || 0);
          const canSubmitProof = item.apply_status === "selected" && item.order_status === "claimed" && oid > 0;
          return (
            <div key={item.id} className="xt-inf-card" style={{ padding: 14, borderLeft: `4px solid ${appliedAccentBorder(item.order_status)}` }}>
              <div>{item.order_no || `#${item.id}`}?{item.title || "-"}</div>
              <div>{t("???")}{item.client_name || item.client_username || "-"}</div>
              <div>{t("???")}{item.apply_status ? t(formatApplyStatus(item.apply_status)) : t(formatOrderStatus(item.order_status))}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                {tab === "available" ? <button type="button" className="xt-accent-btn" onClick={() => void apply(item.id)}>{t("????")}</button> : null}
                <button type="button" className="xt-outline-btn" onClick={() => setDetailOpenId((v) => (v === item.id ? null : item.id))}>{t("??????")}</button>
              </div>
              {detailOpenId === item.id ? renderOrderDetail(item) : null}
              {canSubmitProof ? (
                <div style={{ marginTop: 8 }}>
                  <input value={proofMap[oid] || ""} onChange={(e) => setProofMap((m) => ({ ...m, [oid]: e.target.value }))} placeholder={t("???????")} />
                  <button type="button" className="xt-accent-btn" onClick={() => void submitProof(oid)}>{t("??????")}</button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
