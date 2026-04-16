import type { PoolClient } from "pg";

/**
 * 生成达人领单业务订单号：XT-YYYYMMDD-当日序号（与充值单共用 XT 视觉前缀，计数器独立前缀 XT_MO，避免与充值序号混排）。
 */
export async function allocateMarketOrderNo(client: PoolClient): Promise<string> {
  const dateRes = await client.query<{ date_key: string }>(
    "SELECT to_char((now() AT TIME ZONE 'Asia/Shanghai'), 'YYYYMMDD') AS date_key",
  );
  const dateKey = dateRes.rows[0]!.date_key;
  const seqRes = await client.query<{ last_no: number }>(
    `
    INSERT INTO biz_order_counters (prefix, date_key, last_no)
    VALUES ('XT_MO', $1, 1)
    ON CONFLICT (prefix, date_key)
    DO UPDATE SET last_no = biz_order_counters.last_no + 1
    RETURNING last_no
    `,
    [dateKey],
  );
  const seqNo = seqRes.rows[0]!.last_no;
  return `XT-${dateKey}-${seqNo}`;
}
