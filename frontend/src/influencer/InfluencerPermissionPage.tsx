import { useEffect, useState } from "react";
import { applyInfluencerPermission, getInfluencerPermissionStatus } from "../matchingApi";

type PermissionStatus = "unapplied" | "pending" | "approved" | "rejected" | "disabled";

/**
 * 模式二权限申请页：达人提交资料并查看审核状态。
 */
export default function InfluencerPermissionPage() {
  const [status, setStatus] = useState<PermissionStatus>("unapplied");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ tiktok_account: "", tiktok_fans: "", category: "", contact_info: "", bio: "" });

  /**
   * 拉取当前权限状态。
   */
  const load = async () => {
    setError(null);
    try {
      const data = await getInfluencerPermissionStatus();
      const s = String(data.status || "unapplied") as PermissionStatus;
      setStatus(s);
      if (data.profile) {
        setForm((f) => ({
          ...f,
          tiktok_account: String(data.profile.tiktok_account || ""),
          tiktok_fans: String(data.profile.tiktok_fans || ""),
          category: String(data.profile.category || ""),
          contact_info: String(data.profile.contact_info || ""),
        }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  /**
   * 提交权限申请。
   */
  const submit = async () => {
    setError(null);
    try {
      await applyInfluencerPermission(form);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败");
    }
  };

  /**
   * 渲染状态文案。
   */
  const renderStatus = (): string => {
    if (status === "pending") return "审核中，暂无法操作";
    if (status === "approved") return "已通过，可使用模式二";
    if (status === "rejected") return "审核未通过，可重新申请";
    if (status === "disabled") return "权限已禁用，请联系管理员";
    return "未申请";
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>达人撮合权限申请</h2>
      <p style={{ color: "#64748b" }}>当前状态：{renderStatus()}</p>
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
        <input value={form.tiktok_account} onChange={(e) => setForm((f) => ({ ...f, tiktok_account: e.target.value }))} placeholder="TikTok账号" />
        <input value={form.tiktok_fans} onChange={(e) => setForm((f) => ({ ...f, tiktok_fans: e.target.value }))} placeholder="粉丝数" />
        <input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="带货类目" />
        <input value={form.contact_info} onChange={(e) => setForm((f) => ({ ...f, contact_info: e.target.value }))} placeholder="Line联系方式" />
        <textarea value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} placeholder="个人简介" rows={4} />
      </div>
      <button type="button" onClick={() => void submit()} style={{ marginTop: 10 }}>提交申请</button>
    </div>
  );
}
