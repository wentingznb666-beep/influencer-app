import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  acceptMatchingOrder,
  getMatchingOrderApplicants,
  getMatchingOrders,
  rejectMatchingOrderAccept,
  rejectMatchingOrderApplicant,
  selectMatchingOrderApplicant,
} from "../clientApi";

type OrderRow = {
  id: number;
  order_no?: string | null;
  title?: string | null;
  status?: string | null;
  match_status?: string | null;
  task_amount?: number | string | null;
  work_links?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
  detail_json?: unknown;
};

type ApplicantRow = {
  id: number;
  username?: string | null;
  status?: string | null;
  influencer_id?: number;
  tiktok_account?: string | null;
  tiktok_fans?: string | null;
  expertise_domains?: string | null;
  influencer_bio?: string | null;
};

function safeNumber(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeText(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function getOrderDetailField(order: OrderRow, key: string): string {
  if (!order.detail_json || typeof order.detail_json !== "object") return "";
  const anyObj = order.detail_json as Record<string, unknown>;
  const v = anyObj[key];
  return typeof v === "string" ? v : "";
}

function formatDateTimeLite(raw: unknown): string {
  const s = safeText(raw);
  if (!s) return "-";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusBadgeStyle(status: string): { bg: string; text: string; border: string } {
  const s = status.toLowerCase();
  if (s === "completed") return { bg: "rgba(16,185,129,0.12)", text: "#0f766e", border: "rgba(16,185,129,0.35)" };
  if (s === "claimed") return { bg: "rgba(245,158,11,0.14)", text: "#b45309", border: "rgba(245,158,11,0.40)" };
  if (s === "open") return { bg: "rgba(59,130,246,0.12)", text: "#1d4ed8", border: "rgba(59,130,246,0.35)" };
  return { bg: "rgba(100,116,139,0.12)", text: "#334155", border: "rgba(100,116,139,0.35)" };
}

function statusText(status: string): string {
  const s = status.toLowerCase();
  if (s === "open") return "开放中";
  if (s === "claimed") return "执行中";
  if (s === "completed") return "待验收";
  return status || "-";
}

export default function MatchingOrdersPage() {
  const location = useLocation();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const [applicants, setApplicants] = useState<ApplicantRow[]>([]);
  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [actionBusy, setActionBusy] = useState<Record<string, boolean>>({});
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeInfluencer, setActiveInfluencer] = useState<ApplicantRow | null>(null);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "claimed" | "completed">("all");
  const [sortKey, setSortKey] = useState<"time_desc" | "time_asc" | "amount_desc" | "amount_asc">("time_desc");
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const [page, setPage] = useState(1);

  const setBusy = (key: string, next: boolean) => setActionBusy((prev) => ({ ...prev, [key]: next }));

  const loadAll = async () => {
    setLoadingOrders(true);
    try {
      const data = await getMatchingOrders();
      setOrders(Array.isArray(data?.list) ? (data.list as OrderRow[]) : []);
    } finally {
      setLoadingOrders(false);
    }
  };

  const loadApplicants = async (orderId: number) => {
    setLoadingApplicants(true);
    try {
      const data = await getMatchingOrderApplicants(orderId);
      setApplicants(Array.isArray(data?.list) ? (data.list as ApplicantRow[]) : []);
    } finally {
      setLoadingApplicants(false);
    }
  };

  useEffect(() => {
    loadAll().catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const orderId = Number(sp.get("orderId") || 0);
    if (!Number.isInteger(orderId) || orderId < 1) return;
    void openApplicants(orderId);
  }, [location.search]);

  const openApplicants = async (orderId: number) => {
    setActiveOrderId(orderId);
    setPaymentInfo(null);
    setError(null);
    setMsg("");
    setApplicants([]);
    try {
      await loadApplicants(orderId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载报名失败");
    }
  };

  const closeApplicants = () => {
    setActiveOrderId(null);
    setApplicants([]);
    setPaymentInfo(null);
  };

  const openInfluencerDetail = (influencer: ApplicantRow) => {
    setActiveInfluencer(influencer);
    setDetailOpen(true);
  };

  const selectApplicant = async (appId: number) => {
    if (!activeOrderId) return;
    setError(null);
    setMsg("");
    const key = `selectApplicant:${activeOrderId}:${appId}`;
    setBusy(key, true);
    try {
      await selectMatchingOrderApplicant(activeOrderId, appId);
      await Promise.all([loadAll(), loadApplicants(activeOrderId)]);
      setMsg("已选中达人");
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusy(key, false);
    }
  };

  const rejectApplicant = async (appId: number) => {
    if (!activeOrderId) return;
    setError(null);
    setMsg("");
    const key = `rejectApplicant:${activeOrderId}:${appId}`;
    setBusy(key, true);
    try {
      await rejectMatchingOrderApplicant(activeOrderId, appId);
      await loadApplicants(activeOrderId);
      setMsg("已驳回报名");
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusy(key, false);
    }
  };

  const rejectOrder = async (orderId: number) => {
    setError(null);
    setMsg("");
    const key = `rejectOrder:${orderId}`;
    setBusy(key, true);
    try {
      await rejectMatchingOrderAccept(orderId);
      setPaymentInfo(null);
      await loadAll();
      setMsg("已驳回，任务退回执行中");
    } catch (err) {
      setError(err instanceof Error ? err.message : "驳回失败");
    } finally {
      setBusy(key, false);
    }
  };

  const acceptOrder = async (orderId: number) => {
    setError(null);
    setMsg("");
    const key = `acceptOrder:${orderId}`;
    setBusy(key, true);
    try {
      const ret = await acceptMatchingOrder(orderId);
      setPaymentInfo(ret?.payment_profile || null);
      await loadAll();
      setMsg("验收通过，已展示收款信息");
    } catch (err) {
      setError(err instanceof Error ? err.message : "验收失败");
    } finally {
      setBusy(key, false);
    }
  };

  const activeOrder = useMemo(() => orders.find((o) => o.id === activeOrderId) || null, [orders, activeOrderId]);
  const influencerDomains = useMemo(() => {
    if (!activeInfluencer?.expertise_domains) return "-";
    return safeText(activeInfluencer.expertise_domains)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .join("、") || "-";
  }, [activeInfluencer]);

  const stats = useMemo(() => {
    const out = { all: orders.length, open: 0, claimed: 0, completed: 0 };
    orders.forEach((o) => {
      const s = safeText(o.status).toLowerCase();
      if (s === "open") out.open += 1;
      else if (s === "claimed") out.claimed += 1;
      else if (s === "completed") out.completed += 1;
    });
    return out;
  }, [orders]);

  const filteredSortedOrders = useMemo(() => {
    const query = q.trim().toLowerCase();
    const byStatus = (o: OrderRow) => {
      const s = safeText(o.status).toLowerCase();
      if (statusFilter === "all") return true;
      return s === statusFilter;
    };
    const byQuery = (o: OrderRow) => {
      if (!query) return true;
      const orderNo = safeText(o.order_no).toLowerCase();
      const title = safeText(o.title).toLowerCase();
      const taskName = getOrderDetailField(o, "task_name").toLowerCase();
      const productName = getOrderDetailField(o, "product_name").toLowerCase();
      return [orderNo, title, taskName, productName].some((x) => x.includes(query));
    };
    const arr = orders.filter((o) => byStatus(o) && byQuery(o));
    const byTime = (o: OrderRow) => {
      const raw = o.updated_at || o.created_at || "";
      const t = new Date(raw).getTime();
      return Number.isFinite(t) ? t : 0;
    };
    arr.sort((a, b) => {
      if (sortKey === "amount_desc") return safeNumber(b.task_amount) - safeNumber(a.task_amount);
      if (sortKey === "amount_asc") return safeNumber(a.task_amount) - safeNumber(b.task_amount);
      if (sortKey === "time_asc") return byTime(a) - byTime(b);
      return byTime(b) - byTime(a);
    });
    return arr;
  }, [orders, q, sortKey, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSortedOrders.length / pageSize));
  useEffect(() => {
    setPage(1);
  }, [q, sortKey, statusFilter, pageSize]);

  const pagedOrders = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSortedOrders.slice(start, start + pageSize);
  }, [filteredSortedOrders, page, pageSize]);

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 10px 24px rgba(15,23,42,0.08)" }}>
      <style>{`
        .xt-match-header { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap; }
        .xt-match-title { margin:0; color:var(--xt-primary); letter-spacing:0.02em; font-size:20px; line-height:1.25; }
        .xt-match-sub { margin:6px 0 0; color:#64748b; font-size:13px; line-height:1.7; }
        .xt-match-kpis { display:flex; gap:10px; flex-wrap:wrap; }
        .xt-pill { display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:999px; border:1px solid var(--xt-border); background:rgba(15,23,42,0.02); color:#334155; font-size:12px; }
        .xt-pill strong { font-weight:700; }

        .xt-toolbar { margin-top:14px; padding:12px; border:1px solid var(--xt-border); border-radius:12px; background:linear-gradient(180deg,#fff, rgba(15,23,42,0.015)); display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
        .xt-input { height:36px; padding:0 12px; border:1px solid var(--xt-border); border-radius:10px; outline:none; min-width:220px; background:#fff; color:var(--xt-text); }
        .xt-select { height:36px; padding:0 10px; border:1px solid var(--xt-border); border-radius:10px; outline:none; background:#fff; color:var(--xt-text); }
        .xt-toolbar-spacer { flex:1; min-width:20px; }
        .xt-muted { color:#64748b; font-size:12px; line-height:1.6; }

        .xt-orders { margin-top:14px; display:grid; gap:12px; }
        .xt-card { border:1px solid rgba(148,163,184,0.35); border-radius:14px; background:#fff; padding:14px; transition: box-shadow .18s ease, transform .18s ease, border-color .18s ease; }
        .xt-card:hover { box-shadow:0 14px 28px rgba(15,23,42,0.10); transform: translateY(-1px); border-color: rgba(148,163,184,0.55); }
        .xt-card-row { display:flex; gap:16px; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; }
        .xt-main { min-width:260px; flex:1; }
        .xt-meta { display:flex; flex-wrap:wrap; gap:8px 12px; margin-top:8px; color:#475569; font-size:13px; line-height:1.8; }
        .xt-meta span { white-space:nowrap; }
        .xt-order-no { font-size:12px; color:#64748b; letter-spacing:0.04em; }
        .xt-order-title { margin:4px 0 0; font-size:16px; font-weight:700; color:#0f172a; line-height:1.35; }
        .xt-order-product { margin:6px 0 0; font-size:13px; color:#334155; line-height:1.7; }
        .xt-right { display:flex; flex-direction:column; gap:10px; align-items:flex-end; min-width:220px; }
        .xt-amount { display:flex; align-items:baseline; gap:8px; }
        .xt-amount strong { font-size:20px; color:#b45309; letter-spacing:0.01em; }
        .xt-amount span { font-size:12px; color:#64748b; }
        .xt-badge { display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:999px; border:1px solid; font-size:12px; font-weight:700; }

        .xt-actions { display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end; }
        .xt-btn { height:34px; padding:0 12px; border-radius:10px; border:1px solid transparent; font-weight:700; cursor:pointer; transition: transform .12s ease, box-shadow .12s ease, background-color .12s ease, border-color .12s ease, opacity .12s ease; white-space:nowrap; }
        .xt-btn:active { transform: translateY(1px); }
        .xt-btn[disabled] { cursor:not-allowed; opacity:.55; box-shadow:none; }
        .xt-btn--primary { background: var(--xt-accent); color:#fff; box-shadow:0 6px 16px rgba(224,112,32,0.22); }
        .xt-btn--primary:hover { box-shadow:0 10px 22px rgba(224,112,32,0.30); }
        .xt-btn--outline { background:#fff; color: var(--xt-primary); border-color: rgba(26,35,126,0.22); }
        .xt-btn--outline:hover { background: rgba(26,35,126,0.06); border-color: rgba(26,35,126,0.35); }
        .xt-btn--danger { background: rgba(239,68,68,0.10); color:#b91c1c; border-color: rgba(239,68,68,0.25); }
        .xt-btn--danger:hover { background: rgba(239,68,68,0.14); border-color: rgba(239,68,68,0.34); }

        .xt-pagination { margin-top:14px; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
        .xt-page-btn { height:34px; padding:0 12px; border-radius:10px; border:1px solid var(--xt-border); background:#fff; color:var(--xt-text); cursor:pointer; }
        .xt-page-btn[disabled] { cursor:not-allowed; opacity:.55; }
        .xt-page-nums { display:flex; gap:6px; flex-wrap:wrap; }
        .xt-page-num { width:34px; height:34px; border-radius:10px; border:1px solid var(--xt-border); background:#fff; cursor:pointer; }
        .xt-page-num--active { background: rgba(26,35,126,0.08); border-color: rgba(26,35,126,0.28); color: var(--xt-primary); font-weight:800; }

        .xt-modal-mask { position:fixed; inset:0; background: rgba(15,23,42,0.52); display:grid; place-items:center; z-index:1200; padding: 18px; }
        .xt-modal { width: min(980px, 96vw); max-height: 90vh; overflow: hidden; background:#fff; border-radius:16px; box-shadow:0 20px 60px rgba(15,23,42,0.30); display:flex; flex-direction:column; }
        .xt-modal-head { padding:14px 16px; border-bottom:1px solid var(--xt-border); display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .xt-modal-title { margin:0; font-size:16px; font-weight:800; color:#0f172a; }
        .xt-close { width:36px; height:36px; border-radius:12px; border:1px solid var(--xt-border); background:#fff; cursor:pointer; color:#475569; font-size:18px; display:grid; place-items:center; }
        .xt-close:hover { background: rgba(239,68,68,0.10); border-color: rgba(239,68,68,0.25); color:#b91c1c; }
        .xt-modal-body { padding: 14px 16px; overflow:auto; }
        .xt-table { width:100%; border-collapse: separate; border-spacing:0; }
        .xt-th, .xt-td { padding:10px 10px; border-bottom:1px solid rgba(148,163,184,0.28); text-align:left; font-size:13px; color:#0f172a; vertical-align:middle; }
        .xt-th { color:#475569; font-weight:800; background: rgba(15,23,42,0.02); position: sticky; top: 0; z-index: 1; }

        @media (max-width: 720px) {
          .xt-right { align-items:flex-start; min-width: 0; width: 100%; }
          .xt-actions { justify-content:flex-start; }
          .xt-input { min-width: 100%; }
        }
      `}</style>

      <div className="xt-match-header">
        <div>
          <h2 className="xt-match-title">我的撮合订单</h2>
          <p className="xt-match-sub">按状态/时间/金额快速筛选与管理报名，支持验收与回传查看。</p>
        </div>
        <div className="xt-match-kpis">
          <span className="xt-pill">全部 <strong>{stats.all}</strong></span>
          <span className="xt-pill">开放 <strong>{stats.open}</strong></span>
          <span className="xt-pill">执行 <strong>{stats.claimed}</strong></span>
          <span className="xt-pill">待验收 <strong>{stats.completed}</strong></span>
        </div>
      </div>

      {error ? <p style={{ color: "#b91c1c", marginTop: 10, lineHeight: 1.8 }}>{error}</p> : null}
      {msg ? <p style={{ color: "#166534", marginTop: 8, lineHeight: 1.8 }}>{msg}</p> : null}

      <div className="xt-toolbar">
        <input className="xt-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索：订单号 / 任务名称 / 产品名称" />
        <select className="xt-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
          <option value="all">全部状态</option>
          <option value="open">open（开放）</option>
          <option value="claimed">claimed（执行）</option>
          <option value="completed">completed（待验收）</option>
        </select>
        <select className="xt-select" value={sortKey} onChange={(e) => setSortKey(e.target.value as any)}>
          <option value="time_desc">时间：最新优先</option>
          <option value="time_asc">时间：最早优先</option>
          <option value="amount_desc">金额：高到低</option>
          <option value="amount_asc">金额：低到高</option>
        </select>
        <select className="xt-select" value={String(pageSize)} onChange={(e) => setPageSize(Number(e.target.value) as any)}>
          <option value="10">每页 10</option>
          <option value="20">每页 20</option>
          <option value="50">每页 50</option>
        </select>
        <div className="xt-toolbar-spacer" />
        <span className="xt-muted">{loadingOrders ? "加载中…" : `共 ${filteredSortedOrders.length} 条`}</span>
      </div>

      <div className="xt-orders">
        {pagedOrders.length === 0 && !loadingOrders ? (
          <div style={{ padding: 16, color: "#64748b", border: "1px dashed rgba(148,163,184,0.6)", borderRadius: 14 }}>暂无符合条件的订单</div>
        ) : null}

        {pagedOrders.map((it) => {
          const amount = safeNumber(it.task_amount);
          const status = safeText(it.status);
          const badge = statusBadgeStyle(status);
          const taskName = getOrderDetailField(it, "task_name") || safeText(it.title);
          const productName = getOrderDetailField(it, "product_name");
          const coopType = getOrderDetailField(it, "cooperation_type_id");
          const workLinks = Array.isArray(it.work_links) ? (it.work_links as unknown[]) : [];
          const firstWork = workLinks.length ? String(workLinks[0] || "") : "";
          return (
            <div key={it.id} className="xt-card">
              <div className="xt-card-row">
                <div className="xt-main">
                  <div className="xt-order-no">{safeText(it.order_no) || "-"}</div>
                  <div className="xt-order-title">{taskName || "-"}</div>
                  <div className="xt-order-product">
                    {productName ? <>推广产品/品牌：<strong style={{ color: "#0f172a" }}>{productName}</strong></> : <span style={{ color: "#94a3b8" }}>推广产品/品牌：-</span>}
                  </div>
                  <div className="xt-order-product">
                    {coopType ? <>合作业务类型：<strong style={{ color: "#0f172a" }}>{coopType}</strong></> : <span style={{ color: "#94a3b8" }}>合作业务类型：-</span>}
                  </div>
                  <div className="xt-meta">
                    <span>创建：{formatDateTimeLite(it.created_at)}</span>
                    <span>更新：{formatDateTimeLite(it.updated_at)}</span>
                    {safeText(it.match_status) ? <span>匹配：{safeText(it.match_status)}</span> : null}
                  </div>
                </div>
                <div className="xt-right">
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                    <div className="xt-amount"><strong>{amount.toFixed(0)}</strong><span>฿</span></div>
                    <span className="xt-badge" style={{ background: badge.bg, color: badge.text, borderColor: badge.border }}>{statusText(status)}</span>
                  </div>
                  <div className="xt-actions">
                    <button type="button" className="xt-btn xt-btn--primary" onClick={() => void openApplicants(it.id)}>报名管理</button>
                    {firstWork ? <a className="xt-btn xt-btn--outline" href={firstWork} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>查看回传短视频</a> : null}
                    {safeText(it.status) === "completed" ? (
                      <>
                        <button type="button" className="xt-btn xt-btn--primary" onClick={() => void acceptOrder(it.id)} disabled={!!actionBusy[`acceptOrder:${it.id}`]}>
                          {actionBusy[`acceptOrder:${it.id}`] ? "验收中…" : "验收通过"}
                        </button>
                        <button type="button" className="xt-btn xt-btn--danger" onClick={() => void rejectOrder(it.id)} disabled={!!actionBusy[`rejectOrder:${it.id}`]}>
                          {actionBusy[`rejectOrder:${it.id}`] ? "处理中…" : "验收驳回"}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="xt-pagination">
        <div className="xt-muted">第 {page} / {totalPages} 页</div>
        <div className="xt-page-nums">
          {Array.from({ length: Math.min(7, totalPages) }).map((_, idx) => {
            const windowStart = Math.max(1, Math.min(page - 3, totalPages - 6));
            const p = totalPages <= 7 ? idx + 1 : windowStart + idx;
            return <button key={p} type="button" className={`xt-page-num ${p === page ? "xt-page-num--active" : ""}`} onClick={() => setPage(p)}>{p}</button>;
          })}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="xt-page-btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>上一页</button>
          <button type="button" className="xt-page-btn" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>下一页</button>
        </div>
      </div>

      {activeOrder ? (
        <div className="xt-modal-mask" onClick={(e) => { if (e.target === e.currentTarget) closeApplicants(); }}>
          <div className="xt-modal">
            <div className="xt-modal-head">
              <div>
                <h3 className="xt-modal-title">报名管理</h3>
                <div className="xt-muted">{safeText(activeOrder.order_no) || "-"} ｜ {getOrderDetailField(activeOrder, "task_name") || safeText(activeOrder.title) || "-"}</div>
              </div>
              <button type="button" className="xt-close" onClick={closeApplicants}>×</button>
            </div>
            <div className="xt-modal-body">
              {loadingApplicants ? <div style={{ color: "#64748b", padding: "10px 2px" }}>加载报名中…</div> : null}
              {!loadingApplicants && applicants.length === 0 ? <div style={{ color: "#64748b", padding: "10px 2px" }}>暂无报名达人</div> : null}
              {applicants.length > 0 ? (
                <table className="xt-table">
                  <thead>
                    <tr><th className="xt-th">达人</th><th className="xt-th">状态</th><th className="xt-th" style={{ textAlign: "right" }}>操作</th></tr>
                  </thead>
                  <tbody>
                    {applicants.map((a) => {
                      const st = safeText(a.status);
                      const canAct = st === "pending";
                      const selectKey = `selectApplicant:${activeOrder.id}:${a.id}`;
                      const rejectKey = `rejectApplicant:${activeOrder.id}:${a.id}`;
                      return (
                        <tr key={a.id}>
                          <td className="xt-td">{safeText(a.username) || "-"}</td>
                          <td className="xt-td" style={{ color: "#475569" }}>{st || "-"}</td>
                          <td className="xt-td" style={{ textAlign: "right" }}>
                            <div className="xt-actions">
                              <button type="button" className="xt-btn xt-btn--outline" onClick={() => openInfluencerDetail(a)}>查看达人详情</button>
                              {canAct ? (
                                <>
                                  <button type="button" className="xt-btn xt-btn--primary" onClick={() => void selectApplicant(a.id)} disabled={!!actionBusy[selectKey]}>
                                    {actionBusy[selectKey] ? "处理中…" : "选中"}
                                  </button>
                                  <button type="button" className="xt-btn xt-btn--danger" onClick={() => void rejectApplicant(a.id)} disabled={!!actionBusy[rejectKey]}>
                                    {actionBusy[rejectKey] ? "处理中…" : "驳回"}
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : null}

              {paymentInfo ? (
                <div style={{ marginTop: 14, padding: 12, border: "1px solid rgba(16,185,129,0.35)", borderRadius: 12, background: "rgba(16,185,129,0.08)" }}>
                  <div style={{ fontWeight: 800, color: "#065f46" }}>达人收款信息（请商家线下转账）</div>
                  <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "120px 1fr", rowGap: 6, columnGap: 10, fontSize: 13, lineHeight: 1.8 }}>
                    <div style={{ color: "#047857" }}>姓名</div><div>{paymentInfo.real_name || "-"}</div>
                    <div style={{ color: "#047857" }}>银行</div><div>{paymentInfo.bank_name || "-"}</div>
                    <div style={{ color: "#047857" }}>银行卡号</div><div>{paymentInfo.bank_card || "-"}</div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {detailOpen && activeInfluencer ? (
        <div className="xt-modal-mask" onClick={(e) => { if (e.target === e.currentTarget) setDetailOpen(false); }} style={{ zIndex: 1300 }}>
          <div className="xt-modal" style={{ width: "min(720px, 94vw)" }}>
            <div className="xt-modal-head">
              <h3 className="xt-modal-title">达人详情</h3>
              <button type="button" className="xt-close" onClick={() => setDetailOpen(false)}>×</button>
            </div>
            <div className="xt-modal-body">
              <div style={{ padding: 12, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", display: "grid", gap: 8 }}>
                <div><strong>TikTok账号：</strong>{safeText(activeInfluencer.tiktok_account) || "-"}</div>
                <div><strong>粉丝数量：</strong>{safeText(activeInfluencer.tiktok_fans) || "-"}</div>
                <div><strong>擅长领域：</strong>{influencerDomains}</div>
                <div><strong>自我介绍/个人优势：</strong>{safeText(activeInfluencer.influencer_bio) || "-"}</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
