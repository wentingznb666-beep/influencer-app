
import { defineStore } from "pinia";
import { ref } from "vue";
import { listClientMarketOrders, type ClientMarketOrder } from "@/api/client";
import {
  acceptClientOfflineVideoOrder,
  acceptClientOrderBatch,
  listClientOfflineVideoOrders,
  listClientOrderBatches,
  rejectClientMonthlyBatch,
  rejectClientOfflineVideoOrder,
  settleClientMonthlyBatch,
  type OrderBatchRecord,
  type VideoOrder,
} from "@/api/videoOrders";
import type { UnifiedOrderType } from "@/types/videoOrderExt";

type ClientBatchQueryState = {
  status: "" | "pending_acceptance" | "accepted" | "settled";
  keyword: string;
  page: number;
  pageSize: number;
};

/** 订单模块全局状态（持久化筛选/展示偏好 + 商家端订单/批次状态）。 */
export const useVideoOrdersStore = defineStore("videoOrders", () => {
  const clientTypeFilter = ref<UnifiedOrderType | "">("");
  const employeeTypeFilter = ref<UnifiedOrderType | "">("");
  const orderKeyword = ref("");
  const highContrast = ref(true);
  const roomyLayout = ref(true);

  const clientMarketOrders = ref<ClientMarketOrder[]>([]);
  const clientOfflineOrders = ref<VideoOrder[]>([]);
  const clientOrdersLoading = ref(false);
  const clientBatchMap = ref<Record<number, OrderBatchRecord[]>>({});
  const clientBatchLoadingMap = ref<Record<number, boolean>>({});
  const clientBatchActionLoadingMap = ref<Record<string, boolean>>({});
  const clientOrderActionLoadingMap = ref<Record<number, boolean>>({});
  const clientBatchQueryMap = ref<Record<number, ClientBatchQueryState>>({});

  function defaultBatchQuery(): ClientBatchQueryState {
    return {
      status: "",
      keyword: "",
      page: 1,
      pageSize: 5,
    };
  }

  function ensureBatchQuery(orderId: number): ClientBatchQueryState {
    if (!clientBatchQueryMap.value[orderId]) {
      clientBatchQueryMap.value = {
        ...clientBatchQueryMap.value,
        [orderId]: defaultBatchQuery(),
      };
    }
    return clientBatchQueryMap.value[orderId];
  }

  function setClientBatchQuery(orderId: number, patch: Partial<ClientBatchQueryState>): void {
    clientBatchQueryMap.value = {
      ...clientBatchQueryMap.value,
      [orderId]: {
        ...ensureBatchQuery(orderId),
        ...patch,
      },
    };
  }

  function setClientOrderBatches(orderId: number, batches: OrderBatchRecord[]): void {
    const next = [...batches].sort((a, b) => Number(b.batch_no || 0) - Number(a.batch_no || 0));
    clientBatchMap.value = {
      ...clientBatchMap.value,
      [orderId]: next,
    };

    clientOfflineOrders.value = clientOfflineOrders.value.map((order) => {
      if (Number(order.id) !== Number(orderId)) return order;
      return {
        ...order,
        batch_payload: next,
      };
    });
  }

  function seedClientBatchesFromOrders(orders: VideoOrder[]): void {
    const nextMap = { ...clientBatchMap.value };
    for (const order of orders) {
      if (!Array.isArray(order.batch_payload) || !order.batch_payload.length) continue;
      if (!nextMap[order.id] || !nextMap[order.id].length) {
        nextMap[order.id] = [...order.batch_payload].sort((a, b) => Number(b.batch_no || 0) - Number(a.batch_no || 0));
      }
      ensureBatchQuery(order.id);
    }
    clientBatchMap.value = nextMap;
  }

  function getClientBatches(orderId: number): OrderBatchRecord[] {
    return clientBatchMap.value[orderId] || [];
  }

  function isClientBatchActing(orderId: number, batchId: string | number): boolean {
    return Boolean(clientBatchActionLoadingMap.value[`${orderId}_${batchId}`]);
  }

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

  /** 加载商家端订单总览。 */
  async function fetchClientOrders(): Promise<void> {
    clientOrdersLoading.value = true;
    try {
      const [marketOrders, offlineOrders] = await Promise.all([listClientMarketOrders(), listClientOfflineVideoOrders()]);
      clientMarketOrders.value = marketOrders;
      clientOfflineOrders.value = offlineOrders;
      seedClientBatchesFromOrders(offlineOrders);
    } finally {
      clientOrdersLoading.value = false;
    }
  }

  /** 加载某个订单下的批次记录。 */
  async function fetchClientOrderBatches(orderId: number, force = false): Promise<OrderBatchRecord[]> {
    const current = getClientBatches(orderId);
    if (!force && current.length) return current;
    clientBatchLoadingMap.value = {
      ...clientBatchLoadingMap.value,
      [orderId]: true,
    };
    try {
      const batches = await listClientOrderBatches(orderId);
      setClientOrderBatches(orderId, batches);
      return batches;
    } finally {
      clientBatchLoadingMap.value = {
        ...clientBatchLoadingMap.value,
        [orderId]: false,
      };
    }
  }

  /** 商家直接验收非批次订单。 */
  async function acceptClientOrder(orderId: number): Promise<void> {
    clientOrderActionLoadingMap.value = {
      ...clientOrderActionLoadingMap.value,
      [orderId]: true,
    };
    try {
      await acceptClientOfflineVideoOrder(orderId);
      await fetchClientOrders();
    } finally {
      clientOrderActionLoadingMap.value = {
        ...clientOrderActionLoadingMap.value,
        [orderId]: false,
      };
    }
  }

  /** 商家退回非批次订单修改。 */
  async function rejectClientOrder(orderId: number, note?: string): Promise<void> {
    clientOrderActionLoadingMap.value = {
      ...clientOrderActionLoadingMap.value,
      [orderId]: true,
    };
    try {
      await rejectClientOfflineVideoOrder(orderId, note || "");
      await fetchClientOrders();
    } finally {
      clientOrderActionLoadingMap.value = {
        ...clientOrderActionLoadingMap.value,
        [orderId]: false,
      };
    }
  }

  /** 商家直接验收批次，并同步刷新 store。 */
  async function acceptClientBatch(orderId: number, batch: OrderBatchRecord, body?: {
    accepted_count?: number;
    remark?: string;
  }): Promise<void> {
    const actionKey = `${orderId}_${batch.batch_id}`;
    clientBatchActionLoadingMap.value = {
      ...clientBatchActionLoadingMap.value,
      [actionKey]: true,
    };
    try {
      const acceptedCount = Number((body?.accepted_count ?? batch.accepted_count ?? batch.video_count ?? 0)) || batch.video_count;
      const updatedBatch = await acceptClientOrderBatch(orderId, batch.batch_id, {
        accepted_count: acceptedCount,
        remark: body?.remark || "",
      });
      if (updatedBatch) {
        const next = getClientBatches(orderId).map((item) => (String(item.batch_id) === String(batch.batch_id) ? updatedBatch : item));
        setClientOrderBatches(orderId, next);
      }
      await fetchClientOrderBatches(orderId, true);
      await fetchClientOrders();
    } finally {
      clientBatchActionLoadingMap.value = {
        ...clientBatchActionLoadingMap.value,
        [actionKey]: false,
      };
    }
  }

  /** 商家直接结算已验收批次，并同步刷新 store。 */
  async function settleClientBatch(orderId: number, batch: OrderBatchRecord, settledAmount?: number): Promise<void> {
    const actionKey = `${orderId}_${batch.batch_id}`;
    clientBatchActionLoadingMap.value = {
      ...clientBatchActionLoadingMap.value,
      [actionKey]: true,
    };
    try {
      const amount = Number(batch.settled_amount ?? settledAmount ?? 0) || Number(settledAmount ?? 0) || 0;
      const updatedBatch = await settleClientMonthlyBatch(orderId, Number(batch.batch_no || batch.batch_id), {
        settled_amount: amount,
      });
      if (updatedBatch) {
        const next = getClientBatches(orderId).map((item) => (String(item.batch_id) === String(batch.batch_id) ? updatedBatch : item));
        setClientOrderBatches(orderId, next);
      }
      await fetchClientOrderBatches(orderId, true);
      await fetchClientOrders();
    } finally {
      clientBatchActionLoadingMap.value = {
        ...clientBatchActionLoadingMap.value,
        [actionKey]: false,
      };
    }
  }

  /** 商家退回批次修改，并同步刷新 store。 */
  async function rejectClientBatch(orderId: number, batch: OrderBatchRecord, remark?: string): Promise<void> {
    const actionKey = `${orderId}_${batch.batch_id}`;
    clientBatchActionLoadingMap.value = {
      ...clientBatchActionLoadingMap.value,
      [actionKey]: true,
    };
    try {
      const updatedBatch = await rejectClientMonthlyBatch(orderId, Number(batch.batch_no || batch.batch_id), {
        remark: remark || "",
      });
      if (updatedBatch) {
        const next = getClientBatches(orderId).map((item) => (String(item.batch_id) === String(batch.batch_id) ? updatedBatch : item));
        setClientOrderBatches(orderId, next);
      }
      await fetchClientOrderBatches(orderId, true);
      await fetchClientOrders();
    } finally {
      clientBatchActionLoadingMap.value = {
        ...clientBatchActionLoadingMap.value,
        [actionKey]: false,
      };
    }
  }

  return {
    clientTypeFilter,
    employeeTypeFilter,
    orderKeyword,
    highContrast,
    roomyLayout,
    clientMarketOrders,
    clientOfflineOrders,
    clientOrdersLoading,
    clientBatchMap,
    clientBatchLoadingMap,
    clientBatchActionLoadingMap,
    clientOrderActionLoadingMap,
    clientBatchQueryMap,
    initFromStorage,
    persist,
    setClientBatchQuery,
    getClientBatches,
    isClientBatchActing,
    fetchClientOrders,
    fetchClientOrderBatches,
    acceptClientOrder,
    rejectClientOrder,
    acceptClientBatch,
    rejectClientBatch,
    settleClientBatch,
  };
});
