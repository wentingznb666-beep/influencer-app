import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  acceptMatchingOrder,
  createMatchingOrder,
  getClientMemberProfile,
  getMatchingOrderApplicants,
  getMatchingOrders,
  purchaseClientMember,
  rejectMatchingOrderApplicant,
  selectMatchingOrderApplicant,
  topupClientDeposit,
} from "../clientApi";

/** 商家端撮合中心：会员、保证金、报名管理、验收后收款信息展示。 */
export default function MatchingCenterPage() {
  const [profile, setProfile] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [form, setForm] = useState({ title: "", task_amount: "", requirement: "", allow_apply: true });

  /** 加载商家会员与撮合订单数据。 */
  const loadAll = async () => {
    const [p, o] = await Promise.all([getClientMemberProfile(), getMatchingOrders()]);
    setProfile(p?.profile || null);
    setOrders(Array.isArray(o?.list) ? o.list : []);
  };

  /** 加载某个订单的报名达人列表。 */
  const loadApplicants = async (orderId: number) => {
    const data = await getMatchingOrderApplicants(orderId);
    setApplicants(Array.isArray(data?.list) ? data.list : []);
  };

  useEffect(() => {
    loadAll().catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  const activeOrder = useMemo(() => orders.find((o) => o.id === activeOrderId) || null, [orders, activeOrderId]);

  /** 处理创建免积分撮合订单。 */
  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMsg("");
    try {
      await createMatchingOrder({
        title: form.title,
        task_amount: Number(form.task_amount),
        requirement: form.requirement,
        allow_apply: form.allow_apply,
      });
      setForm({ title: "", task_amount: "", requirement: "", allow_apply: true });
      await loadAll();
      setMsg("发布成功");
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    }
  };

  /** 购买会员。 */
  const buy = async (level: 1 | 2 | 3) => {
    setError(null);
    setMsg("");
    try {
      await purchaseClientMember(level, 1);
      await loadAll();
      setMsg("会员开通成功");
    } catch (err) {
      setError(err instanceof Error ? err.message : "购买失败");
    }
  };

  /** 充值保证金。 */
  const topup = async () => {
    setError(null);
    setMsg("");
    try {
      await topupClientDeposit(1000);
      await loadAll();
      setMsg("保证金充值成功");
    } catch (err) {
      setError(err instanceof Error ? err.message : "充值失败");
    }
  };

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

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 10px 24px rgba(15,23,42,0.08)" }}>
      <h2 style={{ marginTop: 0 }}>撮合中心（免积分）</h2>
            {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      {msg && <p style={{ color: "#166534" }}>{msg}</p>}
      <p>会员等级：{profile?.member_level ?? 0} ｜ 到期：{profile?.member_expire_time || "-"}</p>
      <p>保证金：{profile?.deposit_amount ?? 0} ｜ 已冻结：{profile?.deposit_frozen ?? 0}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button type="button" onClick={() => buy(1)}>开通基础会员</button>
        <button type="button" onClick={() => buy(2)}>开通高级会员</button>
        <button type="button" onClick={() => buy(3)}>开通旗舰会员</button>
        <button type="button" onClick={topup}>充值保证金 +1000</button>
      </div>

      <form onSubmit={onCreate} style={{ display: "grid", gap: 8, marginBottom: 16 }}>
        <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="任务标题" />
        <input value={form.task_amount} onChange={(e) => setForm((f) => ({ ...f, task_amount: e.target.value }))} placeholder="任务金额" />
        <input value={form.requirement} onChange={(e) => setForm((f) => ({ ...f, requirement: e.target.value }))} placeholder="合作要求" />
        <label>
          <input type="checkbox" checked={form.allow_apply} onChange={(e) => setForm((f) => ({ ...f, allow_apply: e.target.checked }))} /> 允许任务大厅报名
        </label>
        <button type="submit">发布撮合免积分订单</button>
      </form>

      <h3>我的撮合订单</h3>
      <ul>
        {orders.map((it) => (
          <li key={it.id}>
            {it.order_no}｜{it.title}｜金额 {it.task_amount}｜状态 {it.status}
            <button type="button" onClick={() => openApplicants(it.id)} style={{ marginLeft: 8 }}>报名管理</button>
            {it.status === "completed" && <button type="button" onClick={() => acceptOrder(it.id)} style={{ marginLeft: 8 }}>验收通过</button>}
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
                    <button type="button" onClick={() => selectApplicant(a.id)} style={{ marginLeft: 8 }}>选中</button>
                    <button type="button" onClick={() => rejectApplicant(a.id)} style={{ marginLeft: 8 }}>驳回</button>
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
          <p>支行：{paymentInfo.bank_branch || "-"}</p>
          <p>银行卡号：{paymentInfo.bank_card || "-"}</p>
        </div>
      )}
    </div>
  );
}

