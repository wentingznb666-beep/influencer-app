import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import * as api from "./operationLogApi";

type Row = {
  id: number;
  action_type: "create" | "edit" | "delete" | string;
  target_type: "intent" | "order" | "task" | string;
  target_id: number;
  create_time: string;
};

type LogBucket = "all" | "task" | "withdraw" | "permission" | "system";

const FILTER_LABELS: Record<LogBucket, string> = {
  all: "全部",
  task: "任务操作",
  withdraw: "提现操作",
  permission: "权限申请",
  system: "系统操作",
};

/**
 * 将后端 target_type 映射到筛选分组（无对应值时归入任务操作）。
 */
function inferLogBucket(row: Row): Exclude<LogBucket, "all"> {
  const t = String(row.target_type || "").toLowerCase();
  if (t === "withdraw" || t === "withdrawal") return "withdraw";
  if (t === "permission" || t === "perm") return "permission";
  if (t === "system" || t === "sys") return "system";
  return "task";
}

/**
 * 我的操作日志：展示当前用户的 create/edit/delete 行为（按时间倒序）。
 */
export default function OperationLogsPage() {
  const location = useLocation();
  const isInfluencerShell = location.pathname.startsWith("/influencer");
  const [list, setList] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState<LogBucket>("all");

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .getMyOperationLogs(200)
      .then((data) => setList((data?.list || []) as Row[]))
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, []);

  const actionText: Record<string, string> = { create: "创建", edit: "编辑", delete: "删除" };
  const targetText: Record<string, string> = { intent: "合作意向", order: "达人领单", task: "任务" };

  const filteredList = useMemo(() => {
    if (!isInfluencerShell || logFilter === "all") return list;
    return list.filter((r) => inferLogBucket(r) === logFilter);
  }, [list, logFilter, isInfluencerShell]);

  return (
    <div className={isInfluencerShell ? "xt-oplogs--influencer" : undefined}>
      <h2 className={isInfluencerShell ? "xt-inf-page-title" : undefined} style={isInfluencerShell ? undefined : { marginTop: 0 }}>
        我的操作日志
      </h2>
      <p style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>
        记录您在系统中的新增、编辑、删除操作，按时间倒序展示。
      </p>
      {isInfluencerShell ? (
        <div className="xt-oplogs-filter">
          {(["all", "task", "withdraw", "permission", "system"] as const).map((k) => (
            <button key={k} type="button" className={logFilter === k ? "is-on" : undefined} onClick={() => setLogFilter(k)}>
              {FILTER_LABELS[k]}
            </button>
          ))}
        </div>
      ) : null}
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      {loading ? (
        <p>加载中…</p>
      ) : (
        <div style={{ overflowX: "auto", background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead>
              <tr style={{ background: "#f5f5f5" }}>
                <th style={{ padding: 10, textAlign: "left" }}>时间</th>
                <th style={{ padding: 10, textAlign: "left" }}>动作</th>
                <th style={{ padding: 10, textAlign: "left" }}>对象</th>
                <th style={{ padding: 10, textAlign: "left" }}>目标ID</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((r) => (
                <tr
                  key={r.id}
                  className={
                    isInfluencerShell
                      ? r.action_type === "delete"
                        ? "xt-oplogs-row--bad"
                        : r.action_type === "create"
                          ? "xt-oplogs-row--ok"
                          : undefined
                      : undefined
                  }
                >
                  <td style={{ padding: 10, borderBottom: "1px solid #f1f1f1", color: "#475569" }}>{r.create_time}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f1f1f1" }}>{actionText[r.action_type] ?? r.action_type}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f1f1f1" }}>{targetText[r.target_type] ?? r.target_type}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f1f1f1" }}>{r.target_id}</td>
                </tr>
              ))}
              {filteredList.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: 14, color: "var(--xt-text-muted)" }}>
                    暂无记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}