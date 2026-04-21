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
  attachment_urls?: string[];
};

/** ?????????????? t() ???? */
function formatApplyStatus(status: string | undefined): string {
  if (status === "pending") return "???";
  if (status === "selected") return "???";
  if (status === "rejected") return "???";
  return status || "-";
}

/** ?????????????? t() ???? */
function formatOrderStatus(status: string | undefined): string {
  if (status === "claimed") return "???";
  if (status === "completed") return "???";
  if (status === "accepted") return "???";
  return status || "-";
}

/** ?????????????????????????? */
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

  /** ???????????? */
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
          {merchant.shop_link ? (
            <a href={String(merchant.shop_link)} target="_blank" rel="noreferrer">
              {String(merchant.shop_link)}
            </a>
          ) : (
            "-"
          )}
        </div>
        <div>{t("?????")}{String(detail.selling_points || detail.requirement || "-")}</div>
        <div>{t("???")}{String(item.task_amount || "-")}</div>
        <div>{t("?????????????")}</div>
      </div>
    );
  };

  /** ???????? */
  const appliedList = useMemo(() => myApplies, [myApplies]);

  return (
    <div>
      <h2 className="xt-inf-page-title">{t("??????????")}</h2>
      <p className="xt-inf-lead">{t("??????????????????????????????")}</p>
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      {msg && <p style={{ color: "#166534" }}>{msg}</p>}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => setTab("available")}
          disabled={tab === "available"}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid var(--xt-border)",
            background: tab === "available" ? "rgba(21,42,69,0.08)" : "#fff",
            fontWeight: 700,
          }}
        >
          {t("???")}
        </button>
        <button
          type="button"
          onClick={() => setTab("applied")}
          disabled={tab === "applied"}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid var(--xt-border)",
            background: tab === "applied" ? "rgba(21,42,69,0.08)" : "#fff",
            fontWeight: 700,
          }}
        >
          {t("???")}
        </button>
        <button type="button" className="xt-accent-btn" onClick={() => void load()} style={{ marginLeft: "auto" }}>
          {t("??")}
        </button>
      </div>
      {loading ? <p>{t("????")}</p> : null}

      {!loading && tab === "available" && (
        <>
          {list.length === 0 ? (
            <div className="xt-inf-empty xt-inf-card">
              <div className="xt-inf-empty-icon" aria-hidden>
                ??
              </div>
              <div>{t("???????")}</div>
            </div>
          ) : null}
          <div style={{ display: "grid", gap: 10 }}>
            {list.map((item) => (
              <div key={item.id} className="xt-inf-card" style={{ padding: 14, borderLeft: "4px solid #16a34a" }}>
                <div style={{ fontWeight: 800, color: "var(--xt-primary)", fontSize: 15 }}>
                  {t("?????")}
                  {item.task_amount ?? "?"}
                </div>
                <div style={{ fontWeight: 600, marginTop: 6 }}>
                  {t("????")}
                  {item.order_no || `#${item.id}`}
                </div>
                <div>
                  {t("?????")}
                  {item.title ? t(item.title) : t("???")}
                </div>
                <div>
                  {t("???")}
                  {item.client_name || item.client_username || "-"}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button type="button" className="xt-accent-btn" onClick={() => void apply(item.id)}>
                    {t("????")}
                  </button>
                  <button type="button" className="xt-outline-btn" onClick={() => setDetailOpenId((v) => (v === item.id ? null : item.id))}>
                    {t("??????")}
                  </button>
                </div>
                {detailOpenId === item.id ? renderOrderDetail(item) : null}
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
                ???
              </div>
              <div>{t("??????")}</div>
            </div>
          ) : null}
          <div style={{ display: "grid", gap: 10 }}>
            {appliedList.map((it) => {
              const oid = Number(it.order_id || 0);
              const canSubmitProof = it.apply_status === "selected" && it.order_status === "claimed" && oid > 0;
              const orderLabel = formatOrderStatus(it.order_status);
              const applyLabel = formatApplyStatus(it.apply_status);
              return (
                <div key={it.id} className="xt-inf-card" style={{ padding: 14, borderLeft: `4px solid ${appliedAccentBorder(it.order_status)}` }}>
                  <div style={{ fontWeight: 800, color: "var(--xt-primary)", fontSize: 15 }}>
                    {t("?????")}
                    {t(orderLabel)}
                  </div>
                  <div style={{ fontWeight: 600, marginTop: 6 }}>
                    {t("????")}
                    {it.order_no || "-"}
                  </div>
                  <div>
                    {t("?????")}
                    {it.title ? t(it.title) : t("???")}
                  </div>
                  <div>
                    {t("?????")}
                    {t(applyLabel)}
                  </div>
                  <button type="button" className="xt-outline-btn" style={{ marginTop: 8 }} onClick={() => setDetailOpenId((v) => (v === it.id ? null : it.id))}>
                    {t("??????")}
                  </button>
                  {detailOpenId === it.id ? renderOrderDetail(it) : null}
                  {Array.isArray(it.work_links) && it.work_links.length > 0 && (
                    <div>
                      {t("??????")}
                      <a href={String(it.work_links[0])} target="_blank" rel="noreferrer">
                        {t("??")}
                      </a>
                    </div>
                  )}
                  {canSubmitProof && (
                    <div style={{ marginTop: 8 }}>
                      <input
                        value={proofMap[oid] || ""}
                        onChange={(e) => setProofMap((m) => ({ ...m, [oid]: e.target.value }))}
                        placeholder={t("???????")}
                        style={{ marginRight: 6, width: 300, maxWidth: "100%" }}
                      />
                      <button type="button" className="xt-accent-btn" onClick={() => void submitProof(oid)}>
                        {t("??????")}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
