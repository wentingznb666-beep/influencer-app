import { compactPx } from "../responsive";

type LoadingSpinnerProps = {
  /** 提示文字，默认「加载中…」 */
  text?: string;
  /** 整体尺寸，small 用于内联，normal 用于页面 */
  size?: "small" | "normal";
};

/**
 * 通用加载旋转指示器，替代纯文字「加载中…」。
 */
export default function LoadingSpinner({ text = "加载中…", size = "normal" }: LoadingSpinnerProps) {
  const dim = size === "small" ? compactPx(16) : compactPx(24);
  const border = size === "small" ? 2 : 3;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: compactPx(10), padding: size === "small" ? compactPx(8) : compactPx(32) }}>
      <div
        style={{
          width: dim,
          height: dim,
          border: `${border}px solid #e2e8f0`,
          borderTopColor: "var(--xt-accent, #e07020)",
          borderRadius: "50%",
          animation: "xt-spin 0.7s linear infinite",
        }}
      />
      <span style={{ fontSize: size === "small" ? compactPx(13) : compactPx(14), color: "#64748b" }}>{text}</span>
    </div>
  );
}
