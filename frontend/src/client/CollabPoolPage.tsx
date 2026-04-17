import { useEffect, useState } from "react";
import { applyClientCollabPool, getClientCollabPool } from "../matchingApi";
import { formatDemandApplyStatus, formatDemandStatus } from "../utils/matchingStatusText";

/** 商家端达人需求广场：报名达人模式二需求。 */
export default function CollabPoolPage() {
  const [list, setList] = useState<any[]>([]);
  const [msg, setMsg] = useState<string>("");
  const [loading, setLoading] = useState(false);

  /** 加载开放中的达人需求。 */
  const load = async () => {
    setLoading(true);
    try {
      const data = await getClientCollabPool();
      setList(Array.isArray(data?.list) ? data.list : []);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  /** 商家报名达人需求。 */
  const apply = async (id: number) => {
    setMsg("");
    try {
      await applyClientCollabPool(id);
      setMsg("报名成功");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "报名失败");
    }
  };

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 10px 24px rgba(15,23,42,0.08)" }}>
      <h2 style={{ marginTop: 0 }}>达人合作需求广场</h2>
            {msg && <p>{msg}</p>}
      {loading ? <p>加载中…</p> : null}
      {!loading && list.length === 0 ? <p>暂无开放需求</p> : null}
      <ul>
        {list.map((it) => (
          <li key={it.id} style={{ marginBottom: 10 }}>
            需求#{it.id}｜{it.title || "未命名"}｜达人：{it.influencer_name || it.influencer_username}｜需求状态：{formatDemandStatus(it.status)}｜我的报名：{formatDemandApplyStatus(it.my_apply_status)}
            <button type="button" disabled={it.my_apply_status === "pending" || it.my_apply_status === "selected"} onClick={() => void apply(it.id)} style={{ marginLeft: 8 }}>
              {it.my_apply_status === "pending" || it.my_apply_status === "selected" ? "已报名" : "一键报名"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

