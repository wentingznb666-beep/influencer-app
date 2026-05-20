import { Router, Response } from "express";

import { query, withTx } from "../db";

import { ensurePointAccountLocked } from "../pointAccounts";

import { allocateMarketOrderNo } from "../marketOrderNo";

import { requireAuth, requireRole, type AuthRequest } from "../auth";
import { COOPERATION_TYPES_CONFIG_KEY } from "../cooperationTypes";

import { recordOperationLogTx } from "../operationLog";

import multer from "multer";
import * as xlsx from "xlsx";
import JSZip from "jszip";
import ExcelJS from "exceljs";

import path from "path";

import fs from "fs/promises";

import { getUploadsRoot } from "../uploadsConfig";



const router = Router();

router.use(requireAuth);

router.use(requireRole("client"));



/** 单张 SKU 图片最大体积（与前端提示一致）。 */

const SKU_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_SKU_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const skuUpload = multer({

  storage: multer.memoryStorage(),

  limits: { fileSize: SKU_UPLOAD_MAX_BYTES, files: 20 },

});



const DEFAULT_MARKET_ORDER_CREATOR_REWARD = 5;

const PUBLISH_METHOD_CLIENT_SELF = "client_self_publish";

const PUBLISH_METHOD_INFLUENCER_CART = "influencer_publish_with_cart";

async function resolveMarketOrderCreatorRewardUnitFromConfig(client: { query: Function }, tier: string): Promise<number> {
  const t = String(tier || "").trim().toUpperCase();
  const fallback = t === "A" ? 15 : t === "B" ? 10 : t === "C" ? 5 : DEFAULT_MARKET_ORDER_CREATOR_REWARD;
  try {
    const row = await client.query("SELECT value FROM config WHERE key=$1", [COOPERATION_TYPES_CONFIG_KEY]);
    const raw = row?.rows?.[0]?.value;
    if (!raw || typeof raw !== "string") return fallback;
    const parsed = JSON.parse(raw) as any;
    const types = Array.isArray(parsed?.types) ? parsed.types : [];
    const graded = types.find((x: any) => x && x.id === "graded_video");
    const partTime = graded?.spec?.pricing_points?.part_time;
    const v = partTime?.[t];
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.floor(n);
  } catch {
    return fallback;
  }
}

async function createMessageToAdminAndEmployeesTx(
  client: { query: Function },
  category: string,
  title: string,
  content: string,
  relatedType?: string,
  relatedId?: number
): Promise<void> {
  try {
    await client.query(
      `INSERT INTO system_messages (user_id, category, title, content, related_type, related_id)
       SELECT u.id, $1, $2, $3, $4, $5
         FROM users u
         JOIN roles r ON r.id=u.role_id
        WHERE u.disabled=0 AND r.name IN ('employee','admin')`,
      [category, title, content, relatedType ?? null, relatedId ?? null]
    );
  } catch (e: any) {
    const code = typeof e?.code === "string" ? e.code : "";
    if (code === "42P01" || code === "42703") return;
    throw e;
  }
}



/**

 * 获取可用于外部访问的文件 URL 根路径。

 */

function getPublicBaseUrl(req: AuthRequest): string {

  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";

  const host = req.get("host") || "localhost:3000";

  return `${proto}://${host}`;

}



/**

 * 按 MIME 推断文件扩展名。

 */

function extByMime(mime: string): string | null {

  if (mime === "image/jpeg") return ".jpg";

  if (mime === "image/png") return ".png";

  if (mime === "image/webp") return ".webp";

  return null;

}



/**

 * 将档位映射为商家支付积分。

 */

function resolveMarketOrderPayPoints(tier: string): { tier: "A" | "B" | "C"; payPoints: number } {

  if (tier === "A") return { tier: "A", payPoints: 60 };

  if (tier === "B") return { tier: "B", payPoints: 40 };

  return { tier: "C", payPoints: 20 };

}



/**

 * 解析多图字段：支持字符串数组，最多 20 条，每条去空白后入库。

 */

function normalizeProductImages(input: unknown): string[] {

  if (!Array.isArray(input)) return [];

  return input

    .filter((x) => typeof x === "string")

    .map((x) => String(x).trim())

    .filter(Boolean)

    .slice(0, 20);

}



/**

 * 解析 SKU 编码/名称数组：支持字符串数组，最多 100 条。

 */

function normalizeSkuCodes(input: unknown): string[] {

  if (!Array.isArray(input)) return [];

  return input

    .filter((x) => typeof x === "string")

    .map((x) => String(x).trim())

    .filter(Boolean)

    .slice(0, 100);

}



/**

 * 解析 SKU ID 列表：仅保留正整数，最多 100 条。

 */

function normalizeSkuIds(input: unknown): number[] {

  if (!Array.isArray(input)) return [];

  const out: number[] = [];

  for (const v of input) {

    const n = Number(v);

    if (Number.isInteger(n) && n > 0) out.push(n);

    if (out.length >= 100) break;

  }

  return out;

}



/**

 * 解析并校验商家店铺名称（必填）。

 */

function normalizeClientShopName(input: unknown): string {

  const value = input != null ? String(input).trim() : "";

  return value;

}



/**

 * 解析并校验商家对接群聊（必填，可为群号或链接）。

 */

function normalizeClientGroupChat(input: unknown): string {

  const value = input != null ? String(input).trim() : "";

  return value;

}



/**

 * 规范化订单发布方式，仅允许固定枚举值。

 */

function normalizePublishMethod(input: unknown): string {

  const value = input != null ? String(input).trim() : "";

  if (value === PUBLISH_METHOD_CLIENT_SELF || value === PUBLISH_METHOD_INFLUENCER_CART) return value;

  return "";

}



/**

 * 解析日期参数（YYYY-MM-DD），非法时返回空字符串。

 */

function normalizeDateOnly(value: unknown): string {

  if (typeof value !== "string") return "";

  const v = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "";

  return v;

}



