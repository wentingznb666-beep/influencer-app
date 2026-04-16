import path from "path";
import fs from "fs";

/**
 * 解析本地上传根目录（磁盘上直接包含 models/、skus/ 等子目录）。
 * 生产环境（如 Render）默认使用临时盘，重启后文件会丢失；应挂载持久磁盘并设置 UPLOADS_ROOT 指向挂载点。
 */
export function getUploadsRoot(): string {
  const fromEnv = process.env.UPLOADS_ROOT?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(process.cwd(), "uploads");
}

/**
 * 启动时创建上传子目录，避免首次写入失败。
 */
export function ensureUploadsSubdirs(): void {
  const root = getUploadsRoot();
  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(path.join(root, "models"), { recursive: true });
  fs.mkdirSync(path.join(root, "skus"), { recursive: true });
}

/**
 * 从公开 URL 解析 pathname 后，映射为磁盘绝对路径（与 express.static 根目录一致）。
 */
export function diskPathFromUploadsUrlPath(pathname: string): string | null {
  const p = pathname.split("?")[0] ?? "";
  if (!p.startsWith("/uploads/")) return null;
  const rel = p.slice("/uploads".length).replace(/^\/+/, "");
  if (!rel || rel.includes("..")) return null;
  return path.join(getUploadsRoot(), rel);
}

/**
 * 将完整图片 URL（含 http(s) 或相对路径）转为磁盘路径，供删除文件使用。
 */
export function diskPathFromPublicImageUrl(url: string): string | null {
  try {
    const pathname =
      (url.trim().startsWith("/") ? url.trim().split("?")[0] : new URL(url).pathname) ?? "";
    return diskPathFromUploadsUrlPath(pathname);
  } catch {
    return null;
  }
}
