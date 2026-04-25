import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import { promises as fs } from "fs";
import { requireAuth, type AuthRequest } from "../auth";
import { query, withTx } from "../db";
import { getUploadsRoot } from "../uploadsConfig";
import { isVisibleCooperationType, readCooperationTypesConfig } from "../cooperationTypes";

const router = Router();
router.use(requireAuth);
const matchingUpload = multer({ storage: multer.memoryStorage() });

/** 创建系统通知消息。 */
async function createMessage(userId: number, category: string, title: string, content: string, relatedType?: string, relatedId?: number): Promise<void> {
  await query(
    `INSERT INTO system_messages (user_id, category, title, content, related_type, related_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, category, title, content, relatedType ?? null, relatedId ?? null]
  );
}

/** 会员等级到泰铢价格映射。 */
function getMemberPrice(level: number): number {
  if (level === 1) return 3000;
  if (level === 2) return 5000;
  if (level === 3) return 8000;
  return 0;
}

/** 将擅长领域数组规范化为去重后的字符串数组。 */
function normalizeDomains(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const list = input
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .slice(0, 20);
  return Array.from(new Set(list));
}

/** 判断达人信息是否已完善。 */
function isInfluencerProfileComplete(row: {
  tiktok_account: string | null;
  tiktok_fans: string | null;
  expertise_domains: string | null;
  influencer_bio: string | null;
} | null | undefined): boolean {
  if (!row) return false;
  if (!String(row.tiktok_account || "").trim()) return false;
  if (!String(row.tiktok_fans || "").trim()) return false;
  if (!String(row.expertise_domains || "").trim()) return false;
  if (!String(row.influencer_bio || "").trim()) return false;
  return true;
}

/** 商家端：读取会员与保证金信息。 */
router.get("/client/member", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "client") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  try {
    await query("INSERT INTO merchant_profiles (client_id) VALUES ($1) ON CONFLICT (client_id) DO NOTHING", [req.user.userId]);
    const ret = await query(
      `SELECT member_level, member_expire_time, deposit_amount, deposit_frozen, deposit_status
         FROM merchant_profiles
        WHERE client_id=$1`,
      [req.user.userId]
    );
    const logs = await query(
      `SELECT id, change_amount, type, ref_order_id, note, created_at
         FROM deposit_log
        WHERE client_id=$1
        ORDER BY id DESC
        LIMIT 100`,
      [req.user.userId]
    );
    return res.json({ profile: ret.rows[0] || null, logs: logs.rows });
  } catch (e) {
    console.error("client member read error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

/** 商家端：购买/续费会员。 */
router.post("/client/member/purchase", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "client") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  const level = Number(req.body?.level);
  const months = Math.max(1, Math.min(24, Number(req.body?.months || 1)));
  if (![1, 2, 3].includes(level)) return res.status(400).json({ error: "INVALID_LEVEL", message: "会员等级无效。" });
  const amount = getMemberPrice(level) * months;
  try {
    const ret = await withTx(async (client) => {
      await client.query("INSERT INTO merchant_profiles (client_id) VALUES ($1) ON CONFLICT (client_id) DO NOTHING", [req.user!.userId]);
      const cur = await client.query<{ member_expire_time: string | null }>("SELECT member_expire_time FROM merchant_profiles WHERE client_id=$1 FOR UPDATE", [req.user!.userId]);
      const base = cur.rows[0]?.member_expire_time ? "GREATEST(member_expire_time, now())" : "now()";
      await client.query(
        `UPDATE merchant_profiles
            SET member_level=$2,
                member_expire_time=${base} + make_interval(months => $3),
                updated_at=now()
          WHERE client_id=$1`,
        [req.user!.userId, level, months]
      );
      const order = await client.query<{ id: number }>(
        `INSERT INTO member_orders (client_id, member_level, amount, months, status, expire_time)
         SELECT $1, $2, $3, $4, 'paid', member_expire_time FROM merchant_profiles WHERE client_id=$1
         RETURNING id`,
        [req.user!.userId, level, amount, months]
      );
      return order.rows[0]?.id;
    });
    return res.status(201).json({ ok: true, order_id: ret });
  } catch (e) {
    console.error("client member purchase error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

/** 商家端：保证金充值。 */
router.post("/client/deposit/topup", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "client") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "INVALID_AMOUNT", message: "请输入有效金额。" });
  try {
    await withTx(async (client) => {
      await client.query("INSERT INTO merchant_profiles (client_id) VALUES ($1) ON CONFLICT (client_id) DO NOTHING", [req.user!.userId]);
      await client.query(
        `UPDATE merchant_profiles
            SET deposit_amount = deposit_amount + $2,
                deposit_status = 'active',
                updated_at = now()
          WHERE client_id = $1`,
        [req.user!.userId, amount]
      );
      await client.query(
        `INSERT INTO deposit_log (client_id, change_amount, type, note)
         VALUES ($1, $2, 'pay', '商家主动充值保证金')`,
        [req.user!.userId, amount]
      );
    });
    return res.status(201).json({ ok: true });
  } catch (e) {
    console.error("client deposit topup error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

/** 达人端：读取收款信息。 */
router.get("/influencer/payment-profile", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "influencer") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  try {
    const ret = await query(
      `SELECT real_name, bank_name, bank_card
         FROM users
        WHERE id=$1`,
      [req.user.userId]
    );
    return res.json({ profile: ret.rows[0] || null });
  } catch (e) {
    console.error("influencer payment profile read error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

/** 达人端：保存收款信息（任务结算展示给商家）。 */
router.put("/influencer/payment-profile", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "influencer") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  const realName = String(req.body?.real_name || "").trim();
  const bankName = String(req.body?.bank_name || "").trim();
  const bankCard = String(req.body?.bank_card || "").trim();
  if (!realName || !bankName || !bankCard) {
    return res.status(400).json({ error: "INVALID_INPUT", message: "请完整填写收款信息。" });
  }
  try {
    await query(
      `UPDATE users
          SET real_name=$2,
              bank_name=$3,
              bank_card=$4
        WHERE id=$1`,
      [req.user.userId, realName, bankName, bankCard]
    );
    return res.json({ ok: true });
  } catch (e) {
    console.error("influencer payment profile write error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

/** 商家端：创建撮合免积分订单（独立于原积分单）。 */
/** 商家端读取商家信息模板。 */
/** 达人端：读取达人信息（报名必填）。 */
router.get("/influencer/profile", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "influencer") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  try {
    const ret = await query<{
      tiktok_account: string | null;
      tiktok_fans: string | null;
      expertise_domains: string | null;
      influencer_bio: string | null;
    }>(
      `SELECT tiktok_account, tiktok_fans, expertise_domains, influencer_bio
         FROM users
        WHERE id=$1`,
      [req.user.userId],
    );
    const row = ret.rows[0] || null;
    const domains = row?.expertise_domains ? String(row.expertise_domains).split(",").map((s) => s.trim()).filter(Boolean) : [];
    return res.json({
      profile: row
        ? {
            tiktok_account: String(row.tiktok_account || ""),
            tiktok_fans: String(row.tiktok_fans || ""),
            expertise_domains: domains,
            influencer_bio: String(row.influencer_bio || ""),
            completed: isInfluencerProfileComplete(row),
          }
        : null,
    });
  } catch (e) {
    console.error("influencer profile read error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

/** 达人端：保存达人信息（报名必填）。 */
router.put("/influencer/profile", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "influencer") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });

  const tiktokAccount = String(req.body?.tiktok_account || "").trim();
  const tiktokFans = String(req.body?.tiktok_fans || "").trim();
  const influencerBio = String(req.body?.influencer_bio || "").trim();
  const domains = normalizeDomains(req.body?.expertise_domains);

  if (!tiktokAccount || !/^@?[A-Za-z0-9._]{2,32}$/.test(tiktokAccount)) {
    return res.status(400).json({ error: "INVALID_TIKTOK_ACCOUNT", message: "请填写有效的 TikTok 账号。" });
  }
  if (!tiktokFans || !/^[0-9]+(\+|\s*-\s*[0-9]+)?$/.test(tiktokFans)) {
    return res.status(400).json({ error: "INVALID_TIKTOK_FANS", message: "粉丝数量仅支持正整数或区间格式。" });
  }
  if (domains.length === 0) {
    return res.status(400).json({ error: "INVALID_EXPERTISE_DOMAINS", message: "请至少选择一个擅长领域。" });
  }
  if (!influencerBio) {
    return res.status(400).json({ error: "INVALID_INFLUENCER_BIO", message: "请填写自我介绍/个人优势。" });
  }

  try {
    await query(
      `UPDATE users
          SET tiktok_account=$2,
              tiktok_fans=$3,
              expertise_domains=$4,
              influencer_bio=$5,
              updated_at=now()
        WHERE id=$1`,
      [req.user.userId, tiktokAccount, tiktokFans, domains.join(","), influencerBio],
    );
    return res.json({ ok: true });
  } catch (e) {
    console.error("influencer profile save error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

router.get("/client/merchant-info-template", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "client") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  try {
    const ret = await query(
      `SELECT shop_name, product_type, shop_link, shop_rating, user_reviews
         FROM client_merchant_info_templates
        WHERE client_id=$1`,
      [req.user.userId]
    );
    return res.json({ template: ret.rows[0] || null });
  } catch (e) {
    console.error("client merchant template read error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

/** 商家端保存商家信息模板。 */
router.put("/client/merchant-info-template", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "client") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  const shopName = String(req.body?.shop_name || "").trim();
  const productType = String(req.body?.product_type || "").trim();
  const shopLink = String(req.body?.shop_link || "").trim();
  const shopRating = String(req.body?.shop_rating || "").trim();
  const userReviews = String(req.body?.user_reviews || "").trim();
  if (!shopName || !productType || !shopLink || !shopRating || !userReviews) {
    return res.status(400).json({ error: "INVALID_INPUT", message: "请完整填写商家信息模板。" });
  }
  try {
    await query(
      `INSERT INTO client_merchant_info_templates (client_id, shop_name, product_type, shop_link, shop_rating, user_reviews)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (client_id)
       DO UPDATE SET shop_name=EXCLUDED.shop_name, product_type=EXCLUDED.product_type, shop_link=EXCLUDED.shop_link,
                     shop_rating=EXCLUDED.shop_rating, user_reviews=EXCLUDED.user_reviews, updated_at=now()`,
      [req.user.userId, shopName, productType, shopLink, shopRating, userReviews]
    );
    return res.json({ ok: true });
  } catch (e) {
    console.error("client merchant template save error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

router.post("/client/matching-orders", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "client") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  const title = String(req.body?.title || "").trim();
  const taskAmount = Number(req.body?.task_amount);
  let allowApply = req.body?.allow_apply === false ? 0 : 1;
  const requirement = String(req.body?.requirement || "").trim();
  const detailPayload = req.body?.detail && typeof req.body.detail === "object" ? req.body.detail : null;
  const attachments = Array.isArray(req.body?.attachments)
    ? (req.body.attachments as unknown[]).map((x) => String(x || "").trim()).filter(Boolean).slice(0, 20)
    : [];
  if (!title || title.length > 200) return res.status(400).json({ error: "INVALID_TITLE", message: "请填写任务标题（1-200字）。" });
  if (!Number.isFinite(taskAmount) || taskAmount <= 0) return res.status(400).json({ error: "INVALID_AMOUNT", message: "请填写有效任务金额。" });
  try {
    const coopTypeId =
      detailPayload && typeof (detailPayload as any).cooperation_type_id === "string" ? String((detailPayload as any).cooperation_type_id).trim() : "";
    if (coopTypeId) {
      const cfg = await readCooperationTypesConfig();
      if (!isVisibleCooperationType(cfg, coopTypeId, "client")) {
        return res.status(400).json({ error: "INVALID_COOPERATION_TYPE", message: "无效的合作业务类型。" });
      }
    }
    if (coopTypeId === "high_quality_custom_video" || coopTypeId === "monthly_package" || coopTypeId === "creator_review_video") {
      return res.status(400).json({ error: "VIDEO_ORDERS_ONLY", message: "该类型属于视频分级订单，请在【视频分级订单】模块发布订单。" });
    }
    const ret = await withTx(async (client) => {
      await client.query("INSERT INTO merchant_profiles (client_id) VALUES ($1) ON CONFLICT (client_id) DO NOTHING", [req.user!.userId]);
      const profile = await client.query<{ member_level: number; deposit_amount: string; deposit_frozen: string }>(
        "SELECT member_level, deposit_amount, deposit_frozen FROM merchant_profiles WHERE client_id=$1 FOR UPDATE",
        [req.user!.userId]
      );
      const p = profile.rows[0];
      if (!p || Number(p.member_level || 0) < 1) return { kind: "member_required" as const };
      const tpl = await client.query<{ shop_name: string; product_type: string; shop_link: string; shop_rating: string; user_reviews: string }>(
        `SELECT shop_name, product_type, shop_link, shop_rating, user_reviews FROM client_merchant_info_templates WHERE client_id=$1`,
        [req.user!.userId]
      );
      const merchantTemplate = tpl.rows[0];
      if (!merchantTemplate) return { kind: "merchant_template_required" as const };
      const available = Number(p.deposit_amount || 0) - Number(p.deposit_frozen || 0);
      if (available < taskAmount) return { kind: "deposit_insufficient" as const, available };
      const detailWithMerchant = {
        ...(detailPayload || {}),
        merchant_info: {
          shop_name: merchantTemplate.shop_name,
          product_type: merchantTemplate.product_type,
          shop_link: merchantTemplate.shop_link,
          shop_rating: merchantTemplate.shop_rating,
          user_reviews: merchantTemplate.user_reviews,
        },
      };
      const ins = await client.query<{ id: number; order_no: string }>(
        `INSERT INTO client_market_orders
           (client_id, order_no, title, reward_points, tier, creator_reward_points, platform_profit_points, pay_deducted, status, match_status, order_type, allow_apply, task_amount, deposit_frozen)
         VALUES ($1, 'MH-' || to_char(now(),'YYYYMMDD') || '-' || floor(random()*900000+100000)::text, $2, 10, 'C', 5, 5, 0, 'open', 'open', 1, $3, $4, $4)
         RETURNING id, order_no`,
        [req.user!.userId, requirement ? `${title}｜${requirement}` : title, allowApply, taskAmount]
      );
      const inserted = ins.rows[0];
      if (!inserted) return { kind: "db_error" as const };
      await client.query(
        `INSERT INTO matching_order_details (order_id, detail_json, attachment_urls)
         VALUES ($1, $2::jsonb, $3::jsonb)
         ON CONFLICT (order_id)
         DO UPDATE SET detail_json=EXCLUDED.detail_json, attachment_urls=EXCLUDED.attachment_urls, updated_at=now()`,
        [inserted.id, JSON.stringify(detailWithMerchant), JSON.stringify(attachments)]
      );
      await client.query(
        `UPDATE merchant_profiles
            SET deposit_frozen = deposit_frozen + $2,
                deposit_status = CASE WHEN deposit_amount - (deposit_frozen + $2) <= 0 THEN 'warning' ELSE deposit_status END,
                updated_at = now()
          WHERE client_id=$1`,
        [req.user!.userId, taskAmount]
      );
      await client.query(
        `INSERT INTO deposit_log (client_id, change_amount, type, ref_order_id, note)
         VALUES ($1, $2, 'freeze', $3, '发布撮合单冻结保证金')`,
        [req.user!.userId, -taskAmount, inserted.id]
      );
      return { kind: "ok" as const, id: inserted.id, order_no: inserted.order_no };
    });
    if (ret.kind === "member_required") return res.status(403).json({ error: "MEMBER_REQUIRED", message: "开通会员后才可发布撮合订单。" });
    if (ret.kind === "merchant_template_required") return res.status(400).json({ error: "MERCHANT_TEMPLATE_REQUIRED", message: "请先完善商家信息模板后再发布撮合订单。" });
    if (ret.kind === "deposit_insufficient") return res.status(409).json({ error: "DEPOSIT_INSUFFICIENT", message: `保证金不足，可用余额 ${ret.available}。` });
    if (ret.kind === "db_error") return res.status(500).json({ error: "DB_ERROR", message: "创建失败，请重试。" });
    return res.status(201).json({ id: ret.id, order_no: ret.order_no });
  } catch (e) {
    console.error("client create matching order error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});



/** 商家端：上传撮合任务图片/短视频（落盘）。 */
router.post("/client/matching-orders/upload", (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "client") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  matchingUpload.array("files", 20)(req as any, res as any, async (uploadErr: unknown) => {
    if (uploadErr) {
      const msg = uploadErr instanceof Error ? uploadErr.message : "上传失败";
      return res.status(400).json({ error: "UPLOAD_FAILED", message: msg });
    }
    try {
      const files = ((req as any).files || []) as Express.Multer.File[];
      if (!files.length) return res.status(400).json({ error: "NO_FILES", message: "请选择文件。" });
      const uploadDir = path.join(getUploadsRoot(), "matching-orders", String(req.user!.userId));
      await fs.mkdir(uploadDir, { recursive: true });
      const base = `${req.protocol}://${req.get("host")}`;
      const urls: string[] = [];
      for (const f of files) {
        const ext = path.extname(f.originalname || "").toLowerCase();
        const safeExt = ext && ext.length <= 10 ? ext : "";
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`;
        const filepath = path.join(uploadDir, filename);
        await fs.writeFile(filepath, f.buffer);
        urls.push(`${base}/uploads/matching-orders/${req.user!.userId}/${filename}`);
      }
      return res.json({ urls });
    } catch (e) {
      console.error("client matching order upload error:", e);
      return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
    }
  });
});

/** 商家端：撮合免积分订单列表。 */
router.get("/client/matching-orders", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "client") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  try {
    const videoTypeIds = ["high_quality_custom_video", "monthly_package", "creator_review_video"];
    const rows = await query(
      `SELECT mo.id, mo.order_no, mo.title, mo.status, mo.match_status, mo.order_type, mo.allow_apply, mo.task_amount, mo.deposit_frozen, mo.influencer_id, mo.work_links, mo.created_at, mo.updated_at,
              md.detail_json, md.attachment_urls,
              COALESCE(md.detail_json->>'cooperation_type_id','') AS cooperation_type_id,
              COALESCE(cs.phase,'none') AS coop_phase,
              COALESCE(cs.publish_links,'[]'::jsonb) AS coop_publish_links
         FROM client_market_orders mo
         LEFT JOIN matching_order_details md ON md.order_id=mo.id
         LEFT JOIN cooperation_order_states cs ON cs.order_id=mo.id
        WHERE mo.client_id=$1 AND mo.is_deleted=0 AND COALESCE(mo.order_type,0)=1
          AND COALESCE(md.detail_json->>'cooperation_type_id','') <> ALL($2::text[])
        ORDER BY mo.id DESC`,
      [req.user.userId, videoTypeIds]
    );
    return res.json({ list: rows.rows });
  } catch (e) {
    console.error("client matching order list error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

router.put("/client/matching-orders/:id", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "client") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId < 1) return res.status(400).json({ error: "INVALID_ID", message: "无效的订单ID。" });

  const title = req.body?.title != null ? String(req.body?.title || "").trim() : undefined;
  const taskAmount = req.body?.task_amount != null ? Number(req.body?.task_amount) : undefined;
  const allowApply = req.body?.allow_apply != null ? (req.body?.allow_apply === false ? 0 : 1) : undefined;
  const requirement = req.body?.requirement != null ? String(req.body?.requirement || "").trim() : undefined;
  const detailPayload = req.body?.detail && typeof req.body.detail === "object" ? req.body.detail : undefined;
  const attachments = Array.isArray(req.body?.attachments)
    ? (req.body.attachments as unknown[]).map((x) => String(x || "").trim()).filter(Boolean).slice(0, 20)
    : undefined;

  if (title !== undefined && (!title || title.length > 200)) return res.status(400).json({ error: "INVALID_TITLE", message: "请填写任务标题（1-200字）。" });
  if (taskAmount !== undefined && (!Number.isFinite(taskAmount) || taskAmount <= 0)) return res.status(400).json({ error: "INVALID_AMOUNT", message: "请填写有效任务金额。" });

  try {
    if (detailPayload) {
      const coopTypeId = typeof (detailPayload as any).cooperation_type_id === "string" ? String((detailPayload as any).cooperation_type_id).trim() : "";
      if (coopTypeId) {
        if (coopTypeId === "high_quality_custom_video" || coopTypeId === "monthly_package" || coopTypeId === "creator_review_video") {
          return res.status(400).json({ error: "VIDEO_ORDERS_ONLY", message: "该类型属于视频分级订单，请在【视频分级订单】模块发布订单。" });
        }
        const cfg = await readCooperationTypesConfig();
        if (!isVisibleCooperationType(cfg, coopTypeId, "client")) {
          return res.status(400).json({ error: "INVALID_COOPERATION_TYPE", message: "无效的合作业务类型。" });
        }
      }
    }

    const ret = await withTx(async (client) => {
      const own = await client.query<{ id: number; title: string; status: string; task_amount: number }>(
        `SELECT id, title, status, task_amount
           FROM client_market_orders
          WHERE id=$1 AND client_id=$2 AND is_deleted=0 AND COALESCE(order_type,0)=1
          FOR UPDATE`,
        [orderId, req.user!.userId]
      );
      const row = own.rows[0];
      if (!row) return { kind: "not_found" as const };
      if (row.status !== "open") return { kind: "locked" as const };
      if (taskAmount !== undefined && Number(taskAmount) !== Number(row.task_amount)) return { kind: "amount_locked" as const };

      const nextTitleBase = title !== undefined ? title : row.title;
      const nextTitle = requirement !== undefined ? (requirement ? `${nextTitleBase}｜${requirement}` : nextTitleBase) : nextTitleBase;
      const nextAllowApply = allowApply !== undefined ? allowApply : undefined;

      if (nextAllowApply !== undefined || nextTitle !== row.title) {
        const setParts: string[] = [];
        const values: any[] = [];
        let idx = 1;
        if (nextTitle !== row.title) {
          setParts.push(`title=$${idx++}`);
          values.push(nextTitle);
        }
        if (nextAllowApply !== undefined) {
          setParts.push(`allow_apply=$${idx++}`);
          values.push(nextAllowApply);
        }
        setParts.push("updated_at=now()");
        values.push(orderId, req.user!.userId);
        await client.query(`UPDATE client_market_orders SET ${setParts.join(", ")} WHERE id=$${idx++} AND client_id=$${idx++}`, values);
      }

      if (detailPayload || attachments) {
        let detailWithMerchant: any = detailPayload ? { ...(detailPayload as any) } : null;
        if (detailWithMerchant) {
          const tpl = await client.query<{ shop_name: string; product_type: string; shop_link: string; shop_rating: string; user_reviews: string }>(
            `SELECT shop_name, product_type, shop_link, shop_rating, user_reviews FROM client_merchant_info_templates WHERE client_id=$1`,
            [req.user!.userId]
          );
          const merchantTemplate = tpl.rows[0];
          if (merchantTemplate) {
            detailWithMerchant = {
              ...detailWithMerchant,
              merchant_info: {
                shop_name: merchantTemplate.shop_name,
                product_type: merchantTemplate.product_type,
                shop_link: merchantTemplate.shop_link,
                shop_rating: merchantTemplate.shop_rating,
                user_reviews: merchantTemplate.user_reviews,
              },
            };
          }
        }
        await client.query(
          `INSERT INTO matching_order_details (order_id, detail_json, attachment_urls)
           VALUES ($1, COALESCE($2::jsonb, '{}'::jsonb), COALESCE($3::jsonb, '[]'::jsonb))
           ON CONFLICT (order_id)
           DO UPDATE SET detail_json=COALESCE(EXCLUDED.detail_json, matching_order_details.detail_json),
                         attachment_urls=COALESCE(EXCLUDED.attachment_urls, matching_order_details.attachment_urls),
                         updated_at=now()`,
          [orderId, detailWithMerchant ? JSON.stringify(detailWithMerchant) : null, attachments ? JSON.stringify(attachments) : null]
        );
      }

      return { kind: "ok" as const };
    });

    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    if (ret.kind === "locked") return res.status(409).json({ error: "ORDER_LOCKED", message: "订单当前状态不可编辑。" });
    if (ret.kind === "amount_locked") return res.status(400).json({ error: "AMOUNT_LOCKED", message: "任务金额已锁定，不支持修改。" });
    return res.json({ ok: true });
  } catch (e) {
    console.error("client matching order update error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

/** 达人端：模式一任务大厅（只看撮合免积分开放单）。 */
router.get("/influencer/matching-task-hall", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "influencer") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  try {
    const blockedVideoTypes = ["high_quality_custom_video", "monthly_package", "creator_review_video"];
    const rows = await query(
      `SELECT mo.id, mo.order_no, mo.title, mo.task_amount, mo.status, mo.match_status, mo.created_at,
              md.detail_json, md.attachment_urls,
              COALESCE(md.detail_json->>'cooperation_type_id','') AS cooperation_type_id,
              COALESCE(cs.phase,'none') AS coop_phase,
              COALESCE(cs.publish_links,'[]'::jsonb) AS coop_publish_links,
              u.username AS client_username, COALESCE(NULLIF(u.display_name,''),u.username) AS client_name
         FROM client_market_orders mo
         JOIN users u ON u.id=mo.client_id
         LEFT JOIN matching_order_details md ON md.order_id=mo.id
         LEFT JOIN cooperation_order_states cs ON cs.order_id=mo.id
        WHERE mo.is_deleted=0 AND COALESCE(mo.order_type,0)=1 AND mo.status='open' AND COALESCE(mo.allow_apply,1)=1
          AND COALESCE(md.detail_json->>'cooperation_type_id','') <> ALL($1::text[])
        ORDER BY mo.id DESC`
      ,
      [blockedVideoTypes]
    );
    return res.json({ list: rows.rows });
  } catch (e) {
    console.error("influencer matching task hall error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});


/** 达人端：报名撮合免积分任务。 */
router.post("/influencer/matching-orders/:id/apply", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "influencer") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId < 1) return res.status(400).json({ error: "INVALID_ID", message: "无效的订单ID。" });
  try {
    const blockedVideoTypes = ["high_quality_custom_video", "monthly_package", "creator_review_video"];
    const profile = await query<{
      tiktok_account: string | null;
      tiktok_fans: string | null;
      expertise_domains: string | null;
      influencer_bio: string | null;
    }>(
      `SELECT tiktok_account, tiktok_fans, expertise_domains, influencer_bio FROM users WHERE id=$1`,
      [req.user.userId],
    );
    if (!isInfluencerProfileComplete(profile.rows[0])) {
      return res.status(400).json({
        error: "INFLUENCER_PROFILE_REQUIRED",
        message: "请先完善达人信息后再报名任务。",
      });
    }

    const ord = await query<{ id: number; client_id: number }>(
      `SELECT id, client_id
         FROM client_market_orders
        WHERE id=$1 AND is_deleted=0 AND COALESCE(order_type,0)=1 AND status='open' AND COALESCE(allow_apply,1)=1
          AND COALESCE((SELECT detail_json->>'cooperation_type_id' FROM matching_order_details WHERE order_id=$1),'') <> ALL($2::text[])`,
      [orderId, blockedVideoTypes]
    );
    const row = ord.rows[0];
    if (!row) return res.status(404).json({ error: "NOT_FOUND", message: "任务不存在或不可报名。" });
    await query(
      `INSERT INTO market_order_applications (market_order_id, influencer_id, note)
       VALUES ($1, $2, $3)
       ON CONFLICT (market_order_id, influencer_id)
       DO UPDATE SET status='pending', note=EXCLUDED.note, updated_at=now()`,
      [orderId, req.user.userId, ""]
    );
    await query(`UPDATE client_market_orders SET match_status='pending_selection', updated_at=now() WHERE id=$1 AND match_status='open'`, [orderId]);
    await createMessage(row.client_id, "matching_apply", "撮合任务有新报名", `撮合订单 #${orderId} 收到新的达人报名。`, "matching_order", orderId);
    return res.status(201).json({ ok: true });
  } catch (e) {
    console.error("influencer apply matching order error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

/** 达人端：我的撮合报名列表。 */
router.get("/influencer/my-matching-applies", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "influencer") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  try {
    const blockedVideoTypes = ["high_quality_custom_video", "monthly_package", "creator_review_video"];
    const rows = await query(
      `SELECT a.id, a.status AS apply_status, a.note, a.created_at,
              mo.id AS order_id, mo.order_no, mo.title, mo.task_amount, mo.status AS order_status, mo.match_status, mo.work_links,
              md.detail_json, md.attachment_urls,
              COALESCE(md.detail_json->>'cooperation_type_id','') AS cooperation_type_id,
              COALESCE(cs.phase,'none') AS coop_phase,
              COALESCE(cs.publish_links,'[]'::jsonb) AS coop_publish_links,
              u.username AS client_username
         FROM market_order_applications a
         JOIN client_market_orders mo ON mo.id=a.market_order_id
         JOIN users u ON u.id=mo.client_id
         LEFT JOIN matching_order_details md ON md.order_id=mo.id
         LEFT JOIN cooperation_order_states cs ON cs.order_id=mo.id
        WHERE a.influencer_id=$1 AND mo.is_deleted=0 AND COALESCE(mo.order_type,0)=1
          AND COALESCE(md.detail_json->>'cooperation_type_id','') <> ALL($2::text[])
        ORDER BY a.id DESC`,
      [req.user.userId, blockedVideoTypes]
    );
    return res.json({ list: rows.rows });
  } catch (e) {
    console.error("influencer matching apply list error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

/** 达人端：提交完成凭证（短视频链接）。 */
router.post("/influencer/matching-orders/:id/submit-proof", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "influencer") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  const orderId = Number(req.params.id);
  const urlsRaw = Array.isArray(req.body?.video_urls) ? (req.body.video_urls as unknown[]) : null;
  const videoUrl = String(req.body?.video_url || "").trim();
  const videoUrls =
    urlsRaw && urlsRaw.length
      ? urlsRaw.map((u) => String(u || "").trim()).filter(Boolean).slice(0, 20)
      : videoUrl
      ? [videoUrl]
      : [];
  if (!Number.isInteger(orderId) || orderId < 1) return res.status(400).json({ error: "INVALID_ID", message: "无效的订单ID。" });
  if (!videoUrls.length) return res.status(400).json({ error: "INVALID_VIDEO", message: "请填写回传短视频链接。" });
  try {
    const blockedVideoTypes = ["high_quality_custom_video", "monthly_package", "creator_review_video"];
    const ret = await withTx(async (client) => {
      const app = await client.query<{ id: number; market_order_id: number }>(
        `SELECT a.id, a.market_order_id
           FROM market_order_applications a
           JOIN client_market_orders mo ON mo.id=a.market_order_id
          WHERE a.market_order_id=$1 AND a.influencer_id=$2 AND a.status='selected'
            AND mo.status='claimed' AND COALESCE(mo.order_type,0)=1
          FOR UPDATE`,
        [orderId, req.user!.userId]
      );
      const row = app.rows[0];
      if (!row) return { kind: "not_found" as const };
      const detail = await client.query<{ detail_json: any }>(`SELECT detail_json FROM matching_order_details WHERE order_id=$1`, [orderId]);
      const coopTypeId = String((detail.rows[0]?.detail_json as any)?.cooperation_type_id || "").trim();
      if (blockedVideoTypes.includes(coopTypeId)) return { kind: "forbidden_video" as const };
      await client.query(`UPDATE client_market_orders SET status='completed', work_links=$2::jsonb, updated_at=now(), completed_at=now() WHERE id=$1`, [
        orderId,
        JSON.stringify(videoUrls),
      ]);
      await client.query(`UPDATE market_order_applications SET note=$2, updated_at=now() WHERE id=$1`, [row.id, `proof:${videoUrls[0]}`]);
      if (coopTypeId === "creator_review_video") {
        await client.query(`INSERT INTO cooperation_order_states (order_id) VALUES ($1) ON CONFLICT (order_id) DO NOTHING`, [orderId]);
        await client.query(
          `UPDATE cooperation_order_states
              SET phase='review_pending', publish_links='[]'::jsonb, review_note=NULL, reviewed_by=NULL, reviewed_at=NULL, updated_at=now()
            WHERE order_id=$1`,
          [orderId]
        );
      }
      const owner = await client.query<{ client_id: number }>(`SELECT client_id FROM client_market_orders WHERE id=$1`, [orderId]);
      return { kind: "ok" as const, clientId: owner.rows[0]?.client_id || 0 };
    });
    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "未找到可提交的撮合任务。" });
    if (ret.kind === "forbidden_video") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问视频合作项目任务。" });
    if (ret.clientId > 0) await createMessage(ret.clientId, "matching_submit", "达人已提交完成凭证", `撮合订单 #${orderId} 已提交完成凭证，请验收。`, "matching_order", orderId);
    return res.json({ ok: true });
  } catch (e) {
    console.error("influencer submit matching proof error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

router.post("/influencer/matching-orders/:id/publish", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "influencer") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  const orderId = Number(req.params.id);
  const publishUrl = String(req.body?.publish_url || "").trim();
  if (!Number.isInteger(orderId) || orderId < 1) return res.status(400).json({ error: "INVALID_ID", message: "无效的订单ID。" });
  if (!publishUrl) return res.status(400).json({ error: "INVALID_PUBLISH_URL", message: "请填写发布链接。" });
  try {
    const blockedVideoTypes = ["high_quality_custom_video", "monthly_package", "creator_review_video"];
    const ret = await withTx(async (client) => {
      const app = await client.query<{ market_order_id: number }>(
        `SELECT a.market_order_id
           FROM market_order_applications a
           JOIN client_market_orders mo ON mo.id=a.market_order_id
          WHERE a.market_order_id=$1 AND a.influencer_id=$2 AND a.status='selected'
            AND mo.status='completed' AND COALESCE(mo.order_type,0)=1
          FOR UPDATE`,
        [orderId, req.user!.userId]
      );
      if (!app.rows[0]) return { kind: "not_found" as const };
      const detail = await client.query<{ detail_json: any }>(`SELECT detail_json FROM matching_order_details WHERE order_id=$1`, [orderId]);
      const coopTypeId = String((detail.rows[0]?.detail_json as any)?.cooperation_type_id || "").trim();
      if (blockedVideoTypes.includes(coopTypeId)) return { kind: "forbidden_video" as const };
      if (coopTypeId !== "creator_review_video") return { kind: "not_supported" as const };
      await client.query(`INSERT INTO cooperation_order_states (order_id) VALUES ($1) ON CONFLICT (order_id) DO NOTHING`, [orderId]);
      const st = await client.query<{ phase: string; publish_links: any }>(`SELECT phase, publish_links FROM cooperation_order_states WHERE order_id=$1 FOR UPDATE`, [orderId]);
      const curPhase = String(st.rows[0]?.phase || "none");
      if (curPhase !== "approved_to_publish") return { kind: "bad_phase" as const, phase: curPhase };
      const oldLinks = Array.isArray(st.rows[0]?.publish_links) ? (st.rows[0]!.publish_links as unknown[]) : [];
      const nextLinks = [...oldLinks.map((x) => String(x || "").trim()).filter(Boolean), publishUrl].slice(0, 20);
      await client.query(`UPDATE cooperation_order_states SET phase='published', publish_links=$2::jsonb, updated_at=now() WHERE order_id=$1`, [
        orderId,
        JSON.stringify(nextLinks),
      ]);
      const owner = await client.query<{ client_id: number }>(`SELECT client_id FROM client_market_orders WHERE id=$1`, [orderId]);
      return { kind: "ok" as const, clientId: owner.rows[0]?.client_id || 0 };
    });
    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "未找到可发布的订单。" });
    if (ret.kind === "forbidden_video") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问视频合作项目任务。" });
    if (ret.kind === "not_supported") return res.status(400).json({ error: "NOT_SUPPORTED", message: "该订单无需提交发布链接。" });
    if (ret.kind === "bad_phase") return res.status(409).json({ error: "BAD_STATE", message: `当前阶段不可提交发布链接（${ret.phase}）。` });
    if (ret.clientId > 0) await createMessage(ret.clientId, "cooperation_published", "达人已提交发布链接", `订单 #${orderId} 已提交发布链接，请验收。`, "matching_order", orderId);
    return res.json({ ok: true });
  } catch (e) {
    console.error("influencer publish matching order error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

/** 商家端：查看撮合订单报名达人列表。 */
router.get("/client/matching-orders/:id/applicants", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "client") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId < 1) return res.status(400).json({ error: "INVALID_ID", message: "无效的订单ID。" });
  try {
    const own = await query<{ id: number }>(`SELECT id FROM client_market_orders WHERE id=$1 AND client_id=$2 AND is_deleted=0 AND COALESCE(order_type,0)=1`, [orderId, req.user.userId]);
    if (!own.rows[0]) return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    const rows = await query(
      `SELECT a.id, a.status, a.note, a.created_at,
              u.id AS influencer_id, u.username, u.real_name, u.bank_name, u.bank_card,
              u.tiktok_account, u.tiktok_fans, u.expertise_domains, u.influencer_bio
         FROM market_order_applications a
         JOIN users u ON u.id=a.influencer_id
        WHERE a.market_order_id=$1
        ORDER BY a.id DESC`,
      [orderId]
    );
    return res.json({ list: rows.rows });
  } catch (e) {
    console.error("client matching applicants error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

/** 商家端：选中报名达人。 */
router.post("/client/matching-orders/:id/applicants/:appId/select", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "client") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  const orderId = Number(req.params.id);
  const appId = Number(req.params.appId);
  if (!Number.isInteger(orderId) || !Number.isInteger(appId) || orderId < 1 || appId < 1) return res.status(400).json({ error: "INVALID_ID", message: "无效的ID。" });
  try {
    const ret = await withTx(async (client) => {
      const ord = await client.query<{ id: number; status: string }>(`SELECT id, status FROM client_market_orders WHERE id=$1 AND client_id=$2 AND is_deleted=0 AND COALESCE(order_type,0)=1 FOR UPDATE`, [orderId, req.user!.userId]);
      if (!ord.rows[0]) return { kind: "not_found" as const };
      if (ord.rows[0].status !== "open") return { kind: "bad_state" as const };
      const app = await client.query<{ influencer_id: number }>(`SELECT influencer_id FROM market_order_applications WHERE id=$1 AND market_order_id=$2 FOR UPDATE`, [appId, orderId]);
      const chosen = app.rows[0];
      if (!chosen) return { kind: "app_not_found" as const };
      await client.query(`UPDATE market_order_applications SET status='selected', updated_at=now() WHERE id=$1`, [appId]);
      await client.query(`UPDATE market_order_applications SET status='rejected', updated_at=now() WHERE market_order_id=$1 AND id<>$2 AND status='pending'`, [orderId, appId]);
      await client.query(`UPDATE client_market_orders SET influencer_id=$1, status='claimed', match_status='matched', updated_at=now() WHERE id=$2`, [chosen.influencer_id, orderId]);
      return { kind: "ok" as const, influencerId: chosen.influencer_id };
    });
    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
    if (ret.kind === "bad_state") return res.status(409).json({ error: "BAD_STATE", message: "当前状态不可选人。" });
    if (ret.kind === "app_not_found") return res.status(404).json({ error: "NOT_FOUND", message: "报名记录不存在。" });
    await createMessage(ret.influencerId, "matching_selected", "撮合报名已被选中", `撮合订单 #${orderId} 已选中您，请开始执行任务。`, "matching_order", orderId);
    return res.json({ ok: true });
  } catch (e) {
    console.error("client select matching applicant error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

/** 商家端：驳回报名达人。 */
router.post("/client/matching-orders/:id/applicants/:appId/reject", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "client") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  const orderId = Number(req.params.id);
  const appId = Number(req.params.appId);
  if (!Number.isInteger(orderId) || !Number.isInteger(appId) || orderId < 1 || appId < 1) return res.status(400).json({ error: "INVALID_ID", message: "无效的ID。" });
  try {
    const updated = await query<{ influencer_id: number }>(
      `UPDATE market_order_applications a
          SET status='rejected', updated_at=now()
         FROM client_market_orders mo
        WHERE a.id=$1 AND a.market_order_id=$2 AND mo.id=$2 AND mo.client_id=$3 AND COALESCE(mo.order_type,0)=1
      RETURNING a.influencer_id`,
      [appId, orderId, req.user.userId]
    );
    const row = updated.rows[0];
    if (!row) return res.status(404).json({ error: "NOT_FOUND", message: "报名记录不存在。" });
    await createMessage(row.influencer_id, "matching_reject", "撮合报名未通过", `撮合订单 #${orderId} 的报名未通过。`, "matching_order", orderId);
    return res.json({ ok: true });
  } catch (e) {
    console.error("client reject matching applicant error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

/** 商家端：验收通过并展示达人收款信息。 */
router.post("/client/matching-orders/:id/accept", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "client") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId < 1) return res.status(400).json({ error: "INVALID_ID", message: "无效的订单ID。" });
  try {
    const ret = await withTx(async (client) => {
      const ord = await client.query<{ influencer_id: number; task_amount: string | null }>(
        `SELECT influencer_id, task_amount
           FROM client_market_orders
          WHERE id=$1 AND client_id=$2 AND is_deleted=0 AND COALESCE(order_type,0)=1 AND status='completed'
          FOR UPDATE`,
        [orderId, req.user!.userId]
      );
      const row = ord.rows[0];
      if (!row || !row.influencer_id) return { kind: "not_found" as const };

      const detail = await client.query<{ detail_json: any }>(`SELECT detail_json FROM matching_order_details WHERE order_id=$1`, [orderId]);
      const coopTypeId = String((detail.rows[0]?.detail_json as any)?.cooperation_type_id || "").trim();
      if (coopTypeId === "creator_review_video") {
        await client.query(`INSERT INTO cooperation_order_states (order_id) VALUES ($1) ON CONFLICT (order_id) DO NOTHING`, [orderId]);
        const st = await client.query<{ phase: string; publish_links: any }>(
          `SELECT phase, publish_links FROM cooperation_order_states WHERE order_id=$1 FOR UPDATE`,
          [orderId]
        );
        const phase = String(st.rows[0]?.phase || "none");
        const links = Array.isArray(st.rows[0]?.publish_links) ? (st.rows[0]!.publish_links as unknown[]) : [];
        const hasLink = links.map((x) => String(x || "").trim()).filter(Boolean).length > 0;
        if (phase !== "published" || !hasLink) return { kind: "publish_required" as const };
      }

      await client.query(`UPDATE client_market_orders SET match_status='completed', updated_at=now() WHERE id=$1`, [orderId]);
      const amount = Number(row.task_amount || 0);
      if (amount > 0) {
        await client.query(
          `UPDATE merchant_profiles
              SET deposit_frozen = GREATEST(deposit_frozen - $2, 0),
                  updated_at = now()
            WHERE client_id=$1`,
          [req.user!.userId, amount]
        );
        await client.query(
          `INSERT INTO deposit_log (client_id, change_amount, type, ref_order_id, note)
           VALUES ($1, $2, 'unfreeze', $3, '撮合验收通过解冻保证金')`,
          [req.user!.userId, amount, orderId]
        );
      }
      const inf = await client.query<{ id: number; username: string; real_name: string | null; bank_name: string | null; bank_card: string | null }>(
        `SELECT id, username, real_name, bank_name, bank_card FROM users WHERE id=$1`,
        [row.influencer_id]
      );
      return { kind: "ok" as const, payment: inf.rows[0] || null, influencerId: row.influencer_id };
    });
    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "未找到可验收订单。" });
    if (ret.kind === "publish_required") return res.status(400).json({ error: "PUBLISH_REQUIRED", message: "请等待后台审核与达人发布完成后再验收。" });
    await createMessage(ret.influencerId, "matching_accept", "撮合订单已验收通过", `撮合订单 #${orderId} 已验收通过，请等待商家打款。`, "matching_order", orderId);
    return res.json({ ok: true, payment_profile: ret.payment });
  } catch (e) {
    console.error("client accept matching order error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});


/** 商家端：验收驳回，任务退回执行中。 */
router.post("/client/matching-orders/:id/reject", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "client") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId < 1) return res.status(400).json({ error: "INVALID_ID", message: "无效的订单ID。" });
  try {
    const ret = await withTx(async (client) => {
      const ord = await client.query<{ influencer_id: number | null }>(
        `SELECT influencer_id
           FROM client_market_orders
          WHERE id=$1 AND client_id=$2 AND is_deleted=0 AND COALESCE(order_type,0)=1 AND status='completed'
          FOR UPDATE`,
        [orderId, req.user!.userId]
      );
      const row = ord.rows[0];
      if (!row || !row.influencer_id) return { kind: "not_found" as const };
      await client.query(`UPDATE client_market_orders SET status='claimed', match_status='matched', work_links='[]'::jsonb, updated_at=now() WHERE id=$1`, [orderId]);
      return { kind: "ok" as const, influencerId: row.influencer_id };
    });
    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "未找到可驳回订单。" });
    await createMessage(ret.influencerId, "matching_reject_accept", "撮合订单验收未通过", `撮合订单 #${orderId} 验收未通过，请补充后再次提交。`, "matching_order", orderId);
    return res.json({ ok: true });
  } catch (e) {
    console.error("client reject matching order error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

/** 管理员/员工：商家会员与保证金总览。 */
router.get("/admin/merchant-members", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "admin" && req.user?.role !== "employee") {
    return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  }
  try {
    const rows = await query(
      `SELECT u.id AS client_id, u.username,
              m.member_level, m.member_expire_time, m.deposit_amount, m.deposit_frozen, m.deposit_status
         FROM users u
         JOIN roles r ON r.id=u.role_id AND r.name='client'
         LEFT JOIN merchant_profiles m ON m.client_id=u.id
        WHERE u.disabled=0
        ORDER BY u.id DESC`
    );
    return res.json({ list: rows.rows });
  } catch (e) {
    console.error("admin merchant members error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});


/** 统一消息列表：四端均可读取。 */
router.get("/messages", async (req: AuthRequest, res: Response) => {
  if (!req.user?.userId) return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  try {
    const rows = await query(
      `SELECT id, category, title, content, related_type, related_id, is_read, created_at
         FROM system_messages
        WHERE user_id=$1
        ORDER BY id DESC
        LIMIT 100`,
      [req.user.userId]
    );
    return res.json({ list: rows.rows });
  } catch (e) {
    console.error("list messages error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});



/** 清空当前账号全部系统消息。 */
router.post("/messages/clear", async (req: AuthRequest, res: Response) => {
  if (!req.user?.userId) return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  try {
    await query(`DELETE FROM system_messages WHERE user_id=$1`, [req.user.userId]);
    return res.json({ ok: true });
  } catch (e) {
    console.error("clear messages error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

/** 标记消息已读。 */
router.post("/messages/:id/read", async (req: AuthRequest, res: Response) => {
  if (!req.user?.userId) return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  const messageId = Number(req.params.id);
  if (!Number.isInteger(messageId) || messageId < 1) return res.status(400).json({ error: "INVALID_ID", message: "无效的消息ID。" });
  try {
    const ret = await query<{ id: number }>(
      `UPDATE system_messages
          SET is_read=1, read_at=now()
        WHERE id=$1 AND user_id=$2
      RETURNING id`,
      [messageId, req.user.userId]
    );
    if (!ret.rows[0]) return res.status(404).json({ error: "NOT_FOUND", message: "消息不存在。" });
    return res.json({ ok: true });
  } catch (e) {
    console.error("read message error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

export default router;