/**

 * 根据 SKU ID 列表读取当前商家 SKU（用于发单时快照）。

 */

async function resolveSkuSnapshotByIds(clientId: number, skuIds: number[]): Promise<{ ids: number[]; codes: string[]; images: string[] }> {

  if (skuIds.length === 0) return { ids: [], codes: [], images: [] };

  const { rows } = await query<{ id: number; sku_code: string; sku_name: string | null; sku_images: string[] }>(

    `SELECT id, sku_code, sku_name, sku_images

       FROM client_skus

      WHERE client_id = $1 AND is_deleted = 0 AND id = ANY($2::int[])

      ORDER BY id DESC`,

    [clientId, skuIds]

  );

  const ids = rows.map((r) => r.id);

  const codes = rows.map((r) => (r.sku_name ? `${r.sku_code} / ${r.sku_name}` : r.sku_code));

  const images = rows.flatMap((r) => (Array.isArray(r.sku_images) ? r.sku_images : [])).slice(0, 200);

  return { ids, codes, images };

}



/**

 * GET /api/client/requests

 * 当前商家的需求/合作意向列表。

 */

router.get("/requests", (req: AuthRequest, res: Response) => {

  const clientId = req.user!.userId;

  (async () => {

    const { rows } = await query(

      "SELECT id, product_info, target_platform, budget, need_face, status, created_at FROM client_requests WHERE client_id = $1 AND is_deleted = 0 ORDER BY id DESC",

      [clientId]

    );

    res.json({ list: rows });

  })().catch((e) => {

    console.error("client requests list error:", e);

    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  });

});



/**

 * GET /api/client/requests/:id

 * 获取单条合作意向（用于编辑页回显）。

 */

router.get("/requests/:id", (req: AuthRequest, res: Response) => {

  const clientId = req.user!.userId;

  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {

    res.status(400).json({ error: "INVALID_ID", message: "无效的需求 ID。" });

    return;

  }

  (async () => {

    const { rows } = await query(

      "SELECT id, product_info, target_platform, budget, need_face, status, created_at FROM client_requests WHERE id = $1 AND client_id = $2 AND is_deleted = 0",

      [id, clientId]

    );

    const row = rows[0];

    if (!row) {

      res.status(404).json({ error: "NOT_FOUND", message: "需求不存在。" });

      return;

    }

    res.json({ item: row });

  })().catch((e) => {

    console.error("client requests detail error:", e);

    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  });

});



/**

 * POST /api/client/requests

 * 提交合作意向/任务需求。

 */

router.post("/requests", (req: AuthRequest, res: Response) => {

  const clientId = req.user!.userId;

  const { product_info, target_platform, budget, need_face } = req.body ?? {};

  (async () => {

    const created = await withTx(async (client) => {

      const ins = await client.query<{ id: number }>(

        "INSERT INTO client_requests (client_id, product_info, target_platform, budget, need_face, status) VALUES ($1, $2, $3, $4, $5, 'submitted') RETURNING id",

        [clientId, product_info != null ? String(product_info) : null, target_platform != null ? String(target_platform) : null, budget != null ? String(budget) : null, need_face ? 1 : 0]

      );

      const id = ins.rows[0]!.id;

      await recordOperationLogTx(client, { userId: clientId, actionType: "create", targetType: "intent", targetId: id });

      return { id };

    });

    res.status(201).json({ id: created.id });

  })().catch((e) => {

    console.error("client requests create error:", e);

    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  });

});



/**

 * PATCH /api/client/requests/:id

 * 编辑合作意向（仅允许编辑自己的记录；软删除的不允许编辑）。

 */

router.patch("/requests/:id", (req: AuthRequest, res: Response) => {

  const clientId = req.user!.userId;

  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {

    res.status(400).json({ error: "INVALID_ID", message: "无效的需求 ID。" });

    return;

  }

  const { product_info, target_platform, budget, need_face, status } = req.body ?? {};

  (async () => {

    const row = await query<{ id: number }>(

      "SELECT id FROM client_requests WHERE id = $1 AND client_id = $2 AND is_deleted = 0",

      [id, clientId]

    );

    if (!row.rows[0]) {

      res.status(404).json({ error: "NOT_FOUND", message: "需求不存在。" });

      return;

    }

    const sets: string[] = [];

    const params: any[] = [];

    let idx = 1;

    if (product_info !== undefined) {

      sets.push(`product_info = $${idx++}`);

      params.push(product_info == null ? null : String(product_info));

    }

    if (target_platform !== undefined) {

      sets.push(`target_platform = $${idx++}`);

      params.push(target_platform == null ? null : String(target_platform));

    }

    if (budget !== undefined) {

      sets.push(`budget = $${idx++}`);

      params.push(budget == null ? null : String(budget));

    }

    if (need_face !== undefined) {

      sets.push(`need_face = $${idx++}`);

      params.push(need_face ? 1 : 0);

    }

    if (status === "draft" || status === "submitted" || status === "processing" || status === "done") {

      sets.push(`status = $${idx++}`);

      params.push(status);

    }

    if (sets.length === 0) {

      res.json({ ok: true });

      return;

    }

    await withTx(async (client) => {

      params.push(id);

      params.push(clientId);

      await client.query(`UPDATE client_requests SET ${sets.join(", ")} WHERE id = $${idx++} AND client_id = $${idx++}`, params);

      await recordOperationLogTx(client, { userId: clientId, actionType: "edit", targetType: "intent", targetId: id });

    });

    res.json({ ok: true });

  })().catch((e) => {

    console.error("client requests patch error:", e);

    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  });

});



/**

 * DELETE /api/client/requests/:id

 * 软删除合作意向。

 */

