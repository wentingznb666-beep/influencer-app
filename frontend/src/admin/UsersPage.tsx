import { useEffect, useState, type FormEvent } from "react";
import * as api from "../adminApi";
import { getStoredUser } from "../authApi";
import { normalizeAccountText } from "../utils/accountText";

type UserRole = "admin" | "employee" | "influencer" | "client";

type UserItem = {
  id: number;
  username: string;
  display_name: string | null;
  role: UserRole;
  disabled: number;
  created_at: string;
};

const roleTextMap: Record<UserRole, string> = {
  admin: "管理员",
  employee: "员工",
  influencer: "达人",
  client: "商家",
};

type PasswordFieldProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  /** 是否明文展示 */
  visible: boolean;
  /** 切换明文/密文 */
  onToggleVisible: () => void;
};

/**
 * 密码输入 + 显示/隐藏开关，与系统内按钮样式统一。
 */
function PasswordFieldWithToggle({ value, onChange, placeholder, required, visible, onToggleVisible }: PasswordFieldProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, width: "100%" }}>
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete="new-password"
        style={{ flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
      />
      <button
        type="button"
        onClick={onToggleVisible}
        style={{
          flexShrink: 0,
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid #dbe1ea",
          background: "#fff",
          cursor: "pointer",
          fontSize: 13,
          color: "var(--xt-text)",
        }}
      >
        {visible ? "隐藏" : "显示"}
      </button>
    </div>
  );
}

/**
 * 管理员账号管理页：展示全量账号并可开通新账号。
 */
