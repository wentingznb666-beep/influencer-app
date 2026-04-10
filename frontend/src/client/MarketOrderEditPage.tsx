import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as api from "../clientApi";

type MarketOrderItem = {
  id: number;
  order_no: string | null;
  title: string | null;
  tier: "A" | "B" | "C" | string;
  publish_method?: "client_self_publish" | "influencer_publish_with_cart" | string;
  voice_link?: string | null;
  voice_note?: string | null;
  tiktok_link?: string | null;
  client_shop_name?: string | null;
  client_group_chat?: string | null;
  product_images?: string[] | null;
  status: string;
  created_at: string;
};

/**
 * 客户端发单编辑页：仅用于回显并提交更新（后端会校验仅 open 可编辑）。
 */
export default function MarketOrderEditPage() {
  const { id } = useParams();
  const orderId = Number(id);
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<MarketOrderItem | null>(null);
  const [form, setForm] = useState({
    title: "",
    client_shop_name: "",
    client_group_chat: "",
    tier: "C" as "C" | "B" | "A",
    publish_method: "client_self_publish" as "client_self_publish" | "influencer_publish_with_cart",
    voice_link: "",
    voice_note: "",
    tiktok_link: "",
    product_images_text: "",
  });

  useEffect(() => {
    if (!Number.isInteger(orderId) || orderId < 1) {
      setError("无效的订单 ID。");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    (async () => {
      const data = await api.getMarketOrderDetail(orderId);
      const it = (data?.item || null) as MarketOrderItem | null;
      if (!it) throw new Error("订单不存在");
      setItem(it);
      setForm({
        title: it.title || "",

        client_shop_name: (it.client_shop_name || "") as any,
        client_group_chat: (it.client_group_chat || "") as any,
        tier: (String(it.tier || "C").toUpperCase() as any) === "A" ? "A" : (String(it.tier || "C").toUpperCase() as any) === "B" ? "B" : "C",
        publish_method: String(it.publish_method || "client_self_publish") === "influencer_publish_with_cart" ? "influencer_publish_with_cart" : "client_self_publish",
        voice_link: (it.voice_link || "") as any,
        voice_note: (it.voice_note || "") as any,
        tiktok_link: (it.tiktok_link || "") as any,
        product_images_text: Array.isArray(it.product_images) ? it.product_images.join("\n") : "",
      });
    })()
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [orderId]);

  /**
   * 提交更新：字段与创建页一致，不改变业务含义。
   */
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!item) return;
    setError(null);
    if (!form.client_shop_name.trim()) {
      setError("请输入客户店铺名称");
      return;
    }
    if (!form.client_group_chat.trim()) {
      setError("请输入客户对接群聊（群号/链接）");
      return;
    }
    const titleText = form.title.trim();
    if (!titleText || titleText.length > 200) {
      setError("请填写订单标题（1–200 字）。");
      return;
    }
    try {
      await api.updateMarketOrder(item.id, {
        title: titleText,
        client_shop_name: form.client_shop_name.trim(),
        client_group_chat: form.client_group_chat.trim(),
        tier: form.tier,
        publish_method: form.publish_method,
        voice_link: form.tier === "A" ? (form.voice_link.trim() || undefined) : undefined,
        voice_note: form.tier === "A" ? (form.voice_note.trim() || undefined) : undefined,
        tiktok_link: form.tiktok_link.trim() || undefined,
        product_images: form.product_images_text
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 20),
      });
      nav("/client/market-orders", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    }
  };

  return (
    <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 10px 24px rgba(15,23,42,0.08)", padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>编辑发单</h2>
        <button type="button" onClick={() => nav(-1)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}>
          返回
        </button>
      </div>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      {loading ? (
        <p>加载中…</p>
      ) : item ? (
        <form onSubmit={onSubmit} style={{ marginTop: 14 }}>
          <div style={{ marginBottom: 10 }}>
            <label>订单标题（必填，1–200 字）</label>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} maxLength={200} style={{ display: "block", marginTop: 6, width: "100%", maxWidth: 520, padding: "8px 10px", borderRadius: 10, border: "1px solid #e2e8f0", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label>客户店铺名称（必填）</label>
            <input value={form.client_shop_name} onChange={(e) => setForm((f) => ({ ...f, client_shop_name: e.target.value }))} style={{ display: "block", marginTop: 6, width: "100%", maxWidth: 520, padding: "8px 10px", borderRadius: 10, border: "1px solid #e2e8f0", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label>客户对接群聊（必填）</label>
            <input value={form.client_group_chat} onChange={(e) => setForm((f) => ({ ...f, client_group_chat: e.target.value }))} placeholder="群号或链接" style={{ display: "block", marginTop: 6, width: "100%", maxWidth: 520, padding: "8px 10px", borderRadius: 10, border: "1px solid #e2e8f0", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label>订单档位</label>
            <select value={form.tier} onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value as any }))} style={{ display: "block", marginTop: 6, width: "100%", maxWidth: 240, padding: "8px 10px", borderRadius: 10, border: "1px solid #e2e8f0", boxSizing: "border-box", background: "#fff" }}>
              <option value="C">C 类</option>
              <option value="B">B 类</option>
              <option value="A">A 类</option>
            </select>
          </div>
          {form.tier === "A" && (
            <>
              <div style={{ marginBottom: 10 }}>
                <label>配音素材下载链接（可选）</label>
                <input value={form.voice_link} onChange={(e) => setForm((f) => ({ ...f, voice_link: e.target.value }))} style={{ display: "block", marginTop: 6, width: "100%", maxWidth: 520, padding: "8px 10px", borderRadius: 10, border: "1px solid #e2e8f0", boxSizing: "border-box" }} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label>配音要求备注（可选）</label>
                <textarea value={form.voice_note} onChange={(e) => setForm((f) => ({ ...f, voice_note: e.target.value }))} rows={3} style={{ display: "block", marginTop: 6, width: "100%", maxWidth: 520, padding: "8px 10px", borderRadius: 10, border: "1px solid #e2e8f0", boxSizing: "border-box" }} />
              </div>
            </>
          )}
          <div style={{ marginBottom: 10 }}>
            <label>TikTok 链接（可选）</label>
            <input value={form.tiktok_link} onChange={(e) => setForm((f) => ({ ...f, tiktok_link: e.target.value }))} style={{ display: "block", marginTop: 6, width: "100%", maxWidth: 520, padding: "8px 10px", borderRadius: 10, border: "1px solid #e2e8f0", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label>商品图片（多图，每行一个链接）</label>
            <textarea
              rows={4}
              value={form.product_images_text}
              onChange={(e) => setForm((f) => ({ ...f, product_images_text: e.target.value }))}
              placeholder={"https://img1...\nhttps://img2..."}
              style={{ display: "block", marginTop: 6, width: "100%", maxWidth: 520, padding: "8px 10px", borderRadius: 10, border: "1px solid #e2e8f0", boxSizing: "border-box" }}
            />
          </div>
          <button type="submit" style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: "var(--xt-accent)", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
            保存
          </button>
        </form>
      ) : (
        <p style={{ color: "#666" }}>订单不存在</p>
      )}
    </div>
  );
}

