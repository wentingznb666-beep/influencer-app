import { useNavigate } from "react-router-dom";
import { getStoredUser, clearAuth } from "./authApi";

/**
 * 达人端占位页：展示当前用户并提供登出与后续功能入口。
 */
export default function InfluencerPortal() {
  const navigate = useNavigate();
  const user = getStoredUser();

  const handleLogout = () => {
    clearAuth();
    navigate("/login", { replace: true });
  };

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>达人端</h1>
        <span style={{ color: "#666" }}>{user?.username}（达人）</span>
        <button type="button" onClick={handleLogout} style={{ padding: "8px 16px", border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer" }}>
          退出登录
        </button>
      </header>
      <p style={{ color: "#666" }}>后续可在此接入：任务大厅、我的任务、视频下载、投稿反馈、积分与收益等。</p>
    </div>
  );
}
