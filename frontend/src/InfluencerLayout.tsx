import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { getStoredUser, clearAuth } from "./authApi";

const navStyle = { display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" as const };
const linkStyle = { padding: "8px 12px", borderRadius: 8, textDecoration: "none", color: "#333" };
const activeStyle = { ...linkStyle, background: "#e8f0fe", color: "#1967d2" };

/**
 * 达人端布局：导航（任务大厅、我的任务、积分与收益）+ 子路由出口。
 */
export default function InfluencerLayout() {
  const navigate = useNavigate();
  const user = getStoredUser();

  const handleLogout = () => {
    clearAuth();
    navigate("/login", { replace: true });
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f7" }}>
      <header style={{ background: "#fff", padding: "16px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>达人分发 · 达人端</h1>
        <span style={{ color: "#666" }}>{user?.username}</span>
        <button type="button" onClick={handleLogout} style={{ padding: "6px 12px", border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer" }}>
          退出
        </button>
      </header>
      <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
        <nav style={navStyle}>
          <NavLink to="/influencer/tasks" style={({ isActive }) => (isActive ? activeStyle : linkStyle)}>任务大厅</NavLink>
          <NavLink to="/influencer/my-tasks" style={({ isActive }) => (isActive ? activeStyle : linkStyle)}>我的任务</NavLink>
          <NavLink to="/influencer/points" style={({ isActive }) => (isActive ? activeStyle : linkStyle)}>积分与收益</NavLink>
        </nav>
        <Outlet />
      </main>
    </div>
  );
}
