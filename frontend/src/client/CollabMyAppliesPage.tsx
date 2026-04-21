import { useEffect, useState } from "react";
import { getClientCollabMyApplies } from "../matchingApi";
import { formatDemandApplyStatus, formatDemandStatus } from "../utils/matchingStatusText";

type MyApplyItem = {
  id: number;
  status: string;
  note?: string;
  created_at?: string;
  updated_at?: string;
  demand_id: number;
  title?: string;
  demand_status?: string;
  expected_points?: number | string;
  influencer_username?: string;
  influencer_name?: string;
  merchant_shop_name?: string;
  merchant_product_type?: string;
  merchant_sales_summary?: string;
  merchant_shop_link?: string;
};

/** 商家端：查看自己在模式二的报名记录与状态。 */
export default function CollabMyAppliesPage() {
  const [list, setList] = useState<MyApplyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  /** 拉取商家报名历史。 */
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getClientCollabMyApplies();
      setList(Array.isArray(data?.list) ? (data.list as MyApplyItem[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 10px 24px rgba(15,23,42,0.08)" }}>
      <h2 style={{ marginTop: 0 }}>我的需求报名</h2>
      <p style={{ color: "#64748b", marginTop: 0 }}>查看我报名过的达人需求及最新状态。</p>
      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
      {loading ? <p>加载中…</p> : null}
      {!loading && list.length === 0 ? <p>暂无报名记录</p> : null}
      {!loading && list.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {list.map((it) => (
            <li key={it.id} style={{ marginBottom: 10 }}>
              需求#{it.demand_id}｜{it.title || "未命名"}｜达人：{it.influencer_name || it.influencer_username || "-"}｜
              报名状态：{formatDemandApplyStatus(it.status)}｜需求状态：{formatDemandStatus(it.demand_status)}
              {it.note ? `｜备注：${it.note}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
