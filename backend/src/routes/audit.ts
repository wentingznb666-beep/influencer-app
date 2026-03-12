import { Router, Response } from "express";
import { getDb } from "../db";
import { requireAuth, requireRole, type AuthRequest } from "../auth";

const router = Router();
router.use(requireAuth);
router.use(requireRole("admin"));

/**
 * GET /api/admin/audit
 * 审计日志列表，支持 limit、offset。
 */
router.get("/", (req: AuthRequest, res: Response) => {
  const { limit = "100", offset = "0" } = req.query as { limit?: string; offset?: string };
  const database = getDb();
  const rows = database
    .prepare(
      `
    SELECT id, request_id, user_id, path, method, created_at
    FROM audit_log
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `
    )
    .all(Math.min(Number(limit) || 100, 500), Math.max(0, Number(offset) || 0));
  res.json({ list: rows });
});

/**
 * GET /api/admin/audit/export
 * 导出审计日志为 CSV（简单实现）。
 */
router.get("/export", (req: AuthRequest, res: Response) => {
  const { limit = "1000" } = req.query as { limit?: string };
  const database = getDb();
  const rows = database
    .prepare(
      "SELECT id, request_id, user_id, path, method, created_at FROM audit_log ORDER BY id DESC LIMIT ?"
    )
    .all(Math.min(Number(limit) || 1000, 5000)) as Array<{ id: number; request_id: string | null; user_id: number | null; path: string | null; method: string | null; created_at: string }>;
  const header = "id,request_id,user_id,path,method,created_at";
  const lines = rows.map(
    (r) => `${r.id},${escapeCsv(r.request_id)},${r.user_id ?? ""},${escapeCsv(r.path)},${escapeCsv(r.method)},${escapeCsv(r.created_at)}`
  );
  const csv = [header, ...lines].join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=audit_log.csv");
  res.send("\uFEFF" + csv);
});

function escapeCsv(v: string | null): string {
  if (v == null) return "";
  if (/[,\n"]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export default router;
