import { useEffect, useState, type FormEvent, type InputHTMLAttributes } from "react";
import { Link, useNavigate } from "react-router-dom";

import { registerAccount, type PublicRegisterRole } from "./authApi";
import LanguageSwitch from "./LanguageSwitch";
import { BrandLogo } from "./BrandLogo";
import { xtPrimaryBtn } from "./brandTheme";

const TEAM_PHOTO_SRC = {
  ceo: "/team/ceo.png",
  marketing: "/team/marketing.png",
  live: "/team/live.png",
  edit: "/team/edit.png",
} as const;

type TeamKey = keyof typeof TEAM_PHOTO_SRC;

function TeamPhoto({ team, alt }: { team: TeamKey; alt: string }) {
  return <img className="xt-login-home__team-img" src={TEAM_PHOTO_SRC[team]} alt={alt} loading="lazy" />;
}

type IconInputProps = {
  icon: string;
} & InputHTMLAttributes<HTMLInputElement>;

function LoginInputWithIcon({ icon, style, className, ...rest }: IconInputProps) {
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 12,
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: 16,
          lineHeight: 1,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {icon}
      </span>
      <input
        {...rest}
        className={className}
        style={{
          width: "100%",
          padding: "10px 12px 10px 40px",
          boxSizing: "border-box",
          borderRadius: 8,
          border: "1px solid var(--xt-border)",
          background: "var(--xt-surface)",
          fontSize: 15,
          ...style,
        }}
      />
    </div>
  );
}

function PasswordInputWithIconToggle({
  icon,
  visible,
  onToggleVisible,
  style,
  className,
  ...rest
}: IconInputProps & { visible: boolean; onToggleVisible: () => void }) {
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 12,
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: 16,
          lineHeight: 1,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {icon}
      </span>
      <button
        type="button"
        aria-label={visible ? "隐藏密码" : "显示密码"}
        onClick={onToggleVisible}
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          width: 40,
          height: 40,
          borderRadius: 10,
          border: "1px solid var(--xt-border)",
          background: "var(--xt-surface)",
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
          fontSize: 16,
          color: "var(--xt-text)",
        }}
      >
        {visible ? "🙈" : "👁"}
      </button>
      <input
        {...rest}
        className={className}
        style={{
          width: "100%",
          padding: "10px 52px 10px 40px",
          boxSizing: "border-box",
          borderRadius: 8,
          border: "1px solid var(--xt-border)",
          background: "var(--xt-surface)",
          fontSize: 15,
          ...style,
        }}
      />
    </div>
  );
}

