import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  createMatchingOrder,
  getClientMerchantInfoTemplate,
  getMatchingOrders,
  saveClientMerchantInfoTemplate,
  updateMatchingOrder,
  uploadMatchingOrderAssets,
} from "../clientApi";
import { getCooperationTypes } from "../matchingApi";
import { useAppStore } from "../stores/AppStore";
import { MerchantInfoForm } from "../components/MerchantInfoForm";

type MatchingFormState = {
  cooperation_type_id: string;
  task_name: string;
  task_type: "短视频" | "图文" | "直播" | "探店";
  industry: "美妆" | "服饰" | "美食" | "家居" | "其他";
  recruit_count: string;
  start_date: string;
  order_deadline: string;
  publish_deadline: string;
  product_name: string;
  selling_points: string;
  content_form: "短视频" | "图文笔记" | "直播";
  video_duration: string;
  copy_requirement: string;
  must_elements: string[];
  forbidden_content: string;
  provide_sample: "是" | "否";
  sample_count: string;
  sample_recycle: "是" | "否";
  freight_side: "商家承担" | "达人承担";
  standard_publish_on_time: boolean;
  standard_clear_no_violation: boolean;
  keep_days: string;
  revise_times: string;
  unqualified_action: "驳回修改" | "取消合作" | "扣除佣金";
  rights_granted: boolean;
  no_cheat: boolean;
  violation_action: "取消佣金并拉黑" | "取消合作" | "警告";
  unit_commission: string;
};

const defaultForm: MatchingFormState = {
  cooperation_type_id: "high_quality_custom_video",
  task_name: "",
  task_type: "短视频",
  industry: "美妆",
  recruit_count: "1",
  start_date: "",
  order_deadline: "",
  publish_deadline: "",
  product_name: "",
  selling_points: "",
  content_form: "短视频",
  video_duration: "",
  copy_requirement: "",
  must_elements: [],
  forbidden_content: "",
  provide_sample: "是",
  sample_count: "1",
  sample_recycle: "否",
  freight_side: "商家承担",
  standard_publish_on_time: true,
  standard_clear_no_violation: true,
  keep_days: "30",
  revise_times: "1",
  unqualified_action: "驳回修改",
  rights_granted: true,
  no_cheat: true,
  violation_action: "取消佣金并拉黑",
  unit_commission: "",
};

/** 判断是否是图片 URL。 */
function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url);
}

/** 判断是否是视频 URL。 */
function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v|avi)(\?|$)/i.test(url);
}

