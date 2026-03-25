import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import * as api from "../adminApi";

type Material = { id: number; title: string; type: string; cloud_link: string; platforms: string | null; remark: string | null; status: string; created_at: string };
type FilterOption = { value: string; label: string };

type FilterDropdownProps = {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
};

/**
 * 自定义筛选下拉：支持展开/收起高度过渡与选项 hover 背景。
 */
function FilterDropdown({ label, value, options, onChange }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  /**
   * 点击外部时收起下拉面板，保证交互一致。
   */
  const handleDocumentPointerDown = (event: PointerEvent) => {
    const root = wrapRef.current;
    if (!root) return;
    if (!root.contains(event.target as Node)) setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    document.addEventListener("pointerdown", handleDocumentPointerDown, { passive: true });
    return () => document.removeEventListener("pointerdown", handleDocumentPointerDown);
  }, [open]);

  return (
    <div className="xt-dd" ref={wrapRef}>
      <button
        type="button"
        className="xt-dd-trigger"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="xt-dd-current">{options.find((o) => o.value === value)?.label ?? label}</span>
        <span className="xt-dd-caret" aria-hidden>{open ? "▲" : "▼"}</span>
      </button>
      <ul className={"xt-dd-panel" + (open ? " is-open" : "")} role="listbox" aria-label={label}>
        {options.map((option) => (
          <li
            key={option.value || "__all__"}
            className="xt-dd-option"
            role="option"
            aria-selected={value === option.value}
            onClick={() => {
              onChange(option.value);
              setOpen(false);
            }}
          >
            {option.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function MaterialsPage() {
  const [list, setList] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", type: "explain", cloud_link: "", platforms: "", remark: "" });
  const [animSeed, setAnimSeed] = useState(0);
  const [ripple, setRipple] = useState<{ rowId: number; x: number; y: number; key: number } | null>(null);
  const rippleTimerRef = useRef<number | null>(null);
  const statusFilterOptions: FilterOption[] = [
    { value: "", label: "全部状态" },
    { value: "online", label: "上架" },
    { value: "offline", label: "下架" },
  ];
  const typeFilterOptions: FilterOption[] = [
    { value: "", label: "全部类型" },
    { value: "face", label: "露脸" },
    { value: "explain", label: "讲解" },
  ];

  /**
   * 按筛选条件加载素材列表。
   */
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMaterials({ status: filterStatus || undefined, type: filterType || undefined });
      setList(data.list || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filterStatus, filterType]);

  /**
   * 列表刷新后重置动画种子，用于逐项淡入动画重新触发。
   */
  useEffect(() => {
    if (!loading) setAnimSeed((v) => v + 1);
  }, [loading, list.length]);

  /**
   * 提交新增素材表单并刷新列表。
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.cloud_link.trim()) return;
    setError(null);
    try {
      await api.createMaterial({
        title: form.title.trim(),
        type: form.type,
        cloud_link: form.cloud_link.trim(),
        platforms: form.platforms.trim() || undefined,
        remark: form.remark.trim() || undefined,
      });
      setForm({ title: "", type: "explain", cloud_link: "", platforms: "", remark: "" });
      setShowForm(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    }
  };

  /**
   * 切换素材上/下架状态。
   */
  const toggleStatus = async (id: number, current: string) => {
    try {
      await api.updateMaterial(id, { status: current === "online" ? "offline" : "online" });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新失败");
    }
  };

  /**
   * 行点击水波纹：按点击坐标绘制扩散动画。
   */
  const handleRowPointerDown = (id: number, event: ReactPointerEvent<HTMLTableRowElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (rippleTimerRef.current) window.clearTimeout(rippleTimerRef.current);
    const key = Date.now();
    setRipple({ rowId: id, x, y, key });
    rippleTimerRef.current = window.setTimeout(() => setRipple(null), 700);
  };

  return (
    <div className="xt-mp-root">
      <h2 className="xt-mp-title">素材管理</h2>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <div className="xt-actions-row">
        <FilterDropdown label="全部状态" value={filterStatus} options={statusFilterOptions} onChange={setFilterStatus} />
        <FilterDropdown label="全部类型" value={filterType} options={typeFilterOptions} onChange={setFilterType} />
        <button type="button" onClick={() => setShowForm(!showForm)} className="xt-accent-btn">
          {showForm ? "取消" : "新增素材"}
        </button>
      </div>
      <div className={"xt-collapse" + (showForm ? " is-open" : "")}>
        {showForm && (
        <form onSubmit={handleSubmit} className="xt-form">
          <div className="xt-field">
            <label className="xt-label">标题</label>
            <input className="xt-input" type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
          </div>
          <div className="xt-field">
            <label className="xt-label">类型</label>
            <select className="xt-select" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              <option value="face">露脸</option>
              <option value="explain">讲解</option>
            </select>
          </div>
          <div className="xt-field">
            <label className="xt-label">云盘链接</label>
            <input className="xt-input" type="url" value={form.cloud_link} onChange={(e) => setForm((f) => ({ ...f, cloud_link: e.target.value }))} required />
          </div>
          <div className="xt-field">
            <label className="xt-label">适合平台</label>
            <input className="xt-input" type="text" value={form.platforms} onChange={(e) => setForm((f) => ({ ...f, platforms: e.target.value }))} placeholder="抖音/小红书" />
          </div>
          <div className="xt-field">
            <label className="xt-label">备注</label>
            <input className="xt-input" type="text" value={form.remark} onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))} />
          </div>
          <button type="submit" className="xt-accent-btn">保存</button>
        </form>
      )}
      </div>
      {loading ? <p>加载中…</p> : (
        <div className="xt-card">
        <table className="xt-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>标题</th>
              <th>类型</th>
              <th>链接</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((m, idx) => (
              <tr
                key={`${animSeed}-${m.id}`}
                className="xt-row xt-item-anim"
                style={{ animationDelay: `${idx * 0.1}s` }}
                onPointerDown={(event) => handleRowPointerDown(m.id, event)}
              >
                {ripple?.rowId === m.id && (
                  <span
                    key={ripple.key}
                    className="xt-ripple"
                    style={{ ["--rx" as any]: ripple.x, ["--ry" as any]: ripple.y } as CSSProperties}
                  />
                )}
                <td>{m.id}</td>
                <td>{m.title}</td>
                <td>{m.type === "face" ? "露脸" : "讲解"}</td>
                <td className="xt-link-cell"><a className="xt-open-link" href={m.cloud_link} target="_blank" rel="noreferrer">打开</a></td>
                <td>{m.status === "online" ? "上架" : "下架"}</td>
                <td>
                  <button type="button" onClick={() => toggleStatus(m.id, m.status)} className="xt-inline-btn">{m.status === "online" ? "下架" : "上架"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
      {!loading && list.length === 0 && <p style={{ color: "#666" }}>暂无素材</p>}
    </div>
  );
}
