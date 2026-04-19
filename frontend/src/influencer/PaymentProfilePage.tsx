import { useEffect, useState, type FormEvent } from "react";

import { getInfluencerPaymentProfile, saveInfluencerPaymentProfile } from "../influencerApi";



/** 达人端收款信息页面。 */

export default function PaymentProfilePage() {

  const [form, setForm] = useState({ real_name: "", bank_name: "", bank_card: "" });

  const [msg, setMsg] = useState<string>("");

  const [error, setError] = useState<string | null>(null);



  /** 初始化读取收款资料。 */

  const load = async () => {

    setError(null);

    try {

      const p = await getInfluencerPaymentProfile();

      setForm({

        real_name: p?.profile?.real_name || "",

        bank_name: p?.profile?.bank_name || "",

        bank_card: p?.profile?.bank_card || "",

      });

    } catch (e) {

      setError(e instanceof Error ? e.message : "加载失败");

    }

  };



  useEffect(() => {

    void load();

  }, []);



  /** 保存收款信息。 */

  const onSubmit = async (e: FormEvent) => {

    e.preventDefault();

    setMsg("");

    setError(null);

    try {

      await saveInfluencerPaymentProfile(form);

      setMsg("保存成功");

    } catch (err) {

      setError(err instanceof Error ? err.message : "保存失败");

    }

  };



  return (

    <div className="xt-inf-card" style={{ padding: 22, maxWidth: 520 }}>

      <h2 className="xt-inf-page-title">收款信息</h2>

      <p className="xt-inf-lead">用于撮合任务结算的收款账户，请与实名一致。</p>

      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

      {msg && <p style={{ color: "#166534" }}>{msg}</p>}

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 8 }}>

        <label style={{ fontWeight: 700, color: "var(--xt-primary)" }}>姓名</label>
        <input value={form.real_name} onChange={(e) => setForm((f) => ({ ...f, real_name: e.target.value }))} placeholder="姓名" required style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--xt-border)" }} />

        <label style={{ fontWeight: 700, color: "var(--xt-primary)" }}>银行名称</label>
        <input value={form.bank_name} onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))} placeholder="银行名称" required style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--xt-border)" }} />

        <label style={{ fontWeight: 700, color: "var(--xt-primary)" }}>银行卡号</label>
        <input value={form.bank_card} onChange={(e) => setForm((f) => ({ ...f, bank_card: e.target.value }))} placeholder="银行卡号" required style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--xt-border)" }} />

        <button type="submit" className="xt-accent-btn" style={{ marginTop: 4 }}>保存收款信息</button>

      </form>

    </div>

  );

}

