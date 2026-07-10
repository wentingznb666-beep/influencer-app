import { useEffect, useState } from "react";
import { fetchWithAuth } from "../fetchWithAuth";

export default function PurchaseFinancePage() {
  // sub-tab
  const [tab, setTab] = useState<"rate" | "payments" | "report">("rate");

  // exchange rate
  const [rate, setRate] = useState("");
  const [rateLoading, setRateLoading] = useState(true);
  const [rateSaving, setRateSaving] = useState(false);

  // payments
  const [orderId, setOrderId] = useState("");
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [payForm, setPayForm] = useState<Record<string, any>>({ payment_method: "bank_transfer" });
  const [paySaving, setPaySaving] = useState(false);

  // report
  const [reportStart, setReportStart] = useState("");
  const [reportEnd, setReportEnd] = useState("");
  const [reportData, setReportData] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg }); setTimeout(() => setToast(null), 3000);
  };

  const basePath = window.location.pathname.includes("/employee/")
    ? "/employee/vertical-connections/purchase"
    : "/admin/vertical-connections/purchase";

  // load exchange rate on mount
  useEffect(() => {
    (async () => {
      try {
        const r = await fetchWithAuth("/api/admin/purchase/finance/exchange-rate");
        setRate(String((await r.json()).rate || "5.0"));
      } catch { setRate("5.0"); }
      finally { setRateLoading(false); }
    })();
  }, []);

  const saveRate = async () => {
    const n = parseFloat(rate);
    if (!n || n <= 0) { showToast("error", "请输入有效汇率"); return; }
    setRateSaving(true);
    try {
      await fetchWithAuth("/api/admin/purchase/finance/exchange-rate", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rate: n }),
      });
      showToast("success", `汇率已更新为 ${n}`);
    } catch (e: any) { showToast("error", e.message); }
    finally { setRateSaving(false); }
  };

  const loadPayments = async () => {
    if (!orderId) { showToast("error", "请输入订货单 ID"); return; }
    setPaymentsLoading(true);
    try {
      const r = await fetchWithAuth(`/api/admin/purchase/finance/orders/${orderId}/payments`);
      const d = await r.json();
      setPayments(d.list || []);
    } catch (e: any) { showToast("error", e.message); }
    finally { setPaymentsLoading(false); }
  };

  const recordPayment = async () => {
    if (!orderId || !payForm.amount_thb) { showToast("error", "请输入订货单ID和金额"); return; }
    setPaySaving(true);
    try {
      const body = {
        amount_thb: parseFloat(payForm.amount_thb),
        payment_method: payForm.payment_method || "bank_transfer",
        voucher_image: payForm.voucher_image || null,
        paid_at: payForm.paid_at || new Date().toISOString(),
        remark: payForm.remark || null,
      };
      const r = await fetchWithAuth(`/api/admin/purchase/finance/orders/${orderId}/payments`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const d = await r.json();
      showToast("success", `付款已记录，累计 ฿${d.total_paid} ${d.is_fully_paid ? "(已结清)" : ""}`);
      setPayForm({ payment_method: "bank_transfer" });
      loadPayments();
    } catch (e: any) { showToast("error", e.message); }
    finally { setPaySaving(false); }
  };

  const loadReport = async () => {
    setReportLoading(true);
    try {
      const params = new URLSearchParams();
      if (reportStart) params.set("start", reportStart);
      if (reportEnd) params.set("end", reportEnd);
      const r = await fetchWithAuth(`/api/admin/purchase/finance/summary?${params.toString()}`);
      setReportData(await r.json());
    } catch (e: any) { showToast("error", e.message); }
    finally { setReportLoading(false); }
  };

  const exportReport = () => {
    if (!reportData) return;
    const csv = [
      "指标,金额(THB)",
      `采购总额,${reportData.total_purchase}`,
      `已收款,${reportData.total_received}`,
      `待收款,${reportData.pending_receivable}`,
      `预估利润,${reportData.estimated_profit}`,
      `订单总数,${reportData.order_count}`,
      `已完成,${reportData.completed_count}`,
      `已取消,${reportData.cancelled_count}`,
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `finance-report-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  const inputStyle: React.CSSProperties = {
    padding: "8px 12px", border: "1px solid #dbe1ea", borderRadius: 8, fontSize: 14,
  };
  const btn: React.CSSProperties = {
    padding: "8px 20px", border: "none", borderRadius: 8, background: "var(--xt-accent, #f97316)",
    color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14,
  };
  const outlineBtn: React.CSSProperties = { ...btn, background: "#fff", color: "#334155", border: "1px solid #dbe1ea" };
  const card: React.CSSProperties = { background: "#f8fafc", borderRadius: 10, padding: 14, minWidth: 130 };

  return (
    <div>
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 2000,
          background: toast.type === "success" ? "#166534" : "#991b1b",
          color: "#fff", padding: "12px 20px", borderRadius: 10, fontWeight: 700, fontSize: 14,
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
          {toast.msg}
        </div>
      )}

      <h2 style={{ marginTop: 0, fontSize: 20, fontWeight: 800 }}>达人进货管理</h2>

      {/* Main Tab Nav */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "2px solid #e2e8f0", overflow: "auto" }}>
        {[
          { label: "进货需求", path: basePath },
          { label: "商品库", path: `${basePath}/products` },
          { label: "订货管理", path: `${basePath}/orders` },
          { label: "找货配置", path: `${basePath}/coze-config` },
          { label: "供应商", path: `${basePath}/suppliers` },
          { label: "财务管理", path: `${basePath}/finance` },
        ].map((t) => (
          <a key={t.path} href={t.path} style={{
            padding: "8px 14px", fontSize: 13, fontWeight: t.path.includes("/finance") ? 700 : 500,
            color: t.path.includes("/finance") ? "var(--xt-accent, #f97316)" : "#64748b",
            borderBottom: t.path.includes("/finance") ? "2px solid var(--xt-accent, #f97316)" : "2px solid transparent",
            marginBottom: -2, textDecoration: "none", cursor: "pointer", whiteSpace: "nowrap",
          }}>
            {t.label}
          </a>
        ))}
      </div>

      {/* Finance Sub-tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "1px solid #f1f5f9" }}>
        {[
          { key: "rate", label: "💱 汇率设置" },
          { key: "payments", label: "💳 付款记录" },
          { key: "report", label: "📊 对账报表" },
        ].map((t) => (
          <button key={t.key as string} onClick={() => setTab(t.key as any)} style={{
            padding: "8px 16px", border: "none", background: "transparent", cursor: "pointer",
            fontSize: 14, fontWeight: tab === t.key ? 700 : 400,
            color: tab === t.key ? "var(--xt-accent, #f97316)" : "#64748b",
            borderBottom: tab === t.key ? "2px solid var(--xt-accent, #f97316)" : "2px solid transparent",
            marginBottom: -1,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== Exchange Rate ===== */}
      {tab === "rate" && (
        <div style={{ maxWidth: 480 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>汇率设置</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 18, fontWeight: 700 }}>¥1 CNY = ฿</span>
              <input
                type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)}
                style={{ ...inputStyle, width: 120, fontSize: 18, fontWeight: 700, textAlign: "center" }}
                disabled={rateLoading}
              />
              <span style={{ fontSize: 18, fontWeight: 700 }}>THB</span>
            </div>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "8px 0 16px" }}>
              用于自动换算商品 CNY→THB 价格、对账报表统计
            </p>
            <button onClick={saveRate} disabled={rateSaving} style={btn}>
              {rateSaving ? "保存中..." : "💾 保存汇率"}
            </button>
          </div>
        </div>
      )}

      {/* ===== Payments ===== */}
      {tab === "payments" && (
        <div>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>付款记录</h3>

            {/* Query */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input type="number" placeholder="订货单 ID" value={orderId}
                onChange={(e) => setOrderId(e.target.value)} style={{ ...inputStyle, width: 140 }} />
              <button onClick={loadPayments} disabled={paymentsLoading} style={btn}>
                {paymentsLoading ? "查询中..." : "查询"}
              </button>
            </div>

            {/* Payment list */}
            {payments.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                  累计已付：฿{payments.reduce((s, p) => s + Number(p.amount_thb || 0), 0).toLocaleString()}
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: "6px 8px", borderBottom: "1px solid #e2e8f0", fontSize: 11, color: "#64748b" }}>#</th>
                      <th style={{ padding: "6px 8px", borderBottom: "1px solid #e2e8f0", fontSize: 11, color: "#64748b" }}>金额</th>
                      <th style={{ padding: "6px 8px", borderBottom: "1px solid #e2e8f0", fontSize: 11, color: "#64748b" }}>方式</th>
                      <th style={{ padding: "6px 8px", borderBottom: "1px solid #e2e8f0", fontSize: 11, color: "#64748b" }}>时间</th>
                      <th style={{ padding: "6px 8px", borderBottom: "1px solid #e2e8f0", fontSize: 11, color: "#64748b" }}>备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p, i) => (
                      <tr key={p.id}>
                        <td style={{ padding: "6px 8px" }}>{i + 1}</td>
                        <td style={{ padding: "6px 8px", fontWeight: 600 }}>฿{Number(p.amount_thb).toLocaleString()}</td>
                        <td style={{ padding: "6px 8px" }}>{p.payment_method === "promptpay" ? "PromptPay" : "银行转账"}</td>
                        <td style={{ padding: "6px 8px", fontSize: 11 }}>{p.paid_at ? new Date(p.paid_at).toLocaleString("zh-CN") : "—"}</td>
                        <td style={{ padding: "6px 8px", fontSize: 11 }}>{p.remark || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Record payment */}
            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 16 }}>
              <h4 style={{ margin: "0 0 12px", fontSize: 14 }}>录入付款</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block" }}>金额 THB *</label>
                  <input type="number" value={payForm.amount_thb || ""}
                    onChange={(e) => setPayForm((f) => ({ ...f, amount_thb: e.target.value }))}
                    style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block" }}>付款方式</label>
                  <select value={payForm.payment_method || "bank_transfer"}
                    onChange={(e) => setPayForm((f) => ({ ...f, payment_method: e.target.value }))}
                    style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}>
                    <option value="bank_transfer">银行转账</option>
                    <option value="promptpay">PromptPay</option>
                    <option value="other">其他</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: "#64748b", display: "block" }}>凭证图片链接</label>
                <input value={payForm.voucher_image || ""}
                  onChange={(e) => setPayForm((f) => ({ ...f, voucher_image: e.target.value }))}
                  style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} placeholder="https://..." />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: "#64748b", display: "block" }}>备注</label>
                <input value={payForm.remark || ""}
                  onChange={(e) => setPayForm((f) => ({ ...f, remark: e.target.value }))}
                  style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
              </div>
              <button onClick={recordPayment} disabled={paySaving || !orderId} style={btn}>
                {paySaving ? "录入中..." : "录入付款"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Report ===== */}
      {tab === "report" && (
        <div>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>对账报表</h3>

            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
              <input type="date" value={reportStart} onChange={(e) => setReportStart(e.target.value)} style={inputStyle} />
              <span style={{ color: "#94a3b8" }}>至</span>
              <input type="date" value={reportEnd} onChange={(e) => setReportEnd(e.target.value)} style={inputStyle} />
              <button onClick={loadReport} disabled={reportLoading} style={btn}>
                {reportLoading ? "统计中..." : "📊 生成报表"}
              </button>
              {reportData && (
                <button onClick={exportReport} style={outlineBtn}>📥 导出 CSV</button>
              )}
            </div>

            {reportData && (
              <>
                <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                  <div style={{ ...card, background: "#fff7ed" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#c2410c" }}>฿{reportData.total_purchase.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: "#c2410c" }}>采购总额</div>
                  </div>
                  <div style={{ ...card, background: "#f0fdf4" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#166534" }}>฿{reportData.total_received.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: "#166534" }}>已收款</div>
                  </div>
                  <div style={{ ...card, background: "#fef2f2" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#991b1b" }}>฿{reportData.pending_receivable.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: "#991b1b" }}>待收款</div>
                  </div>
                  <div style={{ ...card, background: "#eff6ff" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#1d4ed8" }}>฿{Math.round(reportData.estimated_profit).toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: "#1d4ed8" }}>预估利润</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#64748b" }}>
                  <span>订单总数：<strong>{reportData.order_count}</strong></span>
                  <span>已完成：<strong style={{ color: "#166534" }}>{reportData.completed_count}</strong></span>
                  <span>已取消：<strong style={{ color: "#991b1b" }}>{reportData.cancelled_count}</strong></span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
