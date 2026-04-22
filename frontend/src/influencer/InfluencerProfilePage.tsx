import { useEffect, useMemo, useState } from "react";
import { getInfluencerProfile, saveInfluencerProfile, type InfluencerProfilePayload } from "../influencerApi";

const DOMAIN_OPTIONS = ["美妆", "服饰", "数码", "家居", "母婴", "食品", "运动", "教育", "旅行", "其他"];

/** 达人信息页：报名撮合任务前必须完善。 */
export default function InfluencerProfilePage() {
  const [form, setForm] = useState<InfluencerProfilePayload>({
    tiktok_account: "",
    tiktok_fans: "",
    expertise_domains: [],
    influencer_bio: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  /** 校验达人信息必填字段及格式。 */
  const validate = (): string | null => {
    const account = form.tiktok_account.trim();
    const fans = form.tiktok_fans.trim();
    const bio = form.influencer_bio.trim();

    if (!account) return "请填写 TikTok 账号";
    if (!/^@?[A-Za-z0-9._]{2,32}$/.test(account)) return "TikTok 账号格式不正确";
    if (!fans) return "请填写粉丝数量";
    if (!/^[0-9]+(\+|\s*-\s*[0-9]+)?$/.test(fans)) return "粉丝数量仅支持正整数或区间，如 10000 或 10000-20000";
    if (form.expertise_domains.length === 0) return "请至少选择一个擅长领域";
    if (!bio) return "请填写自我介绍/个人优势";
    return null;
  };

  /** 读取后端已保存达人信息。 */
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const ret = await getInfluencerProfile();
      const profile = ret?.profile;
      if (profile && typeof profile === "object") {
        setForm({
          tiktok_account: String(profile.tiktok_account || ""),
          tiktok_fans: String(profile.tiktok_fans || ""),
          expertise_domains: Array.isArray(profile.expertise_domains) ? profile.expertise_domains.map((x: unknown) => String(x || "")).filter(Boolean) : [],
          influencer_bio: String(profile.influencer_bio || ""),
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  /** 保存达人信息，供报名撮合任务前校验。 */
  const onSave = async () => {
    setError(null);
    setMsg("");
    const ve = validate();
    if (ve) {
      setError(ve);
      return;
    }
    setSaving(true);
    try {
      await saveInfluencerProfile({
        tiktok_account: form.tiktok_account.trim(),
        tiktok_fans: form.tiktok_fans.trim(),
        expertise_domains: form.expertise_domains,
        influencer_bio: form.influencer_bio.trim(),
      });
      setMsg("保存成功，已可报名任务");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const selectedDomains = useMemo(() => new Set(form.expertise_domains), [form.expertise_domains]);

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 10px 24px rgba(15,23,42,0.08)" }}>
      <h2 style={{ marginTop: 0 }}>达人信息</h2>
      <p style={{ color: "#64748b", marginTop: 4 }}>请先完善以下信息，系统才允许在任务大厅报名。</p>
      {loading ? <p>加载中...</p> : null}
      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
      {msg ? <p style={{ color: "#166534" }}>{msg}</p> : null}

      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        <label>
          TikTok账号 <span style={{ color: "#dc2626" }}>*</span>
          <input
            value={form.tiktok_account}
            onChange={(e) => setForm((prev) => ({ ...prev, tiktok_account: e.target.value }))}
            placeholder="如 @creator001"
            style={{ width: "100%", marginTop: 6 }}
          />
        </label>

        <label>
          粉丝数量 <span style={{ color: "#dc2626" }}>*</span>
          <input
            value={form.tiktok_fans}
            onChange={(e) => setForm((prev) => ({ ...prev, tiktok_fans: e.target.value }))}
            placeholder="支持 10000 或 10000-20000"
            style={{ width: "100%", marginTop: 6 }}
          />
        </label>

        <div>
          擅长领域 <span style={{ color: "#dc2626" }}>*</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {DOMAIN_OPTIONS.map((domain) => {
              const checked = selectedDomains.has(domain);
              return (
                <button
                  key={domain}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      expertise_domains: checked
                        ? prev.expertise_domains.filter((d) => d !== domain)
                        : [...prev.expertise_domains, domain],
                    }))
                  }
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: checked ? "1px solid #2563eb" : "1px solid #cbd5e1",
                    background: checked ? "#eff6ff" : "#fff",
                    color: checked ? "#1d4ed8" : "#334155",
                    cursor: "pointer",
                  }}
                >
                  {domain}
                </button>
              );
            })}
          </div>
        </div>

        <label>
          自我介绍/个人优势 <span style={{ color: "#dc2626" }}>*</span>
          <textarea
            rows={5}
            value={form.influencer_bio}
            onChange={(e) => setForm((prev) => ({ ...prev, influencer_bio: e.target.value }))}
            placeholder="例如：擅长剧情类短视频创作，能稳定周更..."
            style={{ width: "100%", marginTop: 6 }}
          />
        </label>
      </div>

      <div style={{ marginTop: 16 }}>
        <button type="button" onClick={() => void onSave()} disabled={saving} className="xt-accent-btn">
          {saving ? "保存中..." : "保存达人信息"}
        </button>
      </div>
    </div>
  );
}
