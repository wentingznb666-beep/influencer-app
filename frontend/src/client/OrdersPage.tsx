import { useState, useEffect } from "react";
import * as api from "../clientApi";

type Order = {
  id: number;
  request_id: number | null;
  status: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  product_info: string | null;
  target_platform: string | null;
};

export default function OrdersPage() {
  const [list, setList] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formNote, setFormNote] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getOrders();
      setList(data.list || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    setError(null);
    try {
      await api.createOrder({ note: formNote.trim() || undefined });
      setShowForm(false);
      setFormNote("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    }
  };

  const statusText: Record<string, string> = { pending: "待寄送", sent: "已寄出", received: "已收货" };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>样品寄送与订单跟踪</h2>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <div style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          style={{ padding: "8px 16px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
        >
          {showForm ? "取消" : "新建订单/样品记录"}
        </button>
      </div>
      {showForm && (
        <div style={{ marginBottom: 24, padding: 16, background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <label>备注</label>
          <input
            type="text"
            value={formNote}
            onChange={(e) => setFormNote(e.target.value)}
            placeholder="可选"
            style={{ display: "block", marginTop: 4, marginBottom: 12, width: "100%", maxWidth: 300, padding: "8px 10px", boxSizing: "border-box" }}
          />
          <button type="button" onClick={handleCreate} style={{ padding: "8px 16px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>创建</button>
        </div>
      )}
      {loading ? <p>加载中…</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {list.map((o) => (
            <div key={o.id} style={{ padding: 16, background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontWeight: 600 }}>订单 #{o.id}</span>
                <span style={{ color: "#666" }}>{statusText[o.status] ?? o.status}</span>
              </div>
              {o.product_info != null && <p style={{ margin: "8px 0 0", fontSize: 14 }}>关联需求：{o.product_info}</p>}
              {o.note && <p style={{ margin: "4px 0 0", fontSize: 13, color: "#666" }}>备注：{o.note}</p>}
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#999" }}>创建：{o.created_at} · 更新：{o.updated_at}</p>
            </div>
          ))}
        </div>
      )}
      {!loading && list.length === 0 && <p style={{ color: "#666" }}>暂无订单</p>}
    </div>
  );
}