router.delete("/requests/:id", (req: AuthRequest, res: Response) => {

  const clientId = req.user!.userId;

  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {

    res.status(400).json({ error: "INVALID_ID", message: "无效的需求 ID。" });

    return;

  }

  (async () => {

    await withTx(async (client) => {

      const updated = await client.query<{ id: number }>(

        "UPDATE client_requests SET is_deleted = 1, deleted_at = now() WHERE id = $1 AND client_id = $2 AND is_deleted = 0 RETURNING id",

        [id, clientId]

      );

      if (!updated.rows[0]) {

        res.status(404).json({ error: "NOT_FOUND", message: "需求不存在。" });

        return;

      }

      await recordOperationLogTx(client, { userId: clientId, actionType: "delete", targetType: "intent", targetId: id });

      res.json({ ok: true });

    });

  })().catch((e) => {

    console.error("client requests delete error:", e);

    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  });

});



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

      const base = getPublicBaseUrl(req);

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

        const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;

        const filepath = path.join(uploadDir, filename);

        await fs.writeFile(filepath, file.buffer);

        urls.push(`${base}/uploads/skus/${clientId}/${filename}`);

      }

      res.status(201).json({ urls });

    })().catch((e) => {

      console.error("client skus upload error:", e);

      res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

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

        ORDER BY id DESC`,

      [clientId]

    );

    res.json({ list: rows });

  })().catch((e) => {

    console.error("client skus list error:", e);

    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

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

    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

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

    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

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

      // 找 Excel 文件

      const excelEntry = zip.file(/\.xlsx?$/i).find((e) => !e.dir);

      if (!excelEntry) {

        res.status(400).json({ error: "INVALID_INPUT", message: "ZIP 中没有找到 Excel 文件（.xlsx/.xls）。" });

        return;

      }

      excelBuffer = await excelEntry.async("nodebuffer");

      // 找图片文件（images/ 子目录或根目录）

      const imageExts = new Set([".jpg", ".jpeg", ".png", ".webp"]);

      const imageEntries = zip.file(/\.(jpg|jpeg|png|webp)$/i).filter((e) => !e.dir);

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

        const buf = await entry.async("nodebuffer");

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

      headerRow.eachCell((cell, colNumber) => {

        headers[colNumber - 1] = String(cell.value ?? "").trim();

      });

      // 读取数据行

      rows = [];

      sheet.eachRow((row, rowNumber) => {

        if (rowNumber === 1) return; // 跳过表头

        const rowData: Record<string, unknown> = {};

        row.eachCell((cell, colNumber) => {

          const key = headers[colNumber - 1];

          if (key) rowData[key] = cell.value;

        });

        rows.push(rowData);

      });

      // 提取内嵌图片，按行号/单元格匹配到 SKU 编码

      const images = sheet.getImages();

      console.log(`[batch-import] Excel 浮动图片数量: ${images.length}`);

      console.log(`[batch-import] media 库数量: ${wb.model.media?.length ?? 0}`);

      const mediaItems = wb.model.media || [];

      // 辅助函数：将 media item 的 buffer 加入 imageMap
      const addMediaToMap = (skuCode: string, mediaItem: any, logTag: string) => {
        if (!skuCode || !mediaItem?.buffer) return false;
        const ext = mediaItem.extension ? `.${mediaItem.extension}` : ".png";
        const buf = Buffer.from(mediaItem.buffer);
        if (!imageMap.has(skuCode)) imageMap.set(skuCode, []);
        imageMap.get(skuCode)!.push({ buffer: buf, ext });
        console.log(`[batch-import] ${logTag} SKU: ${skuCode}, 大小: ${buf.length} bytes`);
        return true;
      };

      // --- 方式一：浮动图片（通过 sheet.getImages() + array index 匹配 media） ---
      for (let i = 0; i < images.length; i++) {
        const img = images[i]!;
        // ExcelJS 在加载文件时不会给 media 项设置 index，所以 img.imageId 为 undefined。
        // 但加载时图片和 media 按相同顺序解析，直接用数组索引对应。
        const mediaItem = mediaItems[i] as any;
        console.log(`[batch-import] 浮动图片 #${i} imageId=${img.imageId}, range:`, JSON.stringify(img.range));
        if (!mediaItem || !mediaItem.buffer) {
          console.log(`[batch-import] 浮动图片 #${i} 未找到 media 或无 buffer`);
          continue;
        }
        const tl = img.range?.tl;
        if (!tl) {
          console.log(`[batch-import] 浮动图片 #${i} 无 tl 锚点`);
          continue;
        }
        const rowNum = ((tl as any).nativeRow ?? (tl as any).row ?? 0) + 1;
        console.log(`[batch-import] 浮动图片 #${i} 所在行: ${rowNum}`);
        if (rowNum < 2 || rowNum > rows.length + 1) {
          console.log(`[batch-import] 浮动图片 #${i} 行号超出范围`);
          continue;
        }
        const row = rows[rowNum - 2];
        if (!row) continue;
        const skuCode = (row["sku编码"] ?? row.sku_code) != null ? String(row["sku编码"] ?? row.sku_code).trim() : "";
        if (!skuCode) {
          console.log(`[batch-import] 浮动图片 #${i} 对应行无 sku 编码`);
          continue;
        }
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
            console.log("[batch-import] 检测到 cellimages.xml（WPS 单元格内图片），开始解析");
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
            console.log(`[batch-import] cellimages 解析完成，共 ${dispimgToMediaName.size} 个图片映射`);
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
                      } else {
                        console.log(`[batch-import] 单元格图片 ${imgId} 未找到 media (name=${mediaName})`);
                      }
                    } else {
                      console.log(`[batch-import] 单元格图片 ${imgId} 未在 cellimages.xml 中找到映射`);
                    }
                  }
                }
              }
            }
          }
        } catch (cellImgErr) {
          console.log("[batch-import] 解析 cellimages.xml 失败:", cellImgErr);
        }
      }

      console.log(`[batch-import] 最终 imageMap: ${imageMap.size} 个 SKU 有图片`);

      for (const [code, imgs] of imageMap) {

        console.log(`[batch-import]   ${code}: ${imgs.length} 张图片`);

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

      const base = getPublicBaseUrl(req);

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

              urls.push(`${base}/uploads/skus/${clientId}/${filename}`);

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

    console.log(`[batch-import] 导入完成: success=${success}, skipped=${skipped}, imagesImported=${imagesImported}, errors=${errors.length}`);

    res.json({ success, skipped, errors, imagesImported });

  })().catch((e) => {

    console.error("client skus batch-import error:", e);

    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

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

        for (const entry of Object.values(zip.files)) {

          if (entry.dir) continue;

          const entryName = entry.name.toLowerCase();

          const hasImageExt = [".jpg", ".jpeg", ".png", ".webp"].some((ext) => entryName.endsWith(ext));

          if (!hasImageExt) continue;

          const buf = await entry.async("nodebuffer");

          imageFiles.push({ name: path.basename(entry.name), buffer: buf });

        }

      } else {

        // 直接的图片文件

        const dotIdx = file.originalname.lastIndexOf(".");

        if (dotIdx < 1) { unmatched.push(file.originalname); continue; }

        const ext = file.originalname.substring(dotIdx).toLowerCase();

        if (!imageExts.has(ext)) { unmatched.push(file.originalname); continue; }

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

    const base = getPublicBaseUrl(req);

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

        newUrls.push(`${base}/uploads/skus/${clientId}/${filename}`);

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

    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

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
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
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

    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  });

});




