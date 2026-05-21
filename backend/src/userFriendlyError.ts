/**
 * 将数据库错误码和常见错误转为用户可理解的中文提示。
 * 避免向客户端暴露内部错误详情。
 */
export function getUserFriendlyError(err: unknown, fallback = "服务器内部错误，请稍后重试。"): string {
  if (err instanceof Error) {
    const pgCode = (err as { code?: string }).code;

    // PostgreSQL 错误码 → 中文提示
    if (pgCode === "23505") return "数据重复，请检查是否已存在相同记录。";
    if (pgCode === "23503") return "关联数据不存在，请检查相关记录是否已被删除。";
    if (pgCode === "23502") return "必填字段缺失，请检查输入是否完整。";
    if (pgCode === "23514") return "数据校验失败，请检查输入值是否符合要求。";

    // 业务层抛出的错误（如 "INSUFFICIENT_POINTS"、"BAD_STATE" 等）直接透传
    const msg = err.message;
    if (msg && !msg.includes("SQL") && !msg.includes("syntax") && !msg.includes("connection")) {
      return msg;
    }
  }
  return fallback;
}
