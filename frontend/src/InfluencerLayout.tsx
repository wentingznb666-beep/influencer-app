import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getStoredUser, clearAuth } from "./authApi";
import { getPoints as getInfluencerPoints } from "./influencerApi";
import LanguageSwitch from "./LanguageSwitch";
import { BrandLogo } from "./BrandLogo";

const navStyle = { display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" as const };
const linkStyle = { padding: "8px 12px", borderRadius: 8, textDecoration: "none", color: "#333" };
const activeStyle = { ...linkStyle, background: "#e8f0fe", color: "#1967d2" };

/**
 * 达人端布局：导航（任务大厅、我的任务、积分与收益）+ 子路由出口。
 */
export default function InfluencerLayout() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const [balance, setBalance] = useState<number | null>(null);

  const handleLogout = () => {
    clearAuth();
    navigate("/login", { replace: true });
  };

  /**
   * 加载达人当前积分余额，用于在导航顶部展示。
   */
  const loadBalance = async () => {
    try {
      const data = await getInfluencerPoints();
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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <BrandLogo height={36} />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>达人分发 · 达人端</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <LanguageSwitch />
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
          <NavLink to="/influencer/tasks" style={({ isActive }) => (isActive ? activeStyle : linkStyle)}>任务大厅</NavLink>
          <NavLink to="/influencer/client-orders" style={({ isActive }) => (isActive ? activeStyle : linkStyle)}>客户端发单</NavLink>
          <NavLink to="/influencer/my-tasks" style={({ isActive }) => (isActive ? activeStyle : linkStyle)}>我的任务</NavLink>
          <NavLink to="/influencer/points" style={({ isActive }) => (isActive ? activeStyle : linkStyle)}>积分与收益</NavLink>
          <NavLink to="/influencer/withdraw" style={({ isActive }) => (isActive ? activeStyle : linkStyle)}>申请提现</NavLink>
        </nav>
        <Outlet />
      </main>
    </div>
  );
}
