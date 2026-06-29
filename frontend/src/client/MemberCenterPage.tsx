import { useTranslation } from 'react-i18next';
import { compactPx } from "../responsive";
﻿import { useEffect, useState } from "react";
import { getClientMemberProfile, purchaseClientMember, topupClientDeposit } from "../clientApi";

type ClientMemberProfile = {
  member_level?: number | null;
  member_expire_time?: string | null;
  deposit_amount?: number | string | null;
  deposit_frozen?: number | string | null;
};

type DepositLog = {
  id: number;
  created_at?: string | null;
  type?: string | null;
  change_amount?: number | string | null;
  note?: string | null;
};

/** 商家端会员中心：仅会员与保证金。 */
export default function MemberCenterPage() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<ClientMemberProfile | null>(null);
  const [logs, setLogs] = useState<DepositLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");

  /** 加载会员与保证金信息。 */
  const load = async () => {
    setError(null);
    try {
      const data = await getClientMemberProfile();
      setProfile(data?.profile || null);
      setLogs(Array.isArray(data?.logs) ? data.logs : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("加载失败"));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  /** 开通/续费会员。 */
  const buy = async (level: 1 | 2 | 3) => {
    setError(null);
    setMsg("");
    try {
      await purchaseClientMember(level, 1);
      await load();
      setMsg(t("会员开通成功"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("操作失败"));
    }
  };

  /** 充值保证金。 */
  const topup = async () => {
    setError(null);
    setMsg("");
    try {
      await topupClientDeposit(1000);
      await load();
      setMsg(t("保证金充值成功"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("充值失败"));
    }
  };

  return (
    <div className="xt-card" style={{ padding: compactPx(20) }}>
      <div className="xt-page-header">
        <h2 className="xt-page-title">会员中心 / Membership Center</h2>
      </div>
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      {msg && <p style={{ color: "#166534" }}>{msg}</p>}

      <div className="xt-form-grid" style={{ marginBottom: compactPx(16) }}>
        <div className="xt-form-grid__label">会员等级</div><div className="xt-form-grid__value">Member Level {profile?.member_level ?? 0}</div>
        <div className="xt-form-grid__label">到期时间</div><div className="xt-form-grid__value">{profile?.member_expire_time || "-"}</div>
        <div className="xt-form-grid__label">保证金余额</div><div className="xt-form-grid__value">{profile?.deposit_amount ?? 0} 积分</div>
        <div className="xt-form-grid__label">已冻结金额</div><div className="xt-form-grid__value">{profile?.deposit_frozen ?? 0} 积分</div>
      </div>

      <div className="xt-btn-group" style={{ marginTop: compactPx(16), marginBottom: compactPx(20) }}>
        <button type="button" className="xt-btn-outline" onClick={() => void buy(1)}>开通基础会员 / Basic</button>
        <button type="button" className="xt-btn-outline" onClick={() => void buy(2)}>开通高级会员 / Advanced</button>
        <button type="button" className="xt-btn-outline" onClick={() => void buy(3)}>开通旗舰会员 / Premium</button>
        <button type="button" className="xt-accent-btn" onClick={() => void topup()}>充值保证金 / Top up deposit +1000</button>
      </div>

      <h3 style={{ marginBottom: compactPx(8), marginTop: compactPx(8), fontSize: compactPx(16), fontWeight: 700, color: "var(--xt-primary)" }}>保证金流水 / Deposit Logs</h3>
      {logs.length === 0 ? <p>暂无记录 / No records</p> : null}
      {logs.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className="xt-table xt-table--striped" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", padding: compactPx(6) }}>时间</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", padding: compactPx(6) }}>类型</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", padding: compactPx(6) }}>金额</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", padding: compactPx(6) }}>备注</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((it) => (
                <tr key={it.id}>
                  <td style={{ borderBottom: "1px solid #f1f5f9", padding: compactPx(6) }}>{String(it.created_at || "")}</td>
                  <td style={{ borderBottom: "1px solid #f1f5f9", padding: compactPx(6) }}>{String(it.type || "-")}</td>
                  <td style={{ borderBottom: "1px solid #f1f5f9", padding: compactPx(6) }}>{String(it.change_amount ?? "-")}</td>
                  <td style={{ borderBottom: "1px solid #f1f5f9", padding: compactPx(6) }}>{String(it.note || "-")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
