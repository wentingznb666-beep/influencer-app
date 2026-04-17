import { useEffect, useState } from "react";
import {
  createInfluencerDemand,
  getInfluencerDemandApplications,
  getInfluencerDemands,
  getInfluencerPermissionStatus,
  rejectInfluencerDemandApplication,
  selectInfluencerDemandApplication,
} from "../matchingApi";
import { formatDemandApplyStatus, formatDemandStatus, formatInfluencerPermissionStatus } from "../utils/matchingStatusText";

type PermissionStatus = "unapplied" | "pending" | "approved" | "rejected" | "disabled";

type DemandItem = {
  id: number;
  title?: string;
  demand_detail?: string;
  expected_points?: number | string;
  status: string;
  created_at?: string;
};

type DemandApplication = {
  id: number;
  status: string;
  client_username?: string;
  client_name?: string;
  note?: string;
  created_at?: string;
};

/**
 * 模式二需求发布页：仅审核通过后可发布，并可处理商家报名。
 */
export default function CollabDemandsPage() {
  const [status, setStatus] = useState<PermissionStatus>("unapplied");
  const [list, setList] = useState<DemandItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");
  const [form, setForm] = useState({ category: "", expected_commission: "", requirement: "" });
  const [expandedDemandId, setExpandedDemandId] = useState<number | null>(null);
  const [applicationsMap, setApplicationsMap] = useState<Record<number, DemandApplication[]>>({});
  const [loadingDemandId, setLoadingDemandId] = useState<number | null>(null);
  const [actioningAppId, setActioningAppId] = useState<number | null>(null);

  /**
   * 拉取权限与需求列表。
   */
  const load = async () => {
    setError(null);
    try {
      const [permissionRes, demandsRes] = await Promise.all([getInfluencerPermissionStatus(), getInfluencerDemands()]);
      setStatus(String(permissionRes.status || "unapplied") as PermissionStatus);
      setList((demandsRes.list || []) as DemandItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  /**
   * 发布合作需求。
   */
  const create = async () => {
    if (status !== "approved") return;
    setError(null);
    setMsg("");
    try {
      await createInfluencerDemand({
        title: form.category,
        demand_detail: form.requirement,
        expected_points: Number(form.expected_commission) || 1,
      });
      setForm({ category: "", expected_commission: "", requirement: "" });
      await load();
      setMsg("发布成功");
    } catch (e) {
      setError(e instanceof Error ? e.message : "发布失败");
    }
  };

  /**
   * 加载指定需求的商家报名列表。
   */
  const openApplications = async (demandId: number) => {
    setError(null);
    setMsg("");
    if (expandedDemandId === demandId) {
      setExpandedDemandId(null);
      return;
    }
    setExpandedDemandId(demandId);
    setLoadingDemandId(demandId);
    try {
      const ret = await getInfluencerDemandApplications(demandId);
      setApplicationsMap((prev) => ({
        ...prev,
        [demandId]: Array.isArray(ret?.list) ? (ret.list as DemandApplication[]) : [],
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载报名列表失败");
    } finally {
      setLoadingDemandId(null);
    }
  };

  /**
   * 审核商家报名：选中或驳回。
   */
  const reviewApplication = async (demandId: number, appId: number, action: "select" | "reject") => {
    setError(null);
    setMsg("");
    setActioningAppId(appId);
    try {
      if (action === "select") {
        await selectInfluencerDemandApplication(demandId, appId);
        setMsg("已选中商家");
      } else {
        await rejectInfluencerDemandApplication(demandId, appId);
        setMsg("已驳回商家");
      }
      const ret = await getInfluencerDemandApplications(demandId);
      setApplicationsMap((prev) => ({
        ...prev,
        [demandId]: Array.isArray(ret?.list) ? (ret.list as DemandApplication[]) : [],
      }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setActioningAppId(null);
    }
  };

  const disabledTip = status === "pending" ? "审核中，暂无法操作" : status === "rejected" ? "审核未通过，可重新申请" : status !== "approved" ? "去申请权限" : "";

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>发布合作需求</h2>
      <p style={{ color: "#64748b" }}>当前权限：{formatInfluencerPermissionStatus(status)}</p>
      {disabledTip ? <p style={{ color: "#b45309" }}>{disabledTip}</p> : null}
      {msg ? <p style={{ color: "#166534" }}>{msg}</p> : null}
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
        <input disabled={status !== "approved"} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="合作类目" />
        <input disabled={status !== "approved"} value={form.expected_commission} onChange={(e) => setForm((f) => ({ ...f, expected_commission: e.target.value }))} placeholder="期望佣金" />
        <textarea disabled={status !== "approved"} value={form.requirement} onChange={(e) => setForm((f) => ({ ...f, requirement: e.target.value }))} placeholder="合作要求" rows={4} />
      </div>
      <button type="button" disabled={status !== "approved"} onClick={() => void create()} style={{ marginTop: 10 }}>
        发布需求
      </button>

      <h3 style={{ marginTop: 20 }}>我的需求</h3>
      {list.map((d) => {
        const apps = applicationsMap[d.id] || [];
        const canReview = d.status === "open";
        const opened = expandedDemandId === d.id;
        return (
          <div key={d.id} style={{ padding: 10, border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 8 }}>
            <div>类目：{d.title || "-"}</div>
            <div>佣金：{d.expected_points ?? "-"}</div>
            <div>状态：{formatDemandStatus(d.status)}</div>
            <button type="button" onClick={() => void openApplications(d.id)} style={{ marginTop: 8 }}>
              {opened ? "收起商家报名" : "查看商家报名"}
            </button>

            {opened ? (
              <div style={{ marginTop: 10, padding: 10, borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc" }}>
                {loadingDemandId === d.id ? <p>加载中…</p> : null}
                {loadingDemandId !== d.id && apps.length === 0 ? <p>暂无商家报名</p> : null}
                {loadingDemandId !== d.id && apps.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {apps.map((a) => (
                      <li key={a.id} style={{ marginBottom: 8 }}>
                        商家：{a.client_name || a.client_username || "-"}｜状态：{formatDemandApplyStatus(a.status)}
                        {a.note ? `｜备注：${a.note}` : ""}
                        {canReview && a.status === "pending" ? (
                          <>
                            <button
                              type="button"
                              disabled={actioningAppId === a.id}
                              onClick={() => void reviewApplication(d.id, a.id, "select")}
                              style={{ marginLeft: 8 }}
                            >
                              选中商家
                            </button>
                            <button
                              type="button"
                              disabled={actioningAppId === a.id}
                              onClick={() => void reviewApplication(d.id, a.id, "reject")}
                              style={{ marginLeft: 8 }}
                            >
                              驳回商家
                            </button>
                          </>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
