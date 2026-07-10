import { useEffect, useState } from "react";
import { fetchWithAuth } from "../fetchWithAuth";

export default function PurchaseCozeConfig() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ search_status: string; today_searches: number; total_demands: number } | null>(null);

  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg }); setTimeout(() => setToast(null), 3000);
  };

  const basePath = window.location.pathname.includes("/employee/")
    ? "/employee/vertical-connections/purchase"
    : "/admin/vertical-connections/purchase";

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetchWithAuth("/api/admin/purchase/coze-config");
      setStatus(await r.json());
    } catch (e: any) { showToast("error", "加载状态失败"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const btn: React.CSSProperties = {
    padding: "8px 16px", border: "none", borderRadius: 8, background: "var(--xt-accent, #f97316)",
    color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13,
  };

  return (
    <div>
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 2000,
          background: toast.type === "success" ? "#166534" : "#991b1b",
          color: "#fff", padding: "12px 20px", borderRadius: 10, fontWeight: 700, fontSize: 14,
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
          {toast.msg}
        </div>
      )}

      <h2 style={{ marginTop: 0, fontSize: 20, fontWeight: 800 }}>达人进货管理</h2>

      {/* Tab Nav */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "2px solid #e2e8f0" }}>
        {[
          { label: "📊 数据看板", path: basePath },
          { label: "进货需求", path: `${basePath}/demands` },
          { label: "商品库", path: `${basePath}/products` },
          { label: "订货管理", path: `${basePath}/orders` },
          { label: "找货配置", path: `${basePath}/coze-config` },
          { label: "供应商管理", path: `${basePath}/suppliers` },
          { label: "财务管理", path: `${basePath}/finance` },
        ].map((tab) => (
          <a key={tab.path} href={tab.path} style={{
            padding: "8px 14px", fontSize: 13, fontWeight: tab.path.includes("/coze-config") ? 700 : 500,
            color: tab.path.includes("/coze-config") ? "var(--xt-accent, #f97316)" : "#64748b",
            borderBottom: tab.path.includes("/coze-config") ? "2px solid var(--xt-accent, #f97316)" : "2px solid transparent",
            marginBottom: -2, textDecoration: "none", cursor: "pointer", whiteSpace: "nowrap",
          }}>
            {tab.label}
          </a>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div><p>加载中...</p>
        </div>
      ) : (
        <div style={{ maxWidth: 560 }}>
          {/* Status card */}
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 18 }}>⚙️ 找货服务配置</h3>

            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20, lineHeight: 1.6 }}>
              达人提交进货需求后，系统自动调用本地搜索服务查找 1688 商品。
              搜索服务状态：{status?.search_status === "running" ? (
                <span style={{ color: "#166534", fontWeight: 700 }}>🟢 运行中</span>
              ) : (
                <span style={{ color: "#dc2626", fontWeight: 700 }}>🔴 未启动</span>
              )}
            </p>

            {/* Stats cards */}
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              <div style={{ background: "#eff6ff", borderRadius: 10, padding: "14px 20px", flex: 1 }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#1d4ed8" }}>{status?.today_searches || 0}</div>
                <div style={{ fontSize: 12, color: "#1d4ed8" }}>今日搜索次数</div>
              </div>
              <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "14px 20px", flex: 1 }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#166534" }}>{status?.total_demands || 0}</div>
                <div style={{ fontSize: 12, color: "#166534" }}>需求总数</div>
              </div>
            </div>

            <button onClick={load} style={btn}>🔄 刷新状态</button>
          </div>

          {/* Info card */}
          <div style={{ background: "#f0f9ff", borderRadius: 10, padding: 16, border: "1px solid #bae6fd" }}>
            <h4 style={{ margin: "0 0 8px", fontSize: 13, color: "#0369a1" }}>📋 接口说明</h4>
            <div style={{ fontSize: 12, color: "#0c4a6e", lineHeight: 1.8 }}>
              <div><strong>搜索触发：</strong>达人提交需求后，系统异步调用 <code style={{ background: "#e0f2fe", padding: "1px 4px", borderRadius: 3 }}>POST /webhook/search</code></div>
              <div><strong>请求格式：</strong><code style={{ background: "#e0f2fe", padding: "1px 4px", borderRadius: 3 }}>{`{"demand_id":N,"category":"...","description":"...","budget_min_thb":N,"budget_max_thb":N}`}</code></div>
              <div><strong>商品回调：</strong>搜索结果通过 <code style={{ background: "#e0f2fe", padding: "1px 4px", borderRadius: 3 }}>POST /api/purchase/coze-callback</code> 写入商品库</div>
              <div><strong>搜索源：</strong>1688 商品搜索，本地部署，无需外部 API Key</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
