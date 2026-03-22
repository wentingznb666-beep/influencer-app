import { useEffect, useState, type FormEvent } from "react";
import * as api from "../adminApi";

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

/**
 * 管理员账号管理页：展示全量账号并可开通新账号。
 */
export default function UsersPage() {
  const [list, setList] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | UserRole>("");
  const [disabledFilter, setDisabledFilter] = useState<"" | "0" | "1">("");
  const [resetPassword, setResetPassword] = useState("");
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
      setList((data.list || []) as UserItem[]);
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
   * 重置指定账号密码，输入框留空时直接拦截。
   */
  const handleResetPassword = async (id: number) => {
    if (!resetPassword.trim()) {
      setError("请先在“重置密码输入框”填写新密码。");
      return;
    }
    setError(null);
    setActionLoadingId(id);
    try {
      await api.resetUserPassword(id, resetPassword.trim());
      setResetPassword("");
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

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>账号管理</h2>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      <div style={{ marginBottom: 12, padding: 12, background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 8 }}>
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
        <input
          type="password"
          placeholder="重置密码输入框"
          value={resetPassword}
          onChange={(e) => setResetPassword(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
        />
      </div>
      <form
        onSubmit={handleCreate}
        style={{ marginBottom: 20, padding: 16, background: "#fff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
          <input
            placeholder="用户名"
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            required
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
          />
          <input
            type="password"
            placeholder="密码"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            required
            style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd" }}
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
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {list.map((item) => (
                <tr key={item.id}>
                  <td style={{ padding: 10, borderBottom: "1px solid #f1f1f1" }}>{item.id}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f1f1f1" }}>{item.username}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f1f1f1" }}>{item.display_name || "—"}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f1f1f1" }}>{roleTextMap[item.role] ?? item.role}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f1f1f1", color: item.disabled ? "#c00" : "#0a7a2a" }}>{item.disabled ? "已禁用" : "启用中"}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f1f1f1" }}>{item.created_at}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #f1f1f1", whiteSpace: "nowrap" }}>
                    <button
                      type="button"
                      onClick={() => handleResetPassword(item.id)}
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
                      {item.disabled ? "启用" : "禁用"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
