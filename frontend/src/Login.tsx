import { useEffect, useState, type FormEvent, type InputHTMLAttributes } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { login } from "./authApi";
import LanguageSwitch from "./LanguageSwitch";

import { BrandLogo } from "./BrandLogo";

import { xtPrimaryBtn } from "./brandTheme";

const svgDataUri = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;

const TEAM_PHOTO_SRC = {
  ceo: "/team/ceo.png",
  marketing: "/team/marketing.png",
  live: "/team/live.png",
  edit: "/team/edit.png",
} as const;

const TEAM_PHOTO_VERSION = "8c05d16";

const TEAM_PHOTO_FALLBACK = {
  ceo: svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="720" height="480" viewBox="0 0 720 480">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#e4eaf3"/>
          <stop offset="1" stop-color="#eef2f8"/>
        </linearGradient>
        <linearGradient id="b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#152a45"/>
          <stop offset="1" stop-color="#1e3a5c"/>
        </linearGradient>
        <linearGradient id="a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#e07020"/>
          <stop offset="1" stop-color="#ea8938"/>
        </linearGradient>
        <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="18" flood-color="#152a45" flood-opacity=".18"/>
        </filter>
      </defs>
      <rect width="720" height="480" fill="url(#g)"/>
      <circle cx="140" cy="120" r="120" fill="#ffffff" opacity=".7"/>
      <circle cx="610" cy="90" r="140" fill="#ffffff" opacity=".55"/>
      <rect x="90" y="70" width="540" height="340" rx="28" fill="#ffffff" opacity=".9" filter="url(#s)"/>
      <rect x="90" y="70" width="540" height="340" rx="28" fill="url(#b)" opacity=".08"/>
      <circle cx="360" cy="190" r="62" fill="url(#b)"/>
      <path d="M252 332c14-58 66-92 108-92s94 34 108 92" fill="url(#b)" opacity=".95"/>
      <rect x="280" y="132" width="160" height="12" rx="6" fill="url(#a)" opacity=".95"/>
      <rect x="280" y="154" width="110" height="10" rx="5" fill="#d8e0eb"/>
      <rect x="280" y="172" width="140" height="10" rx="5" fill="#d8e0eb"/>
    </svg>
  `),
  marketing: svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="720" height="480" viewBox="0 0 720 480">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#e4eaf3"/>
          <stop offset="1" stop-color="#eef2f8"/>
        </linearGradient>
        <linearGradient id="b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#152a45"/>
          <stop offset="1" stop-color="#1e3a5c"/>
        </linearGradient>
        <linearGradient id="a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#e07020"/>
          <stop offset="1" stop-color="#ea8938"/>
        </linearGradient>
        <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="18" flood-color="#152a45" flood-opacity=".18"/>
        </filter>
      </defs>
      <rect width="720" height="480" fill="url(#g)"/>
      <rect x="86" y="82" width="548" height="316" rx="28" fill="#ffffff" opacity=".92" filter="url(#s)"/>
      <rect x="110" y="118" width="500" height="54" rx="16" fill="url(#b)" opacity=".10"/>
      <rect x="110" y="188" width="312" height="180" rx="22" fill="url(#b)" opacity=".08"/>
      <rect x="440" y="188" width="170" height="180" rx="22" fill="url(#b)" opacity=".06"/>
      <rect x="132" y="208" width="210" height="10" rx="5" fill="#d8e0eb"/>
      <rect x="132" y="228" width="170" height="10" rx="5" fill="#d8e0eb"/>
      <rect x="132" y="248" width="190" height="10" rx="5" fill="#d8e0eb"/>
      <circle cx="496" cy="250" r="34" fill="url(#a)" opacity=".92"/>
      <rect x="468" y="298" width="116" height="12" rx="6" fill="url(#b)" opacity=".75"/>
      <rect x="468" y="320" width="86" height="10" rx="5" fill="#d8e0eb"/>
      <rect x="130" y="136" width="120" height="12" rx="6" fill="url(#a)" opacity=".9"/>
      <rect x="262" y="136" width="110" height="12" rx="6" fill="url(#b)" opacity=".72"/>
      <rect x="384" y="136" width="96" height="12" rx="6" fill="#d8e0eb"/>
    </svg>
  `),
  live: svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="720" height="480" viewBox="0 0 720 480">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#e4eaf3"/>
          <stop offset="1" stop-color="#eef2f8"/>
        </linearGradient>
        <linearGradient id="b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#152a45"/>
          <stop offset="1" stop-color="#1e3a5c"/>
        </linearGradient>
        <linearGradient id="a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#e07020"/>
          <stop offset="1" stop-color="#ea8938"/>
        </linearGradient>
        <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="18" flood-color="#152a45" flood-opacity=".18"/>
        </filter>
      </defs>
      <rect width="720" height="480" fill="url(#g)"/>
      <rect x="86" y="82" width="548" height="316" rx="28" fill="#ffffff" opacity=".92" filter="url(#s)"/>
      <rect x="306" y="120" width="108" height="220" rx="18" fill="url(#b)" opacity=".88"/>
      <rect x="320" y="140" width="80" height="140" rx="12" fill="#ffffff" opacity=".10"/>
      <circle cx="360" cy="304" r="10" fill="#ffffff" opacity=".18"/>
      <rect x="350" y="340" width="20" height="22" rx="10" fill="url(#b)" opacity=".6"/>
      <path d="M360 362l-74 64" stroke="url(#b)" stroke-width="10" stroke-linecap="round" opacity=".55"/>
      <path d="M360 362l74 64" stroke="url(#b)" stroke-width="10" stroke-linecap="round" opacity=".55"/>
      <path d="M360 362v76" stroke="url(#b)" stroke-width="10" stroke-linecap="round" opacity=".55"/>
      <circle cx="488" cy="184" r="46" fill="url(#a)" opacity=".88"/>
      <path d="M470 184h36" stroke="#ffffff" stroke-width="10" stroke-linecap="round" opacity=".9"/>
      <path d="M488 166v36" stroke="#ffffff" stroke-width="10" stroke-linecap="round" opacity=".9"/>
      <rect x="122" y="142" width="150" height="14" rx="7" fill="url(#b)" opacity=".75"/>
      <rect x="122" y="166" width="120" height="10" rx="5" fill="#d8e0eb"/>
      <rect x="122" y="186" width="136" height="10" rx="5" fill="#d8e0eb"/>
    </svg>
  `),
  edit: svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="720" height="480" viewBox="0 0 720 480">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#e4eaf3"/>
          <stop offset="1" stop-color="#eef2f8"/>
        </linearGradient>
        <linearGradient id="b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#152a45"/>
          <stop offset="1" stop-color="#1e3a5c"/>
        </linearGradient>
        <linearGradient id="a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#e07020"/>
          <stop offset="1" stop-color="#ea8938"/>
        </linearGradient>
        <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="18" flood-color="#152a45" flood-opacity=".18"/>
        </filter>
      </defs>
      <rect width="720" height="480" fill="url(#g)"/>
      <rect x="86" y="82" width="548" height="316" rx="28" fill="#ffffff" opacity=".92" filter="url(#s)"/>
      <rect x="116" y="126" width="488" height="182" rx="18" fill="url(#b)" opacity=".10"/>
      <rect x="136" y="146" width="200" height="10" rx="5" fill="#d8e0eb"/>
      <rect x="136" y="168" width="160" height="10" rx="5" fill="#d8e0eb"/>
      <rect x="136" y="190" width="190" height="10" rx="5" fill="#d8e0eb"/>
      <rect x="136" y="236" width="440" height="10" rx="5" fill="#d8e0eb"/>
      <rect x="136" y="258" width="380" height="10" rx="5" fill="#d8e0eb"/>
      <rect x="116" y="326" width="488" height="48" rx="16" fill="url(#b)" opacity=".08"/>
      <rect x="138" y="342" width="138" height="16" rx="8" fill="url(#a)" opacity=".92"/>
      <rect x="290" y="342" width="86" height="16" rx="8" fill="url(#b)" opacity=".72"/>
      <rect x="388" y="342" width="126" height="16" rx="8" fill="#d8e0eb"/>
      <polygon points="520,176 570,206 520,236" fill="url(#a)" opacity=".92"/>
    </svg>
  `),
} as const;

