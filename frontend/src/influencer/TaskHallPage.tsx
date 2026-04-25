import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { applyMatchingOrder, getInfluencerMatchingTaskHall, getMyMatchingApplies, publishMatchingOrder, submitMatchingProof } from "../influencerApi";

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

/** 达人任务大厅：可报名与已报名双标签。 */
export default function TaskHallPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"available" | "applied">("available");
  const [list, setList] = useState<TaskItem[]>([]);
  const [myApplies, setMyApplies] = useState<TaskItem[]>([]);
  const [proofMap, setProofMap] = useState<Record<number, string>>({});
  const [publishMap, setPublishMap] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");

  /** 拉取任务大厅与我的报名。 */
  const load = async () => {
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
  };

  useEffect(() => {
    void load();
  }, []);

  /** 报名商家任务。 */
  const apply = async (id: number) => {
    setError(null);
    setMsg("");
    try {
      await applyMatchingOrder(id);
      await load();
      setTab("applied");
      setMsg(t("报名成功"));
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : t("报名失败");
      setError(errMsg);
      if (errMsg.includes("请先完善达人信息")) {
        window.alert("请先完善达人信息后再报名任务");
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

  return (
    <div>
      <h2 className="xt-inf-page-title">{t("任务大厅（撮合模式）")}</h2>
      <p className="xt-inf-lead">{t("浏览可报名任务或查看已报名进度；收益与状态以卡片内展示为准。")}</p>
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
          {t("可报名")}
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
          {t("已报名")}
        </button>
        <button type="button" className="xt-accent-btn" onClick={() => void load()} style={{ marginLeft: "auto" }}>
          {t("刷新")}
        </button>
      </div>
      {loading ? <p>{t("加载中…")}</p> : null}

      {!loading && tab === "available" && (
        <>
          {list.length === 0 ? (
            <div className="xt-inf-empty xt-inf-card">
              <div className="xt-inf-empty-icon" aria-hidden>
                📋
              </div>
              <div>{t("暂无可报名任务")}</div>
            </div>
          ) : null}
          <div style={{ display: "grid", gap: 10 }}>
            {list.map((item) => (
              <div key={item.id} className="xt-inf-card" style={{ padding: 14, borderLeft: "4px solid #16a34a" }}>
                <div style={{ fontWeight: 800, color: "var(--xt-primary)", fontSize: 15 }}>
                  {t("预估收益：")}
                  {item.task_amount ?? "—"}
                </div>
                <div style={{ fontWeight: 600, marginTop: 6 }}>
                  {t("订单号：")}
                  {item.order_no || `#${item.id}`}
                </div>
                <div>
                  {t("任务名称：")}
                  {item.title ? t(item.title) : t("未命名")}
                </div>
                <div>
                  {t("商家：")}
                  {item.client_name || item.client_username || "-"}
                </div>
                <button type="button" className="xt-accent-btn" onClick={() => void apply(item.id)} style={{ marginTop: 10 }}>
                  {t("一键报名")}
                </button>
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
          <div style={{ display: "grid", gap: 10 }}>
            {appliedList.map((it) => {
              const oid = Number(it.order_id || 0);
              const canSubmitProof = it.apply_status === "selected" && it.order_status === "claimed" && oid > 0;
              const coopType = String((it as any).cooperation_type_id || "").trim();
              const coopPhase = String((it as any).coop_phase || "").trim();
              const publishLinks = Array.isArray((it as any).coop_publish_links) ? ((it as any).coop_publish_links as unknown[]) : [];
              const lastPublish = publishLinks.map((x) => String(x || "").trim()).filter(Boolean).slice(-1)[0] || "";
              const canSubmitPublish = it.apply_status === "selected" && it.order_status === "completed" && oid > 0 && coopType === "creator_review_video" && coopPhase === "approved_to_publish";
              const orderLabel = formatOrderStatus(it.order_status);
              const applyLabel = formatApplyStatus(it.apply_status);
              return (
                <div key={it.id} className="xt-inf-card" style={{ padding: 14, borderLeft: `4px solid ${appliedAccentBorder(it.order_status)}` }}>
                  <div style={{ fontWeight: 800, color: "var(--xt-primary)", fontSize: 15 }}>
                    {t("任务状态：")}
                    {t(orderLabel)}
                  </div>
                  <div style={{ fontWeight: 600, marginTop: 6 }}>
                    {t("订单号：")}
                    {it.order_no || "-"}
                  </div>
                  <div>
                    {t("任务名称：")}
                    {it.title ? t(it.title) : t("未命名")}
                  </div>
                  <div>
                    {t("报名状态：")}
                    {t(applyLabel)}
                  </div>
                  {Array.isArray(it.work_links) && it.work_links.length > 0 && (
                    <div>
                      {t("回传短视频：")}
                      <a href={String(it.work_links[0])} target="_blank" rel="noreferrer">
                        {t("查看")}
                      </a>
                    </div>
                  )}
                  {lastPublish ? (
                    <div>
                      {t("发布链接：")}
                      <a href={lastPublish} target="_blank" rel="noreferrer">
                        {t("查看")}
                      </a>
                    </div>
                  ) : null}
                  {canSubmitProof && (
                    <div style={{ marginTop: 8 }}>
                      <input
                        value={proofMap[oid] || ""}
                        onChange={(e) => setProofMap((m) => ({ ...m, [oid]: e.target.value }))}
                        placeholder={t("回传短视频链接")}
                        style={{ marginRight: 6, width: 300, maxWidth: "100%" }}
                      />
                      <button type="button" className="xt-accent-btn" onClick={() => void submitProof(oid)}>
                        {t("提交完成凭证")}
                      </button>
                    </div>
                  )}
                  {canSubmitPublish && (
                    <div style={{ marginTop: 8 }}>
                      <input
                        value={publishMap[oid] || ""}
                        onChange={(e) => setPublishMap((m) => ({ ...m, [oid]: e.target.value }))}
                        placeholder={t("发布链接（TikTok/TAP）")}
                        style={{ marginRight: 6, width: 300, maxWidth: "100%" }}
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
    </div>
  );
}
