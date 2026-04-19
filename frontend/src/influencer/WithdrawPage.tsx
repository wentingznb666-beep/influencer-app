import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import * as api from "../influencerApi";
import { showToast } from "../utils/showToast";

const THAI_BANKS = [
  "Bangkok Bank",
  "Kasikornbank",
  "Krungthai Bank",
  "Siam Commercial Bank",
  "Bank of Ayudhya (Krungsri)",
  "TMBThanachart Bank",
  "Government Savings Bank",
  "BAAC",
  "CIMB Thai",
  "UOB Thailand",
];

type WithdrawalRow = {
  id: number;
  amount: number;
  bank_account_name: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  status: "pending" | "paid" | "rejected";
  note: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
};

/**
 * 达人端提现申请页（策略 A：申请不扣余额，管理员打款时扣）。
 */
export default function WithdrawPage() {
  const { t } = useTranslation();
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountNo, setBankAccountNo] = useState("");
  const [list, setList] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 加载余额与提现记录。
   */
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, w] = await Promise.all([api.getPoints(), api.getWithdrawals()]);
      setBalance(p.balance ?? 0);
      setList(w.list ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("加载失败"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  /**
   * 提交提现申请。
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const num = Number(amount);
    if (!Number.isInteger(num) || num < 1) {
      setError(t("请输入有效的提现金额（整数且大于 0）。"));
      return;
    }
    if (!bankAccountName.trim() || !bankName.trim() || !bankAccountNo.trim()) {
      setError(t("请完整填写收款姓名、银行名称和银行账号。"));
      return;
    }
    const acct = bankAccountNo.trim();
    if (acct.length < 6 || acct.length > 32) {
      setError(t("银行账号长度应在 6～32 位之间，请核对后重试。"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.createWithdrawal({
        amount: num,
        bank_account_name: bankAccountName.trim(),
        bank_name: bankName.trim(),
        bank_account_no: bankAccountNo.trim(),
      });
      setAmount("");
      setBankAccountName("");
      setBankName("");
      setBankAccountNo("");
      await load();
      showToast(t("提现申请已提交"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("提交失败"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>{t("申请提现")}</h2>
      <p style={{ fontSize: 14, color: "#666" }}>
        {t("当前余额：")}
        <b>{balance}</b>
        {t(" 积分（1 积分 = 1 泰铢，申请后会生成管理员处理订单）")}
      </p>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <form
        onSubmit={handleSubmit}
        style={{
          marginBottom: 20,
          padding: 16,
          background: "#fff",
          borderRadius: 8,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>{t("收款姓名")}</label>
        <input
          type="text"
          value={bankAccountName}
          onChange={(e) => setBankAccountName(e.target.value)}
          required
          style={{
            width: 280,
            maxWidth: "100%",
            padding: "8px 10px",
            boxSizing: "border-box",
            marginBottom: 12,
          }}
        />
        <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>{t("银行名称")}</label>
        <select
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          required
          style={{
            width: 280,
            maxWidth: "100%",
            padding: "8px 10px",
            boxSizing: "border-box",
            marginBottom: 12,
          }}
        >
          <option value="">{t("请选择银行")}</option>
          {THAI_BANKS.map((bank) => (
            <option key={bank} value={bank}>
              {bank}
            </option>
          ))}
        </select>
        <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>{t("银行账号")}</label>
        <input
          type="text"
          value={bankAccountNo}
          onChange={(e) => setBankAccountNo(e.target.value)}
          required
          style={{
            width: 280,
            maxWidth: "100%",
            padding: "8px 10px",
            boxSizing: "border-box",
            marginBottom: 12,
          }}
        />
        <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>{t("提现金额（积分）")}</label>
        <p
          style={{
            marginTop: 0,
            marginBottom: 10,
            color: "#666",
            fontSize: 13,
          }}
        >
          {t("预计到账（泰铢）：")}
          {Number(amount) > 0 ? Number(amount) : 0}
        </p>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            style={{ width: 160, padding: "8px 10px", boxSizing: "border-box" }}
          />
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: "8px 16px",
              background: "var(--xt-accent)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? t("提交中…") : t("提交申请")}
          </button>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            style={{
              padding: "8px 16px",
              border: "1px solid #ddd",
              borderRadius: 8,
              background: "#fff",
              cursor: "pointer",
            }}
          >
            {t("刷新")}
          </button>
        </div>
      </form>
      <h3 style={{ marginTop: 0 }}>{t("提现记录")}</h3>
      {loading ? (
        <p>{t("加载中…")}</p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            background: "#fff",
            borderRadius: 8,
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}
        >
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              <th style={{ padding: 10, textAlign: "left" }}>{t("申请时间")}</th>
              <th style={{ padding: 10, textAlign: "left" }}>{t("收款姓名")}</th>
              <th style={{ padding: 10, textAlign: "left" }}>{t("银行名称")}</th>
              <th style={{ padding: 10, textAlign: "left" }}>{t("银行账号")}</th>
              <th style={{ padding: 10, textAlign: "right" }}>{t("金额")}</th>
              <th style={{ padding: 10, textAlign: "left" }}>{t("状态")}</th>
              <th style={{ padding: 10, textAlign: "left" }}>{t("备注")}</th>
              <th style={{ padding: 10, textAlign: "left" }}>{t("打款时间")}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td style={{ padding: 10 }}>{r.created_at}</td>
                <td style={{ padding: 10 }}>{r.bank_account_name || "—"}</td>
                <td style={{ padding: 10 }}>{r.bank_name || "—"}</td>
                <td style={{ padding: 10 }}>{r.bank_account_no || "—"}</td>
                <td style={{ padding: 10, textAlign: "right" }}>{r.amount}</td>
                <td style={{ padding: 10 }}>
                  {r.status === "paid" ? t("已打款") : r.status === "rejected" ? t("已驳回") : t("待处理")}
                </td>
                <td style={{ padding: 10 }}>{r.note || "—"}</td>
                <td style={{ padding: 10 }}>{r.paid_at || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!loading && list.length === 0 && <p style={{ color: "#666" }}>{t("暂无提现记录")}</p>}
    </div>
  );
}
