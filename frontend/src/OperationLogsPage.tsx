import { useEffect, useState } from "react";
import * as api from "./operationLogApi";

type Row = {
  id: number;
  action_type: "create" | "edit" | "delete" | string;
  target_type: "intent" | "order" | "task" | string;
  target_id: number;
  create_time: string;
};

/**
 * 我的操作日志：展示当前用户的 create/edit/delete 行为（按时间倒序）。
 */
export default function OperationLogsPage() {
  const [list, setList] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>我的操作日志</h2>
      <p style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>
        记录您在系统中的新增、编辑、删除操作，按时间倒序展示。
      </p>
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
              {list.map((r) => (
                <tr key={r.id}>
                  <td style={{ padding: 10, borderBottom: "1px solid #f1f1f1", color: "#475569" }}>{r.create_time}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f1f1f1" }}>{actionText[r.action_type] ?? r.action_type}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f1f1f1" }}>{targetText[r.target_type] ?? r.target_type}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f1f1f1" }}>{r.target_id}</td>
                </tr>
              ))}
              {list.length === 0 && (
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

