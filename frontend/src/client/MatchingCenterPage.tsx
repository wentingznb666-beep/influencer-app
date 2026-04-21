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
  recruit_count: string;
  product_name: string;
  selling_points: string;
  unit_commission: string;
};

const defaultForm: MatchingFormState = {
  task_name: "",
  recruit_count: "1",
  product_name: "",
  selling_points: "",
  unit_commission: "",
};

/** ???????? */
export default function MatchingCenterPage() {
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");
  const [publishing, setPublishing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [form, setForm] = useState<MatchingFormState>(defaultForm);
  const [merchantTemplate, setMerchantTemplate] = useState({ shop_name: "", product_type: "", shop_link: "", shop_rating: "", user_reviews: "" });
  const [templateSaving, setTemplateSaving] = useState(false);

  /** ????????? */
  const loadOrders = async () => {
    const ret = await getMatchingOrders();
    setOrders(Array.isArray(ret?.list) ? ret.list : []);
  };

  /** ????????? */
  const loadMerchantTemplate = async () => {
    const ret = await getClientMerchantInfoTemplate();
    const profile = ret?.profile || {};
    setMerchantTemplate({
      shop_name: String(profile.shop_name || ""),
      product_type: String(profile.product_type || ""),
      shop_link: String(profile.shop_link || ""),
      shop_rating: String(profile.shop_rating || ""),
      user_reviews: String(profile.user_reviews || ""),
    });
  };

  useEffect(() => {
    void Promise.all([loadOrders(), loadMerchantTemplate()]).catch((e) => setError(e instanceof Error ? e.message : "????"));
  }, []);

  const merchantTemplateComplete =
    merchantTemplate.shop_name.trim() && merchantTemplate.product_type.trim() && merchantTemplate.shop_link.trim() && merchantTemplate.shop_rating.trim() && merchantTemplate.user_reviews.trim();

  /** ????????? */
  const saveTemplate = async () => {
    if (!merchantTemplateComplete) {
      setError("???????????");
      return;
    }
    setTemplateSaving(true);
    try {
      await saveClientMerchantInfoTemplate({ ...merchantTemplate });
      setMsg("?????????");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "????";
      setError(msg.includes("MERCHANT_TEMPLATE_REQUIRED") ? "??????????????" : msg);
    } finally {
      setTemplateSaving(false);
    }
  };

  /** ????? */
  const doUpload = async () => {
    if (!uploadFiles.length) return;
    const ret = await uploadMatchingOrderAssets(uploadFiles);
    setUploadedUrls((prev) => [...prev, ...(Array.isArray(ret?.urls) ? ret.urls : [])]);
  };

  /** ??????? */
  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!merchantTemplateComplete) {
      setError("?????????????");
      return;
    }
    if (!form.task_name.trim() || !form.product_name.trim() || !form.selling_points.trim() || Number(form.unit_commission) <= 0) {
      setError("?????????");
      return;
    }
    setPublishing(true);
    try {
      await createMatchingOrder({
        title: form.task_name.trim(),
        task_amount: Number(form.unit_commission),
        requirement: form.selling_points.trim(),
        allow_apply: true,
        detail: {
          task_name: form.task_name.trim(),
          recruit_count: Number(form.recruit_count || 1),
          product_name: form.product_name.trim(),
          selling_points: form.selling_points.trim(),
        },
        attachments: uploadedUrls,
      });
      setShowModal(false);
      setForm(defaultForm);
      setUploadedUrls([]);
      await loadOrders();
      setMsg("????");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "????";
      setError(msg.includes("MERCHANT_TEMPLATE_REQUIRED") ? "??????????????" : msg);
    } finally {
      setPublishing(false);
    }
  };

  const previews = useMemo(() => uploadedUrls, [uploadedUrls]);

  return <div style={{ background: "#fff", borderRadius: 16, padding: 20 }}>
    <h2>????</h2>
    <button type="button" className="xt-accent-btn" onClick={() => setShowModal(true)}>??????</button>
    {showModal ? <div>
      <h3>????????</h3>
      <input value={merchantTemplate.shop_name} onChange={(e) => setMerchantTemplate((v) => ({ ...v, shop_name: e.target.value }))} placeholder="????" />
      <input value={merchantTemplate.product_type} onChange={(e) => setMerchantTemplate((v) => ({ ...v, product_type: e.target.value }))} placeholder="??????" />
      <input value={merchantTemplate.shop_link} onChange={(e) => setMerchantTemplate((v) => ({ ...v, shop_link: e.target.value }))} placeholder="????" />
      <input value={merchantTemplate.shop_rating} onChange={(e) => setMerchantTemplate((v) => ({ ...v, shop_rating: e.target.value }))} placeholder="????" />
      <textarea value={merchantTemplate.user_reviews} onChange={(e) => setMerchantTemplate((v) => ({ ...v, user_reviews: e.target.value }))} placeholder="????" />
      <button type="button" className="xt-accent-btn" onClick={() => void saveTemplate()} disabled={!merchantTemplateComplete || templateSaving}>{templateSaving ? "???..." : "????????"}</button>
      <form onSubmit={onCreate}>
        <input value={form.task_name} onChange={(e) => setForm((v) => ({ ...v, task_name: e.target.value }))} placeholder="????" />
        <input value={form.recruit_count} onChange={(e) => setForm((v) => ({ ...v, recruit_count: e.target.value }))} placeholder="????" />
        <input value={form.product_name} onChange={(e) => setForm((v) => ({ ...v, product_name: e.target.value }))} placeholder="????" />
        <textarea value={form.selling_points} onChange={(e) => setForm((v) => ({ ...v, selling_points: e.target.value }))} placeholder="????" />
        <input value={form.unit_commission} onChange={(e) => setForm((v) => ({ ...v, unit_commission: e.target.value }))} placeholder="??" />
        <input type="file" multiple onChange={(e) => setUploadFiles(Array.from(e.target.files || []))} />
        <button type="button" onClick={() => void doUpload()}>????</button>
        {previews.map((u) => <div key={u}><a href={u} target="_blank" rel="noreferrer">????</a></div>)}
        <button type="submit" className="xt-accent-btn" disabled={publishing || !merchantTemplateComplete}>{publishing ? "???..." : "????"}</button>
      </form>
    </div> : null}
    {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
    {msg ? <p style={{ color: "#166534" }}>{msg}</p> : null}
    {orders.map((it) => <div key={it.id}>{it.order_no}?{it.title}</div>)}
  </div>;
}