/** 商家端撮合中心：弹窗发布撮合订单。 */
export default function MatchingCenterPage() {
  const { merchantTemplate, setMerchantTemplate } = useAppStore();
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [form, setForm] = useState<MatchingFormState>(defaultForm);
  const [editingOrder, setEditingOrder] = useState<any | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [cooperationTypes, setCooperationTypes] = useState<Array<{ id: string; label: string }>>([]);

  /** 读取撮合订单列表。 */
  const loadOrders = async () => {
    const ret = await getMatchingOrders();
    setOrders(Array.isArray(ret?.list) ? ret.list : []);
  };

  /** 从后端加载已保存商家模板并同步到全局状态。 */
  const syncMerchantTemplateFromServer = async () => {
    const ret = await getClientMerchantInfoTemplate();
    const tpl = ret?.template;
    if (!tpl || typeof tpl !== "object") return;
    setMerchantTemplate((prev) => ({
      ...prev,
      shop_name: String(tpl.shop_name || "").trim(),
      product_type: String(tpl.product_type || "").trim(),
      shop_link: String(tpl.shop_link || "").trim(),
      shop_rating: String(tpl.shop_rating || "").trim(),
      user_reviews: String(tpl.user_reviews || "").trim(),
    }));
  };

  useEffect(() => {
    const loadCoopTypes = async () => {
      const ret = await getCooperationTypes();
      const types = Array.isArray(ret?.config?.types) ? ret.config.types : [];
      const list = types
        .filter((t: any) => t && typeof t.id === "string" && t.id !== "graded_video")
        .map((t: any) => ({
          id: String(t.id),
          label: String(t?.name?.zh || t.id),
        }));
      setCooperationTypes(list);
      if (!list.some((x) => x.id === form.cooperation_type_id) && list[0]) {
        setForm((prev) => ({ ...prev, cooperation_type_id: list[0].id }));
      }
    };
    void Promise.all([loadOrders(), syncMerchantTemplateFromServer(), loadCoopTypes()]).catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  /** 字段通用更新器。 */
  const setField = <K extends keyof MatchingFormState>(key: K, value: MatchingFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /** 必须包含元素多选切换。 */
  const toggleMustElement = (value: string) => {
    setForm((prev) => {
      const set = new Set(prev.must_elements);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      return { ...prev, must_elements: Array.from(set) };
    });
  };

  /** 校验发布表单并返回首个错误。 */
  const validateForm = (): string | null => {
    if (!form.task_name.trim()) return "请完善任务名称信息";
    if (!form.recruit_count || Number(form.recruit_count) < 1) return "请完善招募达人数量信息";
    if (!form.start_date) return "请完善任务开始时间信息";
    if (!form.order_deadline) return "请完善接单截止时间信息";
    if (!form.publish_deadline) return "请完善内容发布截止时间信息";
    if (!form.product_name.trim()) return "请完善推广产品/品牌名称信息";
    if (!form.selling_points.trim()) return "请完善产品核心卖点信息";
    if (!form.unit_commission || Number(form.unit_commission) <= 0) return "请完善单条佣金信息";
    if (form.provide_sample === "是" && (!form.sample_count || Number(form.sample_count) < 1)) return "请完善样品数量信息";
    if (!form.keep_days || Number(form.keep_days) < 1) return "请完善内容保留天数信息";
    if (form.must_elements.length === 0) return "请完善必须包含元素信息";
    return null;
  };

  /** 上传图片/视频附件。 */
  const doUpload = async () => {
    if (!uploadFiles.length) {
      setError("请先选择文件");
      return;
    }
    setUploading(true);
    setError(null);
    setMsg("");
    try {
      const ret = await uploadMatchingOrderAssets(uploadFiles);
      const urls = Array.isArray(ret?.urls) ? ret.urls : [];
      setUploadedUrls((prev) => [...prev, ...urls]);
      setUploadFiles([]);
      setMsg("上传成功");
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
    }
  };

  /** 关闭发布弹窗并重置临时状态。 */
  const closeModal = () => {
    setShowModal(false);
    setForm(defaultForm);
    setUploadedUrls([]);
    setUploadFiles([]);
    setEditingOrder(null);
  };

  /** 提交撮合订单。 */
  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMsg("");

    const verifyError = validateForm();
    if (verifyError) {
      setError(verifyError);
      return;
    }

    const requiredTemplateError = [
      ["shop_name", merchantTemplate.shop_name],
      ["product_type", merchantTemplate.product_type],
      ["sales_summary", merchantTemplate.sales_summary],
      ["shop_link", merchantTemplate.shop_link],
      ["shop_rating", merchantTemplate.shop_rating],
      ["user_reviews", merchantTemplate.user_reviews],
    ].find(([, value]) => !String(value || "").trim());
    if (requiredTemplateError) {
      setError("请先在“商家基本信息（必填模板）”中补全并保存所有必填项");
      return;
    }

    setPublishing(true);
    try {
      // 发布前再次写入后端模板，避免仅本地有值但服务端校验缺失。
      await saveClientMerchantInfoTemplate({
        shop_name: merchantTemplate.shop_name.trim(),
        product_type: merchantTemplate.product_type.trim(),
        shop_link: merchantTemplate.shop_link.trim(),
        shop_rating: merchantTemplate.shop_rating.trim(),
        user_reviews: merchantTemplate.user_reviews.trim(),
      });

      const detail = {
        cooperation_type_id: form.cooperation_type_id,
        task_name: form.task_name.trim(),
        task_type: form.task_type,
        industry: form.industry,
        recruit_count: Number(form.recruit_count),
        start_date: form.start_date,
        order_deadline: form.order_deadline,
        publish_deadline: form.publish_deadline,
        product_name: form.product_name.trim(),
        // 从 AppStore 读取商家模板信息
        merchant_shop_name: merchantTemplate.shop_name.trim(),
        merchant_product_type: merchantTemplate.product_type.trim(),
        merchant_sales_summary: merchantTemplate.sales_summary.trim(),
        merchant_shop_link: merchantTemplate.shop_link.trim(),
        merchant_shop_rating: merchantTemplate.shop_rating.trim(),
        merchant_user_reviews: merchantTemplate.user_reviews.trim(),
        selling_points: form.selling_points.trim(),
        content_form: form.content_form,
        video_duration: form.video_duration.trim(),
        copy_requirement: form.copy_requirement.trim(),
        must_elements: form.must_elements,
        forbidden_content: form.forbidden_content.trim(),
        provide_sample: form.provide_sample,
        sample_count: form.provide_sample === "是" ? Number(form.sample_count || 0) : 0,
        sample_recycle: form.sample_recycle,
        freight_side: form.freight_side,
        standard_publish_on_time: form.standard_publish_on_time,
        standard_clear_no_violation: form.standard_clear_no_violation,
        keep_days: Number(form.keep_days),
        revise_times: Number(form.revise_times || 0),
        unqualified_action: form.unqualified_action,
        rights_granted: form.rights_granted,
        no_cheat: form.no_cheat,
        violation_action: form.violation_action,
        unit_commission: Number(form.unit_commission),
      };

      if (editingOrder) {
        await updateMatchingOrder(editingOrder.id, {
          title: form.task_name.trim(),
          task_amount: Number(form.unit_commission),
          requirement: form.selling_points.trim(),
          allow_apply: true,
          detail,
          attachments: uploadedUrls,
        });
      } else {
        await createMatchingOrder({
          title: form.task_name.trim(),
          task_amount: Number(form.unit_commission),
          requirement: form.selling_points.trim(),
          allow_apply: true,
          detail,
          attachments: uploadedUrls,
        });
      }

      await loadOrders();
      closeModal();
      setShowSuccessModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发布失败");
    } finally {
      setPublishing(false);
    }
  };

  /** 附件预览列表。 */
  const previews = useMemo(() => uploadedUrls, [uploadedUrls]);

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 10px 24px rgba(15,23,42,0.08)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2 style={{ margin: 0 }}>撮合中心</h2>
        <button type="button" onClick={() => setShowModal(true)} style={{ height: 38, fontWeight: 700 }}>
          发布撮合订单
        </button>
      </div>

      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      {msg && <p style={{ color: "#166534" }}>{msg}</p>}

      <div style={{ marginTop: 14 }}>
        <h3 style={{ marginBottom: 8 }}>已发布撮合订单</h3>
        {orders.length === 0 ? <p style={{ color: "#64748b" }}>暂无订单</p> : null}
        {orders.map((it) => (
          <div key={it.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div>{it.order_no}｜{it.title}</div>
              <div style={{ color: "#475569", marginTop: 4 }}>
                金额：{it.task_amount}｜状态：{it.status}｜类型：{String((it.detail_json?.cooperation_type_id ?? it.detail?.cooperation_type_id) || "-")}
              </div>
            </div>
            <button 
              type="button" 
              onClick={() => {
                if (it.detail) {
                  const d = it.detail as Record<string, unknown>;
                  setForm({
                    cooperation_type_id: typeof d.cooperation_type_id === "string" ? d.cooperation_type_id : defaultForm.cooperation_type_id,
                    task_name: typeof d.task_name === "string" ? d.task_name : "",
                    task_type: (typeof d.task_type === "string" && ["短视频", "图文", "直播", "探店"].includes(d.task_type)) ? d.task_type as MatchingFormState["task_type"] : "短视频",
                    industry: (typeof d.industry === "string" && ["美妆", "服饰", "美食", "家居", "其他"].includes(d.industry)) ? d.industry as MatchingFormState["industry"] : "其他",
                    recruit_count: typeof d.recruit_count === "number" ? String(d.recruit_count) : "",
                    start_date: typeof d.start_date === "string" ? d.start_date : "",
                    order_deadline: typeof d.order_deadline === "string" ? d.order_deadline : "",
                    publish_deadline: typeof d.publish_deadline === "string" ? d.publish_deadline : "",
                    product_name: typeof d.product_name === "string" ? d.product_name : "",
                    selling_points: typeof d.selling_points === "string" ? d.selling_points : "",
                    content_form: (typeof d.content_form === "string" && ["短视频", "图文笔记", "直播"].includes(d.content_form)) ? d.content_form as MatchingFormState["content_form"] : "短视频",
                    video_duration: typeof d.video_duration === "string" ? d.video_duration : "",
                    copy_requirement: typeof d.copy_requirement === "string" ? d.copy_requirement : "",
                    must_elements: Array.isArray(d.must_elements) ? d.must_elements as string[] : [],
                    forbidden_content: typeof d.forbidden_content === "string" ? d.forbidden_content : "",
                    provide_sample: (d.provide_sample === "是") ? "是" : "否",
                    sample_count: typeof d.sample_count === "number" ? String(d.sample_count) : "",
                    sample_recycle: (d.sample_recycle === "是") ? "是" : "否",
                    freight_side: (d.freight_side === "达人承担") ? "达人承担" : "商家承担",
                    standard_publish_on_time: Boolean(d.standard_publish_on_time),
                    standard_clear_no_violation: Boolean(d.standard_clear_no_violation),
                    keep_days: typeof d.keep_days === "number" ? String(d.keep_days) : "",
                    revise_times: typeof d.revise_times === "number" ? String(d.revise_times) : "",
                    unqualified_action: (typeof d.unqualified_action === "string" && ["驳回修改", "取消合作", "扣除佣金"].includes(d.unqualified_action)) ? d.unqualified_action as MatchingFormState["unqualified_action"] : "驳回修改",
                    rights_granted: Boolean(d.rights_granted),
                    no_cheat: Boolean(d.no_cheat),
                    violation_action: (typeof d.violation_action === "string" && ["取消佣金并拉黑", "取消合作", "警告"].includes(d.violation_action)) ? d.violation_action as MatchingFormState["violation_action"] : "取消佣金并拉黑",
                    unit_commission: typeof d.unit_commission === "number" ? String(d.unit_commission) : "",
                  });
                }
                setUploadedUrls(Array.isArray(it.attachments) ? it.attachments : []);
                setEditingOrder(it);
                setShowModal(true);
              }}
              style={{ 
                padding: "6px 14px", 
                borderRadius: 6, 
                border: "1px solid var(--xt-accent)", 
                background: "transparent", 
                color: "var(--xt-accent)", 
                cursor: "pointer",
                fontWeight: 500,
                fontSize: 13
              }}
            >
              编辑
            </button>
          </div>
        ))}
      </div>

      {showModal ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "grid", placeItems: "center", zIndex: 1000 }}>
          <div style={{ position: "relative", width: "min(920px, 94vw)", maxHeight: "90vh", overflowY: "auto", background: "#fff", borderRadius: 16, padding: 16 }}>
            <button 
              type="button" 
              onClick={closeModal}
              style={{ 
                position: "absolute", 
                top: 16, 
                right: 16, 
                width: 36, 
                height: 36, 
                borderRadius: "50%", 
                border: "1px solid #e2e8f0", 
                background: "#f8fafc", 
                cursor: "pointer", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                fontSize: 18,
                color: "#64748b",
                zIndex: 10,
                transition: "all 0.2s"
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#fee2e2"; e.currentTarget.style.color = "#dc2626"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.color = "#64748b"; }}
            >
              ×
            </button>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingRight: 40 }}>
              <h3 style={{ margin: 0 }}>发布撮合订单</h3>
            </div>

            <form onSubmit={onCreate} style={{ display: "grid", gap: 14, marginTop: 12 }}>
              <MerchantInfoForm />

              <section style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
                <h4 style={{ marginTop: 0 }}>1. 任务基础信息</h4>
                <div style={{ display: "grid", gap: 8 }}>
                  <label htmlFor="task_name">任务名称 <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="task_name" value={form.task_name} onChange={(e) => setField("task_name", e.target.value)} />

                  <label htmlFor="task_type">任务类型</label>
                  <select id="task_type" value={form.task_type} onChange={(e) => setField("task_type", e.target.value as MatchingFormState["task_type"])}>
                    <option value="短视频">短视频</option><option value="图文">图文</option><option value="直播">直播</option><option value="探店">探店</option>
                  </select>

                  <label htmlFor="cooperation_type_id">合作业务类型</label>
                  <select
                    id="cooperation_type_id"
                    value={form.cooperation_type_id}
                    onChange={(e) => setField("cooperation_type_id", e.target.value)}
                    disabled={cooperationTypes.length === 0}
                  >
                    {(cooperationTypes.length ? cooperationTypes : [{ id: form.cooperation_type_id, label: form.cooperation_type_id }]).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="industry">所属行业</label>
                  <select id="industry" value={form.industry} onChange={(e) => setField("industry", e.target.value as MatchingFormState["industry"])}>
                    <option value="美妆">美妆</option><option value="服饰">服饰</option><option value="美食">美食</option><option value="家居">家居</option><option value="其他">其他</option>
                  </select>

                  <label htmlFor="recruit_count">招募达人数量 <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="recruit_count" type="number" min={1} value={form.recruit_count} onChange={(e) => setField("recruit_count", e.target.value)} />

                  <label htmlFor="start_date">任务开始时间 <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="start_date" type="date" value={form.start_date} onChange={(e) => setField("start_date", e.target.value)} />

                  <label htmlFor="order_deadline">接单截止时间 <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="order_deadline" type="date" value={form.order_deadline} onChange={(e) => setField("order_deadline", e.target.value)} />

                  <label htmlFor="publish_deadline">内容发布截止时间 <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="publish_deadline" type="date" value={form.publish_deadline} onChange={(e) => setField("publish_deadline", e.target.value)} />
                </div>
              </section>

              <section style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
                <h4 style={{ marginTop: 0 }}>2. 合作内容要求</h4>
                <div style={{ display: "grid", gap: 8 }}>
                  <label htmlFor="product_name">推广产品/品牌名称 <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="product_name" value={form.product_name} onChange={(e) => setField("product_name", e.target.value)} />

                  <label htmlFor="selling_points">产品核心卖点 <span style={{ color: "#dc2626" }}>*</span></label>
                  <textarea id="selling_points" rows={3} value={form.selling_points} onChange={(e) => setField("selling_points", e.target.value)} />

                  <label htmlFor="content_form">内容形式</label>
                  <select id="content_form" value={form.content_form} onChange={(e) => setField("content_form", e.target.value as MatchingFormState["content_form"])}>
                    <option value="短视频">短视频</option><option value="图文笔记">图文笔记</option><option value="直播">直播</option>
                  </select>

                  <label htmlFor="video_duration">视频时长要求</label>
                  <input id="video_duration" value={form.video_duration} onChange={(e) => setField("video_duration", e.target.value)} placeholder="例：15s-30s" />

                  <label htmlFor="copy_requirement">文案/标题要求</label>
                  <textarea id="copy_requirement" rows={3} value={form.copy_requirement} onChange={(e) => setField("copy_requirement", e.target.value)} />

                  <div>
                    <span>必须包含元素 <span style={{ color: "#dc2626" }}>*</span>：</span>
                    {["产品出镜", "口播", "字幕", "话题标签"].map((v) => (
                      <label key={v} style={{ marginLeft: 8 }}>
                        <input type="checkbox" checked={form.must_elements.includes(v)} onChange={() => toggleMustElement(v)} /> {v}
                      </label>
                    ))}
                  </div>

                  <label htmlFor="forbidden_content">禁止内容</label>
                  <textarea id="forbidden_content" rows={3} value={form.forbidden_content} onChange={(e) => setField("forbidden_content", e.target.value)} />
                </div>
              </section>

              <section style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
                <h4 style={{ marginTop: 0 }}>3. 样品与发货</h4>
                <div style={{ display: "grid", gap: 8 }}>
                  <label htmlFor="provide_sample">是否提供样品</label>
                  <select id="provide_sample" value={form.provide_sample} onChange={(e) => setField("provide_sample", e.target.value as "是" | "否")}>
                    <option value="是">是</option><option value="否">否</option>
                  </select>

                  {form.provide_sample === "是" ? (
                    <>
                      <label htmlFor="sample_count">样品数量 <span style={{ color: "#dc2626" }}>*</span></label>
                      <input id="sample_count" type="number" min={1} value={form.sample_count} onChange={(e) => setField("sample_count", e.target.value)} />
                    </>
                  ) : null}

                  <label htmlFor="sample_recycle">样品是否回收</label>
                  <select id="sample_recycle" value={form.sample_recycle} onChange={(e) => setField("sample_recycle", e.target.value as "是" | "否")}>
                    <option value="是">是</option><option value="否">否</option>
                  </select>

                  <label htmlFor="freight_side">运费承担</label>
                  <select id="freight_side" value={form.freight_side} onChange={(e) => setField("freight_side", e.target.value as "商家承担" | "达人承担")}> 
                    <option value="商家承担">商家承担</option><option value="达人承担">达人承担</option>
                  </select>
                </div>
              </section>

              <section style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
                <h4 style={{ marginTop: 0 }}>4. 验收标准</h4>
                <div style={{ display: "grid", gap: 8 }}>
                  <label><input type="checkbox" checked={form.standard_publish_on_time} onChange={(e) => setField("standard_publish_on_time", e.target.checked)} /> 内容必须按时发布</label>
                  <label><input type="checkbox" checked={form.standard_clear_no_violation} onChange={(e) => setField("standard_clear_no_violation", e.target.checked)} /> 画面清晰无水印无违规</label>

                  <label htmlFor="keep_days">内容保留天数 <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="keep_days" type="number" min={1} value={form.keep_days} onChange={(e) => setField("keep_days", e.target.value)} />

                  <label htmlFor="revise_times">允许修改次数</label>
                  <input id="revise_times" type="number" min={0} value={form.revise_times} onChange={(e) => setField("revise_times", e.target.value)} />

                  <label htmlFor="unqualified_action">未达标处理</label>
                  <select id="unqualified_action" value={form.unqualified_action} onChange={(e) => setField("unqualified_action", e.target.value as MatchingFormState["unqualified_action"])}>
                    <option value="驳回修改">驳回修改</option><option value="取消合作">取消合作</option><option value="扣除佣金">扣除佣金</option>
                  </select>
                </div>
              </section>

              <section style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
                <h4 style={{ marginTop: 0 }}>5. 版权与规则</h4>
                <div style={{ display: "grid", gap: 8 }}>
                  <label><input type="checkbox" checked={form.rights_granted} onChange={(e) => setField("rights_granted", e.target.checked)} /> 商家拥有使用权、剪辑权、宣传使用权</label>
                  <label><input type="checkbox" checked={form.no_cheat} onChange={(e) => setField("no_cheat", e.target.checked)} /> 达人不得抄袭搬运刷数据</label>

                  <label htmlFor="violation_action">违规行为处理</label>
                  <select id="violation_action" value={form.violation_action} onChange={(e) => setField("violation_action", e.target.value as MatchingFormState["violation_action"])}>
                    <option value="取消佣金并拉黑">取消佣金并拉黑</option><option value="取消合作">取消合作</option><option value="警告">警告</option>
                  </select>

                  <label htmlFor="unit_commission">单条佣金 <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="unit_commission" type="number" min={1} value={form.unit_commission} onChange={(e) => setField("unit_commission", e.target.value)} />
                </div>
              </section>

              <section style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
                <h4 style={{ marginTop: 0 }}>附件上传</h4>
                <input type="file" multiple accept="image/*,video/*" onChange={(e) => setUploadFiles(Array.from(e.target.files || []))} />
                <div style={{ marginTop: 8 }}>
                  <button type="button" onClick={() => void doUpload()} disabled={uploading}>{uploading ? "上传中..." : "上传文件"}</button>
                </div>

                {previews.length > 0 ? (
                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    {previews.map((url) => (
                      <div key={url} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 8 }}>
                        <div style={{ marginBottom: 6 }}><a href={url} target="_blank" rel="noreferrer">查看文件</a></div>
                        {isImageUrl(url) ? <img src={url} alt="attachment" style={{ maxWidth: 240, maxHeight: 160, borderRadius: 6 }} /> : null}
                        {isVideoUrl(url) ? <video src={url} controls style={{ maxWidth: 320, maxHeight: 180, borderRadius: 6 }} /> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>

              <button 
                type="submit" 
                disabled={publishing} 
                style={{ 
                  height: 42, 
                  fontWeight: 700, 
                  background: "var(--xt-accent)", 
                  color: "#fff",
                  cursor: "pointer",
                  border: "none",
                  borderRadius: 8
                }}
              >
                {publishing ? "提交中..." : (editingOrder ? "确认保存" : "确认发布")}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {showSuccessModal ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "grid", placeItems: "center", zIndex: 2000 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "32px 40px", textAlign: "center", minWidth: 280 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✨</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#1e293b", marginBottom: 8 }}>提交成功</div>
            <div style={{ fontSize: 14, color: "#64748b", marginBottom: 24 }}>撮合订单已提交，请耐心等待</div>
            <button 
              type="button" 
              onClick={() => setShowSuccessModal(false)}
              style={{ 
                padding: "10px 32px", 
                borderRadius: 8, 
                border: "none", 
                background: "var(--xt-accent)", 
                color: "#fff", 
                fontWeight: 600, 
                cursor: "pointer",
                fontSize: 14
              }}
            >
              确定
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