type TeamKey = keyof typeof TEAM_PHOTO_SRC;

function TeamPhoto({ team, alt }: { team: TeamKey; alt: string }) {
  const src = `${TEAM_PHOTO_SRC[team]}?v=${TEAM_PHOTO_VERSION}`;
  const fallback = TEAM_PHOTO_FALLBACK[team];
  const [currentSrc, setCurrentSrc] = useState<string>(src);

  useEffect(() => {
    setCurrentSrc(src);
  }, [src]);

  return (
    <img
      className="xt-login-home__team-img"
      src={currentSrc}
      alt={alt}
      loading="lazy"
      onError={() => {
        if (currentSrc !== fallback) setCurrentSrc(fallback);
      }}
    />
  );
}



type IconInputProps = {

  /** 左侧展示的小图标（如账号、密码） */

  icon: string;

} & InputHTMLAttributes<HTMLInputElement>;



/**

 * 带左侧图标的输入框，用于登录/注册中的账号与密码行。

 */

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



/**

 * 达人分发 APP 登录页：用户名密码登录，成功后按角色跳转。

 */

export default function Login() {

  const STORAGE_KEY = "xt_login_remember_v1";
  const [username, setUsername] = useState("");

  const [password, setPassword] = useState("");

  const [rememberMe, setRememberMe] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loadingLogin, setLoadingLogin] = useState(false);

  const navigate = useNavigate();

  const [searchParams] = useSearchParams();

  const from = searchParams.get("from") || "/";



  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { username?: string; remember?: boolean };
        if (typeof parsed.username === "string") setUsername(parsed.username);
        if (typeof parsed.remember === "boolean") setRememberMe(parsed.remember);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }

    requestAnimationFrame(() => setReady(true));
  }, []);

  function persistRemember(nextUsername: string) {
    if (!rememberMe) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ username: nextUsername, remember: true }));
  }

  function scrollToSection(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /**

   * 根据登录用户角色决定默认跳转页面。

   */

  function resolveRolePath(role: string): string {

    if (role === "admin") return "/admin";

    if (role === "employee") return "/employee";

    if (role === "influencer") return "/influencer";

    return "/client";

  }



  /**

   * 处理登录提交：校验身份后跳转至对应门户页。

   */

  const handleSubmit = async (e: FormEvent) => {

    e.preventDefault();

    setError(null);

    setLoadingLogin(true);

    try {

      const nextUsername = username.trim();
      persistRemember(nextUsername);
      const user = await login(nextUsername, password);
      const rolePath = resolveRolePath(user.role);

      navigate(

        from.startsWith("/admin") || from.startsWith("/employee") || from.startsWith("/client") || from.startsWith("/influencer")

          ? from

          : rolePath,

        { replace: true }

      );

    } catch (err: unknown) {

      setError(err instanceof Error ? err.message : "登录失败");

    } finally {

      setLoadingLogin(false);

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
                <div className="xt-login-home__card-title">登录</div>
                <LanguageSwitch />
              </div>
              <div className="xt-login-home__card-desc">欢迎回来，请使用账号密码登录系统</div>

              <form onSubmit={handleSubmit}>
                <div style={{ marginTop: 12, marginBottom: 12 }}>
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
                  <LoginInputWithIcon
                    icon="🔒"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>

                <div className="xt-login-home__actions">
                  <label className="xt-login-home__remember">
                    <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                    <span>记住我</span>
                  </label>
                  <button className="xt-login-home__ghost" type="button" onClick={() => scrollToSection("pdpa")}>
                    PDPA 隐私政策
                  </button>
                </div>

                {error && <p style={{ color: "#c00", marginTop: 10, marginBottom: 10, fontSize: 14 }}>{error}</p>}

                <button
                  type="submit"
                  disabled={loadingLogin}
                  className="xt-login-home__submit"
                  style={{
                    ...xtPrimaryBtn,
                    width: "100%",
                    padding: "12px 16px",
                    opacity: loadingLogin ? 0.75 : 1,
                    cursor: loadingLogin ? "not-allowed" : "pointer",
                  }}
                >
                  {loadingLogin ? "登录中…" : "登录"}
                </button>
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
                <div className="xt-login-home__card-p">
                  Xiong Liu，5 年线上业务、直播、广告、短视频、TikTok 运营。
                </div>
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
                <div className="xt-login-home__card-p">
                  月销超 100 万泰铢、10+ 主播、100+ 后端、中国商品直播、网红打造、专业短视频、爆款直播。
                </div>
              </div>
              <div className="xt-login-home__info-card">
                <div className="xt-login-home__card-h">SWOT</div>
                <div className="xt-login-home__card-p">
                  优势 TikTok 领先、机会多平台拓展、劣势物流线下经验不足、威胁平台规则变化。
                </div>
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
            <div className="xt-login-home__footer-text">
              Line OA：{" "}
              <a className="xt-login-home__footer-a" href="https://lin.ee/TbYmfgi" target="_blank" rel="noreferrer">
                https://lin.ee/TbYmfgi
              </a>
            </div>
          </div>

          <div className="xt-login-home__footer-col">
            <div className="xt-login-home__footer-title">合规信息</div>
            <div className="xt-login-home__footer-text">
              เลขทะเบียน:0505564017671 | ประกอบธุรกิจ:โฆษณา | วันที่จดทะเบียน:8 พฤศจิกายน 2564
            </div>
            <div className="xt-login-home__footer-text">
              注册号：0505564017671 | 业务：广告代理 | 成立：2021-11-08
            </div>
            <div className="xt-login-home__footer-text">
              ที่ตั้งแผนที่: 44/34 หมู่ที่ 5 ตำบลหนองป่าครั่ง อำเภอเมืองเชียงใหม่ จ.เชียงใหม่ 50000
            </div>
            <div className="xt-login-home__footer-text">
              办公地址 ：44/34 Moo 5, Nong Pa Khrang, Mueang Chiang Mai, Chiang Mai 50000
            </div>
          </div>

          <div className="xt-login-home__footer-col">
            <div className="xt-login-home__footer-title">联系方式</div>
            <div className="xt-login-home__footer-text">电话 0653085541 / 0652468116</div>
            <div className="xt-login-home__footer-text">邮箱 Xt.tiktok7@gmail.com</div>
          </div>
        </div>
      </footer>
    </div>

  );

}
