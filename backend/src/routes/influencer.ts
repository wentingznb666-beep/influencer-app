import { Router, Response } from "express";
import { query, withTx } from "../db";
import { ensurePointAccountLocked } from "../pointAccounts";
import { requireAuth, requireRole, type AuthRequest } from "../auth";
import { recordOperationLogTx } from "../operationLog";

const router = Router();
router.use(requireAuth);
router.use(requireRole("influencer"));

/**
 * 将 client_market_orders 完成结算：
 * - 若发单时尚未扣款（历史订单 pay_deducted=0），则先从客户端扣除客户支付积分（reward_points）
 * - 达人收益固定为 5（creator_reward_points）
 * - 平台利润记录为（客户支付 - 5）
 */
async function settleMarketOrderComplete(params: {
  orderId: number;
  influencerUserId: number;
  workLink: string;
}): Promise<
  | { kind: "ok" }
  | { kind: "not_found" }
  | { kind: "bad_state" }
  | { kind: "insufficient"; balance: number; need: number }
> {
  const { orderId, influencerUserId, workLink } = params;
  return withTx(async (client) => {
    const ordRes = await client.query<{
      id: number;
      client_id: number;
      influencer_id: number | null;
      status: string;
      reward_points: number;
      creator_reward_points: number;
      platform_profit_points: number;
      pay_deducted: number;
    }>(
      "SELECT id, client_id, influencer_id, status, reward_points, creator_reward_points, platform_profit_points, pay_deducted FROM client_market_orders WHERE id = $1 FOR UPDATE",
      [orderId]
    );
    const ord = ordRes.rows[0];
    if (!ord) return { kind: "not_found" };
    if (ord.status !== "claimed" || ord.influencer_id !== influencerUserId) {
      return { kind: "bad_state" };
    }
    const clientUid = ord.client_id;
    const infUid = influencerUserId;
    const clientPay = ord.reward_points;
    const creatorReward = Number(ord.creator_reward_points) > 0 ? Number(ord.creator_reward_points) : 5;
    const platformProfit = Math.max(clientPay - creatorReward, 0);
    const low = Math.min(clientUid, infUid);
    const high = Math.max(clientUid, infUid);
    const accLow = await ensurePointAccountLocked(client, low);
    const accHigh = await ensurePointAccountLocked(client, high);
    const clientAcc = clientUid === low ? accLow : accHigh;
    const infAcc = infUid === low ? accLow : accHigh;
    // 兼容历史：若未在发单时扣款，则在完单时扣除客户支付积分
    if (Number(ord.pay_deducted) !== 1) {
      if (clientAcc.balance < clientPay) {
        return { kind: "insufficient", balance: clientAcc.balance, need: clientPay };
      }
      await client.query("INSERT INTO point_ledger (account_id, amount, type, ref_id) VALUES ($1, $2, 'market_order_client_pay', $3)", [
        clientAcc.id,
        -clientPay,
        orderId,
      ]);
      await client.query("UPDATE point_accounts SET balance = balance - $1, updated_at = now() WHERE id = $2", [clientPay, clientAcc.id]);
      await client.query("UPDATE client_market_orders SET pay_deducted = 1 WHERE id = $1", [orderId]);
    }
    await client.query("INSERT INTO point_ledger (account_id, amount, type, ref_id) VALUES ($1, $2, 'market_order_influencer_reward', $3)", [
      infAcc.id,
      creatorReward,
      orderId,
    ]);
    await client.query("UPDATE point_accounts SET balance = balance + $1, updated_at = now() WHERE id = $2", [creatorReward, infAcc.id]);
    await client.query("UPDATE client_market_orders SET platform_profit_points = $1 WHERE id = $2", [platformProfit, orderId]);
    await client.query(
      `UPDATE client_market_orders SET status = 'completed', work_link = $1, updated_at = now(), completed_at = now() WHERE id = $2`,
      [workLink, orderId]
    );
    return { kind: "ok" };
  });
}

