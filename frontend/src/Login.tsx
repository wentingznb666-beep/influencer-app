import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
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
      <p style={{ marginTop: 20, fontSize: 14 }}>
        <Link to="/translate" style={{ color: "#007aff" }}>使用翻译与朗读工具（无需登录）</Link>
      </p>
    </div>
  );
}
