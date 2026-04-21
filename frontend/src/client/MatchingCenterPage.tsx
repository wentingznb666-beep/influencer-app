import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  createMatchingOrder,
  getClientMerchantInfoTemplate,
  getMatchingOrders,
  saveClientMerchantInfoTemplate,
  uploadMatchingOrderAssets,
} from "../clientApi";

type MatchingFormState = {
  task_name: string;
  task_type: "???" | "??" | "??" | "??";
  industry: "??" | "??" | "??" | "??" | "??";
  recruit_count: string;
  start_date: string;
  order_deadline: string;
  publish_deadline: string;
  product_name: string;
  selling_points: string;
  content_form: "???" | "????" | "??";
  video_duration: string;
  copy_requirement: string;
  must_elements: string[];
  forbidden_content: string;
  provide_sample: "?" | "?";
  sample_count: string;
  sample_recycle: "?" | "?";
  freight_side: "????" | "????";
  standard_publish_on_time: boolean;
  standard_clear_no_violation: boolean;
  keep_days: string;
  revise_times: string;
  unqualified_action: "????" | "????" | "????";
  rights_granted: boolean;
  no_cheat: boolean;
  violation_action: "???????" | "????" | "??";
  unit_commission: string;
};

type MerchantTemplateState = {
  shop_name: string;
  product_type: string;
  shop_link: string;
  shop_rating: string;
  user_reviews: string;
};

const defaultForm: MatchingFormState = {
  task_name: "",
  task_type: "???",
  industry: "??",
  recruit_count: "1",
  start_date: "",
  order_deadline: "",
  publish_deadline: "",
  product_name: "",
  selling_points: "",
  content_form: "???",
  video_duration: "",
  copy_requirement: "",
  must_elements: [],
  forbidden_content: "",
  provide_sample: "?",
  sample_count: "1",
  sample_recycle: "?",
  freight_side: "????",
  standard_publish_on_time: true,
  standard_clear_no_violation: true,
  keep_days: "30",
  revise_times: "1",
  unqualified_action: "????",
  rights_granted: true,
  no_cheat: true,
  violation_action: "???????",
  unit_commission: "",
};

const defaultTemplate: MerchantTemplateState = {
  shop_name: "",
  product_type: "",
  shop_link: "",
  shop_rating: "",
  user_reviews: "",
};

/** ??????? URL? */
function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url);
}

/** ??????? URL? */
function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v|avi)(\?|$)/i.test(url);
}

