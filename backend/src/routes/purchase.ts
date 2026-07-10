import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import { query } from "../db";
import { requireAuth, requireRole, type AuthRequest } from "../auth";

// ========== INFLUENCER ROUTES ==========
const influencerRouter = Router();
influencerRouter.use(requireAuth);
influencerRouter.use(requireRole("influencer"));

/** 提交进货需求 */
influencerRouter.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.userId;
    const {
      title, category, sub_category, description,
      budget_min_thb, budget_max_thb, target_price,
      estimated_quantity, frequency, influencer_note,
    } = req.body || {};

    if (!title || !category) {
      return res.status(400).json({ error: "MISSING", message: "标题和品类为必填项" });
    }

    // 查询达人资料 ID
    const prof = await query(
      "SELECT id FROM influencer_profiles_full WHERE user_id = $1 LIMIT 1",
      [uid]
    );
    const influencer_profile_id = prof.rows[0]?.id || null;

    const { rows } = await query(
      `INSERT INTO purchase_demands
        (influencer_id, influencer_profile_id, title, category, sub_category,
         description, budget_min_thb, budget_max_thb, target_price,
         estimated_quantity, frequency, influencer_note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id`,
      [
        uid, influencer_profile_id, title, category,
        sub_category || null, description || null,
        budget_min_thb || null, budget_max_thb || null,
        target_price || null, estimated_quantity || null,
        frequency || "one_time", influencer_note || null,
      ]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

/** 查看自己的需求列表 */
influencerRouter.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.userId;
    const { rows } = await query(
      `SELECT * FROM purchase_demands
       WHERE influencer_id = $1
       ORDER BY created_at DESC
       LIMIT 200`,
      [uid]
    );
    res.json({ list: rows });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

/** 查看需求详情（含推荐商品列表） */
influencerRouter.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.userId;
    const id = parseInt(String(req.params.id));

    const demand = await query(
      "SELECT * FROM purchase_demands WHERE id = $1 AND influencer_id = $2",
      [id, uid]
    );
    if (!demand.rows[0]) {
      return res.status(404).json({ error: "NOT_FOUND", message: "需求不存在或无权访问" });
    }

    // 关联推荐商品
    const recs = await query(
      `SELECT pr.*, pp.product_name, pp.source, pp.price_cny, pp.price_thb,
              pp.image_urls, pp.category as product_category, pp.supplier_name,
              pp.estimated_profit_rate, pp.moq, pp.product_link
       FROM purchase_recommendations pr
       JOIN purchase_products pp ON pr.product_id = pp.id
       WHERE pr.demand_id = $1
       ORDER BY pr.created_at DESC`,
      [id]
    );

    res.json({ demand: demand.rows[0], recommendations: recs.rows });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

/** 修改需求（仅 pending 状态可修改，修改后重新触发 Coze 搜索） */
influencerRouter.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.userId;
    const id = parseInt(String(req.params.id));

    const existing = await query(
      "SELECT * FROM purchase_demands WHERE id = $1 AND influencer_id = $2",
      [id, uid]
    );
    if (!existing.rows[0]) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }
    if (existing.rows[0].status !== "pending") {
      return res.status(400).json({ error: "STATUS_ERROR", message: "仅待处理状态的需求可以修改" });
    }

    const {
      title, category, sub_category, description,
      budget_min_thb, budget_max_thb, target_price,
      estimated_quantity, frequency, influencer_note,
    } = req.body || {};

    const updates: string[] = ["updated_at = now()", "coze_search_triggered = false"];
    const params: any[] = [];
    let idx = 1;

    const setField = (field: string, value: any) => {
      if (value !== undefined) {
        updates.push(`${field} = $${idx++}`);
        params.push(value);
      }
    };

    setField("title", title);
    setField("category", category);
    setField("sub_category", sub_category);
    setField("description", description);
    setField("budget_min_thb", budget_min_thb);
    setField("budget_max_thb", budget_max_thb);
    setField("target_price", target_price);
    setField("estimated_quantity", estimated_quantity);
    setField("frequency", frequency);
    setField("influencer_note", influencer_note);

    params.push(id);
    await query(
      `UPDATE purchase_demands SET ${updates.join(", ")} WHERE id = $${idx}`,
      params
    );

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

/** 撤回需求（仅 pending 状态可撤回，变为 cancelled） */
influencerRouter.patch("/:id/cancel", async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.userId;
    const id = parseInt(String(req.params.id));

    const existing = await query(
      "SELECT * FROM purchase_demands WHERE id = $1 AND influencer_id = $2",
      [id, uid]
    );
    if (!existing.rows[0]) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }
    if (existing.rows[0].status !== "pending") {
      return res.status(400).json({ error: "STATUS_ERROR", message: "仅待处理状态的需求可以撤回" });
    }

    await query(
      "UPDATE purchase_demands SET status = 'cancelled', updated_at = now() WHERE id = $1",
      [id]
    );
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

// ========== ADMIN ROUTES ==========
const adminRouter = Router();
adminRouter.use(requireAuth);

