import { useState, useEffect } from "react";
import * as api from "../adminApi";

type Sub = {
  id: number;
  task_claim_id: number;
  work_link: string;
  note: string | null;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  influencer_username: string;
  material_title: string;
  point_reward: number;
  platform: string;
};

export default function SubmissionsPage() {
  const [list, setList] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("pending");
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSubmissions({ status: filterStatus || undefined });
      setList(data.list || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filterStatus]);

  const handleApprove = async (id: number) => {
    setError(null);
    try {
      await api.approveSubmission(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    }
  };

  const handleReject = async () => {
    if (rejectId == null) return;
    setError(null);
    try {
      await api.rejectSubmission(rejectId, rejectReason.trim() || undefined);
      setRejectId(null);
      setRejectReason("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>投稿审核</h2>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <div style={{ marginBottom: 16 }}>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: "6px 10px" }}>
          <option value="pending">待审核</option>
          <option value="approved">已通过</option>
          <option value="rejected">已驳回</option>
        </select>
      </div>
      {loading ? <p>加载中…</p> : (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden" }}>
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              <th style={{ padding: 10, textAlign: "left" }}>ID</th>
              <th style={{ padding: 10, textAlign: "left" }}>达人</th>
              <th style={{ padding: 10, textAlign: "left" }}>素材/任务</th>
              <th style={{ padding: 10, textAlign: "left" }}>作品链接</th>
              <th style={{ padding: 10, textAlign: "left" }}>提交时间</th>
              <th style={{ padding: 10, textAlign: "left" }}>状态</th>
              {filterStatus === "pending" && <th style={{ padding: 10 }}>操作</th>}
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id}>
                <td style={{ padding: 10 }}>{s.id}</td>
                <td style={{ padding: 10 }}>{s.influencer_username}</td>
                <td style={{ padding: 10 }}>{s.material_title} / {s.platform} ({s.point_reward} 积分)</td>
                <td style={{ padding: 10 }}><a href={s.work_link} target="_blank" rel="noreferrer">打开</a></td>
                <td style={{ padding: 10 }}>{s.submitted_at}</td>
                <td style={{ padding: 10 }}>{s.status === "pending" ? "待审核" : s.status === "approved" ? "已通过" : "已驳回"}</td>
                {filterStatus === "pending" && (
                  <td style={{ padding: 10 }}>
                    <button type="button" onClick={() => handleApprove(s.id)} style={{ marginRight: 8, padding: "4px 10px", background: "#34c759", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>通过</button>
                    <button type="button" onClick={() => setRejectId(s.id)} style={{ padding: "4px 10px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer" }}>驳回</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rejectId != null && (
        <div style={{ marginTop: 24, padding: 16, background: "#fff", borderRadius: 8 }}>
          <p>驳回原因（可选）</p>
          <input type="text" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="输入驳回原因" style={{ width: 300, padding: "8px 10px", marginRight: 8 }} />
          <button type="button" onClick={handleReject} style={{ padding: "8px 16px", background: "#ff3b30", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>确认驳回</button>
          <button type="button" onClick={() => { setRejectId(null); setRejectReason(""); }} style={{ marginLeft: 8, padding: "8px 16px", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer" }}>取消</button>
        </div>
      )}
      {!loading && list.length === 0 && <p style={{ color: "#666" }}>暂无投稿</p>}
    </div>
  );
}
