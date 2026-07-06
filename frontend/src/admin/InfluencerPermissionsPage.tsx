import { useTranslation } from 'react-i18next';
import { compactPx } from "../responsive";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { getAdminInfluencerPermissions, reviewAdminInfluencerPermission, toggleAdminInfluencerPermission } from "../matchingApi";
import { formatInfluencerPermissionStatus } from "../utils/matchingStatusText";

type InfluencerPermissionRow = {
  id: number;
  username?: string | null;
  display_name?: string | null;
  influencer_status?: string | null;
  tiktok_account?: string | null;
  tiktok_fans?: string | null;
  category?: string | null;
  real_name?: string | null;
  bank_name?: string | null;
  bank_branch?: string | null;
};

/** 管理端达人撮合权限审核页。 */
export default function InfluencerPermissionsPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const [list, setList] = useState<InfluencerPermissionRow[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [msg, setMsg] = useState<string>("");
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const filteredList = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return list;
    return list.filter((it) => {
      const name = (it.display_name || it.username || "").toLowerCase();
      const account = (it.tiktok_account || "").toLowerCase();
      const category = (it.category || "").toLowerCase();
      return name.includes(q) || account.includes(q) || category.includes(q);
    });
  }, [list, searchQ]);
  const [isMobile, setIsMobile] = useState(false);
  const focusIdRef = useRef<number>(0);
  const jumpedOnceRef = useRef(false);

  const setBusyKey = (key: string, value: boolean) => {
    setBusy((prev) => ({ ...prev, [key]: value }));
  };

  const renderPlaceholder = (text: string) => <span style={{ color: "#94a3b8" }}>{text}</span>;

  const renderValue = (value: unknown, placeholder = "-") => {
    if (value === null || value === undefined) return renderPlaceholder(placeholder);
    const v = String(value).trim();
    if (!v) return renderPlaceholder(placeholder);
    return v;
  };

  const renderTruncatedText = (value: unknown, lines: 1 | 2 = 1, placeholder = "-") => {
    const text = value === null || value === undefined ? "" : String(value).trim();
    if (!text) return renderPlaceholder(placeholder);
    return (
      <div className={lines === 1 ? "xt-perm-ellipsis-1" : "xt-perm-ellipsis-2"} title={text}>
        {text}
      </div>
    );
  };

  const statusTagStyle = (status: string | null | undefined) => {
    const v = String(status || "unapplied");
    if (v === "approved") return { background: "#ecfdf5", borderColor: "#10b981", color: "#047857" };
    if (v === "pending") return { background: "#fff7ed", borderColor: "#fb923c", color: "#9a3412" };
    if (v === "rejected") return { background: "#fef2f2", borderColor: "#ef4444", color: "#b91c1c" };
    if (v === "disabled") return { background: "#f1f5f9", borderColor: "#94a3b8", color: "#475569" };
    return { background: "#f1f5f9", borderColor: "#cbd5e1", color: "#64748b" };
  };

  const btnStyle = (variant: "success" | "danger" | "primary" | "default") => {
    if (variant === "success") return { background: "#16a34a", borderColor: "#16a34a", color: "#fff" };
    if (variant === "danger") return { background: "#ef4444", borderColor: "#ef4444", color: "#fff" };
    if (variant === "primary") return { background: "#2563eb", borderColor: "#2563eb", color: "#fff" };
    return { background: "#f8fafc", borderColor: "#e2e8f0", color: "#334155" };
  };

  /** 加载达人撮合权限列表。 */
  const load = async () => {
    const data = await getAdminInfluencerPermissions();
    setList(Array.isArray(data?.list) ? data.list : []);
  };

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    if (typeof mq.addEventListener === "function") mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    load().catch((e) => setMsg(e instanceof Error ? e.message : t("加载失败")));
    return () => {
      if (typeof mq.removeEventListener === "function") mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const id = Number(sp.get("id") || sp.get("permissionId") || 0);
    if (!Number.isFinite(id) || id < 1) return;
    focusIdRef.current = id;
    if (!jumpedOnceRef.current) jumpedOnceRef.current = true;
  }, [location.search]);

  useEffect(() => {
    const id = focusIdRef.current;
    if (!id) return;
    if (!Array.isArray(list) || list.length === 0) return;
    const el = document.querySelector<HTMLElement>(`[data-perm-id="${id}"]`);
    if (!el) return;
    focusIdRef.current = 0;
    window.setTimeout(() => el.scrollIntoView({ block: "center" }), 0);
  }, [list, isMobile]);

  /** 审核通过或驳回达人权限申请。 */
  const review = async (id: number, action: "approve" | "reject") => {
    const k = `review:${id}:${action}`;
    if (busy[k]) return;
    setBusyKey(k, true);
    setMsg("");
    try {
      await reviewAdminInfluencerPermission(id, action);
      await load();
      setMsg(action === "approve" ? t("已通过") : t("已驳回"));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t("审核失败"));
    } finally {
      setBusyKey(k, false);
    }
  };

  /** 手动开启或禁用达人撮合权限。 */
  const toggle = async (id: number, enabled: boolean) => {
    const k = `toggle:${id}:${enabled ? "on" : "off"}`;
    if (busy[k]) return;
    setBusyKey(k, true);
    setMsg("");
    try {
      await toggleAdminInfluencerPermission(id, enabled);
      await load();
      setMsg(enabled ? t("已开启权限") : t("已禁用权限"));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t("操作失败"));
    } finally {
      setBusyKey(k, false);
    }
  };

  return (
    <div style={{ background: "#fff", borderRadius: compactPx(16), padding: isMobile ? 12 : 20, boxShadow: "0 10px 24px rgba(15,23,42,0.08)" }}>
      <h2 style={{ marginTop: 0 }}>达人撮合权限审核</h2>
      <input
        type="text"
        placeholder="搜索 Creator 用户名…"
        value={searchQ}
        onChange={(e) => setSearchQ(e.target.value)}
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid var(--xt-border)",
          width: "100%",
          maxWidth: 320,
          marginBottom: 12,
          fontSize: 13,
        }}
      />
      {msg && <p style={{ margin: "8px 0 12px", color: "#334155" }}>{msg}</p>}

      <style>{`
        .xt-perm-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          table-layout: fixed;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          overflow: hidden;
        }
        .xt-perm-table thead th {
          text-align: left;
          font-weight: 700;
          font-size: 13px;
          color: #0f172a;
          background: rgba(15, 23, 42, 0.04);
          padding: compactPx(10)px 12px;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
          min-width: 0;
        }
        .xt-perm-table tbody td {
          padding: compactPx(10)px 12px;
          border-bottom: 1px solid #cbd5e1;
          vertical-align: top;
          color: #0f172a;
          font-size: 13px;
          min-width: 0;
          overflow: hidden;
        }
        .xt-perm-table tbody tr:nth-child(odd) td {
          background: #fcfcfd;
        }
        .xt-perm-table tbody tr:hover td {
          background: #f8fafc;
        }
        .xt-perm-actions {
          display: flex;
          gap: compactPx(6)px;
          flex-wrap: wrap;
        }
        .xt-perm-actions > * {
          flex: 0 0 auto;
        }
        .xt-perm-btn {
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #334155;
          height: 30px;
          padding: 0 10px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: transform .05s ease, filter .15s ease;
          user-select: none;
        }
        .xt-perm-btn:disabled {
          opacity: .6;
          cursor: not-allowed;
        }
        .xt-perm-btn:not(:disabled):hover {
          filter: brightness(0.98);
        }
        .xt-perm-btn:not(:disabled):active {
          transform: translateY(1px);
        }
        .xt-perm-tag {
          display: inline-flex;
          align-items: center;
          height: 22px;
          padding: 0 8px;
          border-radius: 999px;
          border: 1px solid transparent;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }
        .xt-perm-ellipsis-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          overflow-wrap: anywhere;
          word-break: break-word;
          line-height: 1.35;
        }
        .xt-perm-ellipsis-1 {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
        }
        .xt-perm-cards {
          display: grid;
          gap: compactPx(10)px;
        }
        .xt-perm-card {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: compactPx(12)px;
          background: #fff;
        }
        .xt-perm-card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: compactPx(10)px;
          margin-bottom: 8px;
        }
        .xt-perm-card-title {
          font-weight: 800;
          color: #0f172a;
          font-size: 14px;
          line-height: 1.2;
        }
        .xt-perm-card-rows {
          display: grid;
          gap: compactPx(6)px;
        }
        .xt-perm-card-row {
          display: grid;
          grid-template-columns: 84px 1fr;
          gap: compactPx(8)px;
          align-items: start;
          font-size: 13px;
        }
        .xt-perm-card-label {
          color: #64748b;
          white-space: nowrap;
        }
        .xt-perm-card-value {
          color: #0f172a;
          min-width: 0;
        }
        .xt-perm-card-actions {
          margin-top: 10px;
        }
        .xt-perm-card-actions .xt-perm-actions {
          gap: compactPx(8)px;
        }
        .xt-perm-card-actions .xt-perm-btn {
          flex: 1 1 auto;
          min-width: 0;
        }
        @media (max-width: 480px) {
          .xt-perm-card {
            padding: compactPx(10)px;
          }
          .xt-perm-card-row {
            grid-template-columns: 72px 1fr;
          }
          .xt-perm-card-actions .xt-perm-btn {
            flex-basis: calc(50% - 4px);
          }
        }
      `}</style>

      {isMobile ? (
        <div className="xt-perm-cards">
          {filteredList.map((it) => {
            const name = it.display_name || it.username;
            const bankText = [it.real_name, it.bank_name, it.bank_branch].filter(Boolean).join(" / ");
            const tiktokAccount = it.tiktok_account ?? "";
            const category = it.category ?? "";
            return (
              <div key={it.id} className="xt-perm-card" data-perm-id={it.id}>
                <div className="xt-perm-card-top">
                  <div style={{ minWidth: 0 }}>
                    <div className="xt-perm-card-title">{renderTruncatedText(name)}</div>
                  </div>
                  <span className="xt-perm-tag" style={statusTagStyle(it.influencer_status)}>
                    {formatInfluencerPermissionStatus(it.influencer_status)}
                  </span>
                </div>

                <div className="xt-perm-card-rows">
                  <div className="xt-perm-card-row">
                    <div className="xt-perm-card-label">TikTok账号</div>
                    <div className="xt-perm-card-value">{renderTruncatedText(tiktokAccount)}</div>
                  </div>
                  <div className="xt-perm-card-row">
                    <div className="xt-perm-card-label">粉丝数</div>
                    <div className="xt-perm-card-value">{renderValue(it.tiktok_fans)}</div>
                  </div>
                  <div className="xt-perm-card-row">
                    <div className="xt-perm-card-label">类目/简介</div>
                    <div className="xt-perm-card-value">{renderTruncatedText(category, 2)}</div>
                  </div>
                  <div className="xt-perm-card-row">
                    <div className="xt-perm-card-label">收款信息</div>
                    <div className="xt-perm-card-value">{renderTruncatedText(bankText, 2, "未填写")}</div>
                  </div>
                </div>

                <div className="xt-perm-card-actions">
                  <div className="xt-perm-actions">
                    <button
                      type="button"
                      className="xt-perm-btn"
                      style={btnStyle("success")}
                      title="通过该达人的撮合权限申请"
                      disabled={Boolean(busy[`review:${it.id}:approve`])}
                      onClick={() => void review(it.id, "approve")}
                    >
                      {busy[`review:${it.id}:approve`] ? t("通过中…") : "通过"}
                    </button>
                    <button
                      type="button"
                      className="xt-perm-btn"
                      style={btnStyle("danger")}
                      title="驳回该达人的撮合权限申请"
                      disabled={Boolean(busy[`review:${it.id}:reject`])}
                      onClick={() => void review(it.id, "reject")}
                    >
                      {busy[`review:${it.id}:reject`] ? t("驳回中…") : "驳回"}
                    </button>
                    <button
                      type="button"
                      className="xt-perm-btn"
                      style={btnStyle("primary")}
                      title="开启该达人的撮合权限"
                      disabled={Boolean(busy[`toggle:${it.id}:on`])}
                      onClick={() => void toggle(it.id, true)}
                    >
                      {busy[`toggle:${it.id}:on`] ? t("开启中…") : "开启"}
                    </button>
                    <button
                      type="button"
                      className="xt-perm-btn"
                      style={btnStyle("default")}
                      title="禁用该达人的撮合权限"
                      disabled={Boolean(busy[`toggle:${it.id}:off`])}
                      onClick={() => void toggle(it.id, false)}
                    >
                      {busy[`toggle:${it.id}:off`] ? t("禁用中…") : "禁用"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <table className="xt-perm-table">
          <colgroup>
            <col style={{ width: "15%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "14%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>达人</th><th>状态</th><th>TikTok账号</th><th>粉丝数</th><th>类目/简介</th><th>收款信息</th><th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredList.map((it) => {
              const name = it.display_name || it.username;
              const bankText = [it.real_name, it.bank_name, it.bank_branch].filter(Boolean).join(" / ");
              const tiktokAccount = it.tiktok_account ?? "";
              const category = it.category ?? "";
              return (
                <tr key={it.id} data-perm-id={it.id}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {renderTruncatedText(name)}
                  </td>
                  <td>
                    <span className="xt-perm-tag" style={statusTagStyle(it.influencer_status)}>
                      {formatInfluencerPermissionStatus(it.influencer_status)}
                    </span>
                  </td>
                  <td style={{ textAlign: "left" }}>{renderTruncatedText(tiktokAccount)}</td>
                  <td>{renderValue(it.tiktok_fans)}</td>
                  <td>{renderTruncatedText(category, 2)}</td>
                  <td style={{ textAlign: "left" }}>{renderTruncatedText(bankText, 2, "未填写")}</td>
                  <td>
                    <div className="xt-perm-actions">
                      <button
                        type="button"
                        className="xt-perm-btn"
                        style={btnStyle("success")}
                        title="通过该达人的撮合权限申请"
                        disabled={Boolean(busy[`review:${it.id}:approve`])}
                        onClick={() => void review(it.id, "approve")}
                      >
                        {busy[`review:${it.id}:approve`] ? t("通过中…") : "通过"}
                      </button>
                      <button
                        type="button"
                        className="xt-perm-btn"
                        style={btnStyle("danger")}
                        title="驳回该达人的撮合权限申请"
                        disabled={Boolean(busy[`review:${it.id}:reject`])}
                        onClick={() => void review(it.id, "reject")}
                      >
                        {busy[`review:${it.id}:reject`] ? t("驳回中…") : "驳回"}
                      </button>
                      <button
                        type="button"
                        className="xt-perm-btn"
                        style={btnStyle("primary")}
                        title="开启该达人的撮合权限"
                        disabled={Boolean(busy[`toggle:${it.id}:on`])}
                        onClick={() => void toggle(it.id, true)}
                      >
                        {busy[`toggle:${it.id}:on`] ? t("开启中…") : "开启"}
                      </button>
                      <button
                        type="button"
                        className="xt-perm-btn"
                        style={btnStyle("default")}
                        title="禁用该达人的撮合权限"
                        disabled={Boolean(busy[`toggle:${it.id}:off`])}
                        onClick={() => void toggle(it.id, false)}
                      >
                        {busy[`toggle:${it.id}:off`] ? t("禁用中…") : "禁用"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
