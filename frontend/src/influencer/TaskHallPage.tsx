import { useEffect, useMemo, useState } from "react";
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
};

/** 统一报名状态文案。 */
function formatApplyStatus(status: string | undefined): string {
  if (status === "pending") return "待选择";
  if (status === "selected") return "已选中";
  if (status === "rejected") return "已拒绝";
  return status || "-";
}

/** 统一订单状态文案。 */
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
  const [tab, setTab] = useState<"available" | "applied">("available");
  const [list, setList] = useState<TaskItem[]>([]);
  const [myApplies, setMyApplies] = useState<TaskItem[]>([]);
  const [proofMap, setProofMap] = useState<Record<number, string>>({});
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
      setError(e instanceof Error ? e.message : "加载失败");
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
      setMsg("报名成功");
    } catch (e) {
      setError(e instanceof Error ? e.message : "报名失败");
    }
  };

  /** 提交完成回传短视频。 */
  const submitProof = async (orderId: number) => {
    const videoUrl = (proofMap[orderId] || "").trim();
    if (!videoUrl) {
      setError("请先填写短视频链接");
      return;
    }
    setError(null);
    setMsg("");
    try {
      await submitMatchingProof(orderId, videoUrl);
      await load();
      setMsg("回传成功，等待商家验收");
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败");
    }
  };

  /** 当前已报名列表。 */
  const appliedList = useMemo(() => myApplies, [myApplies]);

  return (
    <div>
      <h2 className="xt-inf-page-title">任务大厅（撮合模式）</h2>
      <p className="xt-inf-lead">浏览可报名任务或查看已报名进度；收益与状态以卡片内展示为准。</p>
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      {msg && <p style={{ color: "#166534" }}>{msg}</p>}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={() => setTab("available")} disabled={tab === "available"} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--xt-border)", background: tab === "available" ? "rgba(21,42,69,0.08)" : "#fff", fontWeight: 700 }}>可报名</button>
        <button type="button" onClick={() => setTab("applied")} disabled={tab === "applied"} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--xt-border)", background: tab === "applied" ? "rgba(21,42,69,0.08)" : "#fff", fontWeight: 700 }}>已报名</button>
        <button type="button" className="xt-accent-btn" onClick={() => void load()} style={{ marginLeft: "auto" }}>刷新</button>
      </div>
      {loading ? <p>加载中…</p> : null}

      {!loading && tab === "available" && (
        <>
          {list.length === 0 ? (
            <div className="xt-inf-empty xt-inf-card">
              <div className="xt-inf-empty-icon" aria-hidden>
                📋
              </div>
              <div>暂无可报名任务</div>
            </div>
          ) : null}
          <div style={{ display: "grid", gap: 10 }}>
            {list.map((item) => (
              <div key={item.id} className="xt-inf-card" style={{ padding: 14, borderLeft: "4px solid #16a34a" }}>
                <div style={{ fontWeight: 800, color: "var(--xt-primary)", fontSize: 15 }}>预估收益：{item.task_amount ?? "—"}</div>
                <div style={{ fontWeight: 600, marginTop: 6 }}>订单号：{item.order_no || `#${item.id}`}</div>
                <div>任务名称：{item.title || "未命名"}</div>
                <div>商家：{item.client_name || item.client_username || "-"}</div>
                <button type="button" className="xt-accent-btn" onClick={() => void apply(item.id)} style={{ marginTop: 10 }}>一键报名</button>
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
              <div>暂无报名记录</div>
            </div>
          ) : null}
          <div style={{ display: "grid", gap: 10 }}>
            {appliedList.map((it) => {
              const oid = Number(it.order_id || 0);
              const canSubmitProof = it.apply_status === "selected" && it.order_status === "claimed" && oid > 0;
              return (
                <div key={it.id} className="xt-inf-card" style={{ padding: 14, borderLeft: `4px solid ${appliedAccentBorder(it.order_status)}` }}>
                  <div style={{ fontWeight: 800, color: "var(--xt-primary)", fontSize: 15 }}>任务状态：{formatOrderStatus(it.order_status)}</div>
                  <div style={{ fontWeight: 600, marginTop: 6 }}>订单号：{it.order_no || "-"}</div>
                  <div>任务名称：{it.title || "未命名"}</div>
                  <div>报名状态：{formatApplyStatus(it.apply_status)}</div>
                  {Array.isArray(it.work_links) && it.work_links.length > 0 && (
                    <div>
                      回传短视频：<a href={String(it.work_links[0])} target="_blank" rel="noreferrer">查看</a>
                    </div>
                  )}
                  {canSubmitProof && (
                    <div style={{ marginTop: 8 }}>
                      <input
                        value={proofMap[oid] || ""}
                        onChange={(e) => setProofMap((m) => ({ ...m, [oid]: e.target.value }))}
                        placeholder="回传短视频链接"
                        style={{ marginRight: 6, width: 300, maxWidth: "100%" }}
                      />
                      <button type="button" className="xt-accent-btn" onClick={() => void submitProof(oid)}>提交完成凭证</button>
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
