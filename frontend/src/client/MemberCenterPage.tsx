import { useEffect, useState } from "react";
import { getClientMemberProfile, purchaseClientMember, topupClientDeposit } from "../clientApi";

/** 商家端会员中心：仅会员与保证金。 */
export default function MemberCenterPage() {
  const [profile, setProfile] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
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
      setError(e instanceof Error ? e.message : "加载失败");
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
      setMsg("会员开通成功");
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    }
  };

  /** 充值保证金。 */
  const topup = async () => {
    setError(null);
    setMsg("");
    try {
      await topupClientDeposit(1000);
      await load();
      setMsg("保证金充值成功");
    } catch (e) {
      setError(e instanceof Error ? e.message : "充值失败");
    }
  };

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 10px 24px rgba(15,23,42,0.08)" }}>
      <h2 style={{ marginTop: 0 }}>会员中心 / Membership Center</h2>
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      {msg && <p style={{ color: "#166534" }}>{msg}</p>}

      <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
        <div>会员等级 / Member Level：{profile?.member_level ?? 0}</div>
        <div>会员到期时间 / Expire Time：{profile?.member_expire_time || "-"}</div>
        <div>保证金余额 / Deposit Balance：{profile?.deposit_amount ?? 0}</div>
        <div>已冻结金额 / Frozen Amount：{profile?.deposit_frozen ?? 0}</div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <button type="button" onClick={() => void buy(1)}>开通基础会员 / Basic</button>
        <button type="button" onClick={() => void buy(2)}>开通高级会员 / Advanced</button>
        <button type="button" onClick={() => void buy(3)}>开通旗舰会员 / Premium</button>
        <button type="button" onClick={() => void topup()}>充值保证金 / Top up deposit +1000</button>
      </div>

      <h3 style={{ marginBottom: 8 }}>保证金流水 / Deposit Logs</h3>
      {logs.length === 0 ? <p>暂无记录 / No records</p> : null}
      {logs.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", padding: 6 }}>时间</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", padding: 6 }}>类型</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", padding: 6 }}>金额</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", padding: 6 }}>备注</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((it) => (
                <tr key={it.id}>
                  <td style={{ borderBottom: "1px solid #f1f5f9", padding: 6 }}>{String(it.created_at || "")}</td>
                  <td style={{ borderBottom: "1px solid #f1f5f9", padding: 6 }}>{String(it.type || "-")}</td>
                  <td style={{ borderBottom: "1px solid #f1f5f9", padding: 6 }}>{String(it.change_amount ?? "-")}</td>
                  <td style={{ borderBottom: "1px solid #f1f5f9", padding: 6 }}>{String(it.note || "-")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
