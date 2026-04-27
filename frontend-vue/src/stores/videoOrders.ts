import { defineStore } from "pinia";
import { ref } from "vue";
import type { UnifiedOrderType } from "@/types/videoOrderExt";

/** 订单模块全局状态（持久化筛选/展示偏好）。 */
export const useVideoOrdersStore = defineStore("videoOrders", () => {
  const clientTypeFilter = ref<UnifiedOrderType | "">("");
  const employeeTypeFilter = ref<UnifiedOrderType | "">("");
  const orderKeyword = ref("");
  const highContrast = ref(true);
  const roomyLayout = ref(true);

  /** 初始化本地缓存。 */
  function initFromStorage(): void {
    const raw = localStorage.getItem("app:video-orders:store");
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as Partial<{
        clientTypeFilter: UnifiedOrderType | "";
        employeeTypeFilter: UnifiedOrderType | "";
        orderKeyword: string;
        highContrast: boolean;
        roomyLayout: boolean;
      }>;
      if (typeof data.clientTypeFilter === "string") clientTypeFilter.value = data.clientTypeFilter;
      if (typeof data.employeeTypeFilter === "string") employeeTypeFilter.value = data.employeeTypeFilter;
      if (typeof data.orderKeyword === "string") orderKeyword.value = data.orderKeyword;
      if (typeof data.highContrast === "boolean") highContrast.value = data.highContrast;
      if (typeof data.roomyLayout === "boolean") roomyLayout.value = data.roomyLayout;
    } catch {
      // ignore parse error
    }
  }

  /** 持久化当前状态。 */
  function persist(): void {
    localStorage.setItem(
      "app:video-orders:store",
      JSON.stringify({
        clientTypeFilter: clientTypeFilter.value,
        employeeTypeFilter: employeeTypeFilter.value,
        orderKeyword: orderKeyword.value,
        highContrast: highContrast.value,
        roomyLayout: roomyLayout.value,
      }),
    );
  }

  return {
    clientTypeFilter,
    employeeTypeFilter,
    orderKeyword,
    highContrast,
    roomyLayout,
    initFromStorage,
    persist,
  };
});
