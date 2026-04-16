import type { ReactNode } from "react";

type SkuTableCellProps = {
  /** 规范化后的 sku_codes */
  codes: string[];
};

/**
 * 订单列表「SKU信息」列：紧凑展示编码/名称，多条时显示条数提示。
 */
export function SkuTableCell({ codes }: SkuTableCellProps): ReactNode {
  if (!codes.length) {
    return <span style={{ color: "#94a3b8" }}>—</span>;
  }
  const maxLines = 3;
  const lines = codes.slice(0, maxLines);
  const rest = codes.length - lines.length;
  return (
    <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
      {rest > 0 && <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>…共 {codes.length} 项</div>}
    </div>
  );
}

type SkuDetailBlockProps = {
  codes: string[];
  ids: number[];
  images: string[];
};

/**
 * 订单详情抽屉内「SKU信息」区块：列表 + 关联 ID + 缩略图。
 */
export function SkuDetailBlock({ codes, ids, images }: SkuDetailBlockProps): ReactNode {
  const hasAny = codes.length > 0 || ids.length > 0 || images.length > 0;
  if (!hasAny) {
    return <span style={{ color: "#94a3b8" }}>—</span>;
  }
  return (
    <div>
      {codes.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: "#334155" }}>
          {codes.map((line, i) => (
            <li key={i} style={{ marginBottom: 6 }}>
              {line}
            </li>
          ))}
        </ul>
      )}
      {ids.length > 0 && (
        <div style={{ marginTop: codes.length ? 8 : 0, fontSize: 13, color: "#64748b" }}>
          关联 SKU ID：{ids.join("、")}
        </div>
      )}
      {images.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {images.slice(0, 12).map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noreferrer">
              <img src={url} alt="" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 6, border: "1px solid #e2e8f0" }} />
            </a>
          ))}
          {images.length > 12 && <span style={{ fontSize: 12, color: "#64748b", alignSelf: "center" }}>…等共 {images.length} 张</span>}
        </div>
      )}
    </div>
  );
}
