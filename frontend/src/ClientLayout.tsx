import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getStoredUser, clearAuth } from "./authApi";
import { getPoints as getClientPoints } from "./clientApi";

const navStyle = { display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" as const };
const linkStyle = { padding: "8px 12px", borderRadius: 8, textDecoration: "none", color: "#333" };
const activeStyle = { ...linkStyle, background: "#e8f0fe", color: "#1967d2" };

/**
 * 客户端布局：导航（合作意向、订单跟踪、达人作品、积分）+ 子路由出口。
 */
export default function ClientLayout() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const [balance, setBalance] = useState<number | null>(null);

  const handleLogout = () => {
    clearAuth();
    navigate("/login", { replace: true });
  };

  /**
   * 加载客户端当前积分余额，用于在导航顶部展示。
   */
  const loadBalance = async () => {
    try {
      const data = await getClientPoints();
      setBalance(typeof data?.balance === "number" ? data.balance : 0);
    } catch {
      setBalance(null);
    }
  };

  useEffect(() => {
    loadBalance();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f7" }}>
      <header style={{ background: "#fff", padding: "16px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>达人分发 · 客户端</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#666" }}>{user?.username}</span>
          <span style={{ fontSize: 13, color: "#666" }}>
            余额：<span style={{ fontWeight: 700, color: "#111" }}>{balance == null ? "—" : balance}</span>
          </span>
          <button type="button" onClick={loadBalance} style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer" }}>
            刷新余额
          </button>
        </div>
        <button type="button" onClick={handleLogout} style={{ padding: "6px 12px", border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer" }}>
          退出
        </button>
      </header>
      <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
        <nav style={navStyle}>
          <NavLink to="/client/requests" style={({ isActive }) => (isActive ? activeStyle : linkStyle)}>合作意向</NavLink>
          <NavLink to="/client/orders" style={({ isActive }) => (isActive ? activeStyle : linkStyle)}>订单跟踪</NavLink>
          <NavLink to="/client/works" style={({ isActive }) => (isActive ? activeStyle : linkStyle)}>达人作品</NavLink>
          <NavLink to="/client/points" style={({ isActive }) => (isActive ? activeStyle : linkStyle)}>积分充值</NavLink>
        </nav>
        <Outlet />
      </main>
    </div>
  );
}
