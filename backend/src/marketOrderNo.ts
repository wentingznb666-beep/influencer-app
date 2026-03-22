import type { PoolClient } from "pg";

/**
 * 生成达人领单业务订单号（与充值单 XT 区分，前缀 DL + 日期 + 当日序号）。
 */
export async function allocateMarketOrderNo(client: PoolClient): Promise<string> {
  const dateRes = await client.query<{ date_key: string }>(
    "SELECT to_char((now() AT TIME ZONE 'Asia/Shanghai'), 'YYYYMMDD') AS date_key",
  );
  const dateKey = dateRes.rows[0]!.date_key;
  const seqRes = await client.query<{ last_no: number }>(
    `
    INSERT INTO biz_order_counters (prefix, date_key, last_no)
    VALUES ('DL', $1, 1)
    ON CONFLICT (prefix, date_key)
    DO UPDATE SET last_no = biz_order_counters.last_no + 1
    RETURNING last_no
    `,
    [dateKey],
  );
  const seqNo = seqRes.rows[0]!.last_no;
  return `DL${dateKey}-${seqNo}`;
}
