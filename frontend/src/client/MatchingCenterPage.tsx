import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  createMatchingOrder,
  getClientMemberProfile,
  purchaseClientMember,
  topupClientDeposit,
  uploadMatchingOrderAssets,
} from "../clientApi";

/** 商家端撮合中心：仅保留发布撮合免积分订单。 */
export default function MatchingCenterPage() {
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [form, setForm] = useState<any>({
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

  /** 页面初始化读取会员与保证金信息。 */
  const loadProfile = async () => {
    try {
      const p = await getClientMemberProfile();
      setProfile(p?.profile || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  };

  useEffect(() => {
    void loadProfile();
  }, []);

  /** 购买会员。 */
  const buy = async (level: 1 | 2 | 3) => {
    setError(null);
    setMsg("");
    try {
      await purchaseClientMember(level, 1);
      await loadProfile();
      setMsg("会员开通成功");
    } catch (err) {
      setError(err instanceof Error ? err.message : "购买失败");
    }
  };

  /** 充值保证金。 */
  const topup = async () => {
    setError(null);
    setMsg("");
    try {
      await topupClientDeposit(1000);
      await loadProfile();
      setMsg("保证金充值成功");
    } catch (err) {
      setError(err instanceof Error ? err.message : "充值失败");
    }
  };

  /** 勾选元素变更。 */
  const toggleElement = (value: string) => {
    setForm((f: any) => {
      const set = new Set<string>(f.required_elements || []);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      return { ...f, required_elements: Array.from(set) };
    });
  };

  /** 上传图片/短视频到服务器磁盘。 */
  const doUpload = async () => {
    if (!uploadFiles.length) {
      setError("请先选择文件");
      return;
    }
    setUploading(true);
    setError(null);
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
      <h2 style={{ marginTop: 0 }}>撮合中心</h2>
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      {msg && <p style={{ color: "#166534" }}>{msg}</p>}
      <p>会员等级：{profile?.member_level ?? 0} ｜ 到期：{profile?.member_expire_time || "-"}</p>
      <p>保证金：{profile?.deposit_amount ?? 0} ｜ 已冻结：{profile?.deposit_frozen ?? 0}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button type="button" onClick={() => void buy(1)}>开通基础会员</button>
        <button type="button" onClick={() => void buy(2)}>开通高级会员</button>
        <button type="button" onClick={() => void buy(3)}>开通旗舰会员</button>
        <button type="button" onClick={() => void topup()}>充值保证金 +1000</button>
      </div>

      <form onSubmit={onCreate} style={{ display: "grid", gap: 10 }}>
        <h3>任务基础信息</h3>
        <input value={form.task_name} onChange={(e) => setForm((f: any) => ({ ...f, task_name: e.target.value }))} placeholder="任务名称" required />
        <select value={form.task_type} onChange={(e) => setForm((f: any) => ({ ...f, task_type: e.target.value }))}>
          <option>短视频</option><option>图文</option><option>直播</option><option>探店</option>
        </select>
        <select value={form.industry} onChange={(e) => setForm((f: any) => ({ ...f, industry: e.target.value }))}>
          <option>美妆</option><option>服饰</option><option>美食</option><option>家居</option><option>其他</option>
        </select>
        <input type="number" min={1} value={form.recruit_count} onChange={(e) => setForm((f: any) => ({ ...f, recruit_count: e.target.value }))} placeholder="招募达人数量" />
        <input type="date" value={form.start_date} onChange={(e) => setForm((f: any) => ({ ...f, start_date: e.target.value }))} />
        <input type="date" value={form.apply_deadline} onChange={(e) => setForm((f: any) => ({ ...f, apply_deadline: e.target.value }))} />
        <input type="date" value={form.publish_deadline} onChange={(e) => setForm((f: any) => ({ ...f, publish_deadline: e.target.value }))} />

        <h3>合作内容要求</h3>
        <input value={form.brand_name} onChange={(e) => setForm((f: any) => ({ ...f, brand_name: e.target.value }))} placeholder="推广产品/品牌名称" />
        <textarea value={form.core_selling_points} onChange={(e) => setForm((f: any) => ({ ...f, core_selling_points: e.target.value }))} placeholder="产品核心卖点（必填）" required />
        <select value={form.content_format} onChange={(e) => setForm((f: any) => ({ ...f, content_format: e.target.value }))}>
          <option>短视频</option><option>图文笔记</option><option>直播</option>
        </select>
        <input value={form.video_duration} onChange={(e) => setForm((f: any) => ({ ...f, video_duration: e.target.value }))} placeholder="视频时长要求" />
        <textarea value={form.copy_requirement} onChange={(e) => setForm((f: any) => ({ ...f, copy_requirement: e.target.value }))} placeholder="文案/标题要求" />
        <div>
          必须包含元素：
          {['产品出镜', '口播', '字幕', '话题标签'].map((v) => (
            <label key={v} style={{ marginLeft: 8 }}><input type="checkbox" checked={(form.required_elements || []).includes(v)} onChange={() => toggleElement(v)} /> {v}</label>
          ))}
        </div>
        <textarea value={form.forbidden_content} onChange={(e) => setForm((f: any) => ({ ...f, forbidden_content: e.target.value }))} placeholder="禁止内容" />

        <h3>样品与发货</h3>
        <select value={form.provide_sample} onChange={(e) => setForm((f: any) => ({ ...f, provide_sample: e.target.value }))}><option>是</option><option>否</option></select>
        <input type="number" min={0} value={form.sample_count} onChange={(e) => setForm((f: any) => ({ ...f, sample_count: e.target.value }))} placeholder="样品数量" />
        <select value={form.sample_recycle} onChange={(e) => setForm((f: any) => ({ ...f, sample_recycle: e.target.value }))}><option>是</option><option>否</option></select>
        <select value={form.freight_bearer} onChange={(e) => setForm((f: any) => ({ ...f, freight_bearer: e.target.value }))}><option>商家承担</option><option>达人承担</option></select>

        <h3>验收标准</h3>
        <label><input type="checkbox" checked={!!form.must_publish_on_time} onChange={(e) => setForm((f: any) => ({ ...f, must_publish_on_time: e.target.checked }))} /> 内容必须按时发布</label>
        <label><input type="checkbox" checked={!!form.quality_requirements} onChange={(e) => setForm((f: any) => ({ ...f, quality_requirements: e.target.checked }))} /> 画面清晰、无水印、无违规</label>
        <input type="number" min={0} value={form.keep_days} onChange={(e) => setForm((f: any) => ({ ...f, keep_days: e.target.value }))} placeholder="必须保留内容不少于 X 天" />
        <input type="number" min={0} value={form.revise_times} onChange={(e) => setForm((f: any) => ({ ...f, revise_times: e.target.value }))} placeholder="允许修改次数" />
        <select value={form.fail_handle} onChange={(e) => setForm((f: any) => ({ ...f, fail_handle: e.target.value }))}><option>驳回修改</option><option>取消合作</option><option>扣除佣金</option></select>

        <h3>版权与规则</h3>
        <label><input type="checkbox" checked={!!form.copyright_use} onChange={(e) => setForm((f: any) => ({ ...f, copyright_use: e.target.checked }))} /> 商家拥有作品使用权、剪辑权、宣传使用权</label>
        <label><input type="checkbox" checked={!!form.anti_cheat} onChange={(e) => setForm((f: any) => ({ ...f, anti_cheat: e.target.checked }))} /> 达人不得抄袭、搬运、刷数据</label>
        <select value={form.violation_handle} onChange={(e) => setForm((f: any) => ({ ...f, violation_handle: e.target.value }))}><option>取消佣金并拉黑</option><option>取消合作</option><option>警告</option></select>

        <h3>发布设置</h3>
        <input value={form.task_amount} onChange={(e) => setForm((f: any) => ({ ...f, task_amount: e.target.value }))} placeholder="任务金额" required />
        <textarea value={form.cooperation_requirement} onChange={(e) => setForm((f: any) => ({ ...f, cooperation_requirement: e.target.value }))} placeholder="合作要求" />
        <label><input type="checkbox" checked={!!form.allow_apply} onChange={(e) => setForm((f: any) => ({ ...f, allow_apply: e.target.checked }))} /> 允许任务大厅报名</label>

        <h3>上传图片/短视频</h3>
        <input type="file" multiple accept="image/*,video/*" onChange={(e) => setUploadFiles(Array.from(e.target.files || []))} />
        <button type="button" onClick={() => void doUpload()} disabled={uploading}>{uploading ? "上传中..." : "上传文件"}</button>
        {previews.length > 0 && (
          <div style={{ display: "grid", gap: 6 }}>
            {previews.map((url) => (
              <div key={url}><a href={url} target="_blank" rel="noreferrer">查看文件</a></div>
            ))}
          </div>
        )}

        <button type="submit">发布撮合免积分订单</button>
      </form>
    </div>
  );
}
