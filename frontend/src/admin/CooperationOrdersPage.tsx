import { useEffect, useMemo, useState } from "react";
import { getStoredUser } from "../authApi";
import { getAdminCooperationOrders, reviewAdminCooperationOrder } from "../matchingApi";

type Row = {
  id: number;
  order_no?: string | null;
  title?: string | null;
  status?: string | null;
  match_status?: string | null;
  task_amount?: number | string | null;
  client_name?: string | null;
  client_username?: string | null;
  influencer_name?: string | null;
  influencer_username?: string | null;
  work_links?: unknown;
  cooperation_type_id?: string | null;
  phase?: string | null;
  publish_links?: unknown;
  review_note?: string | null;
};

function safeText(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function safeNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function asLinks(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x || "").trim()).filter(Boolean);
}

function typeLabel(typeId: string) {
  if (typeId === "graded_video") return "分级视频";
  if (typeId === "high_quality_custom_video") return "高质量定制视频";
  if (typeId === "monthly_package") return "包月长期合作";
  if (typeId === "creator_review_video") return "Creator带货测评";
  return typeId || "-";
}

function phaseLabel(p: string) {
  if (p === "review_pending") return "待审核";
  if (p === "review_rejected") return "已驳回";
  if (p === "approved_to_publish") return "待发布";
  if (p === "published") return "已发布";
  return p || "—";
}

