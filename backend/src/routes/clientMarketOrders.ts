import { Router, Response } from "express";
import { query, withTx } from "../db";
import { ensurePointAccountLocked } from "../pointAccounts";
import { allocateMarketOrderNo } from "../marketOrderNo";
import { requireAuth, requireRole, type AuthRequest } from "../auth";
import { resolveMarketOrderCreatorRewardUnitFromConfig } from "../cooperationTypes";
import { recordOperationLogTx } from "../operationLog";
import { normalizeDateOnly } from "../dateUtils";
import { createMessageToAdminAndEmployeesTx } from "../systemMessages";
import { getUserFriendlyError } from "../userFriendlyError";
import {
  normalizeProductImages,
  normalizeSkuCodes,
  normalizeSkuIds,
  normalizeClientShopName,
  normalizeClientGroupChat,
  normalizePublishMethod,
  resolveSkuSnapshotByIds,
} from "./client";

const router = Router();
router.use(requireAuth);
router.use(requireRole("client"));

const DEFAULT_MARKET_ORDER_CREATOR_REWARD = 5;
const PUBLISH_METHOD_CLIENT_SELF = "client_self_publish";
const PUBLISH_METHOD_INFLUENCER_CART = "influencer_publish_with_cart";

/**
 * 将档位映射为商家支付积分。
 */
function resolveMarketOrderPayPoints(tier: string): { tier: "A" | "B" | "C"; payPoints: number } {
  if (tier === "A") return { tier: "A", payPoints: 60 };
  if (tier === "B") return { tier: "B", payPoints: 40 };
  return { tier: "C", payPoints: 20 };
}

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
    sql += ` ORDER BY mo.id DESC LIMIT 500`;
    const { rows } = await query(sql, params);
    res.json({ list: rows });
  })().catch((e) => {
    console.error("client market-orders list error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });
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
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });
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
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });
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
      if (nextTier !== String(ord.tier || "").toUpperCase()) {
        res.status(400).json({ error: "TIER_LOCKED", message: "订单档位已锁定，不支持修改。" });
        return;
      }
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
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });
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
    const result = await withTx(async (client) => {
      const updated = await client.query<{ id: number; pay_deducted: number; reward_points: number; task_count: number }>(
        "UPDATE client_market_orders SET is_deleted = 1, deleted_at = now(), updated_at = now() WHERE id = $1 AND client_id = $2 AND status = 'open' AND is_deleted = 0 RETURNING id, pay_deducted, reward_points, task_count",
        [id, clientId]
      );
      if (!updated.rows[0]) {
        return { kind: "not_found" as const };
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
      return { kind: "ok" as const };
    });
    if (result.kind === "not_found") {
      res.status(404).json({ error: "NOT_FOUND", message: "订单不存在或不可删除。" });
      return;
    }
    res.json({ ok: true });
  })().catch((e) => {
    console.error("client market-orders delete error:", e);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: getUserFriendlyError(e) });
  });
});

export default router;
