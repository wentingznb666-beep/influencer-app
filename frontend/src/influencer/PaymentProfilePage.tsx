import { useEffect, useState, type FormEvent } from "react";
import {
  applyMatchingOrder,
  getInfluencerMatchingTaskHall,
  getInfluencerPaymentProfile,
  getMyMatchingApplies,
  saveInfluencerPaymentProfile,
  submitMatchingProof,
} from "../influencerApi";

/** 达人端收款资料与撮合任务大厅页面。 */
export default function PaymentProfilePage() {
  const [form, setForm] = useState({ real_name: "", bank_name: "", bank_branch: "", bank_card: "" });
  const [hall, setHall] = useState<any[]>([]);
  const [myApplies, setMyApplies] = useState<any[]>([]);
  const [proofMap, setProofMap] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState<string>("");

  /** 初始化读取收款资料、任务大厅、我的报名。 */
  const load = async () => {
    const [p, hallData, myData] = await Promise.all([
      getInfluencerPaymentProfile(),
      getInfluencerMatchingTaskHall(),
      getMyMatchingApplies(),
    ]);
    setForm({
      real_name: p?.profile?.real_name || "",
      bank_name: p?.profile?.bank_name || "",
      bank_branch: p?.profile?.bank_branch || "",
      bank_card: p?.profile?.bank_card || "",
    });
    setHall(Array.isArray(hallData?.list) ? hallData.list : []);
    setMyApplies(Array.isArray(myData?.list) ? myData.list : []);
  };

  useEffect(() => {
    load().catch((e) => setMsg(e instanceof Error ? e.message : "加载失败"));
  }, []);

  /** 保存收款信息。 */
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg("");
    try {
      await saveInfluencerPaymentProfile(form);
      setMsg("保存成功");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "保存失败");
    }
  };

  /** 报名任务大厅订单。 */
  const applyOrder = async (orderId: number) => {
    setMsg("");
    try {
      await applyMatchingOrder(orderId);
      await load();
      setMsg("报名成功");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "报名失败");
    }
  };

  /** 提交完成回传短视频。 */
  const submitProof = async (orderId: number) => {
    const videoUrl = (proofMap[orderId] || "").trim();
    if (!videoUrl) {
      setMsg("请先填写短视频链接");
      return;
    }
    setMsg("");
    try {
      await submitMatchingProof(orderId, videoUrl);
      await load();
      setMsg("回传成功，等待商家验收");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "提交失败");
    }
  };

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 10px 24px rgba(15,23,42,0.08)" }}>
      <h2 style={{ marginTop: 0 }}>收款信息与撮合大厅</h2>
      {msg && <p>{msg}</p>}
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 8, maxWidth: 460 }}>
        <input value={form.real_name} onChange={(e) => setForm((f) => ({ ...f, real_name: e.target.value }))} placeholder="姓名" />
        <input value={form.bank_name} onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))} placeholder="银行名称" />
        <input value={form.bank_branch} onChange={(e) => setForm((f) => ({ ...f, bank_branch: e.target.value }))} placeholder="支行" />
        <input value={form.bank_card} onChange={(e) => setForm((f) => ({ ...f, bank_card: e.target.value }))} placeholder="银行卡号" />
        <button type="submit">保存收款信息</button>
      </form>

      <h3>模式一任务大厅（免积分）</h3>
      <ul>
        {hall.map((it) => (
          <li key={it.id}>
            {it.order_no}｜{it.title}｜金额 {it.task_amount}
            <button type="button" onClick={() => applyOrder(it.id)} style={{ marginLeft: 8 }}>一键报名</button>
          </li>
        ))}
      </ul>

      <h3>我的报名</h3>
      <ul>
        {myApplies.map((it) => (
          <li key={it.id}>
            {it.order_no}｜{it.title}｜报名状态 {it.apply_status}｜订单状态 {it.order_status}
            {it.apply_status === "selected" && it.order_status === "claimed" && (
              <span style={{ marginLeft: 8 }}>
                <input
                  value={proofMap[it.order_id] || ""}
                  onChange={(e) => setProofMap((m) => ({ ...m, [it.order_id]: e.target.value }))}
                  placeholder="回传短视频链接"
                  style={{ marginRight: 6 }}
                />
                <button type="button" onClick={() => submitProof(it.order_id)}>提交完成凭证</button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
