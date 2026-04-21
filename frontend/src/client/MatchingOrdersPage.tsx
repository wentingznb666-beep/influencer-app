import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  acceptMatchingOrder,
  getMatchingOrderApplicants,
  getMatchingOrders,
  rejectMatchingOrderAccept,
  rejectMatchingOrderApplicant,
  selectMatchingOrderApplicant,
} from "../clientApi";

/** 商家端独立页面：我的撮合订单与报名管理。 */
export default function MatchingOrdersPage() {
  const location = useLocation();
  const [orders, setOrders] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [paymentInfo, setPaymentInfo] = useState<any>(null);

  /** 读取我的撮合订单。 */
  const loadAll = async () => {
    const data = await getMatchingOrders();
    setOrders(Array.isArray(data?.list) ? data.list : []);
  };

  /** 读取某个订单的报名达人。 */
  const loadApplicants = async (orderId: number) => {
    const data = await getMatchingOrderApplicants(orderId);
    setApplicants(Array.isArray(data?.list) ? data.list : []);
  };

  useEffect(() => {
    loadAll().catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  /** 打开报名管理面板。 */
  const openApplicants = async (orderId: number) => {
    setActiveOrderId(orderId);
    setPaymentInfo(null);
    setError(null);
    try {
      await loadApplicants(orderId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载报名失败");
    }
  };

  /** 选中达人报名。 */
  const selectApplicant = async (appId: number) => {
    if (!activeOrderId) return;
    setError(null);
    try {
      await selectMatchingOrderApplicant(activeOrderId, appId);
      await Promise.all([loadAll(), loadApplicants(activeOrderId)]);
      setMsg("已选中达人");
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    }
  };

  /** 驳回达人报名。 */
  const rejectApplicant = async (appId: number) => {
    if (!activeOrderId) return;
    setError(null);
    try {
      await rejectMatchingOrderApplicant(activeOrderId, appId);
      await loadApplicants(activeOrderId);
      setMsg("已驳回报名");
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    }
  };

  /** 验收驳回并退回任务执行。 */
  const rejectOrder = async (orderId: number) => {
    setError(null);
    try {
      await rejectMatchingOrderAccept(orderId);
      setPaymentInfo(null);
      await loadAll();
      setMsg("已驳回，任务退回执行中");
    } catch (err) {
      setError(err instanceof Error ? err.message : "驳回失败");
    }
  };

  /** 验收通过并显示达人收款信息。 */
  const acceptOrder = async (orderId: number) => {
    setError(null);
    try {
      const ret = await acceptMatchingOrder(orderId);
      setPaymentInfo(ret?.payment_profile || null);
      await loadAll();
      setMsg("验收通过，已展示收款信息");
    } catch (err) {
      setError(err instanceof Error ? err.message : "验收失败");
    }
  };

  /** 当前激活订单。 */
  const activeOrder = useMemo(() => orders.find((o) => o.id === activeOrderId) || null, [orders, activeOrderId]);

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 10px 24px rgba(15,23,42,0.08)" }}>
      <h2 style={{ marginTop: 0 }}>我的撮合订单</h2>
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      {msg && <p style={{ color: "#166534" }}>{msg}</p>}
      <ul>
        {orders.map((it) => (
          <li key={it.id} style={{ marginBottom: 8 }}>
            {it.order_no}｜{it.title}｜金额 {it.task_amount}｜状态 {it.status}
            <button type="button" onClick={() => void openApplicants(it.id)} style={{ marginLeft: 8 }}>报名管理</button>
            {Array.isArray(it.work_links) && it.work_links.length > 0 && (
              <a href={String(it.work_links[0])} target="_blank" rel="noreferrer" style={{ marginLeft: 8 }}>查看回传短视频</a>
            )}
            {it.status === "completed" && (
              <>
                <button type="button" onClick={() => void acceptOrder(it.id)} style={{ marginLeft: 8 }}>验收通过</button>
                <button type="button" onClick={() => void rejectOrder(it.id)} style={{ marginLeft: 8 }}>验收驳回</button>
              </>
            )}
          </li>
        ))}
      </ul>

      {activeOrder && (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #e2e8f0", borderRadius: 10 }}>
          <h4 style={{ marginTop: 0 }}>报名达人 - {activeOrder.order_no}</h4>
          <ul>
            {applicants.map((a) => (
              <li key={a.id}>
                {a.username}｜状态 {a.status}
                {a.status === "pending" && (
                  <>
                    <button type="button" onClick={() => void selectApplicant(a.id)} style={{ marginLeft: 8 }}>选中</button>
                    <button type="button" onClick={() => void rejectApplicant(a.id)} style={{ marginLeft: 8 }}>驳回</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {paymentInfo && (
        <div style={{ marginTop: 16, padding: 12, border: "1px solid #d1fae5", borderRadius: 10, background: "#f0fdf4" }}>
          <h4 style={{ marginTop: 0 }}>达人收款信息（请商家线下转账）</h4>
          <p>姓名：{paymentInfo.real_name || "-"}</p>
          <p>银行：{paymentInfo.bank_name || "-"}</p>
          <p>银行卡号：{paymentInfo.bank_card || "-"}</p>
        </div>
      )}
    </div>
  );
}
