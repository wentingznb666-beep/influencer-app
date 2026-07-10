import { useEffect, useState } from "react";
import { fetchWithAuth } from "../fetchWithAuth";

export default function PurchaseCozeConfig() {
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg }); setTimeout(() => setToast(null), 3000);
  };

  const basePath = window.location.pathname.includes("/employee/")
    ? "/employee/vertical-connections/purchase"
    : "/admin/vertical-connections/purchase";

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetchWithAuth("/api/admin/purchase/coze-config");
        const d = await r.json();
        setUrl(d.url || "");
      } catch (e: any) { showToast("error", "加载配置失败"); }
      finally { setLoading(false); }
    })();
  }, []);

  const save = async () => {
    if (!url || !key) { showToast("error", "URL 和 Key 为必填项"); return; }
    setSaving(true);
    try {
      await fetchWithAuth("/api/admin/purchase/coze-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, key }),
      });
      showToast("success", "配置已保存");
      setKey("");
    } catch (e: any) { showToast("error", e.message || "保存失败"); }
    finally { setSaving(false); }
  };

  const testConnection = async () => {
    if (!url) { showToast("error", "请先填写 URL"); return; }
    setTesting(true);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ test: true }),
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) {
        showToast("success", `连接成功 (HTTP ${r.status})`);
      } else {
        showToast("error", `服务器返回 ${r.status}`);
      }
    } catch (e: any) {
      showToast("error", `连接失败: ${e.message}`);
    } finally { setTesting(false); }
  };

  const inputStyle: React.CSSProperties = {
    padding: "10px 14px", border: "1px solid #dbe1ea", borderRadius: 8, fontSize: 14,
    width: "100%", boxSizing: "border-box", fontFamily: "monospace",
  };
  const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 4, display: "block" };
  const btn: React.CSSProperties = {
    padding: "10px 24px", border: "none", borderRadius: 8, background: "var(--xt-accent, #f97316)",
    color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14,
  };
  const outlineBtn: React.CSSProperties = {
    ...btn, background: "#fff", color: "#334155", border: "1px solid #dbe1ea",
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
        ].map((tab) => {
          const active = window.location.pathname === tab.path;
          return (
            <a key={tab.path} href={tab.path} style={{
              padding: "8px 20px", fontSize: 14, fontWeight: active ? 700 : 500,
              color: active ? "var(--xt-accent, #f97316)" : "#64748b",
              borderBottom: active ? "2px solid var(--xt-accent, #f97316)" : "2px solid transparent",
              marginBottom: -2, textDecoration: "none", cursor: "pointer",
            }}>
              {tab.label}
            </a>
          );
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div><p>加载中...</p>
        </div>
      ) : (
        <div style={{ maxWidth: 560 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 18 }}>⚙️ 找货工作流配置</h3>

            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20, lineHeight: 1.6 }}>
              配置 Coze 工作流的 Webhook 地址和 API Key。达人提交进货需求后，系统会自动调用此接口触发搜索。
              Coze 搜到商品后会回调 <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>POST /api/purchase/coze-callback?token=...</code> 写入商品库。
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Coze Webhook URL</label>
              <input
                type="url" value={url} onChange={(e) => setUrl(e.target.value)}
                style={inputStyle} placeholder="https://api.coze.com/v1/workflow/run"
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Coze API Key</label>
              <input
                type="password" value={key} onChange={(e) => setKey(e.target.value)}
                style={inputStyle} placeholder="输入新的 API Key（已保存的不显示）"
              />
              <p style={{ fontSize: 11, color: "#94a3b8", margin: "4px 0 0" }}>
                已保存的 Key 不会回显，如需更新请输入新 Key
              </p>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={save} disabled={saving} style={{ ...btn, opacity: saving ? 0.5 : 1 }}>
                {saving ? "保存中..." : "💾 保存配置"}
              </button>
              <button onClick={testConnection} disabled={testing} style={outlineBtn}>
                {testing ? "测试中..." : "🔌 测试连接"}
              </button>
            </div>
          </div>

          {/* Info card */}
          <div style={{ background: "#f0f9ff", borderRadius: 10, padding: 16, marginTop: 16, border: "1px solid #bae6fd" }}>
            <h4 style={{ margin: "0 0 8px", fontSize: 13, color: "#0369a1" }}>📋 接口说明</h4>
            <div style={{ fontSize: 12, color: "#0c4a6e", lineHeight: 1.8 }}>
              <div><strong>触发接口：</strong>系统在达人提交需求后 fire-and-forget POST 到上述 URL</div>
              <div><strong>请求格式：</strong><code style={{ background: "#e0f2fe", padding: "1px 4px", borderRadius: 3 }}>{`{"demand_id":N,"category":"...","description":"...","budget_min_thb":N,"budget_max_thb":N}`}</code></div>
              <div><strong>回调接口：</strong>Coze 搜到商品后回调</div>
              <div><strong>回调格式：</strong><code style={{ background: "#e0f2fe", padding: "1px 4px", borderRadius: 3 }}>{`{"demand_id":N,"products":[{"name":"...","price":N,"url":"...","image":"...","supplier":"..."}]}`}</code></div>
              <div><strong>回调 Token：</strong><code style={{ background: "#e0f2fe", padding: "1px 4px", borderRadius: 3 }}>xiangtai-coze-callback-secret-2026</code>（环境变量 COZE_CALLBACK_SECRET）</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
