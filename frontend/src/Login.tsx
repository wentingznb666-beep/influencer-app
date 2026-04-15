import { useState, type FormEvent, type InputHTMLAttributes } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { login, registerAccount, type PublicRegisterRole } from "./authApi";
import LanguageSwitch from "./LanguageSwitch";
import { BrandLogo } from "./BrandLogo";
import { xtPrimaryBtn } from "./brandTheme";

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
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerRole, setRegisterRole] = useState<PublicRegisterRole>("client");
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);
  const [loadingRegister, setLoadingRegister] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const from = searchParams.get("from") || "/";

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
      const user = await login(username.trim(), password);
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

  /**
   * 处理公开注册：仅支持注册商家端或达人账号。
   */
  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setRegisterError(null);
    setRegisterSuccess(null);
    setLoadingRegister(true);
    try {
      const result = await registerAccount(registerUsername.trim(), registerPassword, registerRole);
      setRegisterSuccess(result.message);
      setUsername(registerUsername.trim());
      setPassword(registerPassword);
      setRegisterUsername("");
      setRegisterPassword("");
      setRegisterRole("client");
    } catch (err: unknown) {
      setRegisterError(err instanceof Error ? err.message : "注册失败");
    } finally {
      setLoadingRegister(false);
    }
  };

  return (
    <div className="xt-login-shell">
      <div
        style={{
          maxWidth: 440,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <BrandLogo height={80} style={{ margin: "0 auto" }} />
        </div>
        <div className="xt-login-card">
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <LanguageSwitch />
          </div>
          <h1
            style={{
              marginTop: 0,
              marginBottom: 24,
              fontSize: 22,
              textAlign: "center",
              color: "var(--xt-primary)",
              fontWeight: 700,
            }}
          >
            达人分发 APP
          </h1>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setActiveTab("login")}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--xt-border)",
                background: activeTab === "login" ? "var(--xt-nav-active-bg)" : "var(--xt-surface)",
                color: activeTab === "login" ? "var(--xt-primary)" : "var(--xt-text)",
                cursor: "pointer",
                fontWeight: 600,
                boxShadow: activeTab === "login" ? "inset 0 -2px 0 var(--xt-accent)" : "none",
              }}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("register")}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid var(--xt-border)",
                background: activeTab === "register" ? "var(--xt-nav-active-bg)" : "var(--xt-surface)",
                color: activeTab === "register" ? "var(--xt-primary)" : "var(--xt-text)",
                cursor: "pointer",
                fontWeight: 600,
                boxShadow: activeTab === "register" ? "inset 0 -2px 0 var(--xt-accent)" : "none",
              }}
            >
              注册
            </button>
          </div>

          {activeTab === "login" ? (
            <>
              <p style={{ color: "var(--xt-text-muted)", marginBottom: 24 }}>请登录后使用</p>
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>用户名</label>
                  <LoginInputWithIcon
                    icon="👤"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>密码</label>
                  <LoginInputWithIcon
                    icon="🔒"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
                {error && <p style={{ color: "#c00", marginBottom: 12, fontSize: 14 }}>{error}</p>}
                <button
                  type="submit"
                  disabled={loadingLogin}
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
            </>
          ) : (
            <>
              <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: 18, color: "var(--xt-primary)" }}>注册账号</h2>
              <p style={{ color: "var(--xt-text-muted)", marginTop: 0, marginBottom: 16, fontSize: 13 }}>
                可注册为达人或商家；员工/管理员账号需由管理员开通。
              </p>
              <form onSubmit={handleRegister}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>注册用户名</label>
                  <LoginInputWithIcon
                    icon="👤"
                    type="text"
                    value={registerUsername}
                    onChange={(e) => setRegisterUsername(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>注册密码</label>
                  <LoginInputWithIcon
                    icon="🔒"
                    type="password"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>注册角色</label>
                  <select
                    value={registerRole}
                    onChange={(e) => setRegisterRole(e.target.value as PublicRegisterRole)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      boxSizing: "border-box",
                      borderRadius: 8,
                      border: "1px solid var(--xt-border)",
                      background: "var(--xt-surface)",
                      color: "var(--xt-text)",
                    }}
                  >
                    <option value="client">商家</option>
                    <option value="influencer">达人</option>
                  </select>
                </div>
                {registerError && <p style={{ color: "#c00", marginBottom: 12, fontSize: 14 }}>{registerError}</p>}
                {registerSuccess && <p style={{ color: "#0a7a2a", marginBottom: 12, fontSize: 14 }}>{registerSuccess}</p>}
                <button
                  type="submit"
                  disabled={loadingRegister}
                  style={{
                    ...xtPrimaryBtn,
                    width: "100%",
                    padding: "12px 16px",
                    opacity: loadingRegister ? 0.75 : 1,
                    cursor: loadingRegister ? "not-allowed" : "pointer",
                  }}
                >
                  {loadingRegister ? "注册中…" : "注册"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
