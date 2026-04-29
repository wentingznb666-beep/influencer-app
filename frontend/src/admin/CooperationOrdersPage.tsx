import { useEffect, useMemo, useState, type CSSProperties } from "react";
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

const VIDEO_ORDER_TYPE_IDS = new Set(["graded_video", "high_quality_custom_video", "monthly_package", "creator_review_video"]);

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
  if (!typeId) return "-";
  return typeId;
}

function phaseLabel(p: string) {
  if (p === "none") return "—";
  if (p === "assigned") return "已分配";
  if (p === "in_progress") return "进行中";
  if (p === "submitted") return "已提交";
  if (p === "review_pending") return "待审核";
  if (p === "review_rejected") return "已驳回";
  if (p === "approved_to_publish") return "待发布";
  if (p === "published") return "已发布";
  if (p === "delivered") return "已交付";
  if (p === "completed") return "已完成";
  return p || "—";
}

function statusBadgeStyle(kind: "phase" | "status" | "match", value: string) {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 10px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.35)",
    background: "rgba(148,163,184,0.12)",
    color: "#334155",
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.6,
    whiteSpace: "nowrap",
  };

  const v = String(value || "").trim();
  if (!v || v === "none") return base;

  if (kind === "phase") {
    if (v === "review_pending") return { ...base, borderColor: "rgba(234,179,8,0.35)", background: "rgba(234,179,8,0.12)", color: "#92400e" };
    if (v === "review_rejected") return { ...base, borderColor: "rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.10)", color: "#b91c1c" };
    if (v === "approved_to_publish") return { ...base, borderColor: "rgba(59,130,246,0.35)", background: "rgba(59,130,246,0.10)", color: "#1d4ed8" };
    if (v === "published") return { ...base, borderColor: "rgba(22,163,74,0.35)", background: "rgba(22,163,74,0.10)", color: "#166534" };
    if (v === "delivered" || v === "completed") return { ...base, borderColor: "rgba(22,163,74,0.35)", background: "rgba(22,163,74,0.10)", color: "#166534" };
    return base;
  }

  if (kind === "status") {
    if (v === "open") return { ...base, borderColor: "rgba(59,130,246,0.35)", background: "rgba(59,130,246,0.10)", color: "#1d4ed8" };
    if (v === "claimed") return { ...base, borderColor: "rgba(15,118,110,0.35)", background: "rgba(15,118,110,0.10)", color: "#0f766e" };
    if (v === "completed") return { ...base, borderColor: "rgba(22,163,74,0.35)", background: "rgba(22,163,74,0.10)", color: "#166534" };
    if (v === "cancelled") return { ...base, borderColor: "rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.10)", color: "#b91c1c" };
    return base;
  }

  if (kind === "match") {
    if (v === "matched") return { ...base, borderColor: "rgba(22,163,74,0.35)", background: "rgba(22,163,74,0.10)", color: "#166534" };
    if (v === "unmatched") return { ...base, borderColor: "rgba(148,163,184,0.35)", background: "rgba(148,163,184,0.12)", color: "#334155" };
    return base;
  }

  return base;
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

  const filteredList = useMemo(() => {
    const src = Array.isArray(list) ? list : [];
    return src.filter((r) => {
      const coop = safeText(r.cooperation_type_id);
      return !VIDEO_ORDER_TYPE_IDS.has(coop);
    });
  }, [list]);

  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of filteredList) {
      const coop = safeText(r.cooperation_type_id);
      if (coop && !VIDEO_ORDER_TYPE_IDS.has(coop)) set.add(coop);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [filteredList]);

  useEffect(() => {
    if (!type) return;
    if (typeOptions.includes(type)) return;
    setType("");
  }, [type, typeOptions]);

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
      <style>{`
        .xt-coop-wrap { display:flex; flex-direction:column; gap: 12px; }
        .xt-coop-topbar { display:flex; gap: 10px; align-items:center; flex-wrap:wrap; }
        .xt-coop-topbar h2 { margin: 0; }
        .xt-coop-spacer { flex: 1 1 auto; }
        .xt-coop-input { padding: 6px 10px; border-radius: 10px; border: 1px solid var(--xt-border); min-width: 220px; background: #fff; }
        .xt-coop-select { padding: 6px 10px; border-radius: 10px; border: 1px solid var(--xt-border); background: #fff; }
        .xt-coop-meta { color: var(--xt-text-muted); font-size: 12px; }
        .xt-coop-table-wrap { width: 100%; max-width: 100%; overflow-x: hidden; background:#fff; border:1px solid var(--xt-border); border-radius: 12px; }
        .xt-coop-table { width:100%; max-width:100%; border-collapse: separate; border-spacing:0; table-layout: fixed; }
        .xt-coop-col-order { width: 22%; }
        .xt-coop-col-type { width: 11%; }
        .xt-coop-col-phase { width: 15%; }
        .xt-coop-col-amount { width: 10%; }
        .xt-coop-col-person { width: 20%; }
        .xt-coop-col-links { width: 12%; }
        .xt-coop-col-action { width: 10%; }
        .xt-coop-th { position: sticky; top: 0; z-index: 1; background: rgba(21,42,69,0.06); text-align:left; padding: 10px; font-size: 12px; color: #475569; font-weight: 900; border-bottom: 1px solid rgba(148,163,184,0.28); }
        .xt-coop-td { box-sizing: border-box; padding: 10px; font-size: 13px; color: #0f172a; border-bottom: 1px solid rgba(148,163,184,0.22); vertical-align: top; overflow: hidden; }
        .xt-coop-row:hover { background: rgba(15,23,42,0.02); }
        .xt-coop-ellipsis { display:block; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .xt-coop-order-no { font-weight: 900; color: var(--xt-primary); }
        .xt-coop-title { margin-top: 4px; color: #0f172a; font-weight: 700; }
        .xt-coop-sub { margin-top: 6px; display:flex; gap: 8px; flex-wrap:wrap; align-items:center; }
        .xt-coop-amount { text-align: right; font-weight: 900; color: var(--xt-accent); white-space: nowrap; font-variant-numeric: tabular-nums; }
        .xt-coop-person { display:grid; gap: 6px; color:#0f172a; min-width:0; }
        .xt-coop-person-line { display:grid; grid-template-columns: 34px minmax(0,1fr); gap: 4px; align-items: start; min-width:0; }
        .xt-coop-person-label { color: #475569; }
        .xt-coop-person-value { min-width:0; }
        .xt-coop-muted { color: var(--xt-text-muted); font-size: 12px; }
        .xt-coop-links { display:grid; gap: 8px; min-width:0; }
        .xt-coop-link-row { display:flex; gap: 6px; align-items:center; min-width:0; }
        .xt-coop-link-tag { flex: 0 0 auto; padding: 1px 6px; border-radius: 999px; border: 1px solid rgba(148,163,184,0.35); font-size: 11px; color: #334155; background: rgba(148,163,184,0.12); }
        .xt-coop-link-url { min-width:0; color: var(--xt-primary); text-decoration: none; }
        .xt-coop-link-url:hover { text-decoration: underline; }
        .xt-coop-linkbtn { padding: 6px 10px; border-radius: 10px; border: 1px solid var(--xt-border); background: #fff; cursor: pointer; font-weight: 800; font-size: 12px; display:inline-flex; align-items:center; justify-content:center; }
        .xt-coop-linkbtn[disabled] { opacity: .55; cursor: not-allowed; }
        .xt-coop-review-note { margin-top: 8px; color: #475569; font-size: 12px; line-height: 1.4; max-height: 3.6em; overflow: hidden; text-overflow: ellipsis; }
        @media (max-width: 1280px) {
          .xt-coop-col-order { width: 21%; }
          .xt-coop-col-type { width: 10%; }
          .xt-coop-col-phase { width: 14%; }
          .xt-coop-col-amount { width: 10%; }
          .xt-coop-col-person { width: 21%; }
          .xt-coop-col-links { width: 13%; }
          .xt-coop-col-action { width: 11%; }
        }
        @media (max-width: 1023px) {
          .xt-coop-table-wrap { overflow-x: auto; }
          .xt-coop-table { min-width: 900px; }
        }
        @media (max-width: 720px) {
          .xt-coop-input { min-width: 100%; }
          .xt-coop-select { flex: 1 1 auto; min-width: 160px; }
        }
      `}</style>

      <div className="xt-coop-wrap">
        <div className="xt-coop-topbar">
          <h2>{title}</h2>
          <button type="button" onClick={() => void load()} disabled={loading} style={{ height: 34 }}>
            刷新
          </button>
          <div className="xt-coop-spacer" />
          <input className="xt-coop-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索订单号/标题" />
          <button type="button" onClick={() => void load()} style={{ height: 34 }}>
            搜索
          </button>
        </div>

        <div className="xt-coop-topbar">
          <select className="xt-coop-select" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">全部类型</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {typeLabel(t)}
              </option>
            ))}
          </select>
          <select className="xt-coop-select" value={phase} onChange={(e) => setPhase(e.target.value)}>
            <option value="">全部阶段</option>
            <option value="assigned">已分配</option>
            <option value="in_progress">进行中</option>
            <option value="submitted">已提交</option>
            <option value="review_pending">待审核</option>
            <option value="review_rejected">已驳回</option>
            <option value="approved_to_publish">待发布</option>
            <option value="published">已发布</option>
            <option value="delivered">已交付</option>
            <option value="completed">已完成</option>
          </select>
          <div className="xt-coop-meta">{loading ? "加载中…" : `共 ${filteredList.length} 条`}</div>
        </div>

        {error ? <p style={{ color: "#b91c1c", marginTop: 10 }}>{error}</p> : null}
        {msg ? <p style={{ color: "#166534", marginTop: 8 }}>{msg}</p> : null}

        <div className="xt-coop-table-wrap">
          <table className="xt-coop-table">
            <colgroup>
              <col className="xt-coop-col-order" />
              <col className="xt-coop-col-type" />
              <col className="xt-coop-col-phase" />
              <col className="xt-coop-col-amount" />
              <col className="xt-coop-col-person" />
              <col className="xt-coop-col-links" />
              <col className="xt-coop-col-action" />
            </colgroup>
            <thead>
              <tr>
                <th className="xt-coop-th">订单</th>
                <th className="xt-coop-th">合作类型</th>
                <th className="xt-coop-th">阶段</th>
                <th className="xt-coop-th" style={{ textAlign: "right", minWidth: 96 }}>金额</th>
                <th className="xt-coop-th">商家 / 达人</th>
                <th className="xt-coop-th">交付 / 发布</th>
                <th className="xt-coop-th" style={{ textAlign: "right" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((r) => {
                const id = r.id;
                const coop = safeText(r.cooperation_type_id);
                const ph = safeText(r.phase);
                const workLinks = asLinks(r.work_links);
                const publishLinks = asLinks(r.publish_links);
                const canReview = coop === "creator_review_video" && ph === "review_pending";
                return (
                  <tr key={id} className="xt-coop-row">
                    <td className="xt-coop-td">
                      <div className="xt-coop-order-no xt-coop-ellipsis" title={safeText(r.order_no) || `#${id}`}>
                        {safeText(r.order_no) || `#${id}`}
                      </div>
                      <div className="xt-coop-title xt-coop-ellipsis" title={safeText(r.title) || "-"}>
                        {safeText(r.title) || "-"}
                      </div>
                      <div className="xt-coop-sub">
                        <span style={statusBadgeStyle("status", safeText(r.status))}>{safeText(r.status) || "-"}</span>
                        <span style={statusBadgeStyle("match", safeText(r.match_status))}>{safeText(r.match_status) || "-"}</span>
                      </div>
                    </td>
                    <td className="xt-coop-td">
                      <span className="xt-coop-ellipsis" title={typeLabel(coop)}>
                        {typeLabel(coop)}
                      </span>
                    </td>
                    <td className="xt-coop-td">
                      <span style={statusBadgeStyle("phase", ph)}>{phaseLabel(ph)}</span>
                      {safeText(r.review_note) ? (
                        <div className="xt-coop-review-note" title={`备注：${safeText(r.review_note)}`}>
                          备注：{safeText(r.review_note)}
                        </div>
                      ) : null}
                    </td>
                    <td className="xt-coop-td xt-coop-amount">{safeNum(r.task_amount).toFixed(0)} ฿</td>
                    <td className="xt-coop-td">
                      <div className="xt-coop-person">
                        <div className="xt-coop-person-line">
                          <span className="xt-coop-person-label">商家：</span>
                          <span className="xt-coop-person-value xt-coop-ellipsis" title={safeText(r.client_name) || safeText(r.client_username) || "-"}>
                            {safeText(r.client_name) || safeText(r.client_username) || "-"}
                          </span>
                        </div>
                        <div className="xt-coop-person-line">
                          <span className="xt-coop-person-label">达人：</span>
                          <span className="xt-coop-person-value xt-coop-ellipsis" title={safeText(r.influencer_name) || safeText(r.influencer_username) || "-"}>
                            {safeText(r.influencer_name) || safeText(r.influencer_username) || "-"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="xt-coop-td">
                      <div className="xt-coop-links">
                        {workLinks.length ? (
                          <div className="xt-coop-link-row">
                            <span className="xt-coop-link-tag">交付</span>
                            <a className="xt-coop-link-url xt-coop-ellipsis" href={workLinks[0]} target="_blank" rel="noreferrer" title={workLinks[0]}>
                              {workLinks[0]}
                            </a>
                          </div>
                        ) : (
                          <span className="xt-coop-muted">交付链接：-</span>
                        )}
                        {publishLinks.length ? (
                          <div className="xt-coop-link-row">
                            <span className="xt-coop-link-tag">发布</span>
                            <a
                              className="xt-coop-link-url xt-coop-ellipsis"
                              href={publishLinks[publishLinks.length - 1]}
                              target="_blank"
                              rel="noreferrer"
                              title={publishLinks[publishLinks.length - 1]}
                            >
                              {publishLinks[publishLinks.length - 1]}
                            </a>
                          </div>
                        ) : (
                          <span className="xt-coop-muted">发布链接：-</span>
                        )}
                      </div>
                    </td>
                    <td className="xt-coop-td" style={{ textAlign: "right" }}>
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
                        <span className="xt-coop-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

