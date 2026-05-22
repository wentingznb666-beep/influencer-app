import { Router, Response } from "express";
import { query, withTx } from "../db";
import { requireAuth, requireRole, type AuthRequest } from "../auth";
import { recordOperationLogTx } from "../operationLog";
import multer from "multer";
import * as xlsx from "xlsx";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import path from "path";
import fs from "fs/promises";
import { getUploadsRoot } from "../uploadsConfig";
import { normalizeProductImages } from "./client";
import { getUserFriendlyError } from "../userFriendlyError";

const router = Router();
router.use(requireAuth);
router.use(requireRole("client"));

/** 单张 SKU 图片最大体积（与前端提示一致）。 */
const SKU_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const SKU_ZIP_MAX_ENTRIES = 1000;
const SKU_ZIP_MAX_IMAGES = 500;
const SKU_ZIP_MAX_UNCOMPRESSED_BYTES = 80 * 1024 * 1024;
const SKU_ZIP_MAX_EXCEL_BYTES = 20 * 1024 * 1024;
const ALLOWED_SKU_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const skuUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: SKU_UPLOAD_MAX_BYTES, files: 20 },
});

/**
 * 按 MIME 推断文件扩展名。
 */
function extByMime(mime: string): string | null {
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  return null;
}

function isAllowedImageBuffer(buffer: Buffer, ext: string): boolean {
  if (ext === ".jpg" || ext === ".jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (ext === ".png") return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (ext === ".webp") return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

function getZipEntrySize(entry: any): number {
  return Number(entry?._data?.uncompressedSize || entry?._data?.compressedSize || 0) || 0;
}

function validateZipEntries(entries: any[]): { ok: true } | { ok: false; message: string } {
  if (entries.length > SKU_ZIP_MAX_ENTRIES) return { ok: false, message: `ZIP 文件数量不能超过 ${SKU_ZIP_MAX_ENTRIES} 个。` };
  const estimatedTotal = entries.reduce((sum, entry) => sum + getZipEntrySize(entry), 0);
  if (estimatedTotal > SKU_ZIP_MAX_UNCOMPRESSED_BYTES) return { ok: false, message: "ZIP 解压后内容过大。" };
  return { ok: true };
}

/**
 * POST /api/client/skus/upload
 * 本地图片上传：multipart/form-data，字段名 files，返回可访问 URL。
 */
router.post("/skus/upload", (req: AuthRequest, res: Response) => {
  skuUpload.array("files", 20)(req as any, res as any, (uploadErr: unknown) => {
    if (uploadErr) {
      const msg = uploadErr instanceof Error ? uploadErr.message : "上传失败";
      const isSize = msg.toLowerCase().includes("file too large");
      res.status(400).json({ error: isSize ? "IMAGE_TOO_LARGE" : "INVALID_UPLOAD", message: isSize ? "单张图片不能超过 10MB。" : msg });
      return;
    }
    const clientId = req.user!.userId;
    (async () => {
      const files = (req.files || []) as Express.Multer.File[];
      if (files.length === 0) {
        res.status(400).json({ error: "INVALID_INPUT", message: "请至少上传一张图片。" });
        return;
      }
      const uploadDir = path.join(getUploadsRoot(), "skus", String(clientId));
      await fs.mkdir(uploadDir, { recursive: true });
      const urls: string[] = [];
      for (const file of files) {
        if (!ALLOWED_SKU_IMAGE_MIME.has(file.mimetype)) {
          res.status(400).json({ error: "INVALID_IMAGE_TYPE", message: "仅支持 jpg/png/webp 图片。" });
          return;
        }
        if (file.size > SKU_UPLOAD_MAX_BYTES) {
          res.status(400).json({ error: "IMAGE_TOO_LARGE", message: "单张图片不能超过 10MB。" });
          return;
        }
        const ext = extByMime(file.mimetype);
        if (!ext) {
          res.status(400).json({ error: "INVALID_IMAGE_TYPE", message: "图片格式不支持。" });
          return;
        }
        if (!isAllowedImageBuffer(file.buffer, ext)) {
          res.status(400).json({ error: "INVALID_IMAGE_CONTENT", message: "图片内容与格式不匹配。" });
          return;
        }
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
        const filepath = path.join(uploadDir, filename);
        await fs.writeFile(filepath, file.buffer);
        urls.push(`/uploads/skus/${clientId}/${filename}`);
      }
      res.status(201).json({ urls });
    })().catch((e) => {
      console.error("client skus upload error:", e);
      res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });
    });
  });
});

