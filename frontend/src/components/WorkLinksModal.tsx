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
};

/**
 * 订单「多条交付链接」只读弹窗：列表页统一用「查看链接」呼出。
 */
export default function WorkLinksModal({ open, onClose, title = "交付链接", links }: WorkLinksModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

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
          maxWidth: 480,
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
        {links.length === 0 ? (
          <p style={{ margin: 0, color: "#94a3b8", fontSize: 14 }}>暂无链接</p>
        ) : (
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "#334155" }}>
            {links.map((u, i) => (
              <li key={`${i}-${u.slice(0, 24)}`} style={{ marginBottom: 10, wordBreak: "break-all" }}>
                <a href={u} target="_blank" rel="noreferrer">
                  {u}
                </a>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