export default function CooperationOrdersPage() {
  const user = getStoredUser();
  const isAdmin = user?.role === "admin";
  const isEmployee = user?.role === "employee";

  const [list, setList] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const [type, setType] = useState("");
  const [phase, setPhase] = useState("");
  const [q, setQ] = useState("");
  const [busyMap, setBusyMap] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const ret = await getAdminCooperationOrders({ type: type || undefined, phase: phase || undefined, q: q || undefined, limit: 200 });
      setList(Array.isArray(ret?.list) ? (ret.list as Row[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    void load();
  }, [type, phase]);

  const title = useMemo(() => {
    if (isAdmin) return "合作订单工作台（管理员）";
    if (isEmployee) return "合作订单工作台（员工）";
    return "合作订单工作台";
  }, [isAdmin, isEmployee]);

  const review = async (orderId: number, action: "approve" | "reject") => {
    const key = `${orderId}:${action}`;
    setBusyMap((p) => ({ ...p, [key]: true }));
    setError(null);
    setMsg("");
    try {
      const note = window.prompt(action === "reject" ? "请输入驳回原因（可选）：" : "请输入审核备注（可选）：") ?? "";
      await reviewAdminCooperationOrder(orderId, { action, note: note.trim() || undefined });
      setMsg(action === "approve" ? "已审核通过" : "已驳回");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusyMap((p) => ({ ...p, [key]: false }));
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <button type="button" onClick={() => void load()} disabled={loading} style={{ height: 34 }}>
          刷新
        </button>
        <div style={{ flex: 1 }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索订单号/标题" style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid var(--xt-border)", minWidth: 220 }} />
        <button type="button" onClick={() => void load()} style={{ height: 34 }}>
          搜索
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
        <select value={type} onChange={(e) => setType(e.target.value)} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid var(--xt-border)" }}>
          <option value="">全部类型</option>
          <option value="high_quality_custom_video">高质量定制视频</option>
          <option value="monthly_package">包月长期合作</option>
          <option value="creator_review_video">Creator带货测评</option>
        </select>
        <select value={phase} onChange={(e) => setPhase(e.target.value)} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid var(--xt-border)" }}>
          <option value="">全部阶段</option>
          <option value="review_pending">待审核</option>
          <option value="approved_to_publish">待发布</option>
          <option value="published">已发布</option>
          <option value="review_rejected">已驳回</option>
        </select>
        <div style={{ color: "var(--xt-text-muted)", fontSize: 12 }}>{loading ? "加载中…" : `共 ${list.length} 条`}</div>
      </div>

      {error ? <p style={{ color: "#b91c1c", marginTop: 10 }}>{error}</p> : null}
      {msg ? <p style={{ color: "#166534", marginTop: 8 }}>{msg}</p> : null}

      <div style={{ marginTop: 12, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 12, overflow: "hidden" }}>
          <thead>
            <tr style={{ background: "rgba(21,42,69,0.06)" }}>
              <th style={{ padding: 10, textAlign: "left" }}>订单</th>
              <th style={{ padding: 10, textAlign: "left" }}>类型</th>
              <th style={{ padding: 10, textAlign: "left" }}>阶段</th>
              <th style={{ padding: 10, textAlign: "right" }}>金额</th>
              <th style={{ padding: 10, textAlign: "left" }}>商家 / 达人</th>
              <th style={{ padding: 10, textAlign: "left" }}>交付 / 发布</th>
              <th style={{ padding: 10, textAlign: "right" }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const id = r.id;
              const coop = safeText(r.cooperation_type_id);
              const ph = safeText(r.phase);
              const workLinks = asLinks(r.work_links);
              const publishLinks = asLinks(r.publish_links);
              const canReview = coop === "creator_review_video" && ph === "review_pending";
              return (
                <tr key={id} style={{ borderTop: "1px solid var(--xt-border)" }}>
                  <td style={{ padding: 10, verticalAlign: "top" }}>
                    <div style={{ fontWeight: 800, color: "var(--xt-primary)" }}>{safeText(r.order_no) || `#${id}`}</div>
                    <div style={{ marginTop: 4, color: "#0f172a" }}>{safeText(r.title) || "-"}</div>
                    <div style={{ marginTop: 6, color: "var(--xt-text-muted)", fontSize: 12 }}>
                      状态：{safeText(r.status) || "-"} / {safeText(r.match_status) || "-"}
                    </div>
                  </td>
                  <td style={{ padding: 10, verticalAlign: "top" }}>{typeLabel(coop)}</td>
                  <td style={{ padding: 10, verticalAlign: "top" }}>
                    <div style={{ fontWeight: 800 }}>{phaseLabel(ph)}</div>
                    {safeText(r.review_note) ? <div style={{ marginTop: 6, color: "#475569", fontSize: 12 }}>备注：{safeText(r.review_note)}</div> : null}
                  </td>
                  <td style={{ padding: 10, verticalAlign: "top", textAlign: "right" }}>{safeNum(r.task_amount).toFixed(0)} ฿</td>
                  <td style={{ padding: 10, verticalAlign: "top" }}>
                    <div>商家：{safeText(r.client_name) || safeText(r.client_username) || "-"}</div>
                    <div style={{ marginTop: 6 }}>达人：{safeText(r.influencer_name) || safeText(r.influencer_username) || "-"}</div>
                  </td>
                  <td style={{ padding: 10, verticalAlign: "top" }}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ color: "var(--xt-text-muted)", fontSize: 12 }}>交付链接</div>
                      {workLinks.length ? (
                        <a href={workLinks[0]} target="_blank" rel="noreferrer">
                          打开
                        </a>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>-</span>
                      )}
                      <div style={{ color: "var(--xt-text-muted)", fontSize: 12, marginTop: 6 }}>发布链接</div>
                      {publishLinks.length ? (
                        <a href={publishLinks[publishLinks.length - 1]} target="_blank" rel="noreferrer">
                          打开
                        </a>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>-</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: 10, verticalAlign: "top", textAlign: "right" }}>
                    {canReview ? (
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                        <button type="button" disabled={!!busyMap[`${id}:approve`]} onClick={() => void review(id, "approve")} style={{ height: 32, fontWeight: 800 }}>
                          {busyMap[`${id}:approve`] ? "处理中…" : "审核通过"}
                        </button>
                        <button
                          type="button"
                          disabled={!!busyMap[`${id}:reject`]}
                          onClick={() => void review(id, "reject")}
                          style={{ height: 32, border: "1px solid rgba(185,28,28,0.35)", background: "rgba(185,28,28,0.08)", color: "#b91c1c" }}
                        >
                          {busyMap[`${id}:reject`] ? "处理中…" : "驳回"}
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: "#94a3b8" }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