/**

 * GET /api/client/orders

 * 样品/订单跟踪列表。

 */

router.get("/orders", (req: AuthRequest, res: Response) => {

  const clientId = req.user!.userId;

  (async () => {

    const { rows } = await query(

      `

    SELECT o.id, o.request_id, o.status, o.note, o.created_at, o.updated_at,

           r.product_info, r.target_platform

    FROM sample_orders o

    LEFT JOIN client_requests r ON o.request_id = r.id

    WHERE o.client_id = $1

    ORDER BY o.id DESC

  `,

      [clientId]

    );

    res.json({ list: rows });

  })().catch((e) => {

    console.error("client orders list error:", e);

    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  });

});



/**

 * POST /api/client/orders

 * 创建样品/订单（可关联需求）。

 */

router.post("/orders", (req: AuthRequest, res: Response) => {

  const clientId = req.user!.userId;

  const { request_id, note } = req.body ?? {};

  (async () => {

    if (request_id != null) {

      const r = await query<{ id: number }>("SELECT id FROM client_requests WHERE id = $1 AND client_id = $2", [Number(request_id), clientId]);

      if (!r.rows[0]) {

        res.status(400).json({ error: "INVALID_REQUEST", message: "需求不存在或无权关联。" });

        return;

      }

    }

    const created = await query<{ id: number }>(

      "INSERT INTO sample_orders (client_id, request_id, status, note) VALUES ($1, $2, 'pending', $3) RETURNING id",

      [clientId, request_id != null ? Number(request_id) : null, note != null ? String(note) : null]

    );

    res.status(201).json({ id: created.rows[0]!.id });

  })().catch((e) => {

    console.error("client orders create error:", e);

    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  });

});



/**

 * PATCH /api/client/orders/:id

 * 更新订单状态（商家可更新备注，状态一般由管理员或流程更新，此处允许商家更新便于协作）。

 */

router.patch("/orders/:id", (req: AuthRequest, res: Response) => {

  const clientId = req.user!.userId;

  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {

    res.status(400).json({ error: "INVALID_ID", message: "无效的订单 ID。" });

    return;

  }

  const { status, note } = req.body ?? {};

  (async () => {

    const row = await query<{ id: number }>("SELECT id FROM sample_orders WHERE id = $1 AND client_id = $2", [id, clientId]);

    if (!row.rows[0]) {

      res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });

      return;

    }



    const sets: string[] = [];

    const params: any[] = [];

    let idx = 1;

    if (status === "pending" || status === "sent" || status === "received") {

      sets.push(`status = $${idx++}`);

      params.push(status);

    }

    if (note !== undefined) {

      sets.push(`note = $${idx++}`);

      params.push(String(note));

    }

    if (sets.length > 0) {

      sets.push(`updated_at = now()`);

      params.push(id);

      params.push(clientId);

      await query(`UPDATE sample_orders SET ${sets.join(", ")} WHERE id = $${idx++} AND client_id = $${idx++}`, params);

    }

    res.json({ ok: true });

  })().catch((e) => {

    console.error("client orders patch error:", e);

    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  });

});



/**

 * GET /api/client/works

 * 达人作品板块已下线，统一返回停用状态。

 */

router.get("/works", (req: AuthRequest, res: Response) => {

  res.status(410).json({ error: "MODULE_DISABLED", message: "达人作品板块已下线。" });

});



/**

 * GET /api/client/points

 * 当前积分余额与流水。

 */

router.get("/points", (req: AuthRequest, res: Response) => {

  const userId = req.user!.userId;

  (async () => {

    const accRes = await query<{ id: number; balance: number }>("SELECT id, balance FROM point_accounts WHERE user_id = $1", [userId]);

    const acc = accRes.rows[0];

    if (!acc) {

      res.json({ balance: 0, ledger: [] });

      return;

    }

    const ledgerRes = await query<{ id: number; amount: number; type: string; created_at: string }>(

      "SELECT id, amount, type, created_at FROM point_ledger WHERE account_id = $1 ORDER BY id DESC LIMIT 50",

      [acc.id]

    );

    const rechargeOrderRes = await query<{ id: number; order_no: string | null; amount: number; status: string; note: string | null; created_at: string; approved_at: string | null }>(

      "SELECT id, order_no, amount, status, note, created_at, approved_at FROM recharge_orders WHERE user_id = $1 ORDER BY id DESC LIMIT 50",

      [userId]

    );

    res.json({ balance: acc.balance, ledger: ledgerRes.rows, rechargeOrders: rechargeOrderRes.rows });

  })().catch((e) => {

    console.error("client points error:", e);

    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  });

});



