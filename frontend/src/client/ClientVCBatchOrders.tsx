import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../fetchWithAuth";

type Conn = any;

export default function ClientVCBatchOrders() {
  const nav = useNavigate();
  const [connections, setConnections] = useState<Conn[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [form, setForm] = useState({ title: "", task_requirements: "", delivery_standards: "", deadline: "", submission_types: "" });
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetchWithAuth("/api/client/connections?tab=active");
        setConnections(((await r.json()).list || []));
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const toggle = (id: number) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleAll = () => {
    if (selected.size === connections.length) setSelected(new Set());
    else setSelected(new Set(connections.map((c: Conn) => c.id)));
  };

  const confirmSubmit = () => {
    if (!form.title || !form.task_requirements || !form.delivery_standards || !form.deadline) { setErr("请填写所有必填字段"); return; }
    if (selected.size === 0) { setErr("请至少勾选一个达人"); return; }
    if (!window.confirm(`确认向 ${selected.size} 位达人批量派单？`)) return;
    submit();
  };
  const submit = async () => {
    setSending(true);
    try {
      const r = await fetchWithAuth("/api/client/connection-orders/batch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connection_ids: [...selected], ...form })
      });
      const data = await r.json();
      setMsg(`批量派单成功！共 ${data.success_count} 条`);
      setTimeout(() => nav("/client/vertical-connections/my/orders"), 1500);
    } catch (e: any) { setErr(e.message); }
    finally { setSending(false); }
  };

  const si: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #dbe1ea", borderRadius: 8, boxSizing: "border-box" };

  return (
    <div>
      <button onClick={() => nav("/client/vertical-connections/my/orders")} style={{ padding: "6px 12px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer", marginBottom: 12 }}>← 返回订单列表</button>
      <h2 style={{ marginTop: 0 }}>批量派单</h2>
      {msg && <p style={{ color: "#166534", fontWeight: 700 }}>{msg}</p>}
      {err && <p style={{ color: "#c00" }}>{err}</p>}

      {loading ? <p>加载中...</p> : connections.length === 0 ? <p style={{ color: "#64748b" }}>暂无建联中的达人</p> : (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={{ cursor: "pointer", fontSize: 13 }}>
              <input type="checkbox" checked={selected.size === connections.length && connections.length > 0} onChange={toggleAll} />
              {" "}全选（{selected.size}/{connections.length}）
            </label>
          </div>

          {connections.map((c: Conn) => (
            <div key={c.id} style={{ background: "#fff", borderRadius: 10, padding: 10, marginBottom: 6, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
              <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} style={{ width: 18, height: 18 }} />
              <div style={{ flex: 1 }}>
                <strong>{c.influencer_code || c.influencer_username || `达人#${c.influencer_id}`}</strong>
                <span style={{ marginLeft: 8, fontSize: 13, color: "#64748b" }}>{c.category} | {c.grade || "-"}</span>
                {c.brief && <span style={{ marginLeft: 8, fontSize: 12, color: "#94a3b8" }}>{c.brief}</span>}
              </div>
            </div>
          ))}

          <div style={{ background: "#fff", borderRadius: 12, padding: 20, marginTop: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", maxWidth: 600 }}>
            <h3 style={{ marginTop: 0 }}>统一任务信息</h3>
            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 10, alignItems: "center" }}>
              <label>任务标题*</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={si} />
              <label>任务要求*</label><textarea value={form.task_requirements} onChange={e => setForm(f => ({ ...f, task_requirements: e.target.value }))} style={si} rows={3} />
              <label>交付标准*</label><textarea value={form.delivery_standards} onChange={e => setForm(f => ({ ...f, delivery_standards: e.target.value }))} style={si} rows={3} />
              <label>截止时间*</label><input type="datetime-local" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} style={si} />
              <label>提交方式</label><input value={form.submission_types} onChange={e => setForm(f => ({ ...f, submission_types: e.target.value }))} style={si} placeholder="link,video,image" />
            </div>
            <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>金额将自动取各达人的单独报价</p>
            <button onClick={confirmSubmit} disabled={sending} style={{ marginTop: 12, padding: "10px 24px", border: "none", borderRadius: 8, background: sending ? "#94a3b8" : "var(--xt-accent)", color: "#fff", cursor: sending ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 15 }}>{sending ? "派单中..." : `批量派单（${selected.size}个达人）`}</button>
          </div>
        </>
      )}
    </div>
  );
}
