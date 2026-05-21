import { query } from "./db";

/**
 * 向单个用户发送系统消息（使用连接池）。
 */
export async function createMessage(
  userId: number,
  category: string,
  title: string,
  content: string,
  relatedType?: string,
  relatedId?: number
): Promise<void> {
  await query(
    `INSERT INTO system_messages (user_id, category, title, content, related_type, related_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, category, title, content, relatedType ?? null, relatedId ?? null]
  );
}

/**
 * 在事务内向单个用户发送系统消息。
 */
export async function createMessageTx(
  client: { query: Function },
  userId: number,
  category: string,
  title: string,
  content: string,
  relatedType?: string,
  relatedId?: number
): Promise<void> {
  try {
    await client.query(
      `INSERT INTO system_messages (user_id, category, title, content, related_type, related_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, category, title, content, relatedType ?? null, relatedId ?? null]
    );
  } catch (e: any) {
    const code = typeof e?.code === "string" ? e.code : "";
    if (code === "42P01" || code === "42703") return;
    throw e;
  }
}

/**
 * 在事务内向所有管理员和员工群发系统消息。
 */
export async function createMessageToAdminAndEmployeesTx(
  client: { query: Function },
  category: string,
  title: string,
  content: string,
  relatedType?: string,
  relatedId?: number
): Promise<void> {
  try {
    await client.query(
      `INSERT INTO system_messages (user_id, category, title, content, related_type, related_id)
       SELECT u.id, $1, $2, $3, $4, $5
         FROM users u
         JOIN roles r ON r.id=u.role_id
        WHERE u.disabled=0 AND r.name IN ('employee','admin')`,
      [category, title, content, relatedType ?? null, relatedId ?? null]
    );
  } catch (e: any) {
    const code = typeof e?.code === "string" ? e.code : "";
    if (code === "42P01" || code === "42703") return;
    throw e;
  }
}