/**

 * POST /api/client/recharge

 * 提交充值订单，待管理员确认后再入账。

 */

router.post("/recharge", (req: AuthRequest, res: Response) => {

  const userId = req.user!.userId;

  const { amount } = req.body ?? {};

  const num = Number(amount);

  if (!Number.isInteger(num) || num < 1 || num > 1000000) {

    res.status(400).json({ error: "INVALID_AMOUNT", message: "请填写有效充值积分（1–1000000）。" });

    return;

  }

  (async () => {

    const created = await withTx(async (client) => {

      const dateRes = await client.query<{ date_key: string }>("SELECT to_char((now() AT TIME ZONE 'Asia/Shanghai'), 'YYYYMMDD') AS date_key");

      const dateKey = dateRes.rows[0]!.date_key;

      const seqRes = await client.query<{ last_no: number }>(

        `

        INSERT INTO biz_order_counters (prefix, date_key, last_no)

        VALUES ('XT', $1, 1)

        ON CONFLICT (prefix, date_key)

        DO UPDATE SET last_no = biz_order_counters.last_no + 1

        RETURNING last_no

        `,

        [dateKey]

      );

      const seqNo = seqRes.rows[0]!.last_no;

      const orderNo = `XT${dateKey}-${seqNo}`;

      const inserted = await client.query<{ id: number; order_no: string }>(

        "INSERT INTO recharge_orders (order_no, user_id, amount, status) VALUES ($1, $2, $3, 'pending') RETURNING id, order_no",

        [orderNo, userId, num]

      );

      return inserted.rows[0]!;

    });

    res.status(201).json({ id: created.id, order_no: created.order_no, status: "pending" });

  })().catch((e) => {

    console.error("client recharge error:", e);

    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  });

});



/**

 * GET /api/client/market-orders

 * 当前商家发布的「达人领单」订单列表（含要求、状态、奖励积分）。

 */

router.get("/market-orders", (req: AuthRequest, res: Response) => {

  const clientId = req.user!.userId;

  const rawQ = typeof req.query.q === "string" ? req.query.q.trim() : "";

  const startDate = normalizeDateOnly(req.query.start_date);

  const endDate = normalizeDateOnly(req.query.end_date);

  (async () => {

    let sql = `SELECT mo.id, mo.order_no, mo.title, mo.reward_points, mo.tier, mo.publish_method, mo.is_public_apply, mo.match_status, mo.tiktok_link, mo.product_images, mo.sku_codes, mo.sku_images, mo.sku_ids, mo.task_count, (mo.reward_points * GREATEST(COALESCE(mo.task_count, 1), 1))::integer AS reward_points_total, mo.status, mo.influencer_id, mo.work_links, mo.client_shop_name, mo.client_group_chat, mo.created_at, mo.updated_at, mo.completed_at,
                      pl.publish_link,
                      ui.username AS influencer_username,

                      COALESCE(NULLIF(ui.display_name, ''), ui.username) AS influencer_display_name

       FROM client_market_orders mo

       LEFT JOIN users ui ON mo.influencer_id = ui.id

       LEFT JOIN LATERAL (
         SELECT publish_link FROM market_order_publish_logs WHERE order_id=mo.id ORDER BY id DESC LIMIT 1
       ) pl ON true
      WHERE mo.client_id = $1 AND mo.is_deleted = 0`;

    const params: unknown[] = [clientId];

    let idx = 2;

    if (rawQ) {

      sql += ` AND (mo.order_no = $${idx} OR mo.title = $${idx})`;

      params.push(rawQ);

      idx += 1;

    }

    if (startDate) {

      sql += ` AND mo.created_at::date >= $${idx}::date`;

      params.push(startDate);

      idx += 1;

    }

    if (endDate) {

      sql += ` AND mo.created_at::date <= $${idx}::date`;

      params.push(endDate);

    }

    sql += ` ORDER BY mo.id DESC`;

    const { rows } = await query(sql, params);

    res.json({ list: rows });

  })().catch((e) => {

    console.error("client market-orders list error:", e);

    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  });

});



/**

 * GET /api/client/market-orders/:id

 * 获取单条发单（用于编辑页回显）。

 */

router.get("/market-orders/:id", (req: AuthRequest, res: Response) => {

  const clientId = req.user!.userId;

  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {

    res.status(400).json({ error: "INVALID_ID", message: "无效的订单 ID。" });

    return;

  }

  (async () => {

    const { rows } = await query(
      `SELECT mo.id, mo.order_no, mo.title, mo.tier, mo.publish_method, mo.is_public_apply, mo.match_status, mo.voice_link, mo.tiktok_link, mo.product_images, mo.sku_codes, mo.sku_images, mo.sku_ids, mo.task_count, mo.reward_points, (mo.reward_points * GREATEST(COALESCE(mo.task_count, 1), 1))::integer AS reward_points_total, mo.status, mo.influencer_id, mo.work_links, mo.client_shop_name, mo.client_group_chat, mo.created_at, mo.updated_at, mo.completed_at,
              pl.publish_link
         FROM client_market_orders mo
         LEFT JOIN LATERAL (
           SELECT publish_link FROM market_order_publish_logs WHERE order_id=mo.id ORDER BY id DESC LIMIT 1
         ) pl ON true
        WHERE mo.id = $1 AND mo.client_id = $2 AND mo.is_deleted = 0`,
      [id, clientId]
    );

    const row = rows[0];

    if (!row) {

      res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });

      return;

    }

    res.json({ item: row });

  })().catch((e) => {

    console.error("client market-orders detail error:", e);

    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  });

});



