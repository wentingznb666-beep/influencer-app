import { useMemo, useState, type FormEvent } from "react";
import { createMatchingOrder, uploadMatchingOrderAssets } from "../clientApi";

type MatchingFormState = {
  task_title: string;
  industry: string;
  recruit_count: number;
  deadline: string;
  follower_requirement: string;
  task_types: string[];
  product_selling_points: string;
  provide_sample: string;
  unit_commission: string;
  acceptance_requirement: string;
};

/** 判断是否是图片 URL。 */
function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url);
}

/** 判断是否是视频 URL。 */
function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v|avi)(\?|$)/i.test(url);
}

/** 商家端撮合中心：发布任务简洁表单。 */
export default function MatchingCenterPage() {
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [form, setForm] = useState<MatchingFormState>({
    task_title: "",
    industry: "美妆",
    recruit_count: 1,
    deadline: "",
    follower_requirement: "",
    task_types: ["短视频"],
    product_selling_points: "",
    provide_sample: "是",
    unit_commission: "",
    acceptance_requirement: "",
  });

  /** 字段通用更新器。 */
  const setField = <K extends keyof MatchingFormState>(key: K, value: MatchingFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /** 任务类型多选切换。 */
  const toggleTaskType = (value: string) => {
    const set = new Set(form.task_types);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    setField("task_types", Array.from(set));
  };

  /** 上传图片/短视频到服务器磁盘。 */
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

  /** 提交撮合任务。 */
  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMsg("");
    try {
      const detail = {
        task_title: form.task_title,
        industry: form.industry,
        recruit_count: form.recruit_count,
        deadline: form.deadline,
        follower_requirement: form.follower_requirement,
        task_types: form.task_types,
        product_selling_points: form.product_selling_points,
        provide_sample: form.provide_sample,
        unit_commission: form.unit_commission,
        acceptance_requirement: form.acceptance_requirement,
      };

      await createMatchingOrder({
        title: form.task_title,
        task_amount: Number(form.unit_commission),
        requirement: form.acceptance_requirement || form.product_selling_points,
        allow_apply: true,
        detail,
        attachments: uploadedUrls,
      });
      setMsg("发布成功");
      setUploadedUrls([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    }
  };

  /** 上传预览列表。 */
  const previews = useMemo(() => uploadedUrls, [uploadedUrls]);

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 10px 24px rgba(15,23,42,0.08)" }}>
      <h2 style={{ marginTop: 0 }}>发布撮合免积分订单</h2>
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      {msg && <p style={{ color: "#166534" }}>{msg}</p>}

      <form onSubmit={onCreate} style={{ display: "grid", gap: 12 }}>
        <label htmlFor="task_title">任务标题 <span style={{ color: "#dc2626" }}>*</span></label>
        <input id="task_title" name="task_title" value={form.task_title} onChange={(e) => setField("task_title", e.target.value)} required />

        <label htmlFor="industry">行业分类 <span style={{ color: "#dc2626" }}>*</span></label>
        <select id="industry" name="industry" value={form.industry} onChange={(e) => setField("industry", e.target.value)} required>
          <option value="美妆">美妆</option><option value="服饰">服饰</option><option value="美食">美食</option><option value="家居">家居</option><option value="其他">其他</option>
        </select>

        <label htmlFor="recruit_count">招募达人数量 <span style={{ color: "#dc2626" }}>*</span></label>
        <input id="recruit_count" name="recruit_count" type="number" min={1} value={form.recruit_count} onChange={(e) => setField("recruit_count", Number(e.target.value || 1))} required />

        <label htmlFor="deadline">任务截止时间 <span style={{ color: "#dc2626" }}>*</span></label>
        <input id="deadline" name="deadline" type="date" value={form.deadline} onChange={(e) => setField("deadline", e.target.value)} required />

        <label htmlFor="follower_requirement">达人粉丝要求 <span style={{ color: "#dc2626" }}>*</span></label>
        <input id="follower_requirement" name="follower_requirement" value={form.follower_requirement} onChange={(e) => setField("follower_requirement", e.target.value)} required />

        <div>
          <span>可接任务类型 <span style={{ color: "#dc2626" }}>*</span>：</span>
          {['短视频', '图文', '直播', '探店'].map((v) => (
            <label key={v} style={{ marginLeft: 8 }}>
              <input type="checkbox" checked={form.task_types.includes(v)} onChange={() => toggleTaskType(v)} /> {v}
            </label>
          ))}
        </div>

        <label htmlFor="product_selling_points">推广产品/卖点 <span style={{ color: "#dc2626" }}>*</span></label>
        <textarea id="product_selling_points" name="product_selling_points" value={form.product_selling_points} onChange={(e) => setField("product_selling_points", e.target.value)} rows={4} required />

        <label htmlFor="provide_sample">是否提供样品 <span style={{ color: "#dc2626" }}>*</span></label>
        <select id="provide_sample" name="provide_sample" value={form.provide_sample} onChange={(e) => setField("provide_sample", e.target.value)} required>
          <option value="是">是</option><option value="否">否</option>
        </select>

        <label htmlFor="unit_commission">单条佣金 <span style={{ color: "#dc2626" }}>*</span></label>
        <input id="unit_commission" name="unit_commission" type="number" min={1} value={form.unit_commission} onChange={(e) => setField("unit_commission", e.target.value)} required />

        <label htmlFor="acceptance_requirement">验收要求 <span style={{ color: "#dc2626" }}>*</span></label>
        <textarea id="acceptance_requirement" name="acceptance_requirement" value={form.acceptance_requirement} onChange={(e) => setField("acceptance_requirement", e.target.value)} rows={4} required />

        <h3 style={{ marginBottom: 0 }}>附件上传</h3>
        <input type="file" multiple accept="image/*,video/*" onChange={(e) => setUploadFiles(Array.from(e.target.files || []))} />
        <button type="button" onClick={() => void doUpload()} disabled={uploading}>{uploading ? "上传中..." : "上传文件"}</button>

        {previews.length > 0 && (
          <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
            {previews.map((url) => (
              <div key={url} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 8 }}>
                <div style={{ marginBottom: 6 }}><a href={url} target="_blank" rel="noreferrer">查看文件</a></div>
                {isImageUrl(url) && <img src={url} alt="attachment" style={{ maxWidth: 240, maxHeight: 160, borderRadius: 6 }} />}
                {isVideoUrl(url) && <video src={url} controls style={{ maxWidth: 320, maxHeight: 180, borderRadius: 6 }} />}
              </div>
            ))}
          </div>
        )}

        <button type="submit" style={{ height: 42, fontWeight: 700 }}>发布任务</button>
      </form>
    </div>
  );
}
