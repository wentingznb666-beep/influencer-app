import { useEffect, useState } from "react";
import { getAdminInfluencerPermissions, reviewAdminInfluencerPermission, toggleAdminInfluencerPermission } from "../matchingApi";
import { formatInfluencerPermissionStatus } from "../utils/matchingStatusText";

/** 管理端达人撮合权限审核页。 */
export default function InfluencerPermissionsPage() {
  const [list, setList] = useState<any[]>([]);
  const [msg, setMsg] = useState<string>("");
  const [busy, setBusy] = useState<Record<string, boolean>>({});

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
    load().catch((e) => setMsg(e instanceof Error ? e.message : "加载失败"));
  }, []);

  /** 审核通过或驳回达人权限申请。 */
  const review = async (id: number, action: "approve" | "reject") => {
    const k = `review:${id}:${action}`;
    if (busy[k]) return;
    setBusyKey(k, true);
    setMsg("");
    try {
      await reviewAdminInfluencerPermission(id, action);
      await load();
      setMsg(action === "approve" ? "已通过" : "已驳回");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "审核失败");
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
      setMsg(enabled ? "已开启权限" : "已禁用权限");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusyKey(k, false);
    }
  };

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 10px 24px rgba(15,23,42,0.08)" }}>
      <h2 style={{ marginTop: 0 }}>达人撮合权限审核</h2>
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
          padding: 10px 12px;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }
        .xt-perm-table tbody td {
          padding: 10px 12px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: top;
          color: #0f172a;
          font-size: 13px;
        }
        .xt-perm-table tbody tr:nth-child(odd) td {
          background: #fcfcfd;
        }
        .xt-perm-table tbody tr:hover td {
          background: #f8fafc;
        }
        .xt-perm-actions {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
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
          word-break: break-word;
          line-height: 1.35;
        }
      `}</style>

      <table className="xt-perm-table">
        <colgroup>
          <col style={{ width: 140 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 160 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 360 }} />
          <col style={{ width: 240 }} />
          <col style={{ width: 240 }} />
        </colgroup>
        <thead>
          <tr>
            <th>达人</th><th>状态</th><th>TikTok账号</th><th>粉丝数</th><th>类目/简介</th><th>收款信息</th><th>操作</th>
          </tr>
        </thead>
        <tbody>
          {list.map((it) => (
            <tr key={it.id}>
              <td style={{ whiteSpace: "nowrap" }}>{renderValue(it.display_name || it.username)}</td>
              <td>
                <span className="xt-perm-tag" style={statusTagStyle(it.influencer_status)}>
                  {formatInfluencerPermissionStatus(it.influencer_status)}
                </span>
              </td>
              <td style={{ textAlign: "left" }}>{renderValue(it.tiktok_account)}</td>
              <td>{renderValue(it.tiktok_fans)}</td>
              <td title={String(it.category || "")}>
                <div className="xt-perm-ellipsis-2">{renderValue(it.category)}</div>
              </td>
              <td style={{ textAlign: "left" }}>
                {(() => {
                  const text = [it.real_name, it.bank_name, it.bank_branch].filter(Boolean).join(" / ");
                  return text ? text : renderPlaceholder("未填写");
                })()}
              </td>
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
                    {busy[`review:${it.id}:approve`] ? "通过中…" : "通过"}
                  </button>
                  <button
                    type="button"
                    className="xt-perm-btn"
                    style={btnStyle("danger")}
                    title="驳回该达人的撮合权限申请"
                    disabled={Boolean(busy[`review:${it.id}:reject`])}
                    onClick={() => void review(it.id, "reject")}
                  >
                    {busy[`review:${it.id}:reject`] ? "驳回中…" : "驳回"}
                  </button>
                  <button
                    type="button"
                    className="xt-perm-btn"
                    style={btnStyle("primary")}
                    title="开启该达人的撮合权限"
                    disabled={Boolean(busy[`toggle:${it.id}:on`])}
                    onClick={() => void toggle(it.id, true)}
                  >
                    {busy[`toggle:${it.id}:on`] ? "开启中…" : "开启"}
                  </button>
                  <button
                    type="button"
                    className="xt-perm-btn"
                    style={btnStyle("default")}
                    title="禁用该达人的撮合权限"
                    disabled={Boolean(busy[`toggle:${it.id}:off`])}
                    onClick={() => void toggle(it.id, false)}
                  >
                    {busy[`toggle:${it.id}:off`] ? "禁用中…" : "禁用"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