/**
 * GET /api/client/skus
 * 当前商家的 SKU 列表。
 */
router.get("/skus", (req: AuthRequest, res: Response) => {
  const clientId = req.user!.userId;
  (async () => {
    const { rows } = await query(
      `SELECT id, sku_code, sku_name, sku_images, created_at, updated_at
         FROM client_skus
        WHERE client_id = $1 AND is_deleted = 0
        ORDER BY id DESC
        LIMIT 500`,
      [clientId]
    );
    res.json({ list: rows });
  })().catch((e) => {
    console.error("client skus list error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });
  });
});

/**
 * POST /api/client/skus
 * 新增 SKU。
 */
router.post("/skus", (req: AuthRequest, res: Response) => {
  const clientId = req.user!.userId;
  const { sku_code, sku_name, sku_images } = req.body ?? {};
  const skuCode = sku_code != null ? String(sku_code).trim() : "";
  const skuName = sku_name != null ? String(sku_name).trim() : "";
  const images = normalizeProductImages(sku_images);
  if (!skuCode || skuCode.length > 120) {
    res.status(400).json({ error: "INVALID_SKU", message: "请填写有效 SKU 编码（1-120）。" });
    return;
  }
  (async () => {
    const created = await withTx(async (client) => {
      const ins = await client.query<{ id: number }>(
        `INSERT INTO client_skus (client_id, sku_code, sku_name, sku_images)
         VALUES ($1, $2, $3, $4::jsonb) RETURNING id`,
        [clientId, skuCode, skuName || null, JSON.stringify(images)]
      );
      await recordOperationLogTx(client, { userId: clientId, actionType: "create", targetType: "task", targetId: ins.rows[0]!.id });
      return ins.rows[0]!.id;
    });
    res.status(201).json({ id: created });
  })().catch((e) => {
    console.error("client skus create error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });
  });
});

/**
 * PATCH /api/client/skus/:id
 * 编辑 SKU。
 */
router.patch("/skus/:id", (req: AuthRequest, res: Response) => {
  const clientId = req.user!.userId;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的 SKU ID。" });
    return;
  }
  const { sku_code, sku_name, sku_images } = req.body ?? {};
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;
  if (sku_code !== undefined) {
    const skuCode = String(sku_code ?? "").trim();
    if (!skuCode || skuCode.length > 120) {
      res.status(400).json({ error: "INVALID_SKU", message: "请填写有效 SKU 编码（1-120）。" });
      return;
    }
    sets.push(`sku_code = $${idx++}`);
    params.push(skuCode);
  }
  if (sku_name !== undefined) {
    const skuName = String(sku_name ?? "").trim();
    sets.push(`sku_name = $${idx++}`);
    params.push(skuName || null);
  }
  if (sku_images !== undefined) {
    sets.push(`sku_images = $${idx++}::jsonb`);
    params.push(JSON.stringify(normalizeProductImages(sku_images)));
  }
  if (sets.length === 0) {
    res.json({ ok: true });
    return;
  }
  (async () => {
    await withTx(async (client) => {
      sets.push(`updated_at = now()`);
      params.push(id, clientId);
      const updated = await client.query<{ id: number }>(
        `UPDATE client_skus SET ${sets.join(", ")}
         WHERE id = $${idx++} AND client_id = $${idx++} AND is_deleted = 0 RETURNING id`,
        params
      );
      if (!updated.rows[0]) {
        res.status(404).json({ error: "NOT_FOUND", message: "SKU 不存在。" });
        return;
      }
      await recordOperationLogTx(client, { userId: clientId, actionType: "edit", targetType: "task", targetId: id });
      res.json({ ok: true });
    });
  })().catch((e) => {
    console.error("client skus patch error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });
  });
});

/**
 * GET /api/client/skus/import-template
 * 下载 SKU 批量导入模板。
 */
router.get("/skus/import-template", (_req: AuthRequest, res: Response) => {
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet([["sku编码", "sku名称", "sku图片"]]);
  // 设置列宽和行高（方便放入图片）
  (ws as any)["!cols"] = [{ wch: 25 }, { wch: 25 }, { wch: 50 }];
  const rows: any[] = [{ hpt: 30 }]; // 表头行高
  for (let i = 1; i <= 300; i++) rows.push({ hpt: 80 }); // 数据行高
  (ws as any)["!rows"] = rows;

  xlsx.utils.book_append_sheet(wb, ws, "SKUs");

  const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=sku_import_template.xlsx");
  res.send(buf);
});

/**
 * POST /api/client/skus/batch-import
 * 批量导入 SKU。支持 mode: "reject"（遇重复全拒）| "skip"（跳过重复）。
 */
const BATCH_IMPORT_MAX = 500;

const skuBatchUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
});