export default function Register() {
  const [ready, setReady] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState<PublicRegisterRole>("client");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    requestAnimationFrame(() => setReady(true));
  }, []);

  function scrollToSection(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const nextUsername = username.trim();
    if (!nextUsername) {
      setError("请输入账号");
      return;
    }
    if (!password) {
      setError("请输入密码");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    setLoading(true);
    try {
      const result = await registerAccount(nextUsername, password, role);
      navigate(`/login?notice=${encodeURIComponent(result.message)}`, { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "注册失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`xt-login-home ${ready ? "is-ready" : ""}`}>
      <main className="xt-login-home__content">
        <section className="xt-login-home__hero">
          <div className="xt-login-home__container xt-login-home__hero-inner">
            <div className="xt-login-home__brand">
              <div className="xt-login-home__logo">
                <BrandLogo height={70} />
              </div>
              <div className="xt-login-home__brand-text">
                <div className="xt-login-home__brand-kicker">Xiang Tai Shopping Co.,Ltd.</div>
              </div>
              <div className="xt-login-home__brand-points">
                <div className="xt-login-home__point">
                  <div className="xt-login-home__point-k">定位</div>
                  <div className="xt-login-home__point-v">TikTok 泰国头部先锋卖家 · 5 年电商经验</div>
                </div>
                <div className="xt-login-home__point">
                  <div className="xt-login-home__point-k">能力</div>
                  <div className="xt-login-home__point-v">直播 / 广告 / 短视频 / TikTok 运营</div>
                </div>
                <div className="xt-login-home__point">
                  <div className="xt-login-home__point-k">服务</div>
                  <div className="xt-login-home__point-v">营销方案 · 媒体制作 · 分析咨询 · 代运营</div>
                </div>
              </div>
            </div>

            <div className="xt-login-card xt-login-home__card">
              <div className="xt-login-home__card-top">
                <div className="xt-login-home__card-title">注册</div>
                <LanguageSwitch />
              </div>
              <div className="xt-login-home__card-desc">创建新账号，注册成功后按原有业务流程进入登录或审核环节</div>

              <div
                style={{
                  marginTop: 14,
                  marginBottom: 14,
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: "linear-gradient(135deg, #ecfeff 0%, #ecfdf5 100%)",
                  border: "1px solid #86efac",
                  color: "#065f46",
                  fontSize: 14,
                  fontWeight: 700,
                  lineHeight: 1.7,
                }}
              >
                🔒 费用透明承诺：免注册费、不抽取佣金、100% 无后期追收费，全程无隐藏费用
              </div>

              <form onSubmit={handleSubmit}>
                <div style={{ marginTop: 12, marginBottom: 12 }}>
                  <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>注册身份</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "12px 14px",
                        borderRadius: 10,
                        border: role === "client" ? "1px solid #2563eb" : "1px solid var(--xt-border)",
                        background: role === "client" ? "#eff6ff" : "var(--xt-surface)",
                        cursor: "pointer",
                      }}
                    >
                      <input type="radio" name="role" checked={role === "client"} onChange={() => setRole("client")} />
                      <span style={{ fontWeight: 600 }}>商家</span>
                    </label>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "12px 14px",
                        borderRadius: 10,
                        border: role === "influencer" ? "1px solid #2563eb" : "1px solid var(--xt-border)",
                        background: role === "influencer" ? "#eff6ff" : "var(--xt-surface)",
                        cursor: "pointer",
                      }}
                    >
                      <input type="radio" name="role" checked={role === "influencer"} onChange={() => setRole("influencer")} />
                      <span style={{ fontWeight: 600 }}>达人</span>
                    </label>
                  </div>
                  {role === "influencer" || role === "client" ? (
                    <div style={{ marginTop: 8, color: "#6b7280", fontSize: 13, lineHeight: 1.6 }}>
                      商家/达人账号注册后需管理员/员工审核通过，审核完成后方可登录。
                    </div>
                  ) : null}
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>账号</label>
                  <LoginInputWithIcon
                    icon="👤"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>密码</label>
                  <PasswordInputWithIconToggle
                    icon="🔒"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    visible={showPassword}
                    onToggleVisible={() => setShowPassword((p) => !p)}
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>确认密码</label>
                  <PasswordInputWithIconToggle
                    icon="🔐"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    visible={showConfirmPassword}
                    onToggleVisible={() => setShowConfirmPassword((p) => !p)}
                  />
                </div>

                <div className="xt-login-home__actions">
                  <div style={{ color: "#64748b", fontSize: 13 }}>提交后将沿用系统现有注册业务逻辑</div>
                  <button className="xt-login-home__ghost" type="button" onClick={() => scrollToSection("pdpa")}>
                    PDPA 隐私政策
                  </button>
                </div>

                {error && <p style={{ color: "#c00", marginTop: 10, marginBottom: 10, fontSize: 14 }}>{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="xt-login-home__submit"
                  style={{
                    ...xtPrimaryBtn,
                    width: "100%",
                    padding: "12px 16px",
                    opacity: loading ? 0.75 : 1,
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "注册中…" : "立即注册"}
                </button>

                <div style={{ marginTop: 14, textAlign: "center", fontSize: 14, color: "#516072" }}>
                  已有账号？{" "}
                  <Link to="/login" style={{ color: "#2563eb", fontWeight: 700, textDecoration: "none" }}>
                    立即登录
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </section>

        <section className="xt-login-home__company" aria-label="Company Showcase" id="about">
          <div className="xt-login-home__container">
            <div className="xt-login-home__section-title">
              <div className="xt-login-home__kicker">Company</div>
              <h2 className="xt-login-home__h2">公司展示</h2>
              <div className="xt-login-home__desc">从公司介绍到团队与项目数据，一页了解我们的能力与价值。</div>
            </div>

            <div className="xt-login-home__grid">
              <div className="xt-login-home__info-card">
                <div className="xt-login-home__card-h">About Company</div>
                <div className="xt-login-home__card-p">公司介绍、TikTok 泰国头部先锋卖家、5 年电商经验。</div>
              </div>
              <div className="xt-login-home__info-card">
                <div className="xt-login-home__card-h">CEO</div>
                <div className="xt-login-home__card-p">Xiong Liu，5 年线上业务、直播、广告、短视频、TikTok 运营。</div>
              </div>
              <div className="xt-login-home__info-card">
                <div className="xt-login-home__card-h">Vision</div>
                <div className="xt-login-home__card-p">引领数字营销，新一代网络营销领军企业。</div>
              </div>
              <div className="xt-login-home__info-card">
                <div className="xt-login-home__card-h">Mission</div>
                <div className="xt-login-home__card-p">赋能新一代营销人，打造专业营销社区。</div>
              </div>
              <div className="xt-login-home__info-card">
                <div className="xt-login-home__card-h">Services</div>
                <div className="xt-login-home__card-p">营销方案、媒体制作、分析咨询、代运营。</div>
              </div>
              <div className="xt-login-home__info-card">
                <div className="xt-login-home__card-h">Team</div>
                <div className="xt-login-home__card-p">CEO、营销组、直播组、剪辑组。</div>
              </div>
              <div className="xt-login-home__info-card xt-login-home__info-card--wide">
                <div className="xt-login-home__card-h">Projects</div>
                <div className="xt-login-home__card-p">月销超 100 万泰铢、10+ 主播、100+ 后端、中国商品直播、网红打造、专业短视频、爆款直播。</div>
              </div>
              <div className="xt-login-home__info-card">
                <div className="xt-login-home__card-h">SWOT</div>
                <div className="xt-login-home__card-p">优势 TikTok 领先、机会多平台拓展、劣势物流线下经验不足、威胁平台规则变化。</div>
              </div>
              <div className="xt-login-home__info-card">
                <div className="xt-login-home__card-h">数据</div>
                <div className="xt-login-home__card-p">服务 2000+ 企业、多平台代运营。</div>
              </div>
            </div>

            <div className="xt-login-home__pdpa" id="pdpa">
              <div className="xt-login-home__card-h">PDPA 条款</div>
              <div className="xt-login-home__card-p">严格保护创作者信息与作品，绝不泄露转售第三方。</div>
            </div>
          </div>
        </section>

        <section className="xt-login-home__team" aria-label="Team Showcase">
          <div className="xt-login-home__container">
            <div className="xt-login-home__team-title">
              <div className="xt-login-home__team-kicker">Meet</div>
              <div className="xt-login-home__team-h">Our Team</div>
            </div>

            <div className="xt-login-home__team-grid">
              <div className="xt-login-home__team-card">
                <TeamPhoto team="ceo" alt="CEO" />
                <div className="xt-login-home__team-label">CEO</div>
              </div>
              <div className="xt-login-home__team-card">
                <TeamPhoto team="marketing" alt="Marketing team" />
                <div className="xt-login-home__team-label">Marketing team</div>
              </div>
              <div className="xt-login-home__team-card">
                <TeamPhoto team="live" alt="Live team" />
                <div className="xt-login-home__team-label">Live team</div>
              </div>
              <div className="xt-login-home__team-card">
                <TeamPhoto team="edit" alt="Edit team" />
                <div className="xt-login-home__team-label">Edit team</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="xt-login-home__footer" id="contact">
        <div className="xt-login-home__container xt-login-home__footer-inner">
          <div className="xt-login-home__footer-col">
            <div className="xt-login-home__footer-title">客服支持</div>
            <div className="xt-login-home__footer-body">
              <div className="xt-login-home__footer-text">
                Line OA：{" "}
                <a className="xt-login-home__footer-a" href="https://lin.ee/TbYmfgi" target="_blank" rel="noreferrer">
                  https://lin.ee/TbYmfgi
                </a>
              </div>
            </div>
          </div>

          <div className="xt-login-home__footer-col">
            <div className="xt-login-home__footer-title">合规信息</div>
            <div className="xt-login-home__footer-body">
              <div className="xt-login-home__footer-text">注册号 ：0505564017671</div>
              <div className="xt-login-home__footer-text">业务类型：广告代理及相关业务</div>
              <div className="xt-login-home__footer-text">成立日期 ：2021年11月8日</div>
              <div className="xt-login-home__footer-text">办公地址 ：44/34 Moo 5, Nong Pa Khrang, Mueang Chiang Mai, Chiang Mai 50000</div>
            </div>
          </div>

          <div className="xt-login-home__footer-col">
            <div className="xt-login-home__footer-title">联系方式</div>
            <div className="xt-login-home__footer-body">
              <div className="xt-login-home__footer-text">电话 0653085541 / 0652468116</div>
              <div className="xt-login-home__footer-text">邮箱 Xt.tiktok7@gmail.com</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
