import { Router, Response } from "express";
import { requireAuth, type AuthRequest } from "../auth";
import { query, withTx } from "../db";

const router = Router();
router.use(requireAuth);

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
      `SELECT real_name, bank_name, bank_branch, bank_card
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
  const bankBranch = String(req.body?.bank_branch || "").trim();
  const bankCard = String(req.body?.bank_card || "").trim();
  if (!realName || !bankName || !bankBranch || !bankCard) {
    return res.status(400).json({ error: "INVALID_INPUT", message: "请完整填写收款信息。" });
  }
  try {
    await query(
      `UPDATE users
          SET real_name=$2,
              bank_name=$3,
              bank_branch=$4,
              bank_card=$5
        WHERE id=$1`,
      [req.user.userId, realName, bankName, bankBranch, bankCard]
    );
    return res.json({ ok: true });
  } catch (e) {
    console.error("influencer payment profile write error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

/** 商家端：创建撮合免积分订单（独立于原积分单）。 */
router.post("/client/matching-orders", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "client") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  const title = String(req.body?.title || "").trim();
  const taskAmount = Number(req.body?.task_amount);
  const allowApply = req.body?.allow_apply === false ? 0 : 1;
  const requirement = String(req.body?.requirement || "").trim();
  if (!title || title.length > 200) return res.status(400).json({ error: "INVALID_TITLE", message: "请填写任务标题（1-200字）。" });
  if (!Number.isFinite(taskAmount) || taskAmount <= 0) return res.status(400).json({ error: "INVALID_AMOUNT", message: "请填写有效任务金额。" });
  try {
    const ret = await withTx(async (client) => {
      await client.query("INSERT INTO merchant_profiles (client_id) VALUES ($1) ON CONFLICT (client_id) DO NOTHING", [req.user!.userId]);
      const profile = await client.query<{ member_level: number; deposit_amount: string; deposit_frozen: string }>(
        "SELECT member_level, deposit_amount, deposit_frozen FROM merchant_profiles WHERE client_id=$1 FOR UPDATE",
        [req.user!.userId]
      );
      const p = profile.rows[0];
      if (!p || Number(p.member_level || 0) < 1) return { kind: "member_required" as const };
      const available = Number(p.deposit_amount || 0) - Number(p.deposit_frozen || 0);
      if (available < taskAmount) return { kind: "deposit_insufficient" as const, available };
      const ins = await client.query<{ id: number; order_no: string }>(
        `INSERT INTO client_market_orders
           (client_id, order_no, title, reward_points, tier, creator_reward_points, platform_profit_points, pay_deducted, status, match_status, order_type, allow_apply, task_amount, deposit_frozen)
         VALUES ($1, 'MH-' || to_char(now(),'YYYYMMDD') || '-' || floor(random()*900000+100000)::text, $2, 10, 'C', 5, 5, 0, 'open', 'open', 1, $3, $4, $4)
         RETURNING id, order_no`,
        [req.user!.userId, requirement ? `${title}｜${requirement}` : title, allowApply, taskAmount]
      );
      await client.query(
        `UPDATE merchant_profiles
            SET deposit_frozen = deposit_frozen + $2,
                deposit_status = CASE WHEN deposit_amount - (deposit_frozen + $2) <= 0 THEN 'warning' ELSE deposit_status END,
                updated_at = now()
          WHERE client_id=$1`,
        [req.user!.userId, taskAmount]
      );
      const inserted = ins.rows[0];
      if (!inserted) return { kind: "db_error" as const };
      await client.query(
        `INSERT INTO deposit_log (client_id, change_amount, type, ref_order_id, note)
         VALUES ($1, $2, 'freeze', $3, '发布撮合单冻结保证金')`,
        [req.user!.userId, -taskAmount, inserted.id]
      );
      return { kind: "ok" as const, id: inserted.id, order_no: inserted.order_no };
    });
    if (ret.kind === "member_required") return res.status(403).json({ error: "MEMBER_REQUIRED", message: "开通会员后才可发布撮合订单。" });
    if (ret.kind === "deposit_insufficient") return res.status(409).json({ error: "DEPOSIT_INSUFFICIENT", message: `保证金不足，可用余额 ${ret.available}。` });
    if (ret.kind === "db_error") return res.status(500).json({ error: "DB_ERROR", message: "创建失败，请重试。" });
    return res.status(201).json({ id: ret.id, order_no: ret.order_no });
  } catch (e) {
    console.error("client create matching order error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

/** 商家端：撮合免积分订单列表。 */
router.get("/client/matching-orders", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "client") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  try {
    const rows = await query(
      `SELECT id, order_no, title, status, match_status, order_type, allow_apply, task_amount, deposit_frozen, influencer_id, created_at, updated_at
         FROM client_market_orders
        WHERE client_id=$1 AND is_deleted=0 AND COALESCE(order_type,0)=1
        ORDER BY id DESC`,
      [req.user.userId]
    );
    return res.json({ list: rows.rows });
  } catch (e) {
    console.error("client matching order list error:", e);
    return res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  }
});

/** 达人端：模式一任务大厅（只看撮合免积分开放单）。 */
router.get("/influencer/matching-task-hall", async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "influencer") return res.status(403).json({ error: "FORBIDDEN", message: "无权限访问。" });
  try {
    const rows = await query(
      `SELECT mo.id, mo.order_no, mo.title, mo.task_amount, mo.status, mo.match_status, mo.created_at,
              u.username AS client_username, COALESCE(NULLIF(u.display_name,''),u.username) AS client_name
         FROM client_market_orders mo
         JOIN users u ON u.id=mo.client_id
        WHERE mo.is_deleted=0 AND COALESCE(mo.order_type,0)=1 AND mo.status='open' AND COALESCE(mo.allow_apply,1)=1
        ORDER BY mo.id DESC`
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
    const ord = await query<{ id: number; client_id: number }>(
      `SELECT id, client_id
         FROM client_market_orders
        WHERE id=$1 AND is_deleted=0 AND COALESCE(order_type,0)=1 AND status='open' AND COALESCE(allow_apply,1)=1`,
      [orderId]
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
    const rows = await query(
      `SELECT a.id, a.status AS apply_status, a.note, a.created_at,
              mo.id AS order_id, mo.order_no, mo.title, mo.task_amount, mo.status AS order_status, mo.match_status, mo.work_links,
              u.username AS client_username
         FROM market_order_applications a
         JOIN client_market_orders mo ON mo.id=a.market_order_id
         JOIN users u ON u.id=mo.client_id
        WHERE a.influencer_id=$1 AND mo.is_deleted=0 AND COALESCE(mo.order_type,0)=1
        ORDER BY a.id DESC`,
      [req.user.userId]
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
  const videoUrl = String(req.body?.video_url || "").trim();
  if (!Number.isInteger(orderId) || orderId < 1) return res.status(400).json({ error: "INVALID_ID", message: "无效的订单ID。" });
  if (!videoUrl) return res.status(400).json({ error: "INVALID_VIDEO", message: "请填写回传短视频链接。" });
  try {
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
      await client.query(`UPDATE client_market_orders SET status='completed', work_links=$2::jsonb, updated_at=now(), completed_at=now() WHERE id=$1`, [orderId, JSON.stringify([videoUrl])]);
      await client.query(`UPDATE market_order_applications SET note=$2, updated_at=now() WHERE id=$1`, [row.id, `proof:${videoUrl}`]);
      const owner = await client.query<{ client_id: number }>(`SELECT client_id FROM client_market_orders WHERE id=$1`, [orderId]);
      return { kind: "ok" as const, clientId: owner.rows[0]?.client_id || 0 };
    });
    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "未找到可提交的撮合任务。" });
    if (ret.clientId > 0) await createMessage(ret.clientId, "matching_submit", "达人已提交完成凭证", `撮合订单 #${orderId} 已提交完成凭证，请验收。`, "matching_order", orderId);
    return res.json({ ok: true });
  } catch (e) {
    console.error("influencer submit matching proof error:", e);
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
              u.id AS influencer_id, u.username, u.real_name, u.bank_name, u.bank_branch, u.bank_card
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
      const inf = await client.query<{ id: number; username: string; real_name: string | null; bank_name: string | null; bank_branch: string | null; bank_card: string | null }>(
        `SELECT id, username, real_name, bank_name, bank_branch, bank_card FROM users WHERE id=$1`,
        [row.influencer_id]
      );
      return { kind: "ok" as const, payment: inf.rows[0] || null, influencerId: row.influencer_id };
    });
    if (ret.kind === "not_found") return res.status(404).json({ error: "NOT_FOUND", message: "未找到可验收订单。" });
    await createMessage(ret.influencerId, "matching_accept", "撮合订单已验收通过", `撮合订单 #${orderId} 已验收通过，请等待商家打款。`, "matching_order", orderId);
    return res.json({ ok: true, payment_profile: ret.payment });
  } catch (e) {
    console.error("client accept matching order error:", e);
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

export default router;