/** 查看所有需求（支持筛选） */
adminRouter.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { status, influencer_id, category, start_date, end_date } = req.query as Record<string, string>;

    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (status) {
      conditions.push(`pd.status = $${idx++}`);
      params.push(status);
    }
    if (influencer_id) {
      conditions.push(`pd.influencer_id = $${idx++}`);
      params.push(parseInt(influencer_id));
    }
    if (category) {
      conditions.push(`pd.category = $${idx++}`);
      params.push(category);
    }
    if (start_date) {
      conditions.push(`pd.created_at >= $${idx++}`);
      params.push(start_date);
    }
    if (end_date) {
      conditions.push(`pd.created_at <= $${idx++}`);
      params.push(end_date);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await query(
      `SELECT pd.*, u.username as influencer_username, u.display_name as influencer_display_name,
              u.disabled as influencer_disabled,
              ipf.influencer_code, ipf.followers, ipf.category as profile_category,
              ipf.grade as profile_grade, ipf.user_id as profile_user_id
       FROM purchase_demands pd
       LEFT JOIN users u ON pd.influencer_id = u.id
       LEFT JOIN influencer_profiles_full ipf ON pd.influencer_profile_id = ipf.id
       ${where}
       ORDER BY pd.created_at DESC
       LIMIT 500`,
      params
    );
    res.json({ list: rows });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

/** 需求统计 */
adminRouter.get("/stats", async (_req: AuthRequest, res: Response) => {
  try {
    const [r1, r2, r3] = await Promise.all([
      query("SELECT COUNT(*)::int as c FROM purchase_demands WHERE status = 'pending'"),
      query("SELECT COUNT(*)::int as c FROM purchase_demands WHERE status = 'recommended'"),
      query("SELECT COUNT(*)::int as c FROM purchase_demands WHERE status = 'ordered'"),
    ]);
    res.json({
      pending: r1.rows[0]?.c || 0,
      recommended: r2.rows[0]?.c || 0,
      ordered: r3.rows[0]?.c || 0,
    });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

/** 查看需求详情（含推荐商品 + 内部备注） */
adminRouter.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));

    const demand = await query(
      `SELECT pd.*, u.username as influencer_username, u.display_name as influencer_display_name,
              ipf.influencer_code, ipf.followers
       FROM purchase_demands pd
       LEFT JOIN users u ON pd.influencer_id = u.id
       LEFT JOIN influencer_profiles_full ipf ON pd.influencer_profile_id = ipf.id
       WHERE pd.id = $1`,
      [id]
    );
    if (!demand.rows[0]) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    const recs = await query(
      `SELECT pr.*, pp.product_name, pp.source, pp.price_cny, pp.price_thb,
              pp.image_urls, pp.category as product_category, pp.supplier_name,
              pp.estimated_profit_rate, pp.moq, pp.product_link
       FROM purchase_recommendations pr
       JOIN purchase_products pp ON pr.product_id = pp.id
       WHERE pr.demand_id = $1
       ORDER BY pr.created_at DESC`,
      [id]
    );

    res.json({ demand: demand.rows[0], recommendations: recs.rows });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

/** 更新需求状态（手动变更，需备注） */
adminRouter.patch("/:id/status", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    const { status, internal_note } = req.body || {};

    if (!status) {
      return res.status(400).json({ error: "MISSING", message: "状态为必填项" });
    }
    if (!internal_note || !internal_note.trim()) {
      return res.status(400).json({ error: "MISSING_NOTE", message: "状态变更必须填写备注" });
    }

    const validStatuses = ["pending", "recommended", "ordered", "closed", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "INVALID_STATUS", message: `无效的状态值，允许: ${validStatuses.join(", ")}` });
    }

    await query(
      `UPDATE purchase_demands
       SET status = $1, internal_note = $2, updated_at = now()
       WHERE id = $3`,
      [status, internal_note, id]
    );

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

/** 代托管达人提交需求 */
adminRouter.post("/proxy", async (req: AuthRequest, res: Response) => {
  try {
    const {
      influencer_profile_id,
      title, category, sub_category, description,
      budget_min_thb, budget_max_thb, target_price,
      estimated_quantity, frequency, influencer_note,
      internal_note,
    } = req.body || {};

    if (!influencer_profile_id) {
      return res.status(400).json({ error: "MISSING", message: "influencer_profile_id 为必填项" });
    }
    if (!title || !category) {
      return res.status(400).json({ error: "MISSING", message: "标题和品类为必填项" });
    }

    // 查询达人资料
    const prof = await query(
      "SELECT * FROM influencer_profiles_full WHERE id = $1",
      [influencer_profile_id]
    );
    if (!prof.rows[0]) {
      return res.status(404).json({ error: "NOT_FOUND", message: "达人资料不存在" });
    }

    // 仅托管达人（user_id IS NULL）允许代提交
    if (prof.rows[0].user_id !== null) {
      return res.status(400).json({
        error: "FORBIDDEN",
        message: "该达人已关联用户账号，不支持代提交需求，请达人自行提交",
      });
    }

    // 为托管达人创建 disabled 用户账号（与建联模块一致的处理方式）
    const code = String(prof.rows[0].influencer_code || `inf_${influencer_profile_id}`);
    const username = `vc_${code.replace(/[^a-zA-Z0-9_]/g, "_").substring(0, 30)}`;
    const password_hash = await bcrypt.hash("changeme123", 10);
    const existUser = await query("SELECT id FROM users WHERE username = $1", [username]);
    const finalUsername = existUser.rows[0] ? `${username}_${Date.now()}` : username;
    const newUser = await query(
      "INSERT INTO users (username, password_hash, role_id, disabled, display_name) VALUES ($1, $2, 3, 1, $4) RETURNING id",
      [finalUsername, password_hash, code]
    );
    const actualInfluencerId = newUser.rows[0].id;
    await query(
      "UPDATE influencer_profiles_full SET user_id = $1, updated_at = now() WHERE id = $2",
      [actualInfluencerId, influencer_profile_id]
    );

    const { rows } = await query(
      `INSERT INTO purchase_demands
        (influencer_id, influencer_profile_id, title, category, sub_category,
         description, budget_min_thb, budget_max_thb, target_price,
         estimated_quantity, frequency, influencer_note, internal_note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id`,
      [
        actualInfluencerId, influencer_profile_id, title, category,
        sub_category || null, description || null,
        budget_min_thb || null, budget_max_thb || null,
        target_price || null, estimated_quantity || null,
        frequency || "one_time", influencer_note || null,
        internal_note || null,
      ]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

// ========== PRODUCTS ROUTES (管理员/员工) ==========
const productsRouter = Router();
productsRouter.use(requireAuth);
productsRouter.use(requireRole("admin", "employee"));

/** 查看商品列表（支持搜索筛选） */
productsRouter.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { product_name, category, source, supplier_name, status } = req.query as Record<string, string>;

    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (product_name) {
      conditions.push(`pp.product_name ILIKE $${idx++}`);
      params.push(`%${product_name}%`);
    }
    if (category) {
      conditions.push(`pp.category = $${idx++}`);
      params.push(category);
    }
    if (source) {
      conditions.push(`pp.source = $${idx++}`);
      params.push(source);
    }
    if (supplier_name) {
      conditions.push(`pp.supplier_name ILIKE $${idx++}`);
      params.push(`%${supplier_name}%`);
    }
    if (status) {
      conditions.push(`pp.status = $${idx++}`);
      params.push(status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await query(
      `SELECT pp.* FROM purchase_products pp ${where} ORDER BY pp.created_at DESC LIMIT 500`,
      params
    );
    res.json({ list: rows });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

/** 查看商品详情 */
productsRouter.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    const { rows } = await query("SELECT * FROM purchase_products WHERE id = $1", [id]);
    if (!rows[0]) return res.status(404).json({ error: "NOT_FOUND", message: "商品不存在" });
    res.json({ product: rows[0] });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

/** 新增商品（手动录入） */
productsRouter.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const {
      product_name, source, category, sub_category, brand,
      price_cny, price_thb, wholesale_tiers, specifications,
      weight_kg, volume_m3, moq, supplier_name, supplier_rating,
      shipping_from, estimated_shipping_days, sample_available,
      sample_price_cny, competitor_price_thb, suggested_retail_thb,
      estimated_profit_rate, description, search_keywords, tags,
      product_link, image_urls,
    } = req.body || {};

    if (!product_name) {
      return res.status(400).json({ error: "MISSING", message: "商品名称为必填项" });
    }
    if (!source) {
      return res.status(400).json({ error: "MISSING", message: "来源为必填项" });
    }

    const { rows } = await query(
      `INSERT INTO purchase_products
        (source, product_link, product_name, image_urls, category, sub_category,
         brand, price_cny, price_thb, wholesale_tiers, specifications,
         weight_kg, volume_m3, moq, supplier_name, supplier_rating,
         shipping_from, estimated_shipping_days, sample_available,
         sample_price_cny, competitor_price_thb, suggested_retail_thb,
         estimated_profit_rate, description, search_keywords, tags, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,'pending')
       RETURNING id`,
      [
        source, product_link || null, product_name,
        JSON.stringify(image_urls || []), category || null, sub_category || null,
        brand || null, price_cny || null, price_thb || null,
        JSON.stringify(wholesale_tiers || {}), JSON.stringify(specifications || {}),
        weight_kg || null, volume_m3 || null, moq || null,
        supplier_name || null, supplier_rating || null,
        shipping_from || null, estimated_shipping_days || null,
        sample_available || false, sample_price_cny || null,
        competitor_price_thb || null, suggested_retail_thb || null,
        estimated_profit_rate || null, description || null,
        JSON.stringify(search_keywords || []), JSON.stringify(tags || []),
      ]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

/** 编辑商品 */
productsRouter.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    const existing = await query("SELECT id FROM purchase_products WHERE id = $1", [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: "NOT_FOUND" });

    const fields = [
      "source", "product_link", "product_name", "category", "sub_category",
      "brand", "price_cny", "price_thb", "weight_kg", "volume_m3", "moq",
      "supplier_name", "supplier_rating", "shipping_from",
      "estimated_shipping_days", "sample_available", "sample_price_cny",
      "competitor_price_thb", "suggested_retail_thb", "estimated_profit_rate",
      "description", "status",
    ];
    const jsonFields = ["image_urls", "wholesale_tiers", "specifications", "search_keywords", "tags"];

    const updates: string[] = ["updated_at = now()"];
    const params: any[] = [];
    let idx = 1;

    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = $${idx++}`);
        params.push(req.body[f]);
      }
    }
    for (const f of jsonFields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = $${idx++}`);
        params.push(JSON.stringify(req.body[f]));
      }
    }

    if (updates.length === 1) {
      return res.status(400).json({ error: "NO_CHANGES", message: "没有要更新的字段" });
    }

    params.push(id);
    await query(
      `UPDATE purchase_products SET ${updates.join(", ")} WHERE id = $${idx}`,
      params
    );
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

/** 下架商品 */
productsRouter.patch("/:id/deactivate", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    const existing = await query("SELECT id FROM purchase_products WHERE id = $1", [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: "NOT_FOUND" });

    await query(
      "UPDATE purchase_products SET status = 'inactive', updated_at = now() WHERE id = $1",
      [id]
    );
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

/** 批量导入商品 */
productsRouter.post("/batch", async (req: AuthRequest, res: Response) => {
  try {
    const { products } = req.body || {};
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: "MISSING", message: "products 数组不能为空" });
    }

    let success = 0;
    let failed = 0;
    const errors: { index: number; error: string }[] = [];

    for (let i = 0; i < products.length; i++) {
      try {
        const p = products[i];
        if (!p.product_name || !p.source) {
          failed++;
          errors.push({ index: i, error: "商品名称和来源为必填项" });
          continue;
        }
        await query(
          `INSERT INTO purchase_products
            (source, product_link, product_name, image_urls, category, sub_category,
             brand, price_cny, price_thb, wholesale_tiers, specifications,
             weight_kg, volume_m3, moq, supplier_name, supplier_rating,
             shipping_from, estimated_shipping_days, sample_available,
             sample_price_cny, competitor_price_thb, suggested_retail_thb,
             estimated_profit_rate, description, search_keywords, tags, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,'pending')`,
          [
            p.source, p.product_link || null, p.product_name,
            JSON.stringify(p.image_urls || []), p.category || null, p.sub_category || null,
            p.brand || null, p.price_cny || null, p.price_thb || null,
            JSON.stringify(p.wholesale_tiers || {}), JSON.stringify(p.specifications || {}),
            p.weight_kg || null, p.volume_m3 || null, p.moq || null,
            p.supplier_name || null, p.supplier_rating || null,
            p.shipping_from || null, p.estimated_shipping_days || null,
            p.sample_available || false, p.sample_price_cny || null,
            p.competitor_price_thb || null, p.suggested_retail_thb || null,
            p.estimated_profit_rate || null, p.description || null,
            JSON.stringify(p.search_keywords || []), JSON.stringify(p.tags || []),
          ]
        );
        success++;
      } catch (e: any) {
        failed++;
        errors.push({ index: i, error: e.message });
      }
    }

    res.json({ success, failed, errors });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

// ========== RECOMMENDATIONS ROUTES (管理员/员工) ==========
const recommendationsRouter = Router();
recommendationsRouter.use(requireAuth);
recommendationsRouter.use(requireRole("admin", "employee"));

/** 手动推荐商品给需求 */
recommendationsRouter.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const { demand_id, product_id } = req.body || {};
    if (!demand_id || !product_id) {
      return res.status(400).json({ error: "MISSING", message: "demand_id 和 product_id 为必填项" });
    }

    // 检查是否已存在关联
    const dup = await query(
      "SELECT id FROM purchase_recommendations WHERE demand_id = $1 AND product_id = $2",
      [demand_id, product_id]
    );
    if (dup.rows[0]) {
      return res.status(400).json({ error: "DUPLICATE", message: "该商品已推荐给此需求" });
    }

    const { rows } = await query(
      `INSERT INTO purchase_recommendations (demand_id, product_id, method, status)
       VALUES ($1, $2, 'manual', 'pending')
       RETURNING id`,
      [demand_id, product_id]
    );

    // 更新商品推荐计数
    await query(
      "UPDATE purchase_products SET total_recommend_count = total_recommend_count + 1, last_recommended_at = now() WHERE id = $1",
      [product_id]
    );

    res.status(201).json({ id: rows[0].id });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

/** 批量推荐商品给需求 */
recommendationsRouter.post("/batch", async (req: AuthRequest, res: Response) => {
  try {
    const { demand_id, product_ids } = req.body || {};
    if (!demand_id) {
      return res.status(400).json({ error: "MISSING", message: "demand_id 为必填项" });
    }
    if (!Array.isArray(product_ids) || product_ids.length === 0) {
      return res.status(400).json({ error: "MISSING", message: "product_ids 数组不能为空" });
    }

    let inserted = 0;
    let skipped = 0;
    for (const pid of product_ids) {
      try {
        const dup = await query(
          "SELECT id FROM purchase_recommendations WHERE demand_id = $1 AND product_id = $2",
          [demand_id, pid]
        );
        if (dup.rows[0]) { skipped++; continue; }

        await query(
          `INSERT INTO purchase_recommendations (demand_id, product_id, method, status)
           VALUES ($1, $2, 'manual', 'pending')`,
          [demand_id, pid]
        );
        await query(
          "UPDATE purchase_products SET total_recommend_count = total_recommend_count + 1, last_recommended_at = now() WHERE id = $1",
          [pid]
        );
        inserted++;
      } catch { skipped++; }
    }

    res.json({ inserted, skipped });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

/** 查看某个需求的推荐列表 */
recommendationsRouter.get("/demand/:demandId", async (req: AuthRequest, res: Response) => {
  try {
    const demandId = parseInt(String(req.params.demandId));
    const { rows } = await query(
      `SELECT pr.*, pp.product_name, pp.source, pp.price_cny, pp.price_thb,
              pp.image_urls, pp.category as product_category, pp.supplier_name,
              pp.estimated_profit_rate, pp.moq, pp.product_link, pp.brand,
              pp.suggested_retail_thb, pp.competitor_price_thb, pp.status as product_status
       FROM purchase_recommendations pr
       JOIN purchase_products pp ON pr.product_id = pp.id
       WHERE pr.demand_id = $1
       ORDER BY pr.created_at DESC`,
      [demandId]
    );
    res.json({ list: rows });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

/** 代确认推荐（托管达人场景，状态改为 interested） */
recommendationsRouter.patch("/:id/confirm-proxy", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    const existing = await query("SELECT * FROM purchase_recommendations WHERE id = $1", [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: "NOT_FOUND" });

    await query(
      `UPDATE purchase_recommendations
       SET status = 'interested', influencer_feedback = $1
       WHERE id = $2`,
      [req.body.feedback || "管理员代确认", id]
    );
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

/** 更新达人反馈 */
recommendationsRouter.patch("/:id/feedback", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    const { status, influencer_feedback } = req.body || {};

    const existing = await query("SELECT * FROM purchase_recommendations WHERE id = $1", [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: "NOT_FOUND" });

    if (status && !["interested", "rejected"].includes(status)) {
      return res.status(400).json({ error: "INVALID_STATUS", message: "状态仅允许 interested 或 rejected" });
    }

    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (status) {
      updates.push(`status = $${idx++}`);
      params.push(status);
    }
    if (influencer_feedback !== undefined) {
      updates.push(`influencer_feedback = $${idx++}`);
      params.push(influencer_feedback);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "NO_CHANGES", message: "没有要更新的字段" });
    }

    params.push(id);
    await query(
      `UPDATE purchase_recommendations SET ${updates.join(", ")} WHERE id = $${idx}`,
      params
    );
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

// ========== ORDER HELPERS ==========
function genOrderNo(): string {
  return `PO-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/** 写入进度日志 */
async function insertOrderLog(orderId: number, fromStatus: string | null, toStatus: string, note: string | null, operatorId: number) {
  await query(
    `INSERT INTO purchase_order_logs (order_id, from_status, to_status, note, operator_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [orderId, fromStatus, toStatus, note || null, operatorId]
  );
}

/** 合法状态流转（管理员推进时校验） */
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending_approval: ["approved", "cancelled"],
  approved: ["purchasing", "cancelled"],
  purchasing: ["shipped_cn", "cancelled"],
  shipped_cn: ["arrived_cn_warehouse", "cancelled"],
  arrived_cn_warehouse: ["shipped_th", "cancelled"],
  shipped_th: ["customs_cleared", "cancelled"],
  customs_cleared: ["arrived", "cancelled"],
  arrived: ["completed", "cancelled"],
};

// ========== INFLUENCER ORDER ROUTES ==========
const influencerOrderRouter = Router();
influencerOrderRouter.use(requireAuth);
influencerOrderRouter.use(requireRole("influencer"));

/** 下单 */
influencerOrderRouter.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.userId;
    const { demand_id, product_id, selected_specs, quantity } = req.body || {};

    if (!product_id || !quantity) {
      return res.status(400).json({ error: "MISSING", message: "product_id 和 quantity 为必填项" });
    }

    // 查询商品价格
    const prod = await query("SELECT price_cny, price_thb FROM purchase_products WHERE id = $1", [product_id]);
    if (!prod.rows[0]) return res.status(404).json({ error: "NOT_FOUND", message: "商品不存在" });

    const unit_price_cny = Number(prod.rows[0].price_cny) || 0;
    const unit_price_thb = Number(prod.rows[0].price_thb) || 0;
    const total_price_cny = unit_price_cny * quantity;
    const total_price_thb = unit_price_thb * quantity;
    const total_payable = total_price_thb;

    const order_no = genOrderNo();
    const { rows } = await query(
      `INSERT INTO purchase_orders
        (order_no, demand_id, influencer_id, product_id, selected_specs, quantity,
         unit_price_cny, total_price_cny, total_price_thb, total_payable)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id`,
      [
        order_no, demand_id || null, uid, product_id,
        JSON.stringify(selected_specs || {}), quantity,
        unit_price_cny, total_price_cny, total_price_thb, total_payable,
      ]
    );
    const orderId = rows[0].id;

    // 写入初始日志
    await insertOrderLog(orderId, null, "pending_approval", "达人提交订货单", uid);

    // 更新需求状态为 ordered
    if (demand_id) {
      await query(
        "UPDATE purchase_demands SET status = 'ordered', updated_at = now() WHERE id = $1 AND status = 'recommended'",
        [demand_id]
      );
    }

    res.status(201).json({ id: orderId, order_no });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

/** 查看自己的订货单列表 */
influencerOrderRouter.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.userId;
    const { rows } = await query(
      `SELECT po.*, pp.product_name, pp.image_urls as product_images, pp.price_thb as product_price_thb,
              pd.title as demand_title
       FROM purchase_orders po
       LEFT JOIN purchase_products pp ON po.product_id = pp.id
       LEFT JOIN purchase_demands pd ON po.demand_id = pd.id
       WHERE po.influencer_id = $1
       ORDER BY po.created_at DESC
       LIMIT 200`,
      [uid]
    );
    res.json({ list: rows });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

/** 查看订货单详情（含进度日志） */
influencerOrderRouter.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.userId;
    const id = parseInt(String(req.params.id));

    const order = await query(
      `SELECT po.*, pp.product_name, pp.image_urls as product_images,
              pp.price_thb as product_price_thb, pp.source as product_source,
              pp.category as product_category, pp.supplier_name,
              pd.title as demand_title
       FROM purchase_orders po
       LEFT JOIN purchase_products pp ON po.product_id = pp.id
       LEFT JOIN purchase_demands pd ON po.demand_id = pd.id
       WHERE po.id = $1 AND po.influencer_id = $2`,
      [id, uid]
    );
    if (!order.rows[0]) return res.status(404).json({ error: "NOT_FOUND", message: "订货单不存在或无权访问" });

    const logs = await query(
      `SELECT pol.*, u.username as operator_name
       FROM purchase_order_logs pol
       LEFT JOIN users u ON pol.operator_id = u.id
       WHERE pol.order_id = $1
       ORDER BY pol.created_at ASC`,
      [id]
    );

    res.json({ order: order.rows[0], logs: logs.rows });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

/** 确认收货 */
influencerOrderRouter.patch("/:id/confirm-received", async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.userId;
    const id = parseInt(String(req.params.id));

    const order = await query("SELECT * FROM purchase_orders WHERE id = $1 AND influencer_id = $2", [id, uid]);
    if (!order.rows[0]) return res.status(404).json({ error: "NOT_FOUND" });
    if (order.rows[0].status !== "arrived") {
      return res.status(400).json({ error: "STATUS_ERROR", message: "仅已到货状态的订单可确认收货" });
    }

    await query(
      "UPDATE purchase_orders SET status = 'completed', confirmed_received_at = now(), updated_at = now() WHERE id = $1",
      [id]
    );
    await insertOrderLog(id, "arrived", "completed", "达人确认收货", uid);

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

/** 提交退货申请 */
influencerOrderRouter.post("/:id/return-request", async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.userId;
    const id = parseInt(String(req.params.id));
    const { reason, photos } = req.body || {};

    if (!reason) {
      return res.status(400).json({ error: "MISSING", message: "退货原因为必填项" });
    }

    const order = await query("SELECT * FROM purchase_orders WHERE id = $1 AND influencer_id = $2", [id, uid]);
    if (!order.rows[0]) return res.status(404).json({ error: "NOT_FOUND" });

    const allowedStatuses = ["arrived", "completed"];
    if (!allowedStatuses.includes(order.rows[0].status)) {
      return res.status(400).json({ error: "STATUS_ERROR", message: "仅已到货或已完成的订单可提交退货申请" });
    }

    const note = JSON.stringify({ type: "return_request", reason, photos: photos || [] });
    await insertOrderLog(id, order.rows[0].status, "return_requested", note, uid);

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

// ========== ADMIN ORDER ROUTES ==========
const adminOrderRouter = Router();
adminOrderRouter.use(requireAuth);

/** 查看所有订货单 */
adminOrderRouter.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const { status, influencer_id, start_date, end_date } = req.query as Record<string, string>;

    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (status) {
      conditions.push(`po.status = $${idx++}`);
      params.push(status);
    }
    if (influencer_id) {
      conditions.push(`po.influencer_id = $${idx++}`);
      params.push(parseInt(influencer_id));
    }
    if (start_date) {
      conditions.push(`po.created_at >= $${idx++}`);
      params.push(start_date);
    }
    if (end_date) {
      conditions.push(`po.created_at <= $${idx++}`);
      params.push(end_date);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await query(
      `SELECT po.*, pp.product_name, pp.image_urls as product_images,
              u.username as influencer_username, u.display_name as influencer_display_name,
              u.disabled as influencer_disabled,
              ipf.influencer_code, ipf.user_id as profile_user_id, pd.title as demand_title
       FROM purchase_orders po
       LEFT JOIN purchase_products pp ON po.product_id = pp.id
       LEFT JOIN users u ON po.influencer_id = u.id
       LEFT JOIN influencer_profiles_full ipf ON u.id = ipf.user_id
       LEFT JOIN purchase_demands pd ON po.demand_id = pd.id
       ${where}
       ORDER BY po.created_at DESC
       LIMIT 500`,
      params
    );
    res.json({ list: rows });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

/** 查看订货单详情（含进度日志 + 内部备注） */
adminOrderRouter.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));

    const order = await query(
      `SELECT po.*, pp.product_name, pp.image_urls as product_images,
              pp.price_thb as product_price_thb, pp.source as product_source,
              pp.category as product_category, pp.supplier_name,
              u.username as influencer_username, u.display_name as influencer_display_name,
              u.disabled as influencer_disabled,
              ipf.influencer_code, ipf.user_id as profile_user_id, pd.title as demand_title
       FROM purchase_orders po
       LEFT JOIN purchase_products pp ON po.product_id = pp.id
       LEFT JOIN users u ON po.influencer_id = u.id
       LEFT JOIN influencer_profiles_full ipf ON u.id = ipf.user_id
       LEFT JOIN purchase_demands pd ON po.demand_id = pd.id
       WHERE po.id = $1`,
      [id]
    );
    if (!order.rows[0]) return res.status(404).json({ error: "NOT_FOUND" });

    const logs = await query(
      `SELECT pol.*, u.username as operator_name
       FROM purchase_order_logs pol
       LEFT JOIN users u ON pol.operator_id = u.id
       WHERE pol.order_id = $1
       ORDER BY pol.created_at ASC`,
      [id]
    );

    res.json({ order: order.rows[0], logs: logs.rows });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

/** 审核订货单（通过/拒绝） */
adminOrderRouter.patch("/:id/review", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    const { action, note } = req.body || {};
    const uid = req.user!.userId;

    if (!action || !["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: "MISSING", message: "action 必须为 approve 或 reject" });
    }

    const order = await query("SELECT * FROM purchase_orders WHERE id = $1", [id]);
    if (!order.rows[0]) return res.status(404).json({ error: "NOT_FOUND" });
    if (order.rows[0].status !== "pending_approval") {
      return res.status(400).json({ error: "STATUS_ERROR", message: "仅待审核状态的订单可审核" });
    }

    if (action === "approve") {
      await query("UPDATE purchase_orders SET status = 'approved', updated_at = now() WHERE id = $1", [id]);
      await insertOrderLog(id, "pending_approval", "approved", note || "审核通过", uid);
    } else {
      if (!note || !note.trim()) {
        return res.status(400).json({ error: "MISSING_NOTE", message: "拒绝必须填写原因" });
      }
      await query("UPDATE purchase_orders SET status = 'cancelled', internal_note = $1, updated_at = now() WHERE id = $2", [note, id]);
      await insertOrderLog(id, "pending_approval", "cancelled", note, uid);
    }

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

/** 更新进度状态 */
adminOrderRouter.patch("/:id/status", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    const { status, note } = req.body || {};
    const uid = req.user!.userId;

    if (!status) {
      return res.status(400).json({ error: "MISSING", message: "目标状态为必填项" });
    }
    if (!note || !note.trim()) {
      return res.status(400).json({ error: "MISSING_NOTE", message: "状态变更必须填写备注" });
    }

    const order = await query("SELECT * FROM purchase_orders WHERE id = $1", [id]);
    if (!order.rows[0]) return res.status(404).json({ error: "NOT_FOUND" });

    const currentStatus = order.rows[0].status;
    const allowed = VALID_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(status)) {
      return res.status(400).json({
        error: "INVALID_TRANSITION",
        message: `不允许从 ${currentStatus} 变更为 ${status}。允许的下一步: ${allowed ? allowed.join(", ") : "无"}`,
      });
    }

    await query(
      "UPDATE purchase_orders SET status = $1, updated_at = now() WHERE id = $2",
      [status, id]
    );
    await insertOrderLog(id, currentStatus, status, note, uid);

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

/** 代下单（托管达人） */
adminOrderRouter.post("/proxy", async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.userId;
    const { influencer_profile_id, demand_id, product_id, selected_specs, quantity } = req.body || {};

    if (!influencer_profile_id) {
      return res.status(400).json({ error: "MISSING", message: "influencer_profile_id 为必填项" });
    }
    if (!product_id || !quantity) {
      return res.status(400).json({ error: "MISSING", message: "product_id 和 quantity 为必填项" });
    }

    // 查询达人资料
    const prof = await query("SELECT * FROM influencer_profiles_full WHERE id = $1", [influencer_profile_id]);
    if (!prof.rows[0]) return res.status(404).json({ error: "NOT_FOUND", message: "达人资料不存在" });

    // 仅托管达人（user_id IS NULL 或关联 disabled 用户）允许代下单
    let actualInfluencerId = prof.rows[0].user_id as number | null;
    if (actualInfluencerId) {
      const u = await query("SELECT disabled FROM users WHERE id = $1", [actualInfluencerId]);
      if (!u.rows[0] || u.rows[0].disabled !== 1) {
        return res.status(400).json({ error: "FORBIDDEN", message: "该达人非托管达人，不支持代下单" });
      }
    } else {
      // 无 user_id：创建 disabled 用户
      const code = String(prof.rows[0].influencer_code || `inf_${influencer_profile_id}`);
      const username = `vc_${code.replace(/[^a-zA-Z0-9_]/g, "_").substring(0, 30)}`;
      const password_hash = await bcrypt.hash("changeme123", 10);
      const existUser = await query("SELECT id FROM users WHERE username = $1", [username]);
      const finalUsername = existUser.rows[0] ? `${username}_${Date.now()}` : username;
      const newUser = await query(
        "INSERT INTO users (username, password_hash, role_id, disabled, display_name) VALUES ($1, $2, 3, 1, $4) RETURNING id",
        [finalUsername, password_hash, code]
      );
      actualInfluencerId = newUser.rows[0].id;
      await query("UPDATE influencer_profiles_full SET user_id = $1, updated_at = now() WHERE id = $2", [actualInfluencerId, influencer_profile_id]);
    }

    // 查询商品价格
    const prod = await query("SELECT price_cny, price_thb FROM purchase_products WHERE id = $1", [product_id]);
    if (!prod.rows[0]) return res.status(404).json({ error: "NOT_FOUND", message: "商品不存在" });

    const unit_price_cny = Number(prod.rows[0].price_cny) || 0;
    const unit_price_thb = Number(prod.rows[0].price_thb) || 0;
    const total_price_cny = unit_price_cny * quantity;
    const total_price_thb = unit_price_thb * quantity;

    const order_no = genOrderNo();
    const { rows } = await query(
      `INSERT INTO purchase_orders
        (order_no, demand_id, influencer_id, product_id, selected_specs, quantity,
         unit_price_cny, total_price_cny, total_price_thb, total_payable)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id`,
      [
        order_no, demand_id || null, actualInfluencerId, product_id,
        JSON.stringify(selected_specs || {}), quantity,
        unit_price_cny, total_price_cny, total_price_thb, total_price_thb,
      ]
    );
    await insertOrderLog(rows[0].id, null, "pending_approval", "管理员代达人下单", uid);

    if (demand_id) {
      await query(
        "UPDATE purchase_demands SET status = 'ordered', updated_at = now() WHERE id = $1 AND status = 'recommended'",
        [demand_id]
      );
    }

    res.status(201).json({ id: rows[0].id, order_no });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

/** 代确认收货（托管达人） */
adminOrderRouter.patch("/:id/confirm-received-proxy", async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.userId;
    const id = parseInt(String(req.params.id));

    const order = await query("SELECT * FROM purchase_orders WHERE id = $1", [id]);
    if (!order.rows[0]) return res.status(404).json({ error: "NOT_FOUND" });
    if (order.rows[0].status !== "arrived") {
      return res.status(400).json({ error: "STATUS_ERROR", message: "仅已到货状态的订单可确认收货" });
    }

    await query(
      "UPDATE purchase_orders SET status = 'completed', confirmed_received_at = now(), updated_at = now() WHERE id = $1",
      [id]
    );
    await insertOrderLog(id, "arrived", "completed", req.body.note || "管理员代确认收货", uid);

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

/** 更新物流追踪信息 */
adminOrderRouter.patch("/:id/logistics", async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.userId;
    const id = parseInt(String(req.params.id));
    const { company, tracking_no, link } = req.body || {};

    if (!company && !tracking_no) {
      return res.status(400).json({ error: "MISSING", message: "物流公司或单号为必填项" });
    }

    const order = await query("SELECT * FROM purchase_orders WHERE id = $1", [id]);
    if (!order.rows[0]) return res.status(404).json({ error: "NOT_FOUND" });

    const logistics = JSON.stringify({ company: company || "", tracking_no: tracking_no || "", link: link || "", updated_at: new Date().toISOString() });

    await query(
      "UPDATE purchase_orders SET logistics_info = $1, updated_at = now() WHERE id = $2",
      [logistics, id]
    );
    await insertOrderLog(id, order.rows[0].status, order.rows[0].status, `更新物流: ${company || ""} ${tracking_no || ""}`, uid);

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

/** 记录付款信息 */
adminOrderRouter.patch("/:id/payment", async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user!.userId;
    const id = parseInt(String(req.params.id));
    const { paid_amount, paid_at } = req.body || {};

    if (!paid_amount) {
      return res.status(400).json({ error: "MISSING", message: "已付金额为必填项" });
    }

    const order = await query("SELECT * FROM purchase_orders WHERE id = $1", [id]);
    if (!order.rows[0]) return res.status(404).json({ error: "NOT_FOUND" });

    await query(
      `UPDATE purchase_orders
       SET is_paid = true, paid_amount = $1, paid_at = $2, updated_at = now()
       WHERE id = $3`,
      [paid_amount, paid_at || new Date().toISOString(), id]
    );
    await insertOrderLog(id, order.rows[0].status, order.rows[0].status, `记录付款 ฿${paid_amount}`, uid);

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: e.message });
  }
});

export const purchaseInfluencerDemandsRoutes = influencerRouter;
export const purchaseAdminDemandsRoutes = adminRouter;
export const purchaseProductsRoutes = productsRouter;
export const purchaseRecommendationsRoutes = recommendationsRouter;
export const purchaseInfluencerOrderRoutes = influencerOrderRouter;
export const purchaseAdminOrderRoutes = adminOrderRouter;
