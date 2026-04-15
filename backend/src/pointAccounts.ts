import { PoolClient } from "pg";

/**
 * 在事务内按用户锁定积分账户；若不存在则创建余额为 0 的账户并锁定。
 * @param client 已开启事务的 PG 商家端
 * @param userId 用户 ID
 */
export async function ensurePointAccountLocked(client: PoolClient, userId: number): Promise<{ id: number; balance: number }> {
  const accRes = await client.query<{ id: number; balance: number }>("SELECT id, balance FROM point_accounts WHERE user_id = $1 FOR UPDATE", [userId]);
  let acc = accRes.rows[0];
  if (!acc) {
    const created = await client.query<{ id: number; balance: number }>(
      "INSERT INTO point_accounts (user_id, balance) VALUES ($1, 0) RETURNING id, balance",
      [userId]
    );
    acc = created.rows[0]!;
  }
  return acc;
}
