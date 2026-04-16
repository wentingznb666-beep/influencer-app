import { useMemo } from "react";

export type DateFilterMode = "all" | "day" | "range";

export type DateFilterState = {
  mode: DateFilterMode;
  day: string;
  startDate: string;
  endDate: string;
};

type OrderDateFilterProps = {
  value: DateFilterState;
  onChange: (next: DateFilterState) => void;
};

/**
 * 统一订单日期筛选组件：
 * - all：不过滤
 * - day：按某一天过滤（前后端会转为同一天区间）
 * - range：按起止日期区间过滤
 */
export default function OrderDateFilter({ value, onChange }: OrderDateFilterProps) {
  /**
   * 计算当前筛选提示文案，帮助用户确认筛选条件是否生效。
   */
  const summary = useMemo(() => {
    if (value.mode === "day") return value.day ? `已筛选：${value.day}` : "请选择日期";
    if (value.mode === "range") {
      if (value.startDate && value.endDate) return `已筛选：${value.startDate} ~ ${value.endDate}`;
      return "请选择起止日期";
    }
    return "不过滤日期";
  }, [value]);

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <select
        value={value.mode}
        onChange={(e) =>
          onChange({
            ...value,
            mode: e.target.value as DateFilterMode,
          })
        }
        style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #dbe1ea", background: "#fff", minWidth: 120 }}
      >
        <option value="all">全部日期</option>
        <option value="day">按某一天</option>
        <option value="range">按日期区间</option>
      </select>
      {value.mode === "day" && (
        <input
          type="date"
          value={value.day}
          onChange={(e) => onChange({ ...value, day: e.target.value })}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #dbe1ea", background: "#fff" }}
        />
      )}
      {value.mode === "range" && (
        <>
          <input
            type="date"
            value={value.startDate}
            onChange={(e) => onChange({ ...value, startDate: e.target.value })}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #dbe1ea", background: "#fff" }}
          />
          <span style={{ color: "#64748b" }}>至</span>
          <input
            type="date"
            value={value.endDate}
            onChange={(e) => onChange({ ...value, endDate: e.target.value })}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #dbe1ea", background: "#fff" }}
          />
        </>
      )}
      <span style={{ fontSize: 12, color: "#64748b" }}>{summary}</span>
    </div>
  );
}
