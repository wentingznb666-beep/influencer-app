import { compactPx } from "../responsive";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { getAccessToken, getStoredUser } from "../authApi";
import { getAdminCooperationOrders, getCooperationTypes, type CooperationTypesConfig } from "../matchingApi";

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
  detail_json?: unknown;
  phase?: string | null;
  publish_links?: unknown;
  review_note?: string | null;
};

type LinkAcceptanceItem = {
  link?: string;
  url?: string;
  accepted?: boolean;
  rejected?: boolean;
  payment_url?: string;
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

function pickTaskNameFromTitle(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "-";
  const split = s.split(/[|｜]/).map((x) => x.trim()).filter(Boolean);
  return split[0] || s;
}

function getDetailText(row: unknown, key: string): string {
  if (!row || typeof row !== "object") return "";
  const v = (row as Record<string, unknown>)[key];
  if (v == null) return "";
  const s = String(v).trim();
  return s;
}

function getDetailLinks(detail: unknown, key: string): string[] {
  if (!detail || typeof detail !== "object") return [];
  return asLinks((detail as Record<string, unknown>)[key]);
}

function formatOrderStatus(status: string) {
  const v = String(status || "").trim();
  if (v === "open") return "开放";
  if (v === "claimed") return "已认领";
  if (v === "completed") return "已完成";
  if (v === "accepted") return "已验收";
  if (v === "cancelled") return "已取消";
  return v || "—";
}

function formatMatchStatus(status: string) {
  const v = String(status || "").trim();
  if (v === "matched") return "已匹配";
  if (v === "unmatched") return "未匹配";
  if (v === "pending_selection") return "待选择";
  return v || "—";
}

function resolveUnifiedStatus(row: { phase?: unknown; status?: unknown; match_status?: unknown }): { kind: "phase" | "status" | "match"; value: string; label: string } | null {
  const ph = String(row.phase || "").trim();
  if (ph && ph !== "none") return { kind: "phase", value: ph, label: phaseLabel(ph) };
  const st = String(row.status || "").trim();
  if (st) return { kind: "status", value: st, label: formatOrderStatus(st) };
  const ms = String(row.match_status || "").trim();
  if (ms) return { kind: "match", value: ms, label: formatMatchStatus(ms) };
  return null;
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
    borderRadius: compactPx(999),
    border: "1px solid rgba(148,163,184,0.35)",
    background: "rgba(148,163,184,0.12)",
    color: "#334155",
    fontSize: compactPx(12),
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
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const user = getStoredUser();
  const isAdmin = user?.role === "admin";
  const isEmployee = user?.role === "employee";

  const [list, setList] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState("");
  const [phase, setPhase] = useState("");
  const [q, setQ] = useState("");
  const focusIdRef = useRef<number>(0);
  const [linkAcceptanceMap, setLinkAcceptanceMap] = useState<Record<number, LinkAcceptanceItem[]>>({});
  const jumpedOnceRef = useRef(false);
  const [typeConfig, setTypeConfig] = useState<CooperationTypesConfig | null>(null);

  const typeNameMap = useMemo(() => {
    const m = new Map<string, { zh: string; th: string }>();
    for (const it of typeConfig?.types || []) {
      m.set(String(it.id || ""), { zh: String(it.name?.zh || ""), th: String(it.name?.th || "") });
    }
    return m;
  }, [typeConfig]);

  const typeIdLabel = (typeId: string) => {
    const id = String(typeId || "").trim();
    if (!id) return "—";
    const name = typeNameMap.get(id);
    const isTh = String(i18n.language || "").toLowerCase().startsWith("th");
    const label = isTh ? name?.th : name?.zh;
    return (label && String(label).trim()) || id;
  };

  const taskNameLabel = (row: Row) => {
    const detailName = getDetailText(row.detail_json, "task_name");
    if (detailName) return detailName;
    return pickTaskNameFromTitle(safeText(row.title));
  };

  const taskTypeLabel = (row: Row) => {
    const detailType = getDetailText(row.detail_json, "task_type");
    if (detailType) return detailType;
    const id = String(row.cooperation_type_id || "").trim();
    if (!id) return "—";
    return typeIdLabel(id);
  };

  const filteredList = useMemo(() => {
    const src = Array.isArray(list) ? list : [];
    return src.filter((r) => {
      const coop = safeText(r.cooperation_type_id);
      return !VIDEO_ORDER_TYPE_IDS.has(coop);
    });
  }, [list]);

  const typeOptions = useMemo(() => {
    const types = (typeConfig?.types || [])
      .filter((t) => t.id && !VIDEO_ORDER_TYPE_IDS.has(t.id))
      .map((t) => t.id);
    return types.sort((a, b) => a.localeCompare(b));
  }, [typeConfig]);

  useEffect(() => {
    if (!type) return;
    if (typeOptions.includes(type)) return;
    setType("");
  }, [type, typeOptions]);

  const load = async (override?: { type?: string; phase?: string; q?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const nextType = override?.type ?? type;
      const nextPhase = override?.phase ?? phase;
      const nextQ = override?.q ?? q;
      const ret = await getAdminCooperationOrders({
        type: nextType || undefined,
        phase: nextPhase || undefined,
        q: nextQ || undefined,
        limit: 200,
      });
      setList(Array.isArray(ret?.list) ? (ret.list as Row[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("加载失败"));
    } finally {
      setLoading(false);
    }
  };
  /** 加载所有订单的验收/付款截图数据 */
  const loadLinkAcceptances = useCallback(async (orders: Row[]) => {
    const map: Record<number, LinkAcceptanceItem[]> = {};
    const token = getAccessToken();
    await Promise.all(orders.map(async (r) => {
      try {
        const res = await fetch(`/api/matching/admin/matching-orders/${r.id}/link-acceptance`, {
          headers: { Authorization: `Bearer ${token || ""}` },
        });
        const data = await res.json();
        if (data?.list?.length) map[r.id] = data.list;
      } catch {}
    }));
    setLinkAcceptanceMap(map);
  }, []);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    getCooperationTypes()
      .then((ret) => setTypeConfig(ret?.config || null))
      .catch(() => setTypeConfig(null));
  }, []);

  useEffect(() => {
    if (filteredList.length > 0) void loadLinkAcceptances(filteredList);
  }, [filteredList, loadLinkAcceptances]);

  useEffect(() => {
    void load();
  }, [type, phase]);

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const orderId = Number(sp.get("orderId") || 0);
    const nextQ = String(sp.get("q") || "").trim();
    const hasFocus = Number.isFinite(orderId) && orderId > 0;
    if (!jumpedOnceRef.current) {
      jumpedOnceRef.current = true;
      if (nextQ) setQ(nextQ);
      if (hasFocus) focusIdRef.current = orderId;
      if (nextQ) void load({ q: nextQ });
      return;
    }
    if (hasFocus) focusIdRef.current = orderId;
    if (nextQ && nextQ !== q) {
      setQ(nextQ);
      void load({ q: nextQ });
    }
  }, [location.search]);

  useEffect(() => {
    const focusId = focusIdRef.current;
    if (!focusId) return;
    if (loading) return;
    const el = document.querySelector<HTMLElement>(`[data-coop-id="${focusId}"]`);
    if (!el) return;
    focusIdRef.current = 0;
    window.setTimeout(() => el.scrollIntoView({ block: "center" }), 0);
  }, [loading, filteredList.length]);

  const title = useMemo(() => {
    if (isAdmin) return "合作订单工作台（管理员）";
    if (isEmployee) return "合作订单工作台（员工）";
    return "合作订单工作台";
  }, [isAdmin, isEmployee]);

  return (
    <div>
      <style>{`
        .xt-coop-wrap { display:flex; flex-direction:column; gap: compactPx(12)px; }
        .xt-coop-topbar { display:flex; gap: compactPx(10)px; align-items:center; flex-wrap:wrap; }
        .xt-coop-topbar h2 { margin: 0; }
        .xt-coop-spacer { flex: 1 1 auto; }
        .xt-coop-input { padding: compactPx(6)px 10px; border-radius: 10px; border: 1px solid var(--xt-border); min-width: 220px; background: #fff; }
        .xt-coop-select { padding: compactPx(6)px 10px; border-radius: 10px; border: 1px solid var(--xt-border); background: #fff; }
        .xt-coop-meta { color: var(--xt-text-muted); font-size: 12px; }
        .xt-coop-table-wrap { width: 100%; max-width: 100%; overflow-x: hidden; background:#fff; border:1px solid var(--xt-border); border-radius: 12px; }
        .xt-coop-table { width:100%; max-width:100%; border-collapse: separate; border-spacing:0; table-layout: fixed; }
        .xt-coop-col-orderNo { width: 10%; }
        .xt-coop-col-taskName { width: 18%; }
        .xt-coop-col-type { width: 12%; }
        .xt-coop-col-amount { width: 10%; }
        .xt-coop-col-client { width: 14%; }
        .xt-coop-col-influencer { width: 14%; }
        .xt-coop-col-status { width: 12%; }
        .xt-coop-col-delivery { width: 10%; }
        .xt-coop-col-acceptance { width: 14%; }
        .xt-coop-th { position: sticky; top: 0; z-index: 1; background: rgba(21,42,69,0.06); text-align:left; padding: compactPx(10)px; font-size: 12px; color: #475569; font-weight: 900; border-bottom: 1px solid rgba(148,163,184,0.28); }
        .xt-coop-td { box-sizing: border-box; padding: compactPx(10)px; font-size: 13px; color: #0f172a; border-bottom: 1px solid rgba(148,163,184,0.22); border-right: 1px solid rgba(148,163,184,0.12); vertical-align: top; overflow-wrap: anywhere; word-break: break-word; white-space: normal; }
        .xt-coop-td:last-child { border-right: none; }
        .xt-coop-row:hover { background: rgba(15,23,42,0.02); }
        .xt-coop-order-no { font-weight: 900; color: var(--xt-primary); }
        .xt-coop-title { color: #0f172a; font-weight: 700; }
        .xt-coop-sub { display:flex; gap: compactPx(8)px; flex-wrap:wrap; align-items:center; }
        .xt-coop-amount { text-align: right; font-weight: 900; color: var(--xt-accent); white-space: nowrap; font-variant-numeric: tabular-nums; }
        .xt-coop-person { display:grid; gap: compactPx(6)px; color:#0f172a; min-width:0; }
        .xt-coop-person-line { display:grid; grid-template-columns: 34px minmax(0,1fr); gap: compactPx(4)px; align-items: start; min-width:0; }
        .xt-coop-person-label { color: #475569; }
        .xt-coop-person-value { min-width:0; }
        .xt-coop-muted { color: var(--xt-text-muted); font-size: 12px; }
        .xt-coop-links { display:grid; gap: compactPx(8)px; min-width:0; }
        .xt-coop-link-row { display:flex; gap: compactPx(6)px; align-items:center; min-width:0; }
        .xt-coop-link-tag { flex: 0 0 auto; padding: 1px 6px; border-radius: 999px; border: 1px solid rgba(148,163,184,0.35); font-size: 11px; color: #334155; background: rgba(148,163,184,0.12); }
        .xt-coop-link-url { min-width:0; color: var(--xt-primary); text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block; max-width: 160px; }
        .xt-coop-link-url:hover { text-decoration: underline; }
        .xt-coop-linkbtn { padding: compactPx(6)px 10px; border-radius: 10px; border: 1px solid var(--xt-border); background: #fff; cursor: pointer; font-weight: 800; font-size: 12px; display:inline-flex; align-items:center; justify-content:center; }
        .xt-coop-linkbtn[disabled] { opacity: .55; cursor: not-allowed; }
        .xt-coop-order-no { white-space: nowrap !important; font-variant-numeric: tabular-nums; font-weight: 700; overflow: hidden; text-overflow: ellipsis; }
        .xt-coop-review-note { margin-top: 8px; color: #475569; font-size: 12px; line-height: 1.4; max-height: 3.6em; overflow: hidden; text-overflow: ellipsis; }
        @media (max-width: 1280px) {
          .xt-coop-col-orderNo { width: 11%; }
          .xt-coop-col-taskName { width: 18%; }
          .xt-coop-col-type { width: 12%; }
          .xt-coop-col-amount { width: 10%; }
          .xt-coop-col-client { width: 14%; }
          .xt-coop-col-influencer { width: 14%; }
          .xt-coop-col-status { width: 12%; }
          .xt-coop-col-delivery { width: 9%; }
          .xt-coop-col-acceptance { width: 13%; }
        }
        @media (max-width: 1023px) {
          .xt-coop-table-wrap { overflow-x: auto; }
          .xt-coop-table { min-width: 980px; }
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
          <select className="xt-coop-select" value={type} onChange={(e) => setType(e.target.value)} disabled={!typeConfig && !loading}>
            <option value="">全部类型</option>
            {!typeConfig && !loading ? (
              <option disabled value="">加载中…</option>
            ) : typeOptions.length === 0 ? (
              <option disabled value="">暂无类型数据</option>
            ) : (
              typeOptions.map((t) => (
                <option key={t} value={t}>
                  {typeIdLabel(t)}
                </option>
              ))
            )}
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
          <div className="xt-coop-meta">{loading ? t("加载中…") : `共 ${filteredList.length} 条`}</div>
        </div>

        {error ? <p style={{ color: "#b91c1c", marginTop: compactPx(10) }}>{error}</p> : null}
        

        <div className="xt-coop-table-wrap">
          <table className="xt-coop-table">
            <colgroup>
              <col className="xt-coop-col-orderNo" />
              <col className="xt-coop-col-taskName" />
              <col className="xt-coop-col-type" />
              <col className="xt-coop-col-amount" />
              <col className="xt-coop-col-client" />
              <col className="xt-coop-col-influencer" />
              <col className="xt-coop-col-status" />
              <col className="xt-coop-col-delivery" />
              <col className="xt-coop-col-acceptance" />
            </colgroup>
            <thead>
              <tr>
                <th className="xt-coop-th">订单号</th>
                <th className="xt-coop-th">任务名称</th>
                <th className="xt-coop-th">任务类型</th>
                <th className="xt-coop-th" style={{ textAlign: "right", minWidth: 96 }}>金额</th>
                <th className="xt-coop-th">商家</th>
                <th className="xt-coop-th">达人</th>
                <th className="xt-coop-th">订单状态</th>
                <th className="xt-coop-th">交付</th>
                <th className="xt-coop-th">验收状态</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((r) => {
                const id = r.id;
                const workLinks = (() => {
                  const primary = asLinks(r.work_links);
                  if (primary.length) return primary;
                  const fromDetail = getDetailLinks(r.detail_json, "work_links");
                  if (fromDetail.length) return fromDetail;
                  const fromProof = getDetailLinks(r.detail_json, "proof_links");
                  if (fromProof.length) return fromProof;
                  return [];
                })();
                const uni = resolveUnifiedStatus(r);
                return (
                  <tr key={id} className="xt-coop-row" data-coop-id={id}>
                    <td className="xt-coop-td">
                      <div className="xt-coop-order-no" title={safeText(r.order_no) || `#${id}`} style={{ cursor: "pointer" }} onClick={() => { const txt = safeText(r.order_no) || `#${id}`; if (txt) { navigator.clipboard?.writeText(txt).then(() => { /* copied */ }).catch(() => {}); } }}>
                        {safeText(r.order_no) || `#${id}`}
                      </div>
                    </td>
                    <td className="xt-coop-td">
                      <div className="xt-coop-title">{taskNameLabel(r)}</div>
                    </td>
                    <td className="xt-coop-td">
                      <span>{taskTypeLabel(r)}</span>
                    </td>
                    <td className="xt-coop-td xt-coop-amount">{safeNum(r.task_amount).toFixed(0)} ฿</td>
                    <td className="xt-coop-td">
                      <div className="xt-coop-person">
                        <span className="xt-coop-person-value" title={safeText(r.client_name) || safeText(r.client_username) || "-"}>
                          {safeText(r.client_name) || safeText(r.client_username) || "-"}
                        </span>
                      </div>
                    </td>
                    <td className="xt-coop-td">
                      <div className="xt-coop-person">
                        <span className="xt-coop-person-value" title={safeText(r.influencer_name) || safeText(r.influencer_username) || "-"}>
                          {safeText(r.influencer_name) || safeText(r.influencer_username) || "-"}
                        </span>
                      </div>
                    </td>
                    <td className="xt-coop-td">
                      {uni ? <span style={statusBadgeStyle(uni.kind, uni.value)}>{t(uni.label)}</span> : <span className="xt-coop-muted">—</span>}
                    </td>
                    <td className="xt-coop-td">
                      {workLinks.length ? (
                        <div className="xt-coop-links">
                          {workLinks.map((url, idx) => (
                            <div key={`${id}-work-${idx}`} className="xt-coop-link-row">
                              <span className="xt-coop-link-tag">{t("交付")}</span>
                              <a className="xt-coop-link-url" href={url} target="_blank" rel="noreferrer">
                                {url}
                              </a>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="xt-coop-muted">—</span>
                      )}
                    </td>
                    <td className="xt-coop-td">
                      {(() => {
                        const acceptances = linkAcceptanceMap[r.id];
                        if (!acceptances || acceptances.length === 0) return <span className="xt-coop-muted">—</span>;
                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: compactPx(6) }}>
                            {acceptances.map((la, idx) => (
                              <div key={idx} style={{ display: "flex", alignItems: "center", gap: compactPx(6), padding: "4px 0", fontSize: compactPx(12), flexWrap: "wrap" }}>
                                <span style={{ flex: "0 0 auto", color: "#64748b" }}>回传{idx + 1}</span>
                                {la.accepted ? (
                                  <span style={{ color: "#16a34a", fontWeight: 700, whiteSpace: "nowrap" }}>✅ 通过</span>
                                ) : la.rejected ? (
                                  <span style={{ color: "#dc2626", fontWeight: 700, whiteSpace: "nowrap" }}>❌ 驳回</span>
                                ) : (
                                  <span style={{ color: "#94a3b8", whiteSpace: "nowrap" }}>待验收</span>
                                )}
                                {la.influencer_username && (
                                  <span style={{ color: "#64748b", fontSize: compactPx(11) }}>@{la.influencer_username}</span>
                                )}
                                {la.payment_url && (
                                  <a href={la.payment_url} target="_blank" rel="noreferrer" style={{ fontSize: compactPx(11), padding: "2px 8px", background: "#10b981", color: "#fff", borderRadius: compactPx(4), textDecoration: "none", whiteSpace: "nowrap" }}>
                                    付款截图
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
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