/**
 * GET /api/influencer/tasks
 * 任务大厅：已发布任务，支持 platform、type 筛选；露脸任务仅对 show_face=1 的达人可见。
 */
router.get("/tasks", (req: AuthRequest, res: Response) => {
  res.status(410).json({ error: "MODULE_DISABLED", message: "任务大厅模块已下线。" });
  return;
  const userId = req.user!.userId;
  const { platform, type } = req.query as { platform?: string; type?: string };
  (async () => {
    const profileRes = await query<{ show_face: number; blacklisted: number }>(
      "SELECT show_face, blacklisted FROM influencer_profiles WHERE user_id = $1",
      [userId]
    );
    const profile = profileRes.rows[0];
    const showFace = profile?.show_face ?? 0;
    if (profile?.blacklisted === 1) {
      res.json({ list: [] });
      return;
    }

    let sql = `
      SELECT t.id, t.material_id, t.type, t.platform, t.max_claim_count, t.point_reward, t.created_at,
             m.title AS material_title, m.cloud_link, m.remark AS material_remark
      FROM tasks t
      JOIN materials m ON t.material_id = m.id
      WHERE t.status = 'published' AND m.status = 'online'
    `;
    const params: any[] = [];
    let idx = 1;
    if (showFace === 0) {
      sql += " AND t.type = 'explain'";
    }
    if (platform && typeof platform === "string") {
      sql += ` AND t.platform = $${idx++}`;
      params.push(platform);
    }
    if (type === "face" || type === "explain") {
      sql += ` AND t.type = $${idx++}`;
      params.push(type);
    }
    sql += " ORDER BY t.point_reward DESC, t.id DESC";

    const tasksRes = await query<Array<Record<string, unknown> & { id: number }>>(sql, params);
    const rows = tasksRes.rows as any[];
    const taskIds = rows.map((r) => r.id) as number[];

    let claimedSet = new Set<number>();
    if (taskIds.length > 0) {
      const placeholders = taskIds.map((_, i) => `$${i + 2}`).join(",");
      const claimedRes = await query<{ task_id: number }>(
        `SELECT task_id FROM task_claims WHERE user_id = $1 AND task_id IN (${placeholders})`,
        [userId, ...taskIds]
      );
      claimedSet = new Set(claimedRes.rows.map((c) => c.task_id));
    }

    const list = rows.map((r: any) => ({ ...r, claimed: claimedSet.has(r.id) }));
    res.json({ list });
  })().catch((e) => {
    console.error("influencer tasks error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * POST /api/influencer/tasks/:taskId/claim
 * 领取任务：校验每日上限、是否已领、任务剩余量、黑名单。
 */
router.post("/tasks/:taskId/claim", (req: AuthRequest, res: Response) => {
  res.status(410).json({ error: "MODULE_DISABLED", message: "任务大厅模块已下线。" });
  return;
  const userId = req.user!.userId;
  const taskId = Number(req.params.taskId);
  if (!Number.isInteger(taskId) || taskId < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的任务 ID。" });
    return;
  }
  (async () => {
    const profileRes = await query<{ blacklisted: number }>("SELECT blacklisted FROM influencer_profiles WHERE user_id = $1", [userId]);
    if (profileRes.rows[0]?.blacklisted === 1) {
      res.status(403).json({ error: "BLACKLISTED", message: "您已被列入黑名单，无法领取任务。" });
      return;
    }

    const taskRes = await query<{ id: number; type: string; max_claim_count: number | null; point_reward: number; status: string }>(
      "SELECT id, type, max_claim_count, point_reward, status FROM tasks WHERE id = $1",
      [taskId]
    );
    const task = taskRes.rows[0];
    if (!task || task.status !== "published") {
      res.status(404).json({ error: "NOT_FOUND", message: "任务不存在或未发布。" });
      return;
    }

    if (task.type === "face") {
      const pRes = await query<{ show_face: number }>("SELECT show_face FROM influencer_profiles WHERE user_id = $1", [userId]);
      if (!pRes.rows[0] || pRes.rows[0].show_face !== 1) {
        res.status(403).json({ error: "FORBIDDEN", message: "该任务仅限露脸达人领取。" });
        return;
      }
    }

    const existing = await query<{ id: number }>("SELECT id FROM task_claims WHERE task_id = $1 AND user_id = $2", [taskId, userId]);
    if (existing.rows[0]) {
      res.status(409).json({ error: "ALREADY_CLAIMED", message: "您已领取过该任务。" });
      return;
    }

    const limitRes = await query<{ value: string }>("SELECT value FROM config WHERE key = 'daily_claim_limit'");
    const dailyLimit = Math.min(Number(limitRes.rows[0]?.value) || 10, 100);
    const todayStr = new Date().toISOString().slice(0, 10);
    const countTodayRes = await query<{ c: string }>("SELECT COUNT(*) AS c FROM task_claims WHERE user_id = $1 AND claimed_at::date = $2::date", [userId, todayStr]);
    const countToday = Number(countTodayRes.rows[0]?.c || 0);
    if (countToday >= dailyLimit) {
      res.status(429).json({ error: "DAILY_LIMIT", message: `今日领取已达上限（${dailyLimit} 条），请明日再试。` });
      return;
    }

    if (task.max_claim_count != null) {
      const claimedRes = await query<{ c: string }>("SELECT COUNT(*) AS c FROM task_claims WHERE task_id = $1", [taskId]);
      const claimed = Number(claimedRes.rows[0]?.c || 0);
      if (claimed >= task.max_claim_count) {
        res.status(409).json({ error: "TASK_FULL", message: "该任务已被领完。" });
        return;
      }
    }

    try {
      const created = await withTx(async (client) => {
        const ins = await client.query<{ id: number }>(
          "INSERT INTO task_claims (task_id, user_id, status) VALUES ($1, $2, 'pending') RETURNING id",
          [taskId, userId]
        );
        // 领取计数 + 业务状态推进（不影响原有领取逻辑，仅增加可视化字段）
        await client.query(
          "UPDATE tasks SET claimed_count = claimed_count + 1, biz_status = CASE WHEN biz_status = 'open' THEN 'in_progress' ELSE biz_status END WHERE id = $1",
          [taskId]
        );
        await recordOperationLogTx(client, { userId, actionType: "edit", targetType: "task", targetId: taskId });
        return ins.rows[0]!;
      });
      res.status(201).json({ id: created.id, task_id: taskId });
    } catch (e: any) {
      if (e?.code === "23505") {
        res.status(409).json({ error: "ALREADY_CLAIMED", message: "您已领取过该任务。" });
        return;
      }
      throw e;
    }
  })().catch((e) => {
    console.error("influencer claim error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * GET /api/influencer/my-claims
 * 我的任务列表：已领取任务及投稿状态。
 */
router.get("/my-claims", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  (async () => {
    const { rows } = await query(
      `
    SELECT tc.id AS claim_id, tc.task_id, tc.status AS claim_status, tc.claimed_at,
           t.point_reward, t.platform, t.type AS task_type,
           m.title AS material_title, m.cloud_link,
           s.id AS submission_id, s.work_link, s.status AS submission_status, s.note AS review_note
    FROM task_claims tc
    JOIN tasks t ON tc.task_id = t.id
    JOIN materials m ON t.material_id = m.id
    LEFT JOIN submissions s ON s.task_claim_id = tc.id
    WHERE tc.user_id = $1
    ORDER BY tc.claimed_at DESC
  `,
      [userId]
    );
    res.json({ list: rows });
  })().catch((e) => {
    console.error("influencer my-claims error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * GET /api/influencer/my-claims/:claimId
 * 单条领取详情（含下载链接），用于复制/打开云盘。
 */
router.get("/my-claims/:claimId", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const claimId = Number(req.params.claimId);
  if (!Number.isInteger(claimId) || claimId < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的领取 ID。" });
    return;
  }
  (async () => {
    const r = await query<Record<string, unknown>>(
      `
    SELECT tc.id AS claim_id, tc.task_id, tc.status AS claim_status, tc.claimed_at,
           t.point_reward, t.platform, m.title AS material_title, m.cloud_link, m.remark
    FROM task_claims tc
    JOIN tasks t ON tc.task_id = t.id
    JOIN materials m ON t.material_id = m.id
    WHERE tc.id = $1 AND tc.user_id = $2
  `,
      [claimId, userId]
    );
    const row = r.rows[0];
    if (!row) {
      res.status(404).json({ error: "NOT_FOUND", message: "记录不存在。" });
      return;
    }
    res.json(row);
  })().catch((e) => {
    console.error("influencer my-claim detail error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * POST /api/influencer/submissions
 * 投稿：提交作品链接，创建 submission 并更新 task_claim 为 submitted。
 */
router.post("/submissions", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const { task_claim_id, work_link, note } = req.body ?? {};
  if (!task_claim_id || !work_link || typeof work_link !== "string" || !work_link.trim()) {
    res.status(400).json({ error: "INVALID_INPUT", message: "请提供领取 ID 与作品链接。" });
    return;
  }
  (async () => {
    const tcRes = await query<{ id: number; task_id: number; user_id: number; status: string }>(
      "SELECT id, task_id, user_id, status FROM task_claims WHERE id = $1",
      [Number(task_claim_id)]
    );
    const tc = tcRes.rows[0];
    if (!tc || tc.user_id !== userId) {
      res.status(404).json({ error: "NOT_FOUND", message: "领取记录不存在或无权操作。" });
      return;
    }
    if (tc.status !== "pending") {
      res.status(400).json({ error: "ALREADY_SUBMITTED", message: "该任务已提交过投稿。" });
      return;
    }
    const existing = await query<{ id: number }>("SELECT id FROM submissions WHERE task_claim_id = $1", [tc.id]);
    if (existing.rows[0]) {
      res.status(409).json({ error: "ALREADY_SUBMITTED", message: "该任务已提交过投稿。" });
      return;
    }
    await query("INSERT INTO submissions (task_claim_id, work_link, note, status) VALUES ($1, $2, $3, 'pending')", [tc.id, work_link.trim(), note ? String(note).trim() : null]);
    await query("UPDATE task_claims SET status = 'submitted' WHERE id = $1", [tc.id]);
    res.status(201).json({ ok: true });
  })().catch((e) => {
    console.error("influencer submission create error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * GET /api/influencer/points
 * 当前积分、本周预计结算、流水（最近 N 条）。
 */
router.get("/points", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  (async () => {
    const accRes = await query<{ id: number; balance: number }>("SELECT id, balance FROM point_accounts WHERE user_id = $1", [userId]);
    const acc = accRes.rows[0];
    if (!acc) {
      res.json({ balance: 0, weekPending: 0, ledger: [] });
      return;
    }
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    const weekPendingRes = await query<{ total: string }>(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM point_ledger WHERE account_id = $1 AND amount > 0 AND created_at::date >= $2::date AND created_at::date <= $3::date",
      [acc.id, weekStartStr, weekEndStr]
    );
    const ledgerRes = await query<{ id: number; amount: number; type: string; ref_id: number | null; created_at: string }>(
      "SELECT id, amount, type, ref_id, created_at FROM point_ledger WHERE account_id = $1 ORDER BY id DESC LIMIT 50",
      [acc.id]
    );
    res.json({
      balance: acc.balance,
      weekPending: Number(weekPendingRes.rows[0]?.total || 0),
      ledger: ledgerRes.rows,
    });
  })().catch((e) => {
    console.error("influencer points error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * GET /api/influencer/withdrawals
 * 达人提现申请列表（仅本人）。
 */
router.get("/withdrawals", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  (async () => {
    const { rows } = await query(
      "SELECT id, amount, bank_account_name, bank_name, bank_account_no, status, note, created_at, updated_at, paid_at FROM withdrawal_requests WHERE user_id = $1 ORDER BY id DESC LIMIT 200",
      [userId]
    );
    res.json({ list: rows });
  })().catch((e) => {
    console.error("influencer withdrawals list error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * POST /api/influencer/withdrawals
 * 发起提现申请（策略 A：申请不扣余额，打款时扣）。
 * 请求体: { amount, bank_account_name, bank_name, bank_account_no }
 */
router.post("/withdrawals", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const { amount, bank_account_name, bank_name, bank_account_no } = req.body ?? {};
  const num = Number(amount);
  if (!Number.isInteger(num) || num < 1 || num > 100000000) {
    res.status(400).json({ error: "INVALID_AMOUNT", message: "请填写有效提现金额（整数且大于 0）。" });
    return;
  }
  if (
    !bank_account_name ||
    !bank_name ||
    !bank_account_no ||
    typeof bank_account_name !== "string" ||
    typeof bank_name !== "string" ||
    typeof bank_account_no !== "string"
  ) {
    res.status(400).json({ error: "INVALID_BANK_INFO", message: "请完整填写收款姓名、银行名称与银行账号。" });
    return;
  }
  (async () => {
    const accRes = await query<{ balance: number }>("SELECT balance FROM point_accounts WHERE user_id = $1", [userId]);
    const balance = accRes.rows[0]?.balance ?? 0;
    if (balance < num) {
      res.status(409).json({ error: "INSUFFICIENT", message: `余额不足，当前余额 ${balance}。` });
      return;
    }
    const created = await query<{ id: number }>(
      "INSERT INTO withdrawal_requests (user_id, amount, bank_account_name, bank_name, bank_account_no, status) VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id",
      [userId, num, bank_account_name.trim(), bank_name.trim(), bank_account_no.trim()]
    );
    res.status(201).json({ id: created.rows[0]!.id });
  })().catch((e) => {
    console.error("influencer withdrawals create error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * GET /api/influencer/market-orders
 * 达人订单大厅：仅展示待领取（open）的客户端发单。
 */
router.get("/market-orders", (req: AuthRequest, res: Response) => {
  const rawQ = typeof req.query.q === "string" ? req.query.q.trim() : "";
  (async () => {
    // 达人侧脱敏：不返回客户支付积分 reward_points，仅返回达人固定收益 creator_reward_points（命名为 reward_points 兼容前端）
    // 允许返回 tier（A/B/C）用于展示制作标准，但不解释积分档位规则
    let sql = `SELECT mo.id, mo.order_no, mo.title, mo.requirements, mo.tier, mo.voice_link, mo.voice_note, mo.tiktok_link, mo.product_images, mo.sku_codes, mo.sku_images,
                      mo.creator_reward_points AS reward_points, mo.status, mo.created_at,
                      mo.client_id, u.username AS client_username, COALESCE(NULLIF(u.display_name, ''), u.username) AS client_display_name,
                      mo.client_shop_name, mo.client_group_chat
       FROM client_market_orders mo
       JOIN users u ON mo.client_id = u.id
      WHERE mo.status = 'open' AND mo.is_deleted = 0`;
    const params: unknown[] = [];
    if (rawQ) {
      sql += ` AND (mo.order_no = $1 OR mo.title = $1 OR mo.requirements = $1 OR u.username = $1 OR COALESCE(u.display_name, '') = $1)`;
      params.push(rawQ);
    }
    sql += ` ORDER BY mo.id DESC`;
    const { rows } = await query(sql, params);
    res.json({ list: rows });
  })().catch((e) => {
    console.error("influencer market-orders list error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * GET /api/influencer/market-orders/my
 * 当前达人领取或已完成的客户端发单。
 */
router.get("/market-orders/my", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const rawQ = typeof req.query.q === "string" ? req.query.q.trim() : "";
  (async () => {
    // 达人侧脱敏：不返回客户支付积分 reward_points，仅返回达人固定收益 creator_reward_points（命名为 reward_points 兼容前端）
    // 允许返回 tier（A/B/C）用于展示制作标准，但不解释积分档位规则
    let sql = `SELECT mo.id, mo.order_no, mo.title, mo.requirements, mo.tier, mo.voice_link, mo.voice_note, mo.tiktok_link, mo.product_images, mo.sku_codes, mo.sku_images,
                      mo.creator_reward_points AS reward_points, mo.status, mo.work_link, mo.created_at, mo.updated_at, mo.completed_at,
                      mo.client_id, u.username AS client_username, COALESCE(NULLIF(u.display_name, ''), u.username) AS client_display_name,
                      mo.client_shop_name, mo.client_group_chat
       FROM client_market_orders mo
       JOIN users u ON mo.client_id = u.id
      WHERE mo.influencer_id = $1 AND mo.is_deleted = 0`;
    const params: unknown[] = [userId];
    if (rawQ) {
      sql += ` AND (mo.order_no = $2 OR mo.title = $2 OR mo.requirements = $2 OR u.username = $2 OR COALESCE(u.display_name, '') = $2)`;
      params.push(rawQ);
    }
    sql += ` ORDER BY mo.id DESC`;
    const { rows } = await query(sql, params);
    res.json({ list: rows });
  })().catch((e) => {
    console.error("influencer market-orders my error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * POST /api/influencer/market-orders/:id/claim
 * 领取一条客户端发单（先到先得）。
 */
router.post("/market-orders/:id/claim", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的订单 ID。" });
    return;
  }
  (async () => {
    const profileRes = await query<{ blacklisted: number }>("SELECT blacklisted FROM influencer_profiles WHERE user_id = $1", [userId]);
    if (profileRes.rows[0]?.blacklisted === 1) {
      res.status(403).json({ error: "BLACKLISTED", message: "您已被列入黑名单，无法领取。" });
      return;
    }
    const updated = await withTx(async (client) => {
      const u = await client.query<{ id: number }>(
        `UPDATE client_market_orders SET status = 'claimed', influencer_id = $1, updated_at = now()
         WHERE id = $2 AND status = 'open' AND is_deleted = 0 RETURNING id`,
        [userId, orderId]
      );
      const ok = u.rows[0];
      if (ok) {
        await recordOperationLogTx(client, { userId, actionType: "edit", targetType: "order", targetId: orderId });
      }
      return ok;
    });
    if (!updated) {
      res.status(409).json({ error: "UNAVAILABLE", message: "订单不可领取（已被领或已结束）。" });
      return;
    }
    res.json({ ok: true, id: orderId });
  })().catch((e) => {
    console.error("influencer market-orders claim error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

/**
 * POST /api/influencer/market-orders/:id/complete
 * 提交完成与作品链接：达人获得 reward_points 积分，同时从客户端等额扣除。
 */
router.post("/market-orders/:id/complete", (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const orderId = Number(req.params.id);
  const { work_link } = req.body ?? {};
  const link = work_link != null ? String(work_link).trim() : "";
  if (!Number.isInteger(orderId) || orderId < 1) {
    res.status(400).json({ error: "INVALID_ID", message: "无效的订单 ID。" });
    return;
  }
  if (!link || link.length > 2000) {
    res.status(400).json({ error: "INVALID_LINK", message: "请填写有效作品/交付链接（1–2000 字符）。" });
    return;
  }
  (async () => {
    const result = await settleMarketOrderComplete({ orderId, influencerUserId: userId, workLink: link });
    if (result.kind === "not_found") {
      res.status(404).json({ error: "NOT_FOUND", message: "订单不存在。" });
      return;
    }
    if (result.kind === "bad_state") {
      res.status(409).json({ error: "BAD_STATE", message: "订单状态不允许完成，或您不是领取人。" });
      return;
    }
    if (result.kind === "insufficient") {
      res.status(409).json({
        error: "CLIENT_INSUFFICIENT",
        message: `客户端积分不足，无法结算（需 ${result.need}，当前 ${result.balance}）。请联系商家充值后再试。`,
      });
      return;
    }
    res.json({ ok: true });
  })().catch((e) => {
    console.error("influencer market-orders complete error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "服务器内部错误，请稍后重试。" });
  });
});

export default router;
