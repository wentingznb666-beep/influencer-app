import { useEffect, useState } from "react";
import * as api from "../adminApi";

type Row = {
  id: number;
  client_id: number;
  client_username: string;
  sku_code: string;
  sku_name: string | null;
  sku_images: string[] | null;
  created_at: string;
  updated_at: string;
};
type ClientOption = { id: number; username: string };

/**
 * 管理员/员工 SKU 列表：只读查看与搜索。
 */
export default function AdminSkusPage() {
  const [list, setList] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [clientList, setClientList] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState<number | "">("");

  /**
   * 拉取 SKU 列表。
   */
  const load = async (nextQ?: string, nextClientId?: number | "") => {
    setLoading(true);
    setError(null);
    try {
      const currentClientId = nextClientId ?? clientId;
      const data = await api.getAdminSkus({
        q: (nextQ ?? q).trim() || undefined,
        client_id: currentClientId === "" ? undefined : currentClientId,
      });
      setList((data.list || []) as Row[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 拉取商家下拉数据。
   */
  const loadClients = async () => {
    try {
      const data = await api.getAdminSkuClients();
      setClientList((data.list || []) as ClientOption[]);
    } catch {
      setClientList([]);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>SKU 列表（只读）</h2>
      <p style={{ fontSize: 14, color: "#64748b" }}>支持按商家账号、商家ID、SKU 编码/名称精准搜索。</p>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select
          value={clientId === "" ? "" : String(clientId)}
          onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : "")}
          style={{ padding: "8px 12px", border: "1px solid #dbe1ea", borderRadius: 8, minWidth: 220, background: "#fff" }}
        >
          <option value="">全部商家</option>
          {clientList.map((c) => (
            <option key={c.id} value={c.id}>
              {c.username}（ID:{c.id}）
            </option>
          ))}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索商家账号/ID/SKU编码/名称" style={{ padding: "8px 12px", border: "1px solid #dbe1ea", borderRadius: 8, minWidth: 300 }} />
        <button type="button" onClick={() => load(q, clientId)} style={{ padding: "8px 14px", border: "none", borderRadius: 8, background: "var(--xt-accent)", color: "#fff", cursor: "pointer" }}>
          搜索
        </button>
        <button
          type="button"
          onClick={() => {
            setQ("");
            setClientId("");
            load("", "");
          }}
          style={{ padding: "8px 14px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer" }}
        >
          清空
        </button>
      </div>
      {loading ? (
        <p>加载中…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {list.map((s) => (
            <div key={s.id} style={{ background: "#fff", borderRadius: 10, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                商家：{s.client_username}（ID:{s.client_id}）
              </div>
              <div style={{ marginTop: 4 }}>
                <strong>{s.sku_code}</strong>
                {s.sku_name ? ` / ${s.sku_name}` : ""}
              </div>
              {Array.isArray(s.sku_images) && s.sku_images.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {s.sku_images.slice(0, 8).map((url, idx) => (
                    <a key={`${s.id}-${idx}`} href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt={`admin-sku-${s.id}-${idx}`} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6, border: "1px solid #eee" }} />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
          {list.length === 0 && <p style={{ color: "#666" }}>暂无记录</p>}
        </div>
      )}
    </div>
  );
}

