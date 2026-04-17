import { useEffect, useState } from "react";
import { applyInfluencerMarketOrder, getInfluencerTaskHall } from "../matchingApi";

type TaskItem = {
  id: number;
  order_no: string | null;
  title: string | null;
  client_name: string;
  reward_points: number;
  created_at: string;
};

/**
 * 模式一任务大厅：达人无需审核可直接报名。
 */
export default function TaskHallPage() {
  const [list, setList] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 拉取可报名任务列表。
   */
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getInfluencerTaskHall();
      setList((data.list || []) as TaskItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  /**
   * 报名商家任务。
   */
  const apply = async (id: number) => {
    setError(null);
    try {
      await applyInfluencerMarketOrder(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "报名失败");
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>任务大厅</h2>
      <p style={{ color: "#64748b", fontSize: 14 }}>模式一：无需申请、无需审核，登录即可报名。</p>
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      <button type="button" onClick={() => void load()} style={{ marginBottom: 12 }}>刷新</button>
      {loading ? <p>加载中…</p> : null}
      {!loading && list.length === 0 ? <p>暂无可报名任务</p> : null}
      <div style={{ display: "grid", gap: 10 }}>
        {list.map((item) => (
          <div key={item.id} style={{ background: "#fff", borderRadius: 8, padding: 12, border: "1px solid #e2e8f0" }}>
            <div style={{ fontWeight: 600 }}>订单号：{item.order_no || `#${item.id}`}</div>
            <div>标题：{item.title || "未命名"}</div>
            <div>商家：{item.client_name}</div>
            <div>积分：{item.reward_points}</div>
            <button type="button" onClick={() => void apply(item.id)} style={{ marginTop: 8 }}>一键报名</button>
          </div>
        ))}
      </div>
    </div>
  );
}
