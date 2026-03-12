import { useNavigate } from "react-router-dom";
import { getStoredUser, clearAuth } from "./authApi";

/**
 * 管理员端占位页：展示当前用户并提供登出与后续功能入口。
 */
export default function AdminPortal() {
  const navigate = useNavigate();
  const user = getStoredUser();

  const handleLogout = () => {
    clearAuth();
    navigate("/login", { replace: true });
  };

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>管理员端</h1>
        <span style={{ color: "#666" }}>{user?.username}（管理员）</span>
        <button type="button" onClick={handleLogout} style={{ padding: "8px 16px", border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer" }}>
          退出登录
        </button>
      </header>
      <p style={{ color: "#666" }}>后续可在此接入：素材管理、任务管理、达人审核、投稿审核、积分与结算等。</p>
    </div>
  );
}
