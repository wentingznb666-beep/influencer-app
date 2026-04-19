import { useEffect, useState } from "react";
import { applyInfluencerPermission, getInfluencerPermissionStatus } from "../matchingApi";

type PermissionStatus = "unapplied" | "pending" | "approved" | "rejected" | "disabled";

/**
 * 撮合权限申请页：达人提交资料并查看审核状态。
 */
export default function InfluencerPermissionPage() {
  const [status, setStatus] = useState<PermissionStatus>("unapplied");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ tiktok_account: "", tiktok_fans: "", category: "", bio: "" });

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
    if (status === "approved") return "已通过，可使用";
    if (status === "rejected") return "审核未通过，可重新申请";
    if (status === "disabled") return "权限已禁用，请联系管理员";
    return "未申请";
  };

  return (
    <div>
      <h2 className="xt-inf-page-title">达人撮合权限申请</h2>
      <p className="xt-inf-lead">当前状态：{renderStatus()}</p>
      <ul className="xt-inf-card" style={{ margin: "0 0 16px", padding: "16px 16px 16px 28px", maxWidth: 560, lineHeight: 1.65 }}>
        <li>开通后可发布合作需求</li>
        <li>开通后可管理「我的需求」</li>
        <li>开通后可查看达人接单与报价</li>
      </ul>
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      <div className="xt-inf-card" style={{ display: "grid", gap: 10, maxWidth: 520, padding: 16 }}>
        <label style={{ fontWeight: 700 }}>TikTok 账号</label>
        <input value={form.tiktok_account} onChange={(e) => setForm((f) => ({ ...f, tiktok_account: e.target.value }))} placeholder="TikTok账号" style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--xt-border)" }} />
        <label style={{ fontWeight: 700 }}>粉丝数</label>
        <input value={form.tiktok_fans} onChange={(e) => setForm((f) => ({ ...f, tiktok_fans: e.target.value }))} placeholder="粉丝数" style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--xt-border)" }} />
        <label style={{ fontWeight: 700 }}>带货类目</label>
        <input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="带货类目" style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--xt-border)" }} />
        <label style={{ fontWeight: 700 }}>个人简介</label>
        <textarea value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} placeholder="个人简介" rows={4} style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--xt-border)" }} />
      </div>
      <button type="button" className="xt-accent-btn" onClick={() => void submit()} style={{ marginTop: 14 }}>
        提交申请
      </button>
    </div>
  );
}