router.post("/skus/batch-import", skuBatchUpload.single("file"), (req: AuthRequest, res: Response) => {
  const clientId = req.user!.userId;
  const mode = req.body.mode === "skip" ? "skip" : "reject";
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "INVALID_INPUT", message: "请上传文件。" });
    return;
  }
  (async () => {
    // 1. 判断是 ZIP 还是 Excel
    const isZip = file.originalname.toLowerCase().endsWith(".zip");
    let excelBuffer: Buffer;
    let imageMap = new Map<string, { buffer: Buffer; ext: string }[]>(); // skuCode -> images

    if (isZip) {
      // ZIP 模式：解压，找 Excel + 图片
      const zip = await JSZip.loadAsync(file.buffer);
      const allEntries = Object.values(zip.files) as any[];
      const zipValidation = validateZipEntries(allEntries);
      if (!zipValidation.ok) {
        res.status(400).json({ error: "ZIP_TOO_LARGE", message: zipValidation.message });
        return;
      }
      // 找 Excel 文件
      const excelEntry = zip.file(/\.xlsx?$/i).find((e: any) => !e.dir);
      if (!excelEntry) {
        res.status(400).json({ error: "INVALID_INPUT", message: "ZIP 中没有找到 Excel 文件（.xlsx/.xls）。" });
        return;
      }
      if (getZipEntrySize(excelEntry) > SKU_ZIP_MAX_EXCEL_BYTES) {
        res.status(400).json({ error: "EXCEL_TOO_LARGE", message: "Excel 文件过大。" });
        return;
      }
      excelBuffer = await excelEntry.async("nodebuffer");
      if (excelBuffer.length > SKU_ZIP_MAX_EXCEL_BYTES) {
        res.status(400).json({ error: "EXCEL_TOO_LARGE", message: "Excel 文件过大。" });
        return;
      }

      // 找图片文件（images/ 子目录或根目录）
      const imageExts = new Set([".jpg", ".jpeg", ".png", ".webp"]);
      const imageEntries = zip.file(/\.(jpg|jpeg|png|webp)$/i).filter((e: any) => !e.dir);
      if (imageEntries.length > SKU_ZIP_MAX_IMAGES) {
        res.status(400).json({ error: "TOO_MANY_IMAGES", message: `ZIP 图片数量不能超过 ${SKU_ZIP_MAX_IMAGES} 张。` });
        return;
      }

      for (const entry of imageEntries) {
        const name = path.basename(entry.name); // 如 SKU001.jpg, SKU001_2.jpg
        const dotIdx = name.lastIndexOf(".");
        if (dotIdx < 1) continue;
        const nameWithoutExt = name.substring(0, dotIdx);
        const ext = name.substring(dotIdx).toLowerCase();
        if (!imageExts.has(ext)) continue;

        // 解析 skuCode：格式为 "编码" 或 "编码_序号"
        let skuCode = nameWithoutExt;
        const lastUnderscore = nameWithoutExt.lastIndexOf("_");
        if (lastUnderscore > 0) {
          const afterUnderscore = nameWithoutExt.substring(lastUnderscore + 1);
          if (/^\d+$/.test(afterUnderscore)) {
            skuCode = nameWithoutExt.substring(0, lastUnderscore);
          }
        }

        if (getZipEntrySize(entry) > SKU_UPLOAD_MAX_BYTES) continue;
        const buf = await entry.async("nodebuffer");
        if (buf.length > SKU_UPLOAD_MAX_BYTES || !isAllowedImageBuffer(buf, ext)) continue;
        if (!imageMap.has(skuCode)) imageMap.set(skuCode, []);
        imageMap.get(skuCode)!.push({ buffer: buf, ext });
      }
    } else {
      // 普通 Excel 模式
      excelBuffer = file.buffer;
    }

    // 2. 解析 Excel（支持读取内嵌图片）
    let rows: Record<string, unknown>[];

    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(excelBuffer as any);
      const sheet = wb.worksheets[0];
      if (!sheet) {
        res.status(400).json({ error: "INVALID_INPUT", message: "文件中没有找到工作表。" });
        return;
      }

      // 读取表头
      const headerRow = sheet.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell((cell: any, colNumber: number) => {
        headers[colNumber - 1] = String(cell.value ?? "").trim();
      });

      // 读取数据行
      rows = [];
      sheet.eachRow((row: any, rowNumber: number) => {
        if (rowNumber === 1) return; // 跳过表头
        const rowData: Record<string, unknown> = {};
        row.eachCell((cell: any, colNumber: number) => {
          const key = headers[colNumber - 1];
          if (key) rowData[key] = cell.value;
        });
        rows.push(rowData);
      });

      // 提取内嵌图片，按行号/单元格匹配到 SKU 编码
      const images = sheet.getImages();
      const mediaItems = wb.model.media || [];

      // 辅助函数：将 media item 的 buffer 加入 imageMap
      const addMediaToMap = (skuCode: string, mediaItem: any, logTag: string) => {
        if (!skuCode || !mediaItem?.buffer) return false;
        const ext = mediaItem.extension ? `.${mediaItem.extension}` : ".png";
        const buf = Buffer.from(mediaItem.buffer);
        if (!imageMap.has(skuCode)) imageMap.set(skuCode, []);
        imageMap.get(skuCode)!.push({ buffer: buf, ext });
        return true;
      };

      // --- 方式一：浮动图片（通过 sheet.getImages() + array index 匹配 media） ---
      for (let i = 0; i < images.length; i++) {
        const img = images[i]!;
        // ExcelJS 在加载文件时不会给 media 项设置 index，所以 img.imageId 为 undefined。
        // 但加载时图片和 media 按相同顺序解析，直接用数组索引对应。
        const mediaItem = mediaItems[i] as any;
        if (!mediaItem || !mediaItem.buffer) continue;
        const tl = img.range?.tl;
        if (!tl) continue;
        const rowNum = ((tl as any).nativeRow ?? (tl as any).row ?? 0) + 1;
        if (rowNum < 2 || rowNum > rows.length + 1) continue;
        const row = rows[rowNum - 2];
        if (!row) continue;
        const skuCode = (row["sku编码"] ?? row.sku_code) != null ? String(row["sku编码"] ?? row.sku_code).trim() : "";
        if (!skuCode) continue;
        addMediaToMap(skuCode, mediaItem, `浮动图片 #${i} →`);
      }

      // --- 方式二：WPS 单元格内图片（DISPIMG 公式 + cellimages.xml） ---
      // cellimages.xml 在 xlsx 内部，excelBuffer 本身就是 xlsx 文件内容
      if (excelBuffer) {
        try {
          const innerZip = await JSZip.loadAsync(excelBuffer);
          const cellImagesXml = await innerZip.file("xl/cellimages.xml")?.async("string");
          const cellImagesRels = await innerZip.file("xl/_rels/cellimages.xml.rels")?.async("string");
          if (cellImagesXml && cellImagesRels) {
            // 解析 rels：rId → media filename
            const ridToTarget = new Map<string, string>();
            for (const m of cellImagesRels.matchAll(/<Relationship[^>]*Id=\"(rId\d+)\"[^>]*Target=\"([^\"]+)\"/g)) {
              ridToTarget.set(m[1]!, m[2]!);
            }
            // 解析 cellImages：DISPIMG ID → rId
            const idToRid = new Map<string, string>();
            for (const m of cellImagesXml.matchAll(/<xdr:cNvPr[^>]*name=\"([^\"]+)\"/g)) {
              idToRid.set(m[1]!, ""); // 先占位
            }
            // 重新遍历，拿到每个 cellImage 里的 name 和 r:embed
            const cellImageBlocks = cellImagesXml.matchAll(/<etc:cellImage>([\s\S]*?)<\/etc:cellImage>/g);
            for (const block of cellImageBlocks) {
              const nameMatch = block[1]!.match(/<xdr:cNvPr[^>]*name=\"([^\"]+)\"/);
              const embedMatch = block[1]!.match(/r:embed=\"(rId\d+)\"/);
              if (nameMatch && embedMatch) {
                idToRid.set(nameMatch[1]!, embedMatch[1]!);
              }
            }
            // 构建 DISPIMG ID → media 文件名（不含路径）的映射
            const dispimgToMediaName = new Map<string, string>();
            for (const [id, rid] of idToRid) {
              const target = ridToTarget.get(rid);
              if (target) {
                const basename = target.replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, ""); // "media/image1.jpeg" → "image1"
                dispimgToMediaName.set(id, basename);
              }
            }
            console.info(`[batch-import] cellimages 解析完成，共 ${dispimgToMediaName.size} 个图片映射`);
            // 扫描数据行，匹配 DISPIMG 公式
            for (let i = 0; i < rows.length; i++) {
              const r = rows[i] as Record<string, unknown>;
              const skuCode = (r["sku编码"] ?? r.sku_code) != null ? String(r["sku编码"] ?? r.sku_code).trim() : "";
              if (!skuCode) continue;
              // 检查所有单元格值，查找 DISPIMG 公式
              for (const val of Object.values(r)) {
                if (val && typeof val === "object" && (val as any).formula) {
                  const formula = (val as any).formula as string;
                  const dispMatch = formula.match(/DISPIMG\("([^"]+)"/);
                  if (dispMatch) {
                    const imgId = dispMatch[1]!;
                    const mediaName = dispimgToMediaName.get(imgId);
                    if (mediaName) {
                      const mediaItem = mediaItems.find((m: any) => m.name === mediaName);
                      if (mediaItem) {
                        addMediaToMap(skuCode, mediaItem, `单元格图片(${imgId}) →`);
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (cellImgErr) {
          console.error("[batch-import] 解析 cellimages.xml 失败:", cellImgErr);
        }
      }

    } catch (parseErr: any) {
      console.error("[batch-import] Excel 解析失败:", parseErr?.message ?? parseErr);
      res.status(400).json({ error: "INVALID_INPUT", message: "无法解析文件，请确认是有效的 Excel 或 CSV 文件。" });
      return;
    }

    if (rows.length === 0) {
      res.status(400).json({ error: "INVALID_INPUT", message: "文件中没有数据行。" });
      return;
    }

    if (rows.length > BATCH_IMPORT_MAX) {
      res.status(400).json({ error: "INVALID_INPUT", message: `单次最多导入 ${BATCH_IMPORT_MAX} 条，当前 ${rows.length} 条。` });
      return;
    }

    // 3. 校验 + 文件内去重
    const errors: { row: number; sku_code: string; reason: string }[] = [];
    const valid: { sku_code: string; sku_name: string | null }[] = [];
    const seenInFile = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] as Record<string, unknown>;
      const rawCode = (r["sku编码"] ?? r.sku_code) != null ? String(r["sku编码"] ?? r.sku_code).trim() : "";
      const rawName = (r["sku名称"] ?? r.sku_name) != null ? String(r["sku名称"] ?? r.sku_name).trim() : "";

      const rowNum = i + 2;
      if (!rawCode) {
        errors.push({ row: rowNum, sku_code: "", reason: "sku编码 为空" });
        continue;
      }
      if (rawCode.length > 120) {
        errors.push({ row: rowNum, sku_code: rawCode, reason: "sku编码 超过 120 字符" });
        continue;
      }
      if (seenInFile.has(rawCode)) {
        errors.push({ row: rowNum, sku_code: rawCode, reason: "文件内重复" });
        continue;
      }
      seenInFile.add(rawCode);
      valid.push({ sku_code: rawCode, sku_name: rawName || null });
    }

    // 4. 查询系统中已有的 sku_code
    const existingRes = await query<{ sku_code: string }>(
      `SELECT sku_code FROM client_skus WHERE client_id = $1 AND is_deleted = 0`,
      [clientId]
    );
    const existingCodes = new Set(existingRes.rows.map((r) => r.sku_code));

    // 5. 处理重复
    const toInsert: { sku_code: string; sku_name: string | null }[] = [];
    let skipped = 0;
    for (const item of valid) {
      if (existingCodes.has(item.sku_code)) {
        if (mode === "reject") {
          errors.push({ row: 0, sku_code: item.sku_code, reason: "系统中已存在" });
        } else {
          skipped++;
        }
      } else {
        toInsert.push(item);
      }
    }

    // reject 模式下有重复则整体拒绝
    if (mode === "reject" && errors.length > 0) {
      res.status(409).json({
        error: "DUPLICATE_SKUS",
        message: `发现 ${errors.length} 条重复或无效记录，已拒绝导入。`,
        success: 0,
        skipped: 0,
        errors,
      });
      return;
    }

    // 6. 批量插入 + 保存图片
    let success = 0;
    let imagesImported = 0;

    if (toInsert.length > 0) {
      const uploadDir = path.join(getUploadsRoot(), "skus", String(clientId));
      await fs.mkdir(uploadDir, { recursive: true });

      await withTx(async (dbClient) => {
        for (const item of toInsert) {
          const ins = await dbClient.query<{ id: number }>(
            `INSERT INTO client_skus (client_id, sku_code, sku_name) VALUES ($1, $2, $3) RETURNING id`,
            [clientId, item.sku_code, item.sku_name]
          );
          const skuId = ins.rows[0]!.id;

          // 匹配图片
          const images = imageMap.get(item.sku_code);
          if (images && images.length > 0) {
            const urls: string[] = [];
            for (const img of images) {
              const allowedMime: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
              const mime = allowedMime[img.ext];
              if (!mime) continue;
              const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${img.ext}`;
              await fs.writeFile(path.join(uploadDir, filename), img.buffer);
              urls.push(`/uploads/skus/${clientId}/${filename}`);
              imagesImported++;
            }
            if (urls.length > 0) {
              await dbClient.query(
                `UPDATE client_skus SET sku_images = $1::jsonb, updated_at = now() WHERE id = $2`,
                [JSON.stringify(urls), skuId]
              );
            }
          }

          success++;
        }
      });
    }

    console.info(`[batch-import] 导入完成: success=${success}, skipped=${skipped}, imagesImported=${imagesImported}, errors=${errors.length}`);
    res.json({ success, skipped, errors, imagesImported });
  })().catch((e) => {
    console.error("client skus batch-import error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });
  });
});

/**
 * POST /api/client/skus/batch-images
 * 批量上传图片，按文件名匹配到已有 SKU。
 * 文件名格式：编码.jpg 或 编码_序号.jpg
 */
const skuBatchImagesUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 50 },
});

router.post("/skus/batch-images", skuBatchImagesUpload.array("files", 50), (req: AuthRequest, res: Response) => {
  const clientId = req.user!.userId;
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    res.status(400).json({ error: "INVALID_INPUT", message: "请至少上传一张图片或一个 ZIP 文件。" });
    return;
  }
  (async () => {
    // 1. 查询当前商家所有 active SKU
    const skuRes = await query<{ id: number; sku_code: string; sku_images: unknown }>(
      `SELECT id, sku_code, sku_images FROM client_skus WHERE client_id = $1 AND is_deleted = 0`,
      [clientId]
    );
    const skuMap = new Map<string, { id: number; images: string[] }>();
    for (const row of skuRes.rows) {
      const existing = Array.isArray(row.sku_images) ? row.sku_images as string[] : [];
      skuMap.set(row.sku_code, { id: row.id, images: existing });
    }

    // 2. 收集图片文件（支持直接上传图片 或 上传 ZIP）
    const imageExts = new Set([".jpg", ".jpeg", ".png", ".webp"]);
    const imageFiles: { name: string; buffer: Buffer }[] = [];
    const unmatched: string[] = [];

    for (const file of files) {
      if (file.originalname.toLowerCase().endsWith(".zip")) {
        // 解压 ZIP，提取图片
        const zip = await JSZip.loadAsync(file.buffer);
        const entries = Object.values(zip.files) as any[];
        const zipValidation = validateZipEntries(entries);
        if (!zipValidation.ok) {
          res.status(400).json({ error: "ZIP_TOO_LARGE", message: zipValidation.message });
          return;
        }
        let imageEntryCount = 0;
        for (const entry of entries) {
          if (entry.dir) continue;
          const entryName = String(entry.name || "").toLowerCase();
          const hasImageExt = [".jpg", ".jpeg", ".png", ".webp"].some((ext) => entryName.endsWith(ext));
          if (!hasImageExt) continue;
          imageEntryCount += 1;
          if (imageEntryCount > SKU_ZIP_MAX_IMAGES) {
            res.status(400).json({ error: "TOO_MANY_IMAGES", message: `ZIP 图片数量不能超过 ${SKU_ZIP_MAX_IMAGES} 张。` });
            return;
          }
          if (getZipEntrySize(entry) > SKU_UPLOAD_MAX_BYTES) continue;
          const buf = await entry.async("nodebuffer");
          const ext = path.extname(String(entry.name || "")).toLowerCase();
          if (buf.length > SKU_UPLOAD_MAX_BYTES || !isAllowedImageBuffer(buf, ext)) continue;
          imageFiles.push({ name: path.basename(String(entry.name || "")), buffer: buf });
        }
      } else {
        // 直接的图片文件
        const dotIdx = file.originalname.lastIndexOf(".");
        if (dotIdx < 1) { unmatched.push(file.originalname); continue; }
        const ext = file.originalname.substring(dotIdx).toLowerCase();
        if (!imageExts.has(ext) || !isAllowedImageBuffer(file.buffer, ext)) { unmatched.push(file.originalname); continue; }
        imageFiles.push({ name: file.originalname, buffer: file.buffer });
      }
    }

    // 3. 按文件名分组匹配 SKU
    const fileGroups = new Map<string, { buffer: Buffer; ext: string }[]>();
    for (const img of imageFiles) {
      const dotIdx = img.name.lastIndexOf(".");
      if (dotIdx < 1) { unmatched.push(img.name); continue; }
      const nameWithoutExt = img.name.substring(0, dotIdx);
      const ext = img.name.substring(dotIdx).toLowerCase();

      // 解析 skuCode：格式为 "编码" 或 "编码_序号"
      let skuCode = nameWithoutExt;
      const lastUnderscore = nameWithoutExt.lastIndexOf("_");
      if (lastUnderscore > 0) {
        const afterUnderscore = nameWithoutExt.substring(lastUnderscore + 1);
        if (/^\d+$/.test(afterUnderscore)) {
          skuCode = nameWithoutExt.substring(0, lastUnderscore);
        }
      }

      if (!fileGroups.has(skuCode)) fileGroups.set(skuCode, []);
      fileGroups.get(skuCode)!.push({ buffer: img.buffer, ext });
    }

    // 3. 匹配 + 保存
    const uploadDir = path.join(getUploadsRoot(), "skus", String(clientId));
    await fs.mkdir(uploadDir, { recursive: true });

    let imagesSaved = 0;
    const matchedSkus: string[] = [];
    const notFoundSkus: string[] = [];

    for (const [skuCode, images] of fileGroups) {
      const sku = skuMap.get(skuCode);
      if (!sku) {
        notFoundSkus.push(skuCode);
        continue;
      }

      const newUrls: string[] = [...sku.images];
      for (const img of images) {
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${img.ext}`;
        await fs.writeFile(path.join(uploadDir, filename), img.buffer);
        newUrls.push(`/uploads/skus/${clientId}/${filename}`);
        imagesSaved++;
      }

      // 更新数据库
      await query(
        `UPDATE client_skus SET sku_images = $1::jsonb, updated_at = now() WHERE id = $2`,
        [JSON.stringify(newUrls), sku.id]
      );
      matchedSkus.push(skuCode);
    }

    res.json({ imagesSaved, matchedSkus, notFoundSkus, unmatchedFiles: unmatched });
  })().catch((e) => {
    console.error("client skus batch-images error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });
  });
});


/**
 * DELETE /api/client/skus/batch
 * 批量软删除 SKU。
 */
router.delete("/skus/batch", (req: AuthRequest, res: Response) => {
  const clientId = req.user!.userId;
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50) {
    res.status(400).json({ error: "INVALID_INPUT", message: "请提供要删除的 SKU ID 列表（1-50 个）。" });
    return;
  }
  (async () => {
    await withTx(async (client) => {
      const deleted = await client.query<{ id: number }>(
        `UPDATE client_skus
            SET is_deleted = 1, deleted_at = now(), updated_at = now()
          WHERE id = ANY($1::int[]) AND client_id = $2 AND is_deleted = 0
          RETURNING id`,
        [ids, clientId]
      );
      await recordOperationLogTx(client, { userId: clientId, actionType: "delete", targetType: "task", targetId: 0 });
      res.json({ deleted: deleted.rows.length, deletedIds: deleted.rows.map((r) => r.id) });
    });
  })().catch((e) => {
    console.error("client skus batch-delete error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });
  });
});

/**
 * DELETE /api/client/skus/:id
 * 软删除 SKU。
 */
router.delete("/skus/:id", (req: AuthRequest, res: Response) => {
  const clientId = req.user!.userId;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的 SKU ID。" });
    return;
  }
  (async () => {
    await withTx(async (client) => {
      const updated = await client.query<{ id: number }>(
        `UPDATE client_skus
            SET is_deleted = 1, deleted_at = now(), updated_at = now()
          WHERE id = $1 AND client_id = $2 AND is_deleted = 0
          RETURNING id`,
        [id, clientId]
      );
      if (!updated.rows[0]) {
        res.status(404).json({ error: "NOT_FOUND", message: "SKU 不存在。" });
        return;
      }
      await recordOperationLogTx(client, { userId: clientId, actionType: "delete", targetType: "task", targetId: id });
      res.json({ ok: true });
    });
  })().catch((e) => {
    console.error("client skus delete error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });
  });
});

export default router;