/** ???????????? + ????? */
export default function MatchingCenterPage() {
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [form, setForm] = useState<MatchingFormState>(defaultForm);
  const [merchantTemplate, setMerchantTemplate] = useState<MerchantTemplateState>(defaultTemplate);

  /** ????????? */
  const loadOrders = async () => {
    const ret = await getMatchingOrders();
    setOrders(Array.isArray(ret?.list) ? ret.list : []);
  };

  /** ????????? */
  const loadMerchantTemplate = async () => {
    const ret = await getClientMerchantInfoTemplate();
    if (ret?.template && typeof ret.template === "object") {
      setMerchantTemplate({
        shop_name: String(ret.template.shop_name || ""),
        product_type: String(ret.template.product_type || ""),
        shop_link: String(ret.template.shop_link || ""),
        shop_rating: String(ret.template.shop_rating || ""),
        user_reviews: String(ret.template.user_reviews || ""),
      });
    }
  };

  useEffect(() => {
    void Promise.all([loadOrders(), loadMerchantTemplate()]).catch((e) => setError(e instanceof Error ? e.message : "????"));
  }, []);

  /** ???????? */
  const setField = <K extends keyof MatchingFormState>(key: K, value: MatchingFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /** ??????????? */
  const toggleMustElement = (value: string) => {
    setForm((prev) => {
      const set = new Set(prev.must_elements);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      return { ...prev, must_elements: Array.from(set) };
    });
  };

  /** ????????? */
  const merchantTemplateComplete = useMemo(
    () =>
      !!merchantTemplate.shop_name.trim() &&
      !!merchantTemplate.product_type.trim() &&
      !!merchantTemplate.shop_link.trim() &&
      !!merchantTemplate.shop_rating.trim() &&
      !!merchantTemplate.user_reviews.trim(),
    [merchantTemplate],
  );

  /** ??????? */
  const saveTemplate = async () => {
    if (!merchantTemplateComplete) {
      setError("????????????");
      return;
    }
    setTemplateSaving(true);
    setError(null);
    setMsg("");
    try {
      await saveClientMerchantInfoTemplate(merchantTemplate);
      setMsg("?????????");
    } catch (e) {
      setError(e instanceof Error ? e.message : "????");
    } finally {
      setTemplateSaving(false);
    }
  };

  /** ?????????????? */
  const validateForm = (): string | null => {
    if (!form.task_name.trim()) return "?????????";
    if (!form.recruit_count || Number(form.recruit_count) < 1) return "???????????";
    if (!form.start_date) return "???????????";
    if (!form.order_deadline) return "???????????";
    if (!form.publish_deadline) return "?????????????";
    if (!form.product_name.trim()) return "???????/??????";
    if (!form.selling_points.trim()) return "???????????";
    if (!form.unit_commission || Number(form.unit_commission) <= 0) return "?????????";
    if (form.provide_sample === "?" && (!form.sample_count || Number(form.sample_count) < 1)) return "?????????";
    if (!form.keep_days || Number(form.keep_days) < 1) return "???????????";
    if (form.must_elements.length === 0) return "???????????";
    if (!merchantTemplateComplete) return "?????????????";
    return null;
  };

  /** ????/????? */
  const doUpload = async () => {
    if (!uploadFiles.length) {
      setError("??????");
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
      setMsg("????");
    } catch (e) {
      setError(e instanceof Error ? e.message : "????");
    } finally {
      setUploading(false);
    }
  };

  /** ?????????????? */
  const closeModal = () => {
    setShowModal(false);
    setForm(defaultForm);
    setUploadedUrls([]);
    setUploadFiles([]);
  };

  /** ??????? */
  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMsg("");

    const verifyError = validateForm();
    if (verifyError) {
      setError(verifyError);
      return;
    }

    setPublishing(true);
    try {
      const detail = {
        task_name: form.task_name.trim(),
        task_type: form.task_type,
        industry: form.industry,
        recruit_count: Number(form.recruit_count),
        start_date: form.start_date,
        order_deadline: form.order_deadline,
        publish_deadline: form.publish_deadline,
        product_name: form.product_name.trim(),
        selling_points: form.selling_points.trim(),
        content_form: form.content_form,
        video_duration: form.video_duration.trim(),
        copy_requirement: form.copy_requirement.trim(),
        must_elements: form.must_elements,
        forbidden_content: form.forbidden_content.trim(),
        provide_sample: form.provide_sample,
        sample_count: form.provide_sample === "?" ? Number(form.sample_count || 0) : 0,
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
      };

      await createMatchingOrder({
        title: form.task_name.trim(),
        task_amount: Number(form.unit_commission),
        requirement: form.selling_points.trim(),
        allow_apply: true,
        detail,
        attachments: uploadedUrls,
      });

      await loadOrders();
      closeModal();
      setMsg("????");
    } catch (err) {
      const msgText = err instanceof Error ? err.message : "????";
      if (msgText.includes("MERCHANT_TEMPLATE_REQUIRED")) {
        setError("?????????????");
      } else {
        setError(msgText);
      }
    } finally {
      setPublishing(false);
    }
  };

  /** ??????? */
  const previews = useMemo(() => uploadedUrls, [uploadedUrls]);

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 10px 24px rgba(15,23,42,0.08)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2 style={{ margin: 0 }}>????</h2>
        <button type="button" onClick={() => setShowModal(true)} style={{ height: 38, fontWeight: 700 }}>
          ??????
        </button>
      </div>

      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      {msg && <p style={{ color: "#166534" }}>{msg}</p>}

      <div style={{ marginTop: 14 }}>
        <h3 style={{ marginBottom: 8 }}>???????</h3>
        {orders.length === 0 ? <p style={{ color: "#64748b" }}>????</p> : null}
        {orders.map((it) => (
          <div key={it.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10, marginBottom: 8 }}>
            <div>{it.order_no}?{it.title}</div>
            <div style={{ color: "#475569", marginTop: 4 }}>???{it.task_amount}????{it.status}</div>
          </div>
        ))}
      </div>

      {showModal ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "grid", placeItems: "center", zIndex: 1000 }}>
          <div style={{ width: "min(920px, 94vw)", maxHeight: "90vh", overflowY: "auto", background: "#fff", borderRadius: 16, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>??????</h3>
              <button type="button" onClick={closeModal}>??</button>
            </div>

            <form onSubmit={onCreate} style={{ display: "grid", gap: 14, marginTop: 12 }}>
              <section style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
                <h4 style={{ marginTop: 0 }}>????????</h4>
                <div style={{ display: "grid", gap: 8 }}>
                  <label htmlFor="tpl_shop_name">???? <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="tpl_shop_name" value={merchantTemplate.shop_name} onChange={(e) => setMerchantTemplate((v) => ({ ...v, shop_name: e.target.value }))} />

                  <label htmlFor="tpl_product_type">?????? <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="tpl_product_type" value={merchantTemplate.product_type} onChange={(e) => setMerchantTemplate((v) => ({ ...v, product_type: e.target.value }))} />

                  <label htmlFor="tpl_shop_link">???? <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="tpl_shop_link" value={merchantTemplate.shop_link} onChange={(e) => setMerchantTemplate((v) => ({ ...v, shop_link: e.target.value }))} />

                  <label htmlFor="tpl_shop_rating">???? <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="tpl_shop_rating" value={merchantTemplate.shop_rating} onChange={(e) => setMerchantTemplate((v) => ({ ...v, shop_rating: e.target.value }))} />

                  <label htmlFor="tpl_user_reviews">???? <span style={{ color: "#dc2626" }}>*</span></label>
                  <textarea id="tpl_user_reviews" rows={3} value={merchantTemplate.user_reviews} onChange={(e) => setMerchantTemplate((v) => ({ ...v, user_reviews: e.target.value }))} />

                  <button type="button" className="xt-accent-btn" onClick={() => void saveTemplate()} disabled={templateSaving || !merchantTemplateComplete}>
                    {templateSaving ? "???..." : "????????"}
                  </button>
                </div>
              </section>

              <section style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
                <h4 style={{ marginTop: 0 }}>1. ??????</h4>
                <div style={{ display: "grid", gap: 8 }}>
                  <label htmlFor="task_name">???? <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="task_name" value={form.task_name} onChange={(e) => setField("task_name", e.target.value)} />

                  <label htmlFor="task_type">????</label>
                  <select id="task_type" value={form.task_type} onChange={(e) => setField("task_type", e.target.value as MatchingFormState["task_type"])}>
                    <option value="???">???</option><option value="??">??</option><option value="??">??</option><option value="??">??</option>
                  </select>

                  <label htmlFor="industry">????</label>
                  <select id="industry" value={form.industry} onChange={(e) => setField("industry", e.target.value as MatchingFormState["industry"])}>
                    <option value="??">??</option><option value="??">??</option><option value="??">??</option><option value="??">??</option><option value="??">??</option>
                  </select>

                  <label htmlFor="recruit_count">?????? <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="recruit_count" type="number" min={1} value={form.recruit_count} onChange={(e) => setField("recruit_count", e.target.value)} />

                  <label htmlFor="start_date">?????? <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="start_date" type="date" value={form.start_date} onChange={(e) => setField("start_date", e.target.value)} />

                  <label htmlFor="order_deadline">?????? <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="order_deadline" type="date" value={form.order_deadline} onChange={(e) => setField("order_deadline", e.target.value)} />

                  <label htmlFor="publish_deadline">???????? <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="publish_deadline" type="date" value={form.publish_deadline} onChange={(e) => setField("publish_deadline", e.target.value)} />
                </div>
              </section>

              <section style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
                <h4 style={{ marginTop: 0 }}>2. ??????</h4>
                <div style={{ display: "grid", gap: 8 }}>
                  <label htmlFor="product_name">????/???? <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="product_name" value={form.product_name} onChange={(e) => setField("product_name", e.target.value)} />

                  <label htmlFor="selling_points">?????? <span style={{ color: "#dc2626" }}>*</span></label>
                  <textarea id="selling_points" rows={3} value={form.selling_points} onChange={(e) => setField("selling_points", e.target.value)} />

                  <label htmlFor="content_form">????</label>
                  <select id="content_form" value={form.content_form} onChange={(e) => setField("content_form", e.target.value as MatchingFormState["content_form"])}>
                    <option value="???">???</option><option value="????">????</option><option value="??">??</option>
                  </select>

                  <label htmlFor="video_duration">??????</label>
                  <input id="video_duration" value={form.video_duration} onChange={(e) => setField("video_duration", e.target.value)} placeholder="??15s-30s" />

                  <label htmlFor="copy_requirement">??/????</label>
                  <textarea id="copy_requirement" rows={3} value={form.copy_requirement} onChange={(e) => setField("copy_requirement", e.target.value)} />

                  <div>
                    <span>?????? <span style={{ color: "#dc2626" }}>*</span>?</span>
                    {["????", "??", "??", "????"].map((v) => (
                      <label key={v} style={{ marginLeft: 8 }}>
                        <input type="checkbox" checked={form.must_elements.includes(v)} onChange={() => toggleMustElement(v)} /> {v}
                      </label>
                    ))}
                  </div>

                  <label htmlFor="forbidden_content">????</label>
                  <textarea id="forbidden_content" rows={3} value={form.forbidden_content} onChange={(e) => setField("forbidden_content", e.target.value)} />
                </div>
              </section>

              <section style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
                <h4 style={{ marginTop: 0 }}>3. ?????</h4>
                <div style={{ display: "grid", gap: 8 }}>
                  <label htmlFor="provide_sample">??????</label>
                  <select id="provide_sample" value={form.provide_sample} onChange={(e) => setField("provide_sample", e.target.value as "?" | "?")}>
                    <option value="?">?</option><option value="?">?</option>
                  </select>

                  {form.provide_sample === "?" ? (
                    <>
                      <label htmlFor="sample_count">???? <span style={{ color: "#dc2626" }}>*</span></label>
                      <input id="sample_count" type="number" min={1} value={form.sample_count} onChange={(e) => setField("sample_count", e.target.value)} />
                    </>
                  ) : null}

                  <label htmlFor="sample_recycle">??????</label>
                  <select id="sample_recycle" value={form.sample_recycle} onChange={(e) => setField("sample_recycle", e.target.value as "?" | "?")}>
                    <option value="?">?</option><option value="?">?</option>
                  </select>

                  <label htmlFor="freight_side">????</label>
                  <select id="freight_side" value={form.freight_side} onChange={(e) => setField("freight_side", e.target.value as "????" | "????")}>
                    <option value="????">????</option><option value="????">????</option>
                  </select>
                </div>
              </section>

              <section style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
                <h4 style={{ marginTop: 0 }}>4. ????</h4>
                <div style={{ display: "grid", gap: 8 }}>
                  <label><input type="checkbox" checked={form.standard_publish_on_time} onChange={(e) => setField("standard_publish_on_time", e.target.checked)} /> ????????</label>
                  <label><input type="checkbox" checked={form.standard_clear_no_violation} onChange={(e) => setField("standard_clear_no_violation", e.target.checked)} /> ??????????</label>

                  <label htmlFor="keep_days">?????? <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="keep_days" type="number" min={1} value={form.keep_days} onChange={(e) => setField("keep_days", e.target.value)} />

                  <label htmlFor="revise_times">??????</label>
                  <input id="revise_times" type="number" min={0} value={form.revise_times} onChange={(e) => setField("revise_times", e.target.value)} />

                  <label htmlFor="unqualified_action">?????</label>
                  <select id="unqualified_action" value={form.unqualified_action} onChange={(e) => setField("unqualified_action", e.target.value as MatchingFormState["unqualified_action"])}>
                    <option value="????">????</option><option value="????">????</option><option value="????">????</option>
                  </select>
                </div>
              </section>

              <section style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
                <h4 style={{ marginTop: 0 }}>5. ?????</h4>
                <div style={{ display: "grid", gap: 8 }}>
                  <label><input type="checkbox" checked={form.rights_granted} onChange={(e) => setField("rights_granted", e.target.checked)} /> ?????????????????</label>
                  <label><input type="checkbox" checked={form.no_cheat} onChange={(e) => setField("no_cheat", e.target.checked)} /> ???????????</label>

                  <label htmlFor="violation_action">??????</label>
                  <select id="violation_action" value={form.violation_action} onChange={(e) => setField("violation_action", e.target.value as MatchingFormState["violation_action"])}>
                    <option value="???????">???????</option><option value="????">????</option><option value="??">??</option>
                  </select>

                  <label htmlFor="unit_commission">???? <span style={{ color: "#dc2626" }}>*</span></label>
                  <input id="unit_commission" type="number" min={1} value={form.unit_commission} onChange={(e) => setField("unit_commission", e.target.value)} />
                </div>
              </section>

              <section style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
                <h4 style={{ marginTop: 0 }}>????</h4>
                <input type="file" multiple accept="image/*,video/*" onChange={(e) => setUploadFiles(Array.from(e.target.files || []))} />
                <div style={{ marginTop: 8 }}>
                  <button type="button" onClick={() => void doUpload()} disabled={uploading}>{uploading ? "???..." : "????"}</button>
                </div>

                {previews.length > 0 ? (
                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    {previews.map((url) => (
                      <div key={url} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 8 }}>
                        <div style={{ marginBottom: 6 }}><a href={url} target="_blank" rel="noreferrer">????</a></div>
                        {isImageUrl(url) ? <img src={url} alt="attachment" style={{ maxWidth: 240, maxHeight: 160, borderRadius: 6 }} /> : null}
                        {isVideoUrl(url) ? <video src={url} controls style={{ maxWidth: 320, maxHeight: 180, borderRadius: 6 }} /> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>

              <button type="submit" disabled={publishing || !merchantTemplateComplete} style={{ height: 42, fontWeight: 700 }}>
                {publishing ? "???..." : "????"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