/**

 * POST /api/client/market-orders

 * 创建达人可领取的订单：发单时按档位扣积分（C=20 / B=40 / A=60）。

 */

router.post("/market-orders", (req: AuthRequest, res: Response) => {

  const clientId = req.user!.userId;

  const { title, tier, voice_link, tiktok_link, product_images, task_count, sku_codes, sku_images, sku_ids, client_shop_name, client_group_chat, publish_method, is_public_apply } = req.body ?? {};

  if (typeof tiktok_link === "string" && tiktok_link.trim().length > 2000) {

    res.status(400).json({ error: "INVALID_TIKTOK", message: "TikTok 链接最长 2000 字符。" });

    return;

  }

  const titleText = title != null ? String(title).trim() : "";

  if (!titleText || titleText.length > 200) {

    res.status(400).json({ error: "INVALID_TITLE", message: "请填写订单标题（1–200 字）。" });

    return;

  }

  const clientShopName = normalizeClientShopName(client_shop_name);

  if (!clientShopName) {

    res.status(400).json({ error: "INVALID_CLIENT_SHOP_NAME", message: "请输入商家店铺名称。" });

    return;

  }

  if (clientShopName.length > 200) {

    res.status(400).json({ error: "INVALID_CLIENT_SHOP_NAME", message: "商家店铺名称最长 200 字符。" });

    return;

  }

  const clientGroupChat = normalizeClientGroupChat(client_group_chat);

  if (!clientGroupChat) {

    res.status(400).json({ error: "INVALID_CLIENT_GROUP_CHAT", message: "请输入商家对接群聊（群号/链接）。" });

    return;

  }

  if (clientGroupChat.length > 2000) {

    res.status(400).json({ error: "INVALID_CLIENT_GROUP_CHAT", message: "商家对接群聊最长 2000 字符。" });

    return;

  }

  const publishMethod = normalizePublishMethod(publish_method);

  const isPublicApply = is_public_apply ? 1 : 0;

  if (!publishMethod) {

    res.status(400).json({ error: "INVALID_PUBLISH_METHOD", message: "请选择发布方式" });

    return;

  }

  (async () => {

    const result = await withTx(async (client) => {

      const acc = await ensurePointAccountLocked(client, clientId);

      const resolved = resolveMarketOrderPayPoints(typeof tier === "string" ? tier.trim().toUpperCase() : "");

      const payPoints = resolved.payPoints;

      const creatorRewardUnit = await resolveMarketOrderCreatorRewardUnitFromConfig(client, resolved.tier);
      const platformProfitUnit = Math.max(payPoints - creatorRewardUnit, 0);

      const countRaw = task_count == null ? 1 : Number(task_count);

      const taskCount = Number.isInteger(countRaw) ? Math.min(Math.max(countRaw, 1), 100) : 1;

      const totalPayPoints = payPoints * taskCount;

      const platformProfitTotal = platformProfitUnit * taskCount;

      if (acc.balance < totalPayPoints) {

        return { kind: "insufficient" as const, balance: acc.balance, need: totalPayPoints };

      }

      const voiceLink = voice_link != null ? String(voice_link).trim() : "";

      const tiktokLink = tiktok_link != null ? String(tiktok_link).trim() : "";

      const productImages = normalizeProductImages(product_images);

      const inputSkuCodes = normalizeSkuCodes(sku_codes);

      const inputSkuImages = normalizeProductImages(sku_images);

      const inputSkuIds = normalizeSkuIds(sku_ids);

      const snapshot = await resolveSkuSnapshotByIds(clientId, inputSkuIds);

      const finalSkuIds = snapshot.ids.length > 0 ? snapshot.ids : inputSkuIds;

      const finalSkuCodes = snapshot.codes.length > 0 ? snapshot.codes : inputSkuCodes;

      const finalSkuImages = snapshot.images.length > 0 ? snapshot.images : inputSkuImages;

      if (resolved.tier === "A") {

        if (voiceLink.length > 2000) {

          return { kind: "bad_voice" as const, message: "配音素材链接最长 2000 字符。" };

        }

      }

      const orderNo = await allocateMarketOrderNo(client);
      const ins = await client.query<{ id: number; order_no: string }>(
        `INSERT INTO client_market_orders
           (client_id, order_no, title, reward_points, tier, creator_reward_points, platform_profit_points, pay_deducted, voice_link, voice_note, tiktok_link, product_images, sku_codes, sku_images, sku_ids, task_count, client_shop_name, client_group_chat, publish_method, is_public_apply, match_status, status)
         VALUES
           ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, $10, $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb, $15, $16, $17, $18, $19, 'open', 'open')
         RETURNING id, order_no`,
        [
          clientId,
          orderNo,
          titleText,
          payPoints,
          resolved.tier,
          creatorRewardUnit,
          platformProfitTotal,
          resolved.tier === "A" ? (voiceLink || null) : null,
          null,
          tiktokLink || null,
          JSON.stringify(productImages),
          JSON.stringify(finalSkuCodes),
          JSON.stringify(finalSkuImages),
          JSON.stringify(finalSkuIds),
          taskCount,
          clientShopName,
          clientGroupChat,
          publishMethod,
          isPublicApply,
        ]
      );
      const row0 = ins.rows[0];
      if (!row0) return { kind: "db_error" as const };
      const orderId = row0.id;
      await recordOperationLogTx(client, { userId: clientId, actionType: "create", targetType: "order", targetId: orderId });
      await client.query("INSERT INTO point_ledger (account_id, amount, type, ref_id) VALUES ($1, $2, 'market_order_client_pay', $3)", [
        acc.id,
        -totalPayPoints,
        orderId,
      ]);
      await client.query("UPDATE point_accounts SET balance = balance - $1, updated_at = now() WHERE id = $2", [totalPayPoints, acc.id]);
      await client.query("UPDATE client_market_orders SET pay_deducted = 1, updated_at = now() WHERE id = $1", [orderId]);
      await createMessageToAdminAndEmployeesTx(
        client,
        "market_order_new",
        "新视频分级订单待领取",
        `新视频分级订单 ${row0.order_no}${titleText ? `（${titleText}）` : ""} 已创建，请尽快处理。`,
        "market_order",
        orderId
      );
      return { kind: "ok" as const, id: orderId, order_no: row0.order_no, task_count: taskCount };
    });
    if (result.kind === "db_error") {
      res.status(500).json({ error: "DB_ERROR", message: "创建订单失败，请重试。" });
      return;
    }
    if (result.kind === "bad_voice") {

      res.status(400).json({ error: "INVALID_VOICE", message: result.message });

      return;

    }

    if (result.kind === "insufficient") {

      res.status(409).json({

        error: "INSUFFICIENT_POINTS",

        message: `发单积分不足（需 ${result.need}），当前余额 ${result.balance}。`,

      });

      return;

    }

    // 返回给商家端：显示其支付积分（reward_points 字段历史沿用）

    res.status(201).json({ id: result.id, order_no: result.order_no, created_count: 1, task_count: result.task_count });

  })().catch((e) => {

    console.error("client market-orders create error:", e);

    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  });

});



