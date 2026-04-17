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
};

type DemandApplication = {
  id: number;
  status: string;
  client_username?: string;
  client_name?: string;
  note?: string;
};

type DemandFormState = {
  specialty: string;
  fans_level: string;
  task_types: string[];
  categories_can_do: string;
  categories_not_do: string;
  need_sample: "是" | "否";
  unit_price: string;
  delivery_days: string;
  revise_times: string;
  intro: string;
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

/** 达人发布合作需求页。 */
export default function CollabDemandsPage() {
  const [status, setStatus] = useState<PermissionStatus>("unapplied");
  const [list, setList] = useState<DemandItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");
  const [form, setForm] = useState<DemandFormState>({
    specialty: "",
    fans_level: "1万以内",
    task_types: ["短视频"],
    categories_can_do: "",
    categories_not_do: "",
    need_sample: "是",
    unit_price: "",
    delivery_days: "3",
    revise_times: "2",
    intro: "",
  });
  const [expandedDemandId, setExpandedDemandId] = useState<number | null>(null);
  const [applicationsMap, setApplicationsMap] = useState<Record<number, DemandApplication[]>>({});
  const [loadingDemandId, setLoadingDemandId] = useState<number | null>(null);
  const [actioningAppId, setActioningAppId] = useState<number | null>(null);

  /** 拉取权限与需求列表。 */
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

  /** 可接任务类型多选切换。 */
  const toggleTaskType = (value: string) => {
    setForm((prev) => {
      const set = new Set(prev.task_types);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      return { ...prev, task_types: Array.from(set) };
    });
  };

  /** 发布合作需求。 */
  const create = async () => {
    if (status !== "approved") return;
    setError(null);
    setMsg("");
    try {
      await createInfluencerDemand({
        specialty: form.specialty,
        fans_level: form.fans_level,
        task_types: form.task_types,
        categories_can_do: form.categories_can_do,
        categories_not_do: form.categories_not_do,
        need_sample: form.need_sample,
        unit_price: Number(form.unit_price),
        delivery_days: Number(form.delivery_days),
        revise_times: Number(form.revise_times),
        intro: form.intro,
      });
      setForm({
        specialty: "",
        fans_level: "1万以内",
        task_types: ["短视频"],
        categories_can_do: "",
        categories_not_do: "",
        need_sample: "是",
        unit_price: "",
        delivery_days: "3",
        revise_times: "2",
        intro: "",
      });
      await load();
      setMsg("发布成功");
    } catch (e) {
      setError(e instanceof Error ? e.message : "发布失败");
    }
  };

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

  const disabledTip = status === "pending" ? "审核中，暂无法操作" : status === "rejected" ? "审核未通过，可重新申请" : status !== "approved" ? "需审核通过后使用" : "";

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>发布合作需求</h2>
      <p style={{ color: "#64748b" }}>当前权限：{formatInfluencerPermissionStatus(status)}</p>
      {disabledTip ? <p style={{ color: "#b45309" }}>{disabledTip}</p> : null}
      {msg ? <p style={{ color: "#166534" }}>{msg}</p> : null}
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

      <div style={{ display: "grid", gap: 8, maxWidth: 620 }}>
        <label htmlFor="specialty">擅长领域 <span style={{ color: "#dc2626" }}>*</span></label>
        <select id="specialty" disabled={status !== "approved"} value={form.specialty} onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}>
          <option value="">请选择</option>
          <option value="美妆">美妆</option><option value="服饰">服饰</option><option value="美食">美食</option><option value="家居">家居</option><option value="3C">3C</option><option value="母婴">母婴</option><option value="其他">其他</option>
        </select>

        <label htmlFor="fans_level">粉丝量级 <span style={{ color: "#dc2626" }}>*</span></label>
        <select id="fans_level" disabled={status !== "approved"} value={form.fans_level} onChange={(e) => setForm((f) => ({ ...f, fans_level: e.target.value }))}>
          <option>1万以内</option><option>1万-5万</option><option>5万-10万</option><option>10万-50万</option><option>50万以上</option>
        </select>

        <div>
          <span>可接任务类型 <span style={{ color: "#dc2626" }}>*</span>：</span>
          {['短视频', '图文', '直播', '探店'].map((v) => (
            <label key={v} style={{ marginLeft: 8 }}>
              <input type="checkbox" disabled={status !== "approved"} checked={form.task_types.includes(v)} onChange={() => toggleTaskType(v)} /> {v}
            </label>
          ))}
        </div>

        <label htmlFor="categories_can_do">可接产品品类 <span style={{ color: "#dc2626" }}>*</span></label>
        <input id="categories_can_do" disabled={status !== "approved"} value={form.categories_can_do} onChange={(e) => setForm((f) => ({ ...f, categories_can_do: e.target.value }))} />

        <label htmlFor="categories_not_do">不接品类 <span style={{ color: "#dc2626" }}>*</span></label>
        <input id="categories_not_do" disabled={status !== "approved"} value={form.categories_not_do} onChange={(e) => setForm((f) => ({ ...f, categories_not_do: e.target.value }))} />

        <label htmlFor="need_sample">是否需要样品 <span style={{ color: "#dc2626" }}>*</span></label>
        <select id="need_sample" disabled={status !== "approved"} value={form.need_sample} onChange={(e) => setForm((f) => ({ ...f, need_sample: e.target.value as "是" | "否" }))}>
          <option value="是">是</option><option value="否">否</option>
        </select>

        <label htmlFor="unit_price">单条报价 <span style={{ color: "#dc2626" }}>*</span></label>
        <input id="unit_price" type="number" min={1} disabled={status !== "approved"} value={form.unit_price} onChange={(e) => setForm((f) => ({ ...f, unit_price: e.target.value }))} />

        <label htmlFor="delivery_days">出稿时效（天） <span style={{ color: "#dc2626" }}>*</span></label>
        <input id="delivery_days" type="number" min={1} disabled={status !== "approved"} value={form.delivery_days} onChange={(e) => setForm((f) => ({ ...f, delivery_days: e.target.value }))} />

        <label htmlFor="revise_times">可修改次数 <span style={{ color: "#dc2626" }}>*</span></label>
        <input id="revise_times" type="number" min={0} disabled={status !== "approved"} value={form.revise_times} onChange={(e) => setForm((f) => ({ ...f, revise_times: e.target.value }))} />

        <label htmlFor="intro">自我介绍/个人优势 <span style={{ color: "#dc2626" }}>*</span></label>
        <textarea id="intro" rows={4} disabled={status !== "approved"} value={form.intro} onChange={(e) => setForm((f) => ({ ...f, intro: e.target.value }))} />
      </div>
      <button type="button" disabled={status !== "approved"} onClick={() => void create()} style={{ marginTop: 10 }}>
        发布需求
      </button>

      <h3 style={{ marginTop: 20 }}>我的需求</h3>
      {list.map((d) => {
        const detail = parseDemandDetail(d.demand_detail);
        const apps = applicationsMap[d.id] || [];
        const canReview = d.status === "open";
        const opened = expandedDemandId === d.id;
        return (
          <div key={d.id} style={{ padding: 10, border: "1px solid #e2e8f0", borderRadius: 8, marginBottom: 8 }}>
            <div>擅长领域：{d.title || "-"}</div>
            <div>粉丝量级：{detail.fans_level || "-"}</div>
            <div>任务类型：{Array.isArray(detail.task_types) ? detail.task_types.join("/") : "-"}</div>
            <div>单条报价：{d.expected_points ?? "-"}</div>
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
