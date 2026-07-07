import { Router, Response } from "express";
import { query } from "../db";
import { requireAuth, requireRole, type AuthRequest } from "../auth";

const router = Router();
router.use(requireAuth);

/** 等级自动计算 */
function calcGrade(data: { gmv_sales?: string | null; units_sold?: string | null; live_sales?: string | null; weekly_live_count?: string | null }): string | null {
  const gmv = parseFloat(String(data.gmv_sales || "0")) || 0;
  const units = parseInt(String(data.units_sold || "0"), 10) || 0;
  // Step 1: base grade
  let base: string | null = null;
  if (gmv >= 100000 || units >= 1000) base = "A";
  else if (gmv >= 10000 || units >= 100) base = "B";
  else if (gmv >= 3000 || units >= 10) base = "C";
  if (!base) return null;
  // Step 2: PLUS upgrade
  const live = parseFloat(String(data.live_sales || "0")) || 0;
  const weekly = parseInt(String(data.weekly_live_count || "0"), 10) || 0;
  if (live >= gmv * 0.5 && weekly >= 7) return base + "+";
  return base;
}

// Admin/Employee routes
const adminRouter = Router();
adminRouter.use(requireRole("admin", "employee"));

adminRouter.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const q = String(req.query.q || "").trim();
    const category = String(req.query.category || "").trim();
    const grade = String(req.query.grade || "").trim();
    const source = String(req.query.source || "").trim();
    const status = String(req.query.status || "").trim();
    const limit = Math.min(Number(req.query.limit) || 200, 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const params: any[] = [];
    let idx = 1;
    let where = "WHERE 1=1";
    if (q) { where += ` AND (influencer_code ILIKE $${idx} OR followers ILIKE $${idx} OR remark ILIKE $${idx})`; params.push(`%${q}%`); idx++; }
    if (category) { where += ` AND category = $${idx}`; params.push(category); idx++; }
    if (grade) { where += ` AND grade = $${idx}`; params.push(grade); idx++; }
    if (source) { where += ` AND source = $${idx}`; params.push(source); idx++; }
    if (status) { where += ` AND status = $${idx}`; params.push(status); idx++; }

    const { rows } = await query(
      `SELECT * FROM influencer_profiles_full ${where} ORDER BY id DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );
    const { rows: countRows } = await query(`SELECT COUNT(*) as total FROM influencer_profiles_full ${where}`, params);
    res.json({ list: rows, total: parseInt(String(countRows[0]?.total || "0"), 10) });
  } catch (e: any) { console.error("influencer profiles list error:", e); res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

adminRouter.get("/auto-grade", async (_req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query("SELECT id, gmv_sales, units_sold, live_sales, weekly_live_count FROM influencer_profiles_full WHERE status = 'active'");
    let updated = 0;
    for (const r of rows) {
      const grade = calcGrade(r);
      await query("UPDATE influencer_profiles_full SET grade = $1, updated_at = now() WHERE id = $2", [grade, r.id]);
      updated++;
    }
    res.json({ ok: true, updated });
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

adminRouter.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query("SELECT * FROM influencer_profiles_full WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "NOT_FOUND" });
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

adminRouter.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const { influencer_code, source, category, followers, gmv_sales, monthly_cart_videos, units_sold, can_live, live_sales, weekly_live_count, avg_live_hours_per_week, remark, contact_info, payment_info, quoted_price, cooperation_conditions, user_id } = req.body || {};
    if (!influencer_code || !source || !category) return res.status(400).json({ error: "MISSING_FIELDS", message: "influencer_code, source, category 为必填" });
    const grade = calcGrade({ gmv_sales, units_sold, live_sales, weekly_live_count });
    const { rows } = await query(
      `INSERT INTO influencer_profiles_full (influencer_code, source, followers, category, grade, gmv_sales, monthly_cart_videos, units_sold, can_live, live_sales, weekly_live_count, avg_live_hours_per_week, remark, contact_info, payment_info, quoted_price, cooperation_conditions, user_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id`,
      [influencer_code, source, followers || null, category, grade, gmv_sales || null, monthly_cart_videos || null, units_sold || null, !!can_live, live_sales || null, weekly_live_count || null, avg_live_hours_per_week || null, remark || null, contact_info || null, payment_info || null, quoted_price || null, cooperation_conditions || null, user_id || null]
    );
    res.status(201).json({ id: rows[0].id, grade });
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

adminRouter.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    const fields = ["influencer_code","source","followers","category","gmv_sales","monthly_cart_videos","units_sold","can_live","live_sales","weekly_live_count","avg_live_hours_per_week","remark","contact_info","payment_info","quoted_price","cooperation_conditions","user_id","status"];
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        sets.push(`${f} = $${idx++}`);
        params.push(f === "can_live" ? !!req.body[f] : req.body[f]);
      }
    }
    if (sets.length === 0) return res.json({ ok: true });
    sets.push(`updated_at = now()`);
    const grade = calcGrade(req.body);
    if (grade !== undefined) { sets.push(`grade = $${idx++}`); params.push(grade); }
    params.push(id);
    await query(`UPDATE influencer_profiles_full SET ${sets.join(", ")} WHERE id = $${idx}`, params);
    res.json({ ok: true, grade });
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

adminRouter.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    await query("UPDATE influencer_profiles_full SET status = 'inactive', updated_at = now() WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

adminRouter.post("/:id/grade", async (req: AuthRequest, res: Response) => {
  try {
    const grade = req.body?.grade || null;
    await query("UPDATE influencer_profiles_full SET grade = $1, updated_at = now() WHERE id = $2", [grade, req.params.id]);
    res.json({ ok: true, grade });
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

export const adminInfluencerProfiles = adminRouter;

// Client routes
const clientRouter = Router();
clientRouter.use(requireRole("client"));

clientRouter.get("/categories", async (_req: AuthRequest, res: Response) => {
  const categories = [
    { th: "ความงาม", zh: "美妆类" }, { th: "รีวิวทั่วไป", zh: "测评类" }, { th: "ไลฟ์สไตล์", zh: "生活类" },
    { th: "แฟชั่น", zh: "时尚类" }, { th: "อาหาร", zh: "美食类" }, { th: "อิเล็กเทอร์นิกส์", zh: "3C 类" },
    { th: "ของใช้ทั่วไป", zh: "日用品类" }, { th: "แม่และเด็ก", zh: "母婴" }, { th: "อาหารเสริม", zh: "健康保健品" },
    { th: "สายสุขภาพ", zh: "健康" }, { th: "เฟอร์นิเจอร์", zh: "家具类" }, { th: "กีฬาและกิจกรรมกลางแจ้ง", zh: "运动户外类" },
    { th: "มอเตอร์และยานยนต์", zh: "汽摩" }, { th: "กางเกงยีนส์", zh: "牛仔裤" }, { th: "กระเป๋า", zh: "包包" },
    { th: "เสื้อผ้า", zh: "衣服" }, { th: "ชุดนอน", zh: "睡衣" }, { th: "กางเกงใน", zh: "内衣" },
    { th: "เครื่องใช้ไฟฟ้า", zh: "家电" }, { th: "พัดลมพกพา", zh: "便携风扇" }, { th: "Power Bank", zh: "电宝" },
    { th: "แคมป์ปิ้ง", zh: "露营" }, { th: "กระเป๋าสตาง", zh: "钱包" }, { th: "รองเท้า", zh: "鞋子" },
    { th: "สินค้าสาวอวบ", zh: "微胖女生" }, { th: "กางเกงผู้ชาย", zh: "男士裤子" }, { th: "อุปกรณ์เสริมมือถือ", zh: "手机配件" },
    { th: "หูฟัง", zh: "耳机" }, { th: "ลำโพง", zh: "音箱" }, { th: "วัสดุตกแต่ง/ปรับปรุงบ้าน", zh: "家装建材" },
    { th: "การเกษตร", zh: "农业品类" }, { th: "ชุดว่ายน้ำ", zh: "泳衣" },
  ];
  res.json({ categories });
});

clientRouter.get("/influencers", async (req: AuthRequest, res: Response) => {
  try {
    const category = String(req.query.category || "").trim();
    if (!category) return res.status(400).json({ error: "MISSING_CATEGORY" });
    const grade = String(req.query.grade || "").trim();
    const sort = String(req.query.sort || "").trim();
    let where = "WHERE status = 'active' AND category = $1 AND grade IS NOT NULL";
    const params: any[] = [category];
    let idx = 2;
    if (grade) { where += ` AND grade = $${idx++}`; params.push(grade); }
    let order = "ORDER BY id DESC";
    if (sort === "followers_desc") order = "ORDER BY followers DESC";
    if (sort === "gmv_desc") order = "ORDER BY gmv_sales::numeric DESC NULLS LAST";
    const { rows } = await query(
      `SELECT id, influencer_code, source, followers, category, grade, gmv_sales, monthly_cart_videos, units_sold, can_live, live_sales, weekly_live_count, avg_live_hours_per_week, remark FROM influencer_profiles_full ${where} ${order} LIMIT 200`,
      params
    );
    res.json({ list: rows });
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

export const clientInfluencerProfiles = clientRouter;

// Influencer routes
const influencerRouter = Router();
influencerRouter.use(requireRole("influencer"));

influencerRouter.get("/profile", async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query("SELECT * FROM influencer_profiles_full WHERE user_id = $1 AND status = 'active'", [req.user!.userId]);
    res.json(rows[0] || null);
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

influencerRouter.put("/profile", async (req: AuthRequest, res: Response) => {
  try {
    const editableFields = ["influencer_code","source","followers","gmv_sales","monthly_cart_videos","units_sold","can_live","live_sales","weekly_live_count","avg_live_hours_per_week","remark","quoted_price","cooperation_conditions"];
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;
    for (const f of editableFields) {
      if (req.body[f] !== undefined) {
        sets.push(`${f} = $${idx++}`);
        params.push(f === "can_live" ? !!req.body[f] : req.body[f]);
      }
    }
    if (sets.length === 0) return res.json({ ok: true });
    sets.push(`updated_at = now()`);
    // Recalc grade
    const existing = await query("SELECT gmv_sales, units_sold, live_sales, weekly_live_count FROM influencer_profiles_full WHERE user_id = $1", [req.user!.userId]);
    const row = existing.rows[0] || {};
    const grade = calcGrade({
      gmv_sales: req.body.gmv_sales ?? row.gmv_sales,
      units_sold: req.body.units_sold ?? row.units_sold,
      live_sales: req.body.live_sales ?? row.live_sales,
      weekly_live_count: req.body.weekly_live_count ?? row.weekly_live_count,
    });
    sets.push(`grade = $${idx++}`); params.push(grade);
    params.push(req.user!.userId);
    await query(`UPDATE influencer_profiles_full SET ${sets.join(", ")} WHERE user_id = $${idx}`, params);
    res.json({ ok: true, grade });
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

influencerRouter.put("/payment-info", async (req: AuthRequest, res: Response) => {
  try {
    await query("UPDATE influencer_profiles_full SET payment_info = $1, updated_at = now() WHERE user_id = $2", [req.body?.payment_info || null, req.user!.userId]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

influencerRouter.get("/payment-info", async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query("SELECT payment_info FROM influencer_profiles_full WHERE user_id = $1", [req.user!.userId]);
    res.json({ payment_info: rows[0]?.payment_info || null });
  } catch (e: any) { res.status(500).json({ error: "INTERNAL_ERROR", message: e.message }); }
});

export const influencerProfiles = influencerRouter;
export default router;
