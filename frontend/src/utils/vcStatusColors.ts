export const VC_STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "#fef3c7", text: "#92400e", label: "待回应" },
  accepted: { bg: "#dbeafe", text: "#1d4ed8", label: "已接受" },
  rejected: { bg: "#fee2e2", text: "#b91c1c", label: "已拒绝" },
  submitted: { bg: "#dbeafe", text: "#1d4ed8", label: "已提交" },
  approved: { bg: "#dcfce7", text: "#166534", label: "已验收" },
  paid: { bg: "#dcfce7", text: "#166534", label: "已完成" },
  expired: { bg: "#f1f5f9", text: "#64748b", label: "已到期" },
  active: { bg: "#dcfce7", text: "#166534", label: "建联中" },
  completed: { bg: "#dcfce7", text: "#166534", label: "已完成" },
};

export function vcTagStyle(status?: string | null): React.CSSProperties {
  const c = VC_STATUS_COLORS[status || ""] || { bg: "#f1f5f9", text: "#475569" };
  return {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    background: c.bg,
    color: c.text,
    border: `1px solid ${c.text}22`,
  };
}

export function vcStatusLabel(status?: string | null): string {
  return VC_STATUS_COLORS[status || ""]?.label || status || "—";
}
