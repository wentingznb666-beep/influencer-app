import { compactPx } from "../responsive";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getInfluencerProfile, saveInfluencerProfile, type InfluencerProfilePayload } from "../influencerApi";

const DOMAIN_OPTIONS = ["美妆", "服饰", "数码", "家居", "母婴", "食品", "运动", "教育", "旅行", "其他"];
const PROFILE_SAVED_KEY = "app:influencerProfileSaved";

/** 达人信息页：报名撮合任务前必须完善。 */
export default function InfluencerProfilePage() {
  const { t } = useTranslation();
  const [form, setForm] = useState<InfluencerProfilePayload>({
    tiktok_account: "",
    tiktok_fans: "",
    expertise_domains: [],
    influencer_bio: "",
    line_contact: "",
    specialties: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [saved, setSaved] = useState<boolean>(() => {
    try {
      return localStorage.getItem(PROFILE_SAVED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [editing, setEditing] = useState<boolean>(true);

  /** 校验达人信息必填字段及格式。 */
  const validate = (): string | null => {
    const account = form.tiktok_account.trim();
    const fans = form.tiktok_fans.trim();
    const bio = form.influencer_bio.trim();
    const line = form.line_contact.trim();

    if (!account) return t("请填写 TikTok 账号");
    if (!/^@?[A-Za-z0-9._]{2,32}$/.test(account)) return t("TikTok 账号格式不正确");
    if (!fans) return t("请填写粉丝数量");
    if (!/^[0-9]+(\+|\s*-\s*[0-9]+)?$/.test(fans)) return t("粉丝数量仅支持正整数或区间，如 10000 或 10000-20000");
    if (form.expertise_domains.length === 0) return t("请至少选择一个擅长领域");
    if (!bio) return t("请填写自我介绍/个人优势");
    if (!line) return t("请填写 Line 联系方式");
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
          line_contact: String((profile as { line_contact?: unknown }).line_contact || ""),
          specialties: String((profile as { specialties?: unknown }).specialties || ""),
        });
        const completed = Boolean(profile.completed);
        setSaved(completed || saved);
        setEditing(!(completed || saved));
        if (completed) {
          try {
            localStorage.setItem(PROFILE_SAVED_KEY, "1");
          } catch {
            // ignore
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("加载失败"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  /** 进入可编辑态，允许再次修改并提交。 */
  const onEdit = () => {
    setEditing(true);
    setSaved(false);
    setMsg("");
    setError(null);
  };

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
        line_contact: form.line_contact.trim(),
        specialties: form.specialties.trim(),
      });
      setSaved(true);
      setEditing(false);
      setMsg(t("保存成功"));
      try {
        localStorage.setItem(PROFILE_SAVED_KEY, "1");
      } catch {
        // ignore
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("保存失败"));
    } finally {
      setSaving(false);
    }
  };

  const selectedDomains = useMemo(() => new Set(form.expertise_domains), [form.expertise_domains]);

  return (
    <div style={{ background: "#fff", borderRadius: compactPx(16), padding: compactPx(20), boxShadow: "0 10px 24px rgba(15,23,42,0.08)" }}>
      <h2 style={{ marginTop: 0 }}>{t("达人信息")}</h2>
      <p style={{ color: "#64748b", marginTop: compactPx(4) }}>{t("请先完善以下信息，系统才允许在任务大厅报名。")}</p>
      {loading ? <p>{t("加载中…")}</p> : null}
      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
      {msg ? <p style={{ color: "#166534" }}>{msg}</p> : null}

      <div style={{ display: "grid", gap: compactPx(12), marginTop: compactPx(12) }}>
        <label>
          {t("TikTok 账号")} <span style={{ color: "#dc2626" }}>*</span>
          <input
            value={form.tiktok_account}
            disabled={!editing}
            onChange={(e) => setForm((prev) => ({ ...prev, tiktok_account: e.target.value }))}
            placeholder={t("如 @creator001")}
            style={{ width: "100%", marginTop: compactPx(6) }}
          />
        </label>

        <label>
          {t("粉丝数量")} <span style={{ color: "#dc2626" }}>*</span>
          <input
            value={form.tiktok_fans}
            disabled={!editing}
            onChange={(e) => setForm((prev) => ({ ...prev, tiktok_fans: e.target.value }))}
            placeholder={t("支持 10000 或 10000-20000")}
            style={{ width: "100%", marginTop: compactPx(6) }}
          />
        </label>

        <div>
          {t("擅长领域")} <span style={{ color: "#dc2626" }}>*</span>
          <div style={{ display: "flex", gap: compactPx(8), flexWrap: "wrap", marginTop: compactPx(8) }}>
            {DOMAIN_OPTIONS.map((domain) => {
              const checked = selectedDomains.has(domain);
              return (
                <button
                  key={domain}
                  type="button"
                  disabled={!editing}
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
                    borderRadius: compactPx(999),
                    border: checked ? "1px solid #2563eb" : "1px solid #cbd5e1",
                    background: checked ? "#eff6ff" : "#fff",
                    color: checked ? "#1d4ed8" : "#334155",
                    cursor: editing ? "pointer" : "not-allowed",
                    opacity: editing ? 1 : 0.75,
                  }}
                >
                  {t(domain)}
                </button>
              );
            })}
          </div>
        </div>

        <label>
          {t("自我介绍/个人优势")} <span style={{ color: "#dc2626" }}>*</span>
          <textarea
            rows={5}
            disabled={!editing}
            value={form.influencer_bio}
            onChange={(e) => setForm((prev) => ({ ...prev, influencer_bio: e.target.value }))}
            placeholder={t("例如：擅长剧情类短视频创作，能稳定周更…")}
            style={{ width: "100%", marginTop: compactPx(6) }}
          />
        </label>

        <label>
          {t("专长/人设标签")} <span style={{ color: "#888" }}>{t("（选填）")}</span>
          <textarea
            rows={3}
            disabled={!editing}
            value={form.specialties}
            onChange={(e) => setForm((prev) => ({ ...prev, specialties: e.target.value }))}
            placeholder={t("例如：搞笑剧情、情感共鸣型、强带货型、英文口语流利、可双语直播、母婴赛道专家…")}
            style={{ width: "100%", marginTop: compactPx(6) }}
          />
          <div style={{ fontSize: compactPx(11), color: "#94a3b8", marginTop: compactPx(4) }}>
            {t("自由记录达人专长、人设定位及其他重要信息，帮助运营团队精准匹配商单。")}
          </div>
        </label>

        <label>
          {t("Line 联系方式")} <span style={{ color: "#dc2626" }}>*</span>
          <input
            value={form.line_contact}
            disabled={!editing}
            onChange={(e) => setForm((prev) => ({ ...prev, line_contact: e.target.value }))}
            placeholder={t("如 line_id 或手机号（仅管理员/员工可见）")}
            style={{ width: "100%", marginTop: compactPx(6) }}
          />
        </label>
      </div>

      <div style={{ marginTop: compactPx(16), display: "flex", gap: compactPx(8), flexWrap: "wrap" }}>
        <button type="button" onClick={() => void onSave()} disabled={saving || (saved && !editing)} className="xt-accent-btn">
          {saving ? t("保存中…") : saved && !editing ? t("保存成功") : t("保存达人信息")}
        </button>
        <button type="button" onClick={onEdit} className="xt-outline-btn">
          {t("编辑")}
        </button>
      </div>
    </div>
  );
}
