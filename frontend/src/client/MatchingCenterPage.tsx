import { useMemo, useState, type FormEvent } from "react";
import { createMatchingOrder, uploadMatchingOrderAssets } from "../clientApi";

type MatchingFormState = {
  task_name: string;
  task_type: string;
  industry: string;
  recruit_count: number;
  start_date: string;
  apply_deadline: string;
  publish_deadline: string;
  brand_name: string;
  core_selling_points: string;
  content_format: string;
  video_duration: string;
  copy_requirement: string;
  required_elements: string[];
  forbidden_content: string;
  provide_sample: string;
  sample_count: number;
  sample_recycle: string;
  freight_bearer: string;
  must_publish_on_time: boolean;
  quality_requirements: boolean;
  keep_days: number;
  revise_times: number;
  fail_handle: string;
  copyright_use: boolean;
  anti_cheat: boolean;
  violation_handle: string;
  task_amount: string;
  cooperation_requirement: string;
  allow_apply: boolean;
};

/** 判断是否是图片 URL。 */
function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url);
}

/** 判断是否是视频 URL。 */
function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v|avi)(\?|$)/i.test(url);
}

/** 商家端撮合中心：仅发布撮合订单表单。 */
export default function MatchingCenterPage() {
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [form, setForm] = useState<MatchingFormState>({
    task_name: "",
    task_type: "短视频",
    industry: "美妆",
    recruit_count: 1,
    start_date: "",
    apply_deadline: "",
    publish_deadline: "",
    brand_name: "",
    core_selling_points: "",
    content_format: "短视频",
    video_duration: "",
    copy_requirement: "",
    required_elements: [],
    forbidden_content: "",
    provide_sample: "是",
    sample_count: 1,
    sample_recycle: "否",
    freight_bearer: "商家承担",
    must_publish_on_time: true,
    quality_requirements: true,
    keep_days: 30,
    revise_times: 2,
    fail_handle: "驳回修改",
    copyright_use: true,
    anti_cheat: true,
    violation_handle: "取消佣金并拉黑",
    task_amount: "",
    cooperation_requirement: "",
    allow_apply: true,
  });

  /** 字段通用更新器。 */
  const setField = <K extends keyof MatchingFormState>(key: K, value: MatchingFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /** 勾选元素变更。 */
  const toggleElement = (value: string) => {
    const set = new Set<string>(form.required_elements || []);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    setField("required_elements", Array.from(set));
  };

  /** 上传图片/短视频到服务器磁盘。 */
  const doUpload = async () => {
    if (!uploadFiles.length) {
      setError("请先选择文件 / Please choose files first");
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
      setMsg("上传成功 / Upload success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败 / Upload failed");
    } finally {
      setUploading(false);
    }
  };

  /** 提交撮合免积分订单。 */
  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMsg("");
    try {
      const detail = {
        basic_info: {
          task_name: form.task_name,
          task_type: form.task_type,
          industry: form.industry,
          recruit_count: Number(form.recruit_count || 0),
          start_date: form.start_date,
          apply_deadline: form.apply_deadline,
          publish_deadline: form.publish_deadline,
        },
        cooperation: {
          brand_name: form.brand_name,
          core_selling_points: form.core_selling_points,
          content_format: form.content_format,
          video_duration: form.video_duration,
          copy_requirement: form.copy_requirement,
          required_elements: form.required_elements,
          forbidden_content: form.forbidden_content,
        },
        sample_shipping: {
          provide_sample: form.provide_sample,
          sample_count: Number(form.sample_count || 0),
          sample_recycle: form.sample_recycle,
          freight_bearer: form.freight_bearer,
        },
        acceptance: {
          must_publish_on_time: !!form.must_publish_on_time,
          quality_requirements: !!form.quality_requirements,
          keep_days: Number(form.keep_days || 0),
          revise_times: Number(form.revise_times || 0),
          fail_handle: form.fail_handle,
        },
        rights: {
          copyright_use: !!form.copyright_use,
          anti_cheat: !!form.anti_cheat,
          violation_handle: form.violation_handle,
        },
      };
      await createMatchingOrder({
        title: form.task_name,
        task_amount: Number(form.task_amount),
        requirement: form.cooperation_requirement || form.core_selling_points,
        allow_apply: form.allow_apply,
        detail,
        attachments: uploadedUrls,
      });
      setMsg("发布成功 / Published");
      setUploadedUrls([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败 / Create failed");
    }
  };

  /** 上传预览列表。 */
  const previews = useMemo(() => uploadedUrls, [uploadedUrls]);

  return (
    <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 10px 24px rgba(15,23,42,0.08)" }}>
      <h2 style={{ marginTop: 0 }}>发布撮合免积分订单 / Publish Matching Order</h2>
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      {msg && <p style={{ color: "#166534" }}>{msg}</p>}

      <form onSubmit={onCreate} style={{ display: "grid", gap: 14 }}>
        <section style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>任务基础信息 / Basic Info</h3>
          <label htmlFor="task_name">任务名称 / Task Name</label>
          <input id="task_name" name="task_name" value={form.task_name} onChange={(e) => setField("task_name", e.target.value)} required />

          <label htmlFor="task_type">任务类型 / Task Type</label>
          <select id="task_type" name="task_type" value={form.task_type} onChange={(e) => setField("task_type", e.target.value)}>
            <option value="短视频">短视频</option><option value="图文">图文</option><option value="直播">直播</option><option value="探店">探店</option>
          </select>

          <label htmlFor="industry">所属行业 / Industry</label>
          <select id="industry" name="industry" value={form.industry} onChange={(e) => setField("industry", e.target.value)}>
            <option value="美妆">美妆</option><option value="服饰">服饰</option><option value="美食">美食</option><option value="家居">家居</option><option value="其他">其他</option>
          </select>

          <label htmlFor="recruit_count">招募达人数量 / Recruit Count</label>
          <input id="recruit_count" name="recruit_count" type="number" min={1} value={form.recruit_count} onChange={(e) => setField("recruit_count", Number(e.target.value || 1))} />

          <label htmlFor="start_date">任务开始时间 / Start Date</label>
          <input id="start_date" name="start_date" type="date" value={form.start_date} onChange={(e) => setField("start_date", e.target.value)} />

          <label htmlFor="apply_deadline">接单截止时间 / Apply Deadline</label>
          <input id="apply_deadline" name="apply_deadline" type="date" value={form.apply_deadline} onChange={(e) => setField("apply_deadline", e.target.value)} />

          <label htmlFor="publish_deadline">内容发布截止时间 / Publish Deadline</label>
          <input id="publish_deadline" name="publish_deadline" type="date" value={form.publish_deadline} onChange={(e) => setField("publish_deadline", e.target.value)} />
        </section>

        <section style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>合作内容要求 / Content Requirement</h3>
          <label htmlFor="brand_name">推广产品/品牌名称 / Brand Name</label>
          <input id="brand_name" name="brand_name" value={form.brand_name} onChange={(e) => setField("brand_name", e.target.value)} />

          <label htmlFor="core_selling_points">产品核心卖点（必填） / Core Selling Points</label>
          <textarea id="core_selling_points" name="core_selling_points" value={form.core_selling_points} onChange={(e) => setField("core_selling_points", e.target.value)} required />

          <label htmlFor="content_format">内容形式 / Content Format</label>
          <select id="content_format" name="content_format" value={form.content_format} onChange={(e) => setField("content_format", e.target.value)}>
            <option value="短视频">短视频</option><option value="图文笔记">图文笔记</option><option value="直播">直播</option>
          </select>

          <label htmlFor="video_duration">视频时长要求 / Video Duration</label>
          <input id="video_duration" name="video_duration" value={form.video_duration} onChange={(e) => setField("video_duration", e.target.value)} />

          <label htmlFor="copy_requirement">文案/标题要求 / Copy Requirement</label>
          <textarea id="copy_requirement" name="copy_requirement" value={form.copy_requirement} onChange={(e) => setField("copy_requirement", e.target.value)} />

          <div>
            <span>必须包含元素 / Required Elements：</span>
            {['产品出镜', '口播', '字幕', '话题标签'].map((v) => (
              <label key={v} style={{ marginLeft: 8 }}>
                <input type="checkbox" checked={(form.required_elements || []).includes(v)} onChange={() => toggleElement(v)} /> {v}
              </label>
            ))}
          </div>

          <label htmlFor="forbidden_content">禁止内容 / Forbidden Content</label>
          <textarea id="forbidden_content" name="forbidden_content" value={form.forbidden_content} onChange={(e) => setField("forbidden_content", e.target.value)} />
        </section>

        <section style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>样品与发货 / Samples & Shipping</h3>
          <label htmlFor="provide_sample">是否提供样品 / Provide Sample</label>
          <select id="provide_sample" name="provide_sample" value={form.provide_sample} onChange={(e) => setField("provide_sample", e.target.value)}><option value="是">是</option><option value="否">否</option></select>

          <label htmlFor="sample_count">样品数量 / Sample Count</label>
          <input id="sample_count" name="sample_count" type="number" min={0} value={form.sample_count} onChange={(e) => setField("sample_count", Number(e.target.value || 0))} />

          <label htmlFor="sample_recycle">样品是否回收 / Recycle Sample</label>
          <select id="sample_recycle" name="sample_recycle" value={form.sample_recycle} onChange={(e) => setField("sample_recycle", e.target.value)}><option value="是">是</option><option value="否">否</option></select>

          <label htmlFor="freight_bearer">运费承担 / Freight Bearer</label>
          <select id="freight_bearer" name="freight_bearer" value={form.freight_bearer} onChange={(e) => setField("freight_bearer", e.target.value)}><option value="商家承担">商家承担</option><option value="达人承担">达人承担</option></select>
        </section>

        <section style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>验收标准 / Acceptance Rules</h3>
          <label><input type="checkbox" checked={!!form.must_publish_on_time} onChange={(e) => setField("must_publish_on_time", e.target.checked)} /> 内容必须按时发布</label>
          <label><input type="checkbox" checked={!!form.quality_requirements} onChange={(e) => setField("quality_requirements", e.target.checked)} /> 画面清晰无水印无违规</label>

          <label htmlFor="keep_days">内容保留天数 / Keep Days</label>
          <input id="keep_days" name="keep_days" type="number" min={0} value={form.keep_days} onChange={(e) => setField("keep_days", Number(e.target.value || 0))} />

          <label htmlFor="revise_times">允许修改次数 / Revise Times</label>
          <input id="revise_times" name="revise_times" type="number" min={0} value={form.revise_times} onChange={(e) => setField("revise_times", Number(e.target.value || 0))} />

          <label htmlFor="fail_handle">未达标处理 / If Failed</label>
          <select id="fail_handle" name="fail_handle" value={form.fail_handle} onChange={(e) => setField("fail_handle", e.target.value)}><option value="驳回修改">驳回修改</option><option value="取消合作">取消合作</option><option value="扣除佣金">扣除佣金</option></select>
        </section>

        <section style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>版权与规则 / Rights & Rules</h3>
          <label><input type="checkbox" checked={!!form.copyright_use} onChange={(e) => setField("copyright_use", e.target.checked)} /> 商家拥有使用权、剪辑权、宣传使用权</label>
          <label><input type="checkbox" checked={!!form.anti_cheat} onChange={(e) => setField("anti_cheat", e.target.checked)} /> 达人不得抄袭搬运刷数据</label>

          <label htmlFor="violation_handle">违规行为处理 / Violation Handling</label>
          <select id="violation_handle" name="violation_handle" value={form.violation_handle} onChange={(e) => setField("violation_handle", e.target.value)}><option value="取消佣金并拉黑">取消佣金并拉黑</option><option value="取消合作">取消合作</option><option value="警告">警告</option></select>
        </section>

        <section style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>附件上传 / Attachments</h3>
          <input type="file" multiple accept="image/*,video/*" onChange={(e) => setUploadFiles(Array.from(e.target.files || []))} />
          <button type="button" onClick={() => void doUpload()} disabled={uploading}>{uploading ? "上传中..." : "上传文件"}</button>
          {previews.length > 0 && (
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              {previews.map((url) => (
                <div key={url} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 8 }}>
                  <div style={{ marginBottom: 6 }}><a href={url} target="_blank" rel="noreferrer">查看文件</a></div>
                  {isImageUrl(url) && <img src={url} alt="attachment" style={{ maxWidth: 240, maxHeight: 160, borderRadius: 6 }} />}
                  {isVideoUrl(url) && <video src={url} controls style={{ maxWidth: 320, maxHeight: 180, borderRadius: 6 }} />}
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>发布设置 / Publish</h3>
          <label htmlFor="task_amount">任务金额 / Task Amount</label>
          <input id="task_amount" name="task_amount" value={form.task_amount} onChange={(e) => setField("task_amount", e.target.value)} required />

          <label htmlFor="cooperation_requirement">合作要求 / Cooperation Requirement</label>
          <textarea id="cooperation_requirement" name="cooperation_requirement" value={form.cooperation_requirement} onChange={(e) => setField("cooperation_requirement", e.target.value)} />

          <label><input type="checkbox" checked={!!form.allow_apply} onChange={(e) => setField("allow_apply", e.target.checked)} /> 允许任务大厅报名</label>
        </section>

        <button type="submit" style={{ height: 42, fontWeight: 700 }}>发布撮合免积分订单</button>
      </form>
    </div>
  );
}
