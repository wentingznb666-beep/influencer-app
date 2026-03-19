import { Router, Response } from "express";
import { query } from "../db";
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
  (async () => {
    const lim = Math.min(Number(limit) || 100, 500);
    const off = Math.max(0, Number(offset) || 0);
    const { rows } = await query(
      `
    SELECT id, request_id, user_id, path, method, created_at
    FROM audit_log
    ORDER BY id DESC
    LIMIT $1 OFFSET $2
  `,
      [lim, off]
    );
    res.json({ list: rows });
  })().catch((e) => {
    console.error("audit list error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * GET /api/admin/audit/export
 * 导出审计日志为 CSV（简单实现）。
 */
router.get("/export", (req: AuthRequest, res: Response) => {
  const { limit = "1000" } = req.query as { limit?: string };
  (async () => {
    const lim = Math.min(Number(limit) || 1000, 5000);
    const { rows } = await query<{ id: number; request_id: string | null; user_id: number | null; path: string | null; method: string | null; created_at: string }>(
      "SELECT id, request_id, user_id, path, method, created_at FROM audit_log ORDER BY id DESC LIMIT $1",
      [lim]
    );
    const header = "id,request_id,user_id,path,method,created_at";
    const lines = rows.map(
      (r) => `${r.id},${escapeCsv(r.request_id)},${r.user_id ?? ""},${escapeCsv(r.path)},${escapeCsv(r.method)},${escapeCsv(r.created_at)}`
    );
    const csv = [header, ...lines].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=audit_log.csv");
    res.send("\uFEFF" + csv);
  })().catch((e) => {
    console.error("audit export error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

function escapeCsv(v: string | null): string {
  if (v == null) return "";
  if (/[,\n"]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export default router;
