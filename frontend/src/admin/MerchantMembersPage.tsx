import { useTranslation } from 'react-i18next';
import { compactPx } from "../responsive";
﻿import { useEffect, useState } from "react";
import { getAdminMerchantMembers } from "../adminApi";
import { formatDepositStatus, formatMemberLevel } from "../utils/matchingStatusText";

type MerchantMember = {
  client_id: number;
  username?: string | null;
  member_level?: number | null;
  member_expire_time?: string | null;
  deposit_amount?: number | string | null;
  deposit_frozen?: number | string | null;
  deposit_status?: string | null;
};

/** 管理端商家会员与保证金总览。 */
export default function MerchantMembersPage() {
  const { t } = useTranslation();
  const [list, setList] = useState<MerchantMember[]>([]);
  const [error, setError] = useState<string>("");

  /** 加载商家会员数据。 */
  const load = async () => {
    const data = await getAdminMerchantMembers();
    setList(Array.isArray(data?.list) ? data.list : []);
  };

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : t("加载失败")));
  }, []);

  return (
    <div style={{ background: "#fff", borderRadius: compactPx(16), padding: compactPx(20), boxShadow: "0 10px 24px rgba(15,23,42,0.08)" }}>
      <h2 style={{ marginTop: 0 }}>商家会员与保证金</h2>
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><th>商家</th><th>会员等级</th><th>到期时间</th><th>保证金</th><th>冻结</th><th>状态</th></tr></thead>
        <tbody>
          {list.map((it) => (
            <tr key={it.client_id}>
              <td>{it.username}</td><td>{formatMemberLevel(it.member_level)}</td><td>{it.member_expire_time || "-"}</td><td>{it.deposit_amount ?? 0}</td><td>{it.deposit_frozen ?? 0}</td><td>{formatDepositStatus(it.deposit_status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
