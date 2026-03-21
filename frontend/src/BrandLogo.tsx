import type { CSSProperties } from "react";

type BrandLogoProps = {
  /** 徽标高度（像素），宽度随比例自适应 */
  height?: number;
  /** 可选：覆盖外层样式 */
  style?: CSSProperties;
};

/**
 * 湘泰国际（XIANGTAI）品牌徽标，资源文件位于 `public/xiangtai-logo.png`。
 */
export function BrandLogo({ height = 40, style }: BrandLogoProps) {
  return (
    <img
      src="/xiangtai-logo.png"
      alt="湘泰国际 XIANGTAI"
      width={undefined}
      height={undefined}
      style={{
        height,
        width: "auto",
        maxWidth: "100%",
        objectFit: "contain",
        display: "block",
        ...style,
      }}
    />
  );
}
