export type Locale = "th" | "zh";

/** i18n 文案字典。 */
const dict: Record<string, { th: string; zh: string }> = {
  orderCenterTitle: { th: "ระบบคำสั่งงานวิดีโอ", zh: "视频订单系统" },
  refresh: { th: "รีเฟรช", zh: "刷新" },
  publishOrder: { th: "发布需求", zh: "发布需求" },
  saveSuccess: { th: "บันทึกสำเร็จ", zh: "保存成功" },
  close: { th: "ปิด", zh: "关闭" },
  confirm: { th: "ยืนยัน", zh: "确认" },
  markPaid: { th: "ทำเครื่องหมายว่าชำระแล้ว", zh: "手动标记付款" },
};

/** 读取当前语言（默认泰语）。 */
export function readLocale(): Locale {
  const v = String(localStorage.getItem("app:locale") || "th").trim();
  return v === "zh" ? "zh" : "th";
}

/** 写入当前语言。 */
export function writeLocale(locale: Locale): void {
  localStorage.setItem("app:locale", locale);
}

/** 文案翻译函数。 */
export function tr(key: string, fallback: string, locale: Locale = readLocale()): string {
  const item = dict[key];
  if (!item) return fallback;
  return locale === "zh" ? item.zh : item.th;
}
