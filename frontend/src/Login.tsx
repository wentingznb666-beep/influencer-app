import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { login } from "./authApi";

/**
 * 达人分发 APP 登录页：用户名密码登录，成功后按角色跳转。
 */
export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const from = searchParams.get("from") || "/";

  /**
   * 快速填充演示账号，减少测试时反复输入/创建账号的成本。
   */
  const fillDemo = (u: string, p?: string) => {
    setUsername(u);
    if (typeof p === "string") setPassword(p);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(username.trim(), password);
      const rolePath = user.role === "admin" ? "/admin" : user.role === "influencer" ? "/influencer" : "/client";
      navigate(from.startsWith("/admin") || from.startsWith("/client") || from.startsWith("/influencer") ? from : rolePath, { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: "80px auto", padding: 24, background: "#fff", borderRadius: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
      <h1 style={{ marginTop: 0, marginBottom: 24, fontSize: 22 }}>达人分发 APP</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>请登录后使用</p>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>用户名</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            style={{ width: "100%", padding: "10px 12px", boxSizing: "border-box", borderRadius: 8, border: "1px solid #ddd" }}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", marginBottom: 6, fontWeight: 500 }}>密码</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            style={{ width: "100%", padding: "10px 12px", boxSizing: "border-box", borderRadius: 8, border: "1px solid #ddd" }}
          />
        </div>
        {error && <p style={{ color: "#c00", marginBottom: 12, fontSize: 14 }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{ width: "100%", padding: "12px 16px", background: "#007aff", color: "#fff", border: "none", borderRadius: 8, fontWeight: 500, cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? "登录中…" : "登录"}
        </button>
      </form>

      <div style={{ marginTop: 18, padding: 12, border: "1px solid #eee", borderRadius: 10, background: "#fafafa" }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>演示账号（后端启动默认自动创建）</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={() => fillDemo("test-client")} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontSize: 13 }}>
            填充客户：test-client
          </button>
          <button type="button" onClick={() => fillDemo("test-influencer")} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontSize: 13 }}>
            填充达人：test-influencer
          </button>
          <button type="button" onClick={() => fillDemo("admin", "admin123")} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer", fontSize: 13 }}>
            填充管理员：admin
          </button>
        </div>
        <div style={{ fontSize: 12, color: "#666", marginTop: 8, lineHeight: 1.4 }}>
          客户/达人密码取决于你的后端是否已创建或曾手动注册；若开启演示账号自动创建，默认密码通常为 `test123456`。
        </div>
      </div>
    </div>
  );
}
