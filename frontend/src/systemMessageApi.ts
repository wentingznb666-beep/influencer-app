import { fetchWithAuth } from "./fetchWithAuth";

/** 系统消息结构。 */
export type SystemMessage = {
  id: number;
  category: string;
  title: string;
  content: string;
  related_type: string | null;
  related_id: number | null;
  is_read: number;
  created_at: string;
};

/** 读取当前账号系统消息。 */
export async function getSystemMessages() {
  const res = await fetchWithAuth("/api/matching/messages");
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "请求失败");
  return res.json() as Promise<{ list: SystemMessage[] }>;
}

/** 标记消息为已读。 */
export async function markSystemMessageRead(messageId: number) {
  const res = await fetchWithAuth(`/api/matching/messages/${messageId}/read`, { method: "POST" });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "操作失败");
  return res.json();
}
