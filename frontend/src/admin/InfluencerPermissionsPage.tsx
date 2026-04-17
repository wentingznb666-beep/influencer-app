import { useEffect, useState } from "react";
import { getAdminInfluencerPermissions, reviewAdminInfluencerPermission, toggleAdminInfluencerPermission } from "../matchingApi";
import { formatInfluencerPermissionStatus } from "../utils/matchingStatusText";

/** 管理端达人撮合权限审核页。 */
export default function InfluencerPermissionsPage() {
  const [list, setList] = useState<any[]>([]);
  const [msg, setMsg] = useState<string>("");

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
    setMsg("");
    try {
      await reviewAdminInfluencerPermission(id, action);
      await load();
      setMsg(action === "approve" ? "已通过" : "已驳回");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "审核失败");
    }
  };

  /** 手动开启或禁用达人撮合权限。 */
  const toggle = async (id: number, enabled: boolean) => {
    setMsg("");
    try {
      await toggleAdminInfluencerPermission(id, enabled);
      await load();
      setMsg(enabled ? "已开启权限" : "已禁用权限");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "操作失败");
    }
  };

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 10px 24px rgba(15,23,42,0.08)" }}>
      <h2 style={{ marginTop: 0 }}>达人撮合权限审核</h2>
      {msg && <p>{msg}</p>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>达人</th><th>状态</th><th>TikTok账号</th><th>粉丝数</th><th>类目/简介</th><th>收款信息</th><th>操作</th>
          </tr>
        </thead>
        <tbody>
          {list.map((it) => (
            <tr key={it.id}>
              <td>{it.display_name || it.username}</td>
              <td>{formatInfluencerPermissionStatus(it.influencer_status)}</td>
              <td>{it.tiktok_account || "-"}</td>
              <td>{it.tiktok_fans || "-"}</td>
              <td>{it.category || "-"}</td>
              <td>{[it.real_name, it.bank_name, it.bank_branch].filter(Boolean).join(" / ") || "未填写"}</td>
              <td>
                <button type="button" onClick={() => void review(it.id, "approve")}>通过</button>
                <button type="button" onClick={() => void review(it.id, "reject")} style={{ marginLeft: 6 }}>驳回</button>
                <button type="button" onClick={() => void toggle(it.id, true)} style={{ marginLeft: 6 }}>开启</button>
                <button type="button" onClick={() => void toggle(it.id, false)} style={{ marginLeft: 6 }}>禁用</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
