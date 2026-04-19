import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import * as api from "../influencerApi";

type LedgerRow = { id: number; amount: number; type: string; ref_id: number | null; created_at: string };

/**
 * 根据流水类型返回展示用标签（中文键，供 t() 映射泰语）。
 */
function ledgerTypeLabel(type: string): string {
  if (type === "task_approval") return "任务通过";
  if (type === "admin_manual_recharge") return "管理员加分";
  if (type === "admin_manual_deduct") return "管理员扣分";
  return type;
}

/**
 * 积分与收益页：总积分、本周已获得与流水列表（字段以接口为准）。
 */
export default function PointsPage() {
  const { t } = useTranslation();
  const [balance, setBalance] = useState(0);
  const [weekPending, setWeekPending] = useState(0);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .getPoints()
      .then((data) => {
        setBalance(data.balance ?? 0);
        setWeekPending(data.weekPending ?? 0);
        setLedger(data.ledger ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : t("加载失败")))
      .finally(() => setLoading(false));
  }, [t]);

  return (
    <div>
      <h2 className="xt-inf-page-title">{t("积分与收益")}</h2>
      <p className="xt-inf-lead">{t("1 积分 = 1 泰铢，按周结算；流水为最近记录。")}</p>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      {loading ? (
        <p>{t("加载中…")}</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
            <div className="xt-inf-card" style={{ padding: 18, minWidth: 168, flex: "1 1 160px" }}>
              <div style={{ fontSize: 13, color: "var(--xt-text-muted)" }}>{t("总积分")}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "var(--xt-accent)", marginTop: 6 }}>{balance}</div>
            </div>
            <div className="xt-inf-card" style={{ padding: 18, minWidth: 168, flex: "1 1 160px" }}>
              <div style={{ fontSize: 13, color: "var(--xt-text-muted)" }}>{t("本周已获得")}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "var(--xt-primary)", marginTop: 6 }}>{weekPending}</div>
            </div>
          </div>
          <h3 style={{ fontSize: 16, marginBottom: 10 }}>{t("最近流水")}</h3>
          <div style={{ overflowX: "auto" }} className="xt-inf-card">
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ padding: 12, textAlign: "left", fontWeight: 700 }}>{t("时间")}</th>
                  <th style={{ padding: 12, textAlign: "left", fontWeight: 700 }}>{t("类型")}</th>
                  <th style={{ padding: 12, textAlign: "right", fontWeight: 700 }}>{t("积分")}</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((l) => (
                  <tr key={l.id} style={{ borderTop: "1px solid var(--xt-border)" }}>
                    <td style={{ padding: 12, color: "#475569" }}>{l.created_at}</td>
                    <td style={{ padding: 12 }}>{t(ledgerTypeLabel(l.type))}</td>
                    <td
                      style={{
                        padding: 12,
                        textAlign: "right",
                        fontWeight: 700,
                        color: l.amount >= 0 ? "#15803d" : "#b91c1c",
                      }}
                    >
                      {l.amount > 0 ? "+" : ""}
                      {l.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ledger.length === 0 && (
              <div className="xt-inf-empty">
                <div className="xt-inf-empty-icon" aria-hidden>
                  📭
                </div>
                <div>{t("暂无流水")}</div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
