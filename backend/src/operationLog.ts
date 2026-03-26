import { PoolClient } from "pg";
import { query } from "./db";

export type OperationActionType = "create" | "edit" | "delete";
export type OperationTargetType = "intent" | "order" | "task";

/**
 * 写入一条操作日志（事务内版本）。
 * - 用于在“增删改”接口里埋点，确保业务成功后才记录日志。
 */
export async function recordOperationLogTx(
  client: PoolClient,
  params: { userId: number; actionType: OperationActionType; targetType: OperationTargetType; targetId: number }
): Promise<void> {
  const { userId, actionType, targetType, targetId } = params;
  await client.query(
    "INSERT INTO operation_log (user_id, action_type, target_type, target_id) VALUES ($1, $2, $3, $4)",
    [userId, actionType, targetType, targetId]
  );
}

/**
 * 写入一条操作日志（非事务版本）。
 * - 适用于不需要事务的简单写入点；优先使用 recordOperationLogTx。
 */
export async function recordOperationLog(
  params: { userId: number; actionType: OperationActionType; targetType: OperationTargetType; targetId: number }
): Promise<void> {
  const { userId, actionType, targetType, targetId } = params;
  await query("INSERT INTO operation_log (user_id, action_type, target_type, target_id) VALUES ($1, $2, $3, $4)", [
    userId,
    actionType,
    targetType,
    targetId,
  ]);
}

