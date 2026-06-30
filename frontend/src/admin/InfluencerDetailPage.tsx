import { compactPx } from "../responsive";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import * as api from "../adminApi";

type InfluencerDetail = {
  id: number;
  username: string;
  display_name: string | null;
  disabled: number;
  influencer_status: string;
  created_at: string;
  updated_at: string;
  tiktok_account: string | null;
  tiktok_fans: string | null;
  expertise_domains: string[];
  influencer_bio: string | null;
  line_contact: string | null;
  real_name: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  bank_card: string | null;
  show_face: number;
  tags: string | null;
  platforms: string | null;
  blacklisted: number;
  level: number;
};

function formatLevel(level: number | string): string {
  const n = typeof level === "number" ? level : Number(level);
  if (n === 1) return "A";
  if (n === 2) return "A+";
  if (n === 3) return "B";
  if (n === 4) return "B+";
  if (n === 5) return "C";
  if (n === 6) return "C+";
  return String(level ?? "—");
}

export default function InfluencerDetailPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const location = useLocation();
  const params = useParams();
  const userId = Number(params.id || 0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<InfluencerDetail | null>(null);

  const basePath = useMemo(() => {
    const p = String(location.pathname || "");
    if (p.startsWith("/employee/")) return "/employee";
    return "/admin";
  }, [location.pathname]);

  useEffect(() => {
    if (!Number.isInteger(userId) || userId < 1) {
      setError(t("无效的达人ID"));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    (async () => {
      const ret = await api.getInfluencerDetail(userId);
      const p = ret?.profile as InfluencerDetail | null;
      setProfile(p);
    })()
      .catch((e) => setError(e instanceof Error ? e.message : t("加载失败")))
      .finally(() => setLoading(false));
  }, [userId]);

  const row = (label: string, value: React.ReactNode) => (
    <>
      <div style={{ color: "#64748b" }}>{label}</div>
      <div style={{ color: "#0f172a", wordBreak: "break-word", overflowWrap: "anywhere" }}>{value}</div>
    </>
  );

  return (
    <div style={{ background: "#fff", borderRadius: compactPx(16), padding: compactPx(20), boxShadow: "0 10px 24px rgba(15,23,42,0.08)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: compactPx(12), flexWrap: "wrap" }}>
        <div>
          <h2 style={{ marginTop: 0, marginBottom: compactPx(4) }}>{t("达人详情")}</h2>
          <div style={{ color: "#64748b", fontSize: compactPx(13) }}>
            {profile?.username ? <span data-no-auto-translate>{profile.username}</span> : "-"}
          </div>
        </div>
        <button type="button" className="xt-outline-btn" onClick={() => nav(`${basePath}/influencers`)}>
          {t("返回")}
        </button>
      </div>

      {loading ? <p style={{ color: "#64748b" }}>{t("加载中...")}</p> : null}
      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}

      {profile ? (
        <div style={{ marginTop: compactPx(14), display: "grid", gap: compactPx(12) }}>
          <div style={{ padding: compactPx(14), borderRadius: compactPx(14), border: "1px solid rgba(148,163,184,0.35)", background: "#fff" }}>
            <div style={{ fontWeight: 900, color: "var(--xt-primary)" }}>{t("基础信息")}</div>
            <div style={{ marginTop: compactPx(10), display: "grid", gridTemplateColumns: "140px minmax(0, 1fr)", rowGap: 8, columnGap: 12, fontSize: compactPx(13), lineHeight: 1.8 }}>
              {row("ID", profile.id)}
              {row(t("用户名"), <span data-no-auto-translate>{profile.username}</span>)}
              {row(t("显示名"), profile.display_name || "—")}
              {row(t("Line 联系方式"), profile.line_contact || "—")}
              {row(t("账号状态"), profile.disabled ? t("已禁用") : t("启用中"))}
              {row(t("撮合权限"), profile.influencer_status || "—")}
              {row(t("创建时间"), profile.created_at || "—")}
              {row(t("更新时间"), profile.updated_at || "—")}
            </div>
          </div>

          <div style={{ padding: compactPx(14), borderRadius: compactPx(14), border: "1px solid rgba(148,163,184,0.35)", background: "#fff" }}>
            <div style={{ fontWeight: 900, color: "var(--xt-primary)" }}>{t("达人资料")}</div>
            <div style={{ marginTop: compactPx(10), display: "grid", gridTemplateColumns: "140px minmax(0, 1fr)", rowGap: 8, columnGap: 12, fontSize: compactPx(13), lineHeight: 1.8 }}>
              {row(t("TikTok 账号"), profile.tiktok_account || "—")}
              {row(t("粉丝数量"), profile.tiktok_fans || "—")}
              {row(t("擅长领域"), profile.expertise_domains?.length ? profile.expertise_domains.join("、") : "—")}
              {row(t("自我介绍/个人优势"), profile.influencer_bio || "—")}
              {row(t("专长/人设标签"), (profile as { specialties?: string | null }).specialties || "—")}
            </div>
          </div>

          <div style={{ padding: compactPx(14), borderRadius: compactPx(14), border: "1px solid rgba(148,163,184,0.35)", background: "#fff" }}>
            <div style={{ fontWeight: 900, color: "var(--xt-primary)" }}>{t("收款信息")}</div>
            <div style={{ marginTop: compactPx(10), display: "grid", gridTemplateColumns: "140px minmax(0, 1fr)", rowGap: 8, columnGap: 12, fontSize: compactPx(13), lineHeight: 1.8 }}>
              {row(t("姓名"), profile.real_name || "—")}
              {row(t("银行"), profile.bank_name || "—")}
              {row(t("支行"), profile.bank_branch || "—")}
              {row(t("银行卡号"), profile.bank_card || "—")}
            </div>
          </div>

          <div style={{ padding: compactPx(14), borderRadius: compactPx(14), border: "1px solid rgba(148,163,184,0.35)", background: "#fff" }}>
            <div style={{ fontWeight: 900, color: "var(--xt-primary)" }}>{t("运营字段")}</div>
            <div style={{ marginTop: compactPx(10), display: "grid", gridTemplateColumns: "140px minmax(0, 1fr)", rowGap: 8, columnGap: 12, fontSize: compactPx(13), lineHeight: 1.8 }}>
              {row(t("露脸"), profile.show_face ? t("是") : t("否"))}
              {row(t("人设标签"), profile.tags || "—")}
              {row(t("主攻平台"), profile.platforms || "—")}
              {row(t("黑名单"), profile.blacklisted ? t("是") : t("否"))}
              {row(t("等级"), formatLevel(profile.level))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