export default function UsersPage() {
  const user = getStoredUser();
  const isEmployee = user?.role === "employee";
  const [list, setList] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | UserRole>("");
  const [disabledFilter, setDisabledFilter] = useState<"" | "0" | "1">("");
  const [onlyPendingInfluencer, setOnlyPendingInfluencer] = useState(false);
  /** 开通账号表单：密码是否明文 */
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  /** 重置密码弹窗：目标账号与输入 */
  const [resetModal, setResetModal] = useState<{ id: number; username: string } | null>(null);
  const [resetModalPassword, setResetModalPassword] = useState("");
  const [showResetModalPassword, setShowResetModalPassword] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    username: "",
    password: "",
    role: "employee" as UserRole,
    display_name: "",
  });

  /**
   * 拉取账号列表，包含管理员/员工/达人/商家。
   */
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getUsers({ keyword: keyword.trim(), role: roleFilter, disabled: disabledFilter });
      setList(((data.list || []) as UserItem[]).map((item) => ({ ...item, username: normalizeAccountText(item.username), display_name: item.display_name ? normalizeAccountText(item.display_name) : item.display_name })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [keyword, roleFilter, disabledFilter]);

  /**
   * 提交管理员开通账号请求，成功后刷新列表。
   */
  const handleCreate = async (e: FormEvent) => {
    if (isEmployee) {
      setError("员工无创建账号权限。");
      return;
    }
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await api.createUserByAdmin({
        username: form.username.trim(),
        password: form.password,
        role: form.role,
        display_name: form.display_name.trim() || undefined,
      });
      setForm({ username: "", password: "", role: "employee", display_name: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setCreating(false);
    }
  };

  /**
   * 打开重置密码弹窗（管理员输入新密码后提交）。
   */
  const openResetPasswordModal = (item: UserItem) => {
    if (isEmployee) {
      setError("员工无账号编辑权限。");
      return;
    }
    setError(null);
    setSuccessMsg(null);
    setResetModalPassword("");
    setShowResetModalPassword(false);
    setResetModal({ id: item.id, username: item.username });
  };

  /**
   * 关闭重置密码弹窗并清空临时输入。
   */
  const closeResetPasswordModal = () => {
    setResetModal(null);
    setResetModalPassword("");
    setShowResetModalPassword(false);
  };

  /**
   * 确认将弹窗内新密码写入后端（与 PATCH /api/admin/users/:id/password 一致）。
   */
  const confirmResetPassword = async () => {
    if (!resetModal) return;
    const pwd = resetModalPassword.trim();
    if (pwd.length < 6) {
      setError("新密码至少 6 位。");
      return;
    }
    setError(null);
    setActionLoadingId(resetModal.id);
    try {
      await api.resetUserPassword(resetModal.id, pwd);
      closeResetPasswordModal();
      setSuccessMsg("密码已重置。");
      window.setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "重置密码失败");
    } finally {
      setActionLoadingId(null);
    }
  };

  /**
   * 切换账号禁用状态（禁用/启用）。
   */
  const handleToggleDisabled = async (item: UserItem) => {
    if (isEmployee) {
      setError("员工无账号编辑权限。");
      return;
    }
    setError(null);
    setActionLoadingId(item.id);
    try {
      await api.updateUserStatus(item.id, item.disabled !== 1);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新状态失败");
    } finally {
      setActionLoadingId(null);
    }
  };

  /**
   * 计算页面最终展示列表：
   * - 默认展示后端返回结果；
   * - 开启“待审核达人”开关后，仅显示达人且禁用态账号（即待管理员同意）。
   */
  const displayList = onlyPendingInfluencer
    ? list.filter((item) => item.role === "influencer" && item.disabled === 1)
    : list;
  const pendingInfluencerCount = list.filter((item) => item.role === "influencer" && item.disabled === 1).length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <h2 style={{ marginTop: 0, marginBottom: 0 }}>账号管理</h2>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "2px 10px",
            borderRadius: 999,
            background: pendingInfluencerCount > 0 ? "rgba(255, 152, 0, 0.15)" : "var(--xt-nav-active-bg)",
            color: pendingInfluencerCount > 0 ? "#b45309" : "var(--xt-text-muted)",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          待审核达人：{pendingInfluencerCount}
        </span>
      </div>
      {!isEmployee && (
        <p style={{ fontSize: 14, color: "#64748b", marginTop: 4, marginBottom: 8 }}>
          达人/商家（含商家）的积分加分与扣分请在侧边栏「积分与结算」中操作；扣分现已支持商家账号。
        </p>
      )}
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      {successMsg && <p style={{ color: "#0a7a2a" }}>{successMsg}</p>}
      <div style={{ marginBottom: 12, padding: 12, background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
        <input
          placeholder="搜索用户名/显示名"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
        />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as "" | UserRole)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", background: "#fff" }}>
          <option value="">全部角色</option>
          <option value="admin">管理员</option>
          <option value="employee">员工</option>
          <option value="influencer">达人</option>
          <option value="client">商家</option>
        </select>
        <select value={disabledFilter} onChange={(e) => setDisabledFilter(e.target.value as "" | "0" | "1")} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", background: "#fff" }}>
          <option value="">全部状态</option>
          <option value="0">启用中</option>
          <option value="1">已禁用</option>
        </select>
        <label
          style={{
            gridColumn: "1 / -1",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            color: "var(--xt-text)",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={onlyPendingInfluencer}
            onChange={(e) => setOnlyPendingInfluencer(e.target.checked)}
          />
          仅看待审核达人（注册后待管理员同意）
        </label>
      </div>
      {!isEmployee && (
        <form
          onSubmit={handleCreate}
          style={{ marginBottom: 20, padding: 16, background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, alignItems: "stretch" }}>
            <input
              placeholder="用户名"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              required
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
            />
            <PasswordFieldWithToggle
              value={form.password}
              onChange={(v) => setForm((f) => ({ ...f, password: v }))}
              placeholder="密码"
              required
              visible={showCreatePassword}
              onToggleVisible={() => setShowCreatePassword((s) => !s)}
            />
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", background: "#fff" }}
            >
              <option value="employee">员工</option>
              <option value="admin">管理员</option>
              <option value="influencer">达人</option>
              <option value="client">商家</option>
            </select>
            <input
              placeholder="显示名（可选）"
              value={form.display_name}
              onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            style={{ marginTop: 10, padding: "8px 16px", background: "var(--xt-accent)", color: "#fff", border: "none", borderRadius: 8, cursor: creating ? "not-allowed" : "pointer" }}
          >
            {creating ? "开通中…" : "开通账号"}
          </button>
        </form>
      )}
      {loading ? (
        <p>加载中…</p>
      ) : (
        <div style={{ overflowX: "auto", background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>ID</th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>用户名</th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>显示名</th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>账号类型</th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>状态</th>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>创建时间</th>
                {!isEmployee && <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>操作</th>}
              </tr>
            </thead>
            <tbody>
              {displayList.map((item) => (
                <tr key={item.id}>
                  <td style={{ padding: 10, borderBottom: "1px solid #f1f1f1" }}>{item.id}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f1f1f1" }}><span data-no-auto-translate>{item.username}</span></td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f1f1f1" }}>{item.display_name || "—"}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f1f1f1" }}>{roleTextMap[item.role] ?? item.role}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f1f1f1", color: item.disabled ? "#c00" : "#0a7a2a" }}>
                    {item.role === "influencer" && item.disabled === 1 ? "待审核" : item.disabled ? "已禁用" : "启用中"}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f1f1f1" }}>{item.created_at}</td>
                  {!isEmployee && (
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f1f1", whiteSpace: "nowrap" }}>
                      <button
                        type="button"
                        onClick={() => openResetPasswordModal(item)}
                        disabled={actionLoadingId === item.id}
                        style={{ marginRight: 8, padding: "6px 10px", borderRadius: 6, border: "1px solid #ddd", background: "#fff", cursor: actionLoadingId === item.id ? "not-allowed" : "pointer" }}
                      >
                        重置密码
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleDisabled(item)}
                        disabled={actionLoadingId === item.id}
                        style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #ddd", background: "#fff", cursor: actionLoadingId === item.id ? "not-allowed" : "pointer" }}
                      >
                        {item.role === "influencer" && item.disabled === 1 ? "同意注册" : item.disabled ? "启用" : "禁用"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {!displayList.length && (
                <tr>
                  <td colSpan={isEmployee ? 6 : 7} style={{ padding: 14, color: "var(--xt-text-muted)" }}>
                    暂无符合条件的账号
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {resetModal && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
          onClick={closeResetPasswordModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-pwd-title"
            style={{
              width: "100%",
              maxWidth: 400,
              background: "#fff",
              borderRadius: 8,
              boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
              padding: 20,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="reset-pwd-title" style={{ marginTop: 0, marginBottom: 8 }}>
              重置密码
            </h3>
            <p style={{ margin: "0 0 12px", fontSize: 14, color: "#64748b" }}>
              账号：<strong data-no-auto-translate>{resetModal.username}</strong>
            </p>
            <label style={{ display: "block", marginBottom: 6, fontSize: 14, fontWeight: 600 }}>新密码</label>
            <PasswordFieldWithToggle
              value={resetModalPassword}
              onChange={setResetModalPassword}
              placeholder="至少 6 位"
              visible={showResetModalPassword}
              onToggleVisible={() => setShowResetModalPassword((s) => !s)}
            />
            <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={closeResetPasswordModal}
                disabled={actionLoadingId === resetModal.id}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #dbe1ea", background: "#fff", cursor: actionLoadingId === resetModal.id ? "not-allowed" : "pointer" }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void confirmResetPassword()}
                disabled={actionLoadingId === resetModal.id}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: "var(--xt-accent)",
                  color: "#fff",
                  cursor: actionLoadingId === resetModal.id ? "not-allowed" : "pointer",
                }}
              >
                {actionLoadingId === resetModal.id ? "提交中…" : "确定"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
