import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { createInfluencerDemand, getInfluencerPermissionStatus } from "../matchingApi";
import { formatInfluencerPermissionStatus } from "../utils/matchingStatusText";

type PermissionStatus = "unapplied" | "pending" | "approved" | "rejected" | "disabled";

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
  tiktok_account: string;
  tiktok_fans: string;
};

const SPECIALTY_VALUES = ["美妆", "服饰", "美食", "家居", "3C", "母婴", "其他"] as const;

const FANS_LEVEL_VALUES = ["1万以内", "1万-5万", "5万-10万", "10万-50万", "50万以上"] as const;

const TASK_TYPE_VALUES = ["短视频", "图文", "直播", "探店"] as const;

/**
 * 达人发布合作需求页（仅发布）。
 */
export default function CollabDemandsPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<PermissionStatus>("unapplied");
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
    tiktok_account: "",
    tiktok_fans: "",
  });

  /**
   * 拉取权限状态。
   */
  const loadPermission = async () => {
    setError(null);
    try {
      const permissionRes = await getInfluencerPermissionStatus();
      setStatus(String(permissionRes.status || "unapplied") as PermissionStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("加载失败"));
    }
  };

  useEffect(() => {
    void loadPermission();
  }, []);

  /**
   * 可接任务类型多选切换。
   */
  const toggleTaskType = (value: string) => {
    setForm((prev) => {
      const set = new Set(prev.task_types);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      return { ...prev, task_types: Array.from(set) };
    });
  };

  /**
   * 发布合作需求。
   */
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
        tiktok_account: form.tiktok_account,
        tiktok_fans: Number(form.tiktok_fans),
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
        tiktok_account: "",
        tiktok_fans: "",
      });
      setMsg(t("发布成功"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("发布失败"));
    }
  };

  const disabledTip =
    status === "pending"
      ? t("审核中，暂无法操作")
      : status === "rejected"
        ? t("审核未通过，可重新申请")
        : status !== "approved"
          ? t("需审核通过后使用")
          : "";

  return (
    <div>
      <h2 className="xt-inf-page-title">{t("发布合作需求")}</h2>
      <p className="xt-inf-lead">
        {t("当前权限：")}
        {t(formatInfluencerPermissionStatus(status))}
        {t("。")}
        {t("请尽量一次填完并提交，减少反复修改。")}
      </p>
      {disabledTip ? <p style={{ color: "#b45309" }}>{disabledTip}</p> : null}
      {msg ? <p style={{ color: "#166534" }}>{msg}</p> : null}
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

      <div style={{ display: "grid", gap: 8, maxWidth: 620 }}>
        <label htmlFor="specialty">
          {t("擅长领域")} <span style={{ color: "#dc2626" }}>*</span>
        </label>
        <select
          id="specialty"
          disabled={status !== "approved"}
          value={form.specialty}
          onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
        >
          <option value="">{t("请选择")}</option>
          {SPECIALTY_VALUES.map((v) => (
            <option key={v} value={v}>
              {t(v)}
            </option>
          ))}
        </select>

        <label htmlFor="fans_level">
          {t("粉丝量级")} <span style={{ color: "#dc2626" }}>*</span>
        </label>
        <select
          id="fans_level"
          disabled={status !== "approved"}
          value={form.fans_level}
          onChange={(e) => setForm((f) => ({ ...f, fans_level: e.target.value }))}
        >
          {FANS_LEVEL_VALUES.map((v) => (
            <option key={v} value={v}>
              {t(v)}
            </option>
          ))}
        </select>

        <div>
          <span>
            {t("可接任务类型")} <span style={{ color: "#dc2626" }}>*</span>：
          </span>
          {TASK_TYPE_VALUES.map((v) => (
            <label key={v} style={{ marginLeft: 8 }}>
              <input
                type="checkbox"
                disabled={status !== "approved"}
                checked={form.task_types.includes(v)}
                onChange={() => toggleTaskType(v)}
              />{" "}
              {t(v)}
            </label>
          ))}
        </div>

        <label htmlFor="categories_can_do">
          {t("可接产品品类")} <span style={{ color: "#dc2626" }}>*</span>
        </label>
        <input
          id="categories_can_do"
          disabled={status !== "approved"}
          value={form.categories_can_do}
          onChange={(e) => setForm((f) => ({ ...f, categories_can_do: e.target.value }))}
        />

        <label htmlFor="categories_not_do">
          {t("不接品类")} <span style={{ color: "#dc2626" }}>*</span>
        </label>
        <input
          id="categories_not_do"
          disabled={status !== "approved"}
          value={form.categories_not_do}
          onChange={(e) => setForm((f) => ({ ...f, categories_not_do: e.target.value }))}
        />

        <label htmlFor="need_sample">
          {t("是否需要样品")} <span style={{ color: "#dc2626" }}>*</span>
        </label>
        <select
          id="need_sample"
          disabled={status !== "approved"}
          value={form.need_sample}
          onChange={(e) => setForm((f) => ({ ...f, need_sample: e.target.value as "是" | "否" }))}
        >
          <option value="是">{t("是")}</option>
          <option value="否">{t("否")}</option>
        </select>

        <label htmlFor="unit_price">
          {t("单条报价")} <span style={{ color: "#dc2626" }}>*</span>
        </label>
        <input
          id="unit_price"
          type="number"
          min={1}
          disabled={status !== "approved"}
          value={form.unit_price}
          onChange={(e) => setForm((f) => ({ ...f, unit_price: e.target.value }))}
        />

        <label htmlFor="delivery_days">
          {t("出稿时效（天）")} <span style={{ color: "#dc2626" }}>*</span>
        </label>
        <input
          id="delivery_days"
          type="number"
          min={1}
          disabled={status !== "approved"}
          value={form.delivery_days}
          onChange={(e) => setForm((f) => ({ ...f, delivery_days: e.target.value }))}
        />

        <label htmlFor="revise_times">
          {t("可修改次数")} <span style={{ color: "#dc2626" }}>*</span>
        </label>
        <input
          id="revise_times"
          type="number"
          min={0}
          disabled={status !== "approved"}
          value={form.revise_times}
          onChange={(e) => setForm((f) => ({ ...f, revise_times: e.target.value }))}
        />

        <label htmlFor="intro">
          {t("自我介绍/个人优势")} <span style={{ color: "#dc2626" }}>*</span>
        </label>
        <textarea
          id="intro"
          rows={4}
          disabled={status !== "approved"}
          value={form.intro}
          onChange={(e) => setForm((f) => ({ ...f, intro: e.target.value }))}
        />

        <label htmlFor="tiktok_account">
          {t("TikTok 账号")} <span style={{ color: "#dc2626" }}>*</span>
        </label>
        <input
          id="tiktok_account"
          disabled={status !== "approved"}
          value={form.tiktok_account}
          onChange={(e) => setForm((f) => ({ ...f, tiktok_account: e.target.value }))}
        />

        <label htmlFor="tiktok_fans">
          {t("粉丝数量")} <span style={{ color: "#dc2626" }}>*</span>
        </label>
        <input
          id="tiktok_fans"
          type="number"
          min={0}
          disabled={status !== "approved"}
          value={form.tiktok_fans}
          onChange={(e) => setForm((f) => ({ ...f, tiktok_fans: e.target.value }))}
        />
      </div>
      <button type="button" disabled={status !== "approved"} onClick={() => void create()} style={{ marginTop: 10 }}>
        {t("发布需求")}
      </button>
    </div>
  );
}
