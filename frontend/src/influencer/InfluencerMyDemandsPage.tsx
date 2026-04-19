import { useEffect, useState } from "react";
import {
  getInfluencerDemandApplications,
  getInfluencerDemands,
  rejectInfluencerDemandApplication,
  selectInfluencerDemandApplication,
} from "../matchingApi";
import { formatDemandApplyStatus, formatDemandStatus } from "../utils/matchingStatusText";

type DemandItem = {
  id: number;
  title?: string;
  demand_detail?: string;
  expected_points?: number | string;
  status: string;
};

type DemandApplication = {
  id: number;
  status: string;
  client_username?: string;
  client_name?: string;
  note?: string;
};

/** 尝试解析需求详情 JSON。 */
function parseDemandDetail(raw: string | undefined): Record<string, any> {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

/** 达人端：我的需求独立模块。 */
export default function InfluencerMyDemandsPage() {
  const [list, setList] = useState<DemandItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");
  const [expandedDemandId, setExpandedDemandId] = useState<number | null>(null);
  const [applicationsMap, setApplicationsMap] = useState<Record<number, DemandApplication[]>>({});
  const [loadingDemandId, setLoadingDemandId] = useState<number | null>(null);
  const [actioningAppId, setActioningAppId] = useState<number | null>(null);

  /** 拉取我的需求列表。 */
  const load = async () => {
    setError(null);
    try {
      const demandsRes = await getInfluencerDemands();
      setList((demandsRes.list || []) as DemandItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  /** 加载指定需求的商家报名列表。 */
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

  /** 审核商家报名：选中或驳回。 */
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

  return (
    <div>
      <h2 className="xt-inf-page-title">我的需求</h2>
      <p className="xt-inf-lead">管理已发布的合作需求与商家报名，状态一目了然。</p>
      {msg ? <p style={{ color: "#166534" }}>{msg}</p> : null}
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

      {list.length === 0 ? (
        <div className="xt-inf-empty xt-inf-card">
          <div className="xt-inf-empty-icon" aria-hidden>
            📦
          </div>
          <div>暂无需求</div>
        </div>
      ) : null}
      {list.map((d) => {
        const detail = parseDemandDetail(d.demand_detail);
        const apps = applicationsMap[d.id] || [];
        const canReview = d.status === "open";
        const opened = expandedDemandId === d.id;
        return (
          <div key={d.id} className="xt-inf-card" style={{ padding: 14, marginBottom: 12 }}>
            <div>擅长领域：{d.title || "-"}</div>
            <div>粉丝量级：{detail.fans_level || "-"}</div>
            <div>任务类型：{Array.isArray(detail.task_types) ? detail.task_types.join("/") : "-"}</div>
            <div>单条报价：{d.expected_points ?? "-"}</div>
            <div>状态：{formatDemandStatus(d.status)}</div>
            <button type="button" className="xt-accent-btn" onClick={() => void openApplications(d.id)} style={{ marginTop: 8 }}>
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
                            <button type="button" disabled={actioningAppId === a.id} onClick={() => void reviewApplication(d.id, a.id, "select")} style={{ marginLeft: 8 }}>
                              选中商家
                            </button>
                            <button type="button" disabled={actioningAppId === a.id} onClick={() => void reviewApplication(d.id, a.id, "reject")} style={{ marginLeft: 8 }}>
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