/**

 * PATCH /api/client/market-orders/:id

 * 编辑订单：仅允许编辑自己的 open 状态订单（软删除的不允许编辑）。

 */

router.patch("/market-orders/:id", (req: AuthRequest, res: Response) => {

  const clientId = req.user!.userId;

  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {

    res.status(400).json({ error: "INVALID_ID", message: "无效的订单 ID。" });

    return;

  }

  const { title, tier, voice_link, tiktok_link, product_images, sku_codes, sku_images, sku_ids, client_shop_name, client_group_chat, publish_method, is_public_apply } = req.body ?? {};

  const nextTitle = title !== undefined ? String(title ?? "").trim() : undefined;

  const nextTier = typeof tier === "string" ? tier.trim().toUpperCase() : undefined;

  const voiceLink = voice_link !== undefined ? String(voice_link ?? "").trim() : undefined;

  const tiktokLink = tiktok_link !== undefined ? String(tiktok_link ?? "").trim() : undefined;

  const productImages = product_images !== undefined ? normalizeProductImages(product_images) : undefined;

  const nextSkuCodes = sku_codes !== undefined ? normalizeSkuCodes(sku_codes) : undefined;

  const nextSkuImages = sku_images !== undefined ? normalizeProductImages(sku_images) : undefined;

  const nextSkuIds = sku_ids !== undefined ? normalizeSkuIds(sku_ids) : undefined;

  const nextClientShopName = client_shop_name !== undefined ? normalizeClientShopName(client_shop_name) : undefined;

  const nextClientGroupChat = client_group_chat !== undefined ? normalizeClientGroupChat(client_group_chat) : undefined;

  const nextPublishMethod = publish_method !== undefined ? normalizePublishMethod(publish_method) : undefined;

  const nextIsPublicApply = is_public_apply !== undefined ? (is_public_apply ? 1 : 0) : undefined;

  if (nextTitle !== undefined && (!nextTitle || nextTitle.length > 200)) {

    res.status(400).json({ error: "INVALID_TITLE", message: "请填写订单标题（1–200 字）。" });

    return;

  }

  if (voiceLink !== undefined && voiceLink.length > 2000) {

    res.status(400).json({ error: "INVALID_VOICE", message: "配音素材链接最长 2000 字符。" });

    return;

  }

    if (tiktokLink !== undefined && tiktokLink.length > 2000) {

      res.status(400).json({ error: "INVALID_TIKTOK", message: "TikTok 链接最长 2000 字符。" });

      return;

    }

  if (nextClientShopName !== undefined && (!nextClientShopName || nextClientShopName.length > 200)) {

    res.status(400).json({ error: "INVALID_CLIENT_SHOP_NAME", message: "请输入有效商家店铺名称（1-200）。" });

    return;

  }

  if (nextClientGroupChat !== undefined && (!nextClientGroupChat || nextClientGroupChat.length > 2000)) {

    res.status(400).json({ error: "INVALID_CLIENT_GROUP_CHAT", message: "请输入有效商家对接群聊（1-2000）。" });

    return;

  }

  if (publish_method !== undefined && !nextPublishMethod) {

    res.status(400).json({ error: "INVALID_PUBLISH_METHOD", message: "请选择发布方式" });

    return;

  }

  (async () => {

    const row = await query<{ id: number; status: string; tier: string; client_shop_name: string | null; client_group_chat: string | null; publish_method: string | null }>(

      "SELECT id, status, tier, client_shop_name, client_group_chat, publish_method FROM client_market_orders WHERE id = $1 AND client_id = $2 AND is_deleted = 0",

      [id, clientId]

    );

    const ord = row.rows[0];

    if (!ord) {

      res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });

      return;

    }

    if (ord.status !== "open") {

      res.status(409).json({ error: "BAD_STATE", message: "仅支持编辑待领取的订单。" });

      return;

    }

    const sets: string[] = [];

    const params: any[] = [];

    let idx = 1;

    if (nextTitle !== undefined) {

      sets.push(`title = $${idx++}`);

      params.push(nextTitle || null);

    }

    if (tiktokLink !== undefined) {

      sets.push(`tiktok_link = $${idx++}`);

      params.push(tiktokLink || null);

    }

    if (productImages !== undefined) {

      sets.push(`product_images = $${idx++}::jsonb`);

      params.push(JSON.stringify(productImages));

    }

    if (nextSkuCodes !== undefined) {

      sets.push(`sku_codes = $${idx++}::jsonb`);

      params.push(JSON.stringify(nextSkuCodes));

    }

    if (nextSkuImages !== undefined) {

      sets.push(`sku_images = $${idx++}::jsonb`);

      params.push(JSON.stringify(nextSkuImages));

    }

    if (nextSkuIds !== undefined) {

      const snapshot = await resolveSkuSnapshotByIds(clientId, nextSkuIds);

      sets.push(`sku_ids = $${idx++}::jsonb`);

      params.push(JSON.stringify(snapshot.ids.length > 0 ? snapshot.ids : nextSkuIds));

      if (snapshot.codes.length > 0) {

        sets.push(`sku_codes = $${idx++}::jsonb`);

        params.push(JSON.stringify(snapshot.codes));

      }

      if (snapshot.images.length > 0) {

        sets.push(`sku_images = $${idx++}::jsonb`);

        params.push(JSON.stringify(snapshot.images));

      }

    }

    if (nextTier === "A" || nextTier === "B" || nextTier === "C") {

      sets.push(`tier = $${idx++}`);

      params.push(nextTier);

      // A 类才保留配音字段；否则清空

      sets.push(`voice_link = $${idx++}`);

      params.push(nextTier === "A" ? (voiceLink ? voiceLink : null) : null);

      sets.push(`voice_note = $${idx++}`);

      params.push(null);

    } else if (voiceLink !== undefined) {

      // 档位未变更时：仅当当前为 A 才允许写配音字段

      if (String(ord.tier || "") !== "A") {

        res.status(400).json({ error: "INVALID_VOICE", message: "仅 A 类订单支持配音信息。" });

        return;

      }

      if (voiceLink !== undefined) {

        sets.push(`voice_link = $${idx++}`);

        params.push(voiceLink ? voiceLink : null);

      }

    }

    if (sets.length === 0) {

      res.json({ ok: true });

      return;

    }

    const finalClientShopName = nextClientShopName !== undefined ? nextClientShopName : String(ord.client_shop_name ?? "").trim();

    const finalClientGroupChat = nextClientGroupChat !== undefined ? nextClientGroupChat : String(ord.client_group_chat ?? "").trim();

    if (!finalClientShopName) {

      res.status(400).json({ error: "INVALID_CLIENT_SHOP_NAME", message: "请输入商家店铺名称。" });

      return;

    }

    if (!finalClientGroupChat) {

      res.status(400).json({ error: "INVALID_CLIENT_GROUP_CHAT", message: "请输入商家对接群聊（群号/链接）。" });

      return;

    }

    const finalPublishMethod = nextPublishMethod !== undefined ? nextPublishMethod : normalizePublishMethod(ord.publish_method);

    if (!finalPublishMethod) {

      res.status(400).json({ error: "INVALID_PUBLISH_METHOD", message: "请选择发布方式" });

      return;

    }

    if (nextClientShopName !== undefined) {

      sets.push(`client_shop_name = $${idx++}`);

      params.push(nextClientShopName);

    }

    if (nextClientGroupChat !== undefined) {

      sets.push(`client_group_chat = $${idx++}`);

      params.push(nextClientGroupChat);

    }

    if (nextPublishMethod !== undefined) {

      sets.push(`publish_method = $${idx++}`);

      params.push(nextPublishMethod);

    }

    if (nextIsPublicApply !== undefined) {

      sets.push(`is_public_apply = $${idx++}`);

      params.push(nextIsPublicApply);

      sets.push(`match_status = CASE WHEN $${idx-1} = 1 AND match_status = 'open' THEN 'pending_selection' ELSE match_status END`);

    }

    await withTx(async (client) => {

      sets.push(`updated_at = now()`);

      params.push(id);

      params.push(clientId);

      await client.query(

        `UPDATE client_market_orders SET ${sets.join(", ")} WHERE id = $${idx++} AND client_id = $${idx++} AND status = 'open' AND is_deleted = 0`,

        params

      );

      await recordOperationLogTx(client, { userId: clientId, actionType: "edit", targetType: "order", targetId: id });

    });

    res.json({ ok: true });

  })().catch((e) => {

    console.error("client market-orders patch error:", e);

    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  });

});



