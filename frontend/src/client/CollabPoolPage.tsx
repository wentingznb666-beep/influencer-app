import { useEffect, useState } from "react";
import { applyClientCollabPool, consultClientCollabPool, getClientCollabPool } from "../matchingApi";
import { formatDemandApplyStatus, formatDemandStatus } from "../utils/matchingStatusText";

/** 解析达人需求详情 JSON。 */
function parseDetail(raw: string | undefined): Record<string, any> {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

/** 商家端达人需求广场：查看、咨询、发起合作。 */
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

  /** 商家发起合作报名。 */
  const apply = async (id: number) => {
    setMsg("");
    try {
      await applyClientCollabPool(id);
      setMsg("发起合作成功");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "操作失败");
    }
  };

  /** 商家咨询达人需求。 */
  const consult = async (id: number) => {
    const note = window.prompt("请输入咨询内容");
    if (!note || !note.trim()) return;
    setMsg("");
    try {
      await consultClientCollabPool(id, note.trim());
      setMsg("咨询已发送");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "咨询失败");
    }
  };

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 10px 24px rgba(15,23,42,0.08)" }}>
      <h2 style={{ marginTop: 0 }}>达人合作需求广场</h2>
      {msg && <p>{msg}</p>}
      {loading ? <p>加载中…</p> : null}
      {!loading && list.length === 0 ? <p>暂无开放需求</p> : null}
      <ul>
        {list.map((it) => {
          const detail = parseDetail(it.demand_detail);
          return (
            <li key={it.id} style={{ marginBottom: 12 }}>
              <div>需求#{it.id}｜擅长领域：{it.title || "-"}｜达人：{it.influencer_name || it.influencer_username}</div>
              <div>粉丝量级：{detail.fans_level || "-"}｜可接任务类型：{Array.isArray(detail.task_types) ? detail.task_types.join("/") : "-"}</div>
              <div>可接品类：{detail.categories_can_do || "-"}｜不接品类：{detail.categories_not_do || "-"}</div>
              <div>是否需要样品：{detail.need_sample || "-"}｜单条报价：{it.expected_points ?? "-"}｜出稿时效：{detail.delivery_days || "-"}天</div>
              <div>状态：{formatDemandStatus(it.status)}｜我的报名：{formatDemandApplyStatus(it.my_apply_status)}</div>
              <button type="button" onClick={() => void consult(it.id)} style={{ marginTop: 6 }}>咨询</button>
              <button type="button" disabled={it.my_apply_status === "pending" || it.my_apply_status === "selected"} onClick={() => void apply(it.id)} style={{ marginLeft: 8 }}>
                {it.my_apply_status === "pending" || it.my_apply_status === "selected" ? "已发起合作" : "发起合作"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
