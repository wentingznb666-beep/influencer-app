import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { getStoredUser, clearAuth } from "./authApi";

const navStyle = { display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" as const };
const linkStyle = { padding: "8px 12px", borderRadius: 8, textDecoration: "none", color: "#333" };
const activeStyle = { ...linkStyle, background: "#e8f0fe", color: "#1967d2" };

/**
 * 管理员端布局：侧栏导航 + 子路由出口。
 */
export default function AdminLayout() {
  const navigate = useNavigate();
  const user = getStoredUser();

  const handleLogout = () => {
    clearAuth();
    navigate("/login", { replace: true });
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f7" }}>
      <header style={{ background: "#fff", padding: "16px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>达人分发 · 管理员端</h1>
        <span style={{ color: "#666" }}>{user?.username}</span>
        <button type="button" onClick={handleLogout} style={{ padding: "6px 12px", border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer" }}>
          退出
        </button>
      </header>
      <main style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
        <nav style={navStyle}>
          <NavLink to="/admin/materials" style={({ isActive }) => (isActive ? activeStyle : linkStyle)}>素材管理</NavLink>
          <NavLink to="/admin/tasks" style={({ isActive }) => (isActive ? activeStyle : linkStyle)}>任务管理</NavLink>
          <NavLink to="/admin/influencers" style={({ isActive }) => (isActive ? activeStyle : linkStyle)}>达人管理</NavLink>
          <NavLink to="/admin/submissions" style={({ isActive }) => (isActive ? activeStyle : linkStyle)}>投稿审核</NavLink>
          <NavLink to="/admin/points" style={({ isActive }) => (isActive ? activeStyle : linkStyle)}>积分与结算</NavLink>
          <NavLink to="/admin/settlement" style={({ isActive }) => (isActive ? activeStyle : linkStyle)}>结算打款</NavLink>
          <NavLink to="/admin/withdrawals" style={({ isActive }) => (isActive ? activeStyle : linkStyle)}>提现管理</NavLink>
          <NavLink to="/admin/risk" style={({ isActive }) => (isActive ? activeStyle : linkStyle)}>防删与风控</NavLink>
        </nav>
        <Outlet />
      </main>
    </div>
  );
}