/**

 * DELETE /api/client/market-orders/:id

 * 软删除订单：仅允许删除自己的 open 状态订单。

 */

router.delete("/market-orders/:id", (req: AuthRequest, res: Response) => {

  const clientId = req.user!.userId;

  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {

    res.status(400).json({ error: "INVALID_ID", message: "无效的订单 ID。" });

    return;

  }

  (async () => {

    await withTx(async (client) => {

      const updated = await client.query<{ id: number; pay_deducted: number; reward_points: number; task_count: number }>(

        "UPDATE client_market_orders SET is_deleted = 1, deleted_at = now(), updated_at = now() WHERE id = $1 AND client_id = $2 AND status = 'open' AND is_deleted = 0 RETURNING id, pay_deducted, reward_points, task_count",

        [id, clientId]

      );

      if (!updated.rows[0]) {

        res.status(404).json({ error: "NOT_FOUND", message: "订单不存在或不可删除。" });

        return;

      }

      const row = updated.rows[0];
      if (row.pay_deducted === 1) {
        const refundPoints = Math.max(Number(row.reward_points || 0), 0) * Math.max(Number(row.task_count || 1), 1);
        if (refundPoints > 0) {
          const acc = await ensurePointAccountLocked(client, clientId);
          await client.query("INSERT INTO point_ledger (account_id, amount, type, ref_id) VALUES ($1, $2, 'market_order_cancel_refund', $3)", [
            acc.id,
            refundPoints,
            id,
          ]);
          await client.query("UPDATE point_accounts SET balance = balance + $1, updated_at = now() WHERE id = $2", [refundPoints, acc.id]);
          await client.query("UPDATE client_market_orders SET pay_deducted = 0 WHERE id = $1", [id]);
        }
      }

      await recordOperationLogTx(client, { userId: clientId, actionType: "delete", targetType: "order", targetId: id });

      res.json({ ok: true });

    });

  })().catch((e) => {

    console.error("client market-orders delete error:", e);

    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });

  });

});



export default router;
