import { useEffect } from "react";

type WorkLinksModalProps = {
  /** 是否显示弹层 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 弹窗标题 */
  title?: string;
  /** 链接列表 */
  links: string[];
  /** 达人名称（可选） */
  influencerName?: string;
};

/**
 * 订单「多条交付链接」弹窗：显示达人信息 + 链接列表 + 复制 + 打开。
 */
export default function WorkLinksModal({ open, onClose, title = "交付链接", links, influencerName }: WorkLinksModalProps) {

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 10px 40px rgba(15,23,42,0.2)",
          maxWidth: 520,
          width: "100%",
          maxHeight: "70vh",
          overflow: "auto",
          padding: 20,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
          <button type="button" onClick={onClose} style={{ padding: "6px 10px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer" }}>
            关闭
          </button>
        </div>

        {influencerName ? (
          <div style={{ marginBottom: 12, padding: "8px 12px", background: "#f0fdf4", borderRadius: 8, fontSize: 14, fontWeight: 600 }}>
            达人：{influencerName}
          </div>
        ) : null}

        {links.length === 0 ? (
          <p style={{ margin: 0, color: "#94a3b8", fontSize: 14 }}>暂无链接</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {links.map((u, i) => (
              <div key={`${i}-${u.slice(0, 24)}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <span style={{ flex: 1, fontSize: 13, wordBreak: "break-all", minWidth: 0 }}>
                  <a href={u} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>
                    {u}
                  </a>
                </span>
                <button
                  type="button"
                  onClick={() => copyText(u)}
                  style={{ padding: "4px 10px", fontSize: 12, border: "1px solid #dbe1ea", borderRadius: 6, background: "#fff", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  复制
                </button>
                <a
                  href={u}
                  target="_blank"
                  rel="noreferrer"
                  style={{ padding: "4px 10px", fontSize: 12, border: "1px solid #2563eb", borderRadius: 6, background: "#2563eb", color: "#fff", textDecoration: "none", whiteSpace: "nowrap" }}
                >
                  打开
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
