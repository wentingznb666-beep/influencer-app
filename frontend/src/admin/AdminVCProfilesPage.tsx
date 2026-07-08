import { useTranslation } from 'react-i18next';
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchWithAuth } from "../fetchWithAuth";

const CATEGORIES = [
  { th: "ความงาม", zh: "美妆类" },{ th: "รีวิวทั่วไป", zh: "测评类" },{ th: "ไลฟ์สไตล์", zh: "生活类" },
  { th: "แฟชั่น", zh: "时尚类" },{ th: "อาหาร", zh: "美食类" },{ th: "อิเล็กเทอร์นิกส์", zh: "3C 类" },
  { th: "ของใช้ทั่วไป", zh: "日用品类" },{ th: "แม่และเด็ก", zh: "母婴" },{ th: "อาหารเสริม", zh: "健康保健品" },
  { th: "สายสุขภาพ", zh: "健康" },{ th: "เฟอร์นิเจอร์", zh: "家具类" },{ th: "กีฬาและกิจกรรมกลางแจ้ง", zh: "运动户外类" },
  { th: "มอเตอร์และยานยนต์", zh: "汽摩" },{ th: "กางเกงยีนส์", zh: "牛仔裤" },{ th: "กระเป๋า", zh: "包包" },
  { th: "เสื้อผ้า", zh: "衣服" },{ th: "ชุดนอน", zh: "睡衣" },{ th: "กางเกงใน", zh: "内衣" },
  { th: "เครื่องใช้ไฟฟ้า", zh: "家电" },{ th: "พัดลมพกพา", zh: "便携风扇" },{ th: "Power Bank", zh: "电宝" },
  { th: "แคมป์ปิ้ง", zh: "露营" },{ th: "กระเป๋าสตาง", zh: "钱包" },{ th: "รองเท้า", zh: "鞋子" },
  { th: "สินค้าสาวอวบ", zh: "微胖女生" },{ th: "กางเกงผู้ชาย", zh: "男士裤子" },{ th: "อุปกรณ์เสริมมือถือ", zh: "手机配件" },
  { th: "หูฟัง", zh: "耳机" },{ th: "ลำโพง", zh: "音箱" },{ th: "วัสดุตกแต่ง/ปรับปรุงบ้าน", zh: "家装建材" },
  { th: "การเกษตร", zh: "农业品类" },{ th: "ชุดว่ายน้ำ", zh: "泳衣" },
];

type Profile = any;

export default function AdminVCProfilesPage() {
  const { t, i18n } = useTranslation();
  const isTh = (i18n.language || "").startsWith("th");
  const nav = useNavigate();
  const [list, setList] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [form, setForm] = useState<Partial<Profile>>({});
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState({ category: "", grade: "", source: "", q: "" });

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const toggleSelect = (id: number) => setSelected(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});
  const toggleAll = () => { if(selected.size===list.length&&list.length>0) setSelected(new Set()); else setSelected(new Set(list.map((p:any)=>p.id))); };
  const [batchGrade, setBatchGrade] = useState("");

  const batchSetGrade = async () => {
    if(!batchGrade||selected.size===0) return;
    if(!confirm(`确认将 ${selected.size} 位达人等级设为 ${batchGrade}？`)) return;
    try {
      await fetchWithAuth("/api/admin/influencer-profiles/batch-grade", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({profile_ids:[...selected],grade:batchGrade})});
      showToast("success",`已更新 ${selected.size} 位达人等级`);
      setSelected(new Set()); setBatchGrade(""); load();
    } catch(e:any) { showToast("error",e.message||"操作失败"); }
  };

  const batchDelete = async () => {
    if(selected.size===0) return;
    if(!confirm(`确认删除选中的 ${selected.size} 位达人？`)) return;
    let ok=0,fail=0;
    for(const id of selected) { try{await fetchWithAuth(`/api/admin/influencer-profiles/${id}`,{method:"DELETE"});ok++;}catch{fail++;} }
    showToast(fail===0?"success":"error",fail===0?`已删除 ${ok} 位达人`:`成功 ${ok} 条，失败 ${fail} 条`);
    setSelected(new Set()); load();
  };
  const pageSize = 20;

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.category) params.set("category", filter.category);
      if (filter.grade==="ungraded") params.set("grade",""); else if (filter.grade) params.set("grade", filter.grade);
      if (filter.source) params.set("source", filter.source);
      if (filter.q) params.set("q", filter.q);
      params.set("limit", String(pageSize));
      params.set("offset", String((page-1)*pageSize));
      const res = await fetchWithAuth(`/api/admin/influencer-profiles?${params}`);
      const data = await res.json();
      setList(data.list || []);
      setTotal(data.total || 0);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page]);

  const [showErrors, setShowErrors] = useState<string[]>([]);

  const validate = (data: any): string[] => {
    const e: string[] = [];
    const required = ["influencer_code","source","followers","category","quoted_price","cooperation_conditions","gmv_sales","monthly_cart_videos","units_sold","live_sales","weekly_live_count","avg_live_hours_per_week","contact_info"];
    const labels: Record<string,string> = {influencer_code:"达人编号",source:"达人来源",followers:"达人粉丝",category:"类目",quoted_price:"报价",cooperation_conditions:"合作条件",gmv_sales:"GMV 销售额",monthly_cart_videos:"每月挂车视频",units_sold:"销售件数",live_sales:"直播销售额",weekly_live_count:"每周直播次数",avg_live_hours_per_week:"平均直播时长",contact_info:"联系方式"};
    for (const f of required) { if (!data[f] || String(data[f]).trim()==="") e.push(`${labels[f]||f} 不能为空`); }
    return e;
  };

  const save = async () => {
    const errors = validate(form);
    if (errors.length > 0) { setShowErrors(errors); return; }
    setShowErrors([]); setSaving(true);
    try {
      const body = { ...form };
      if (editing?.id) {
        await fetchWithAuth(`/api/admin/influencer-profiles/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        await fetchWithAuth("/api/admin/influencer-profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      setEditing(null); setForm({}); load();
      showToast("success", editing?.id ? "保存成功" : "新增成功");
    } catch (e: any) { showToast("error", e.message||"保存失败"); }
    finally { setSaving(false); }
  };

  const startNew = () => { setEditing({ id: 0 } as any); setForm({ source: "contact_us", category: CATEGORIES[0].th, status: "active" }); };
  const [toast, setToast] = useState<{type:"success"|"error",msg:string}|null>(null);
  const showToast = (type: "success"|"error", msg: string) => { setToast({type,msg}); setTimeout(()=>setToast(null),3000); };

  const del = async (id: number) => { if (!confirm("确认删除该达人？")) return; try { await fetchWithAuth(`/api/admin/influencer-profiles/${id}`, { method: "DELETE" }); showToast("success","删除成功"); load(); } catch(e:any) { showToast("error",e.message||"删除失败"); } };
  const autoGrade = async () => { try { const r = await fetchWithAuth("/api/admin/influencer-profiles/auto-grade"); const d = await r.json(); showToast("success", `等级已重新计算 (${d.updated||0}条)`); load(); } catch(e:any) { showToast("error", e.message||"重新计算失败"); } };

  const i = (f: string, p?: string) => <input value={String(form[f] || "")} onChange={e => setForm(ff => ({ ...ff, [f]: e.target.value }))} placeholder={p || f} style={si} />;
  const sel = (f: string, o: string[]) => <select value={String(form[f] || "")} onChange={e => setForm(ff => ({ ...ff, [f]: e.target.value }))} style={si}>{o.map(v => <option key={v} value={v}>{v}</option>)}</select>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <button onClick={() => nav("/admin/vertical-connections")} style={sb}>← 返回概览</button>
        <h2 style={{ margin: 0 }}>{t("达人资料管理")}</h2>
      </div>
      {error && <p style={{ color: "#c00" }}>{error}</p>}
      {toast && (
        <div style={{position:"fixed",top:20,right:20,background:toast.type==="success"?"#166534":"#b91c1c",color:"#fff",padding:"12px 20px",borderRadius:8,zIndex:2000,fontWeight:700,boxShadow:"0 4px 12px rgba(0,0,0,0.2)"}}>
          {toast.type==="success"?"✅":"❌"} {toast.msg}
          <button onClick={()=>setToast(null)} style={{marginLeft:12,background:"none",border:"none",color:"#fff",cursor:"pointer",fontWeight:700}}>×</button>
        </div>
      )}
      {showErrors.length > 0 && (
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}} onClick={()=>setShowErrors([])}>
          <div style={{background:"#fff",borderRadius:12,padding:24,maxWidth:450,width:"90%"}} onClick={e=>e.stopPropagation()}>
            <h3 style={{color:"#b91c1c",marginTop:0}}>请完善以下信息</h3>
            <ul style={{color:"#475569",fontSize:14,lineHeight:2.2}}>{showErrors.map((e,i)=><li key={i}>· {e}</li>)}</ul>
            <button onClick={()=>setShowErrors([])} style={{padding:"8px 20px",border:"1px solid #dbe1ea",borderRadius:8,background:"#fff",cursor:"pointer",marginTop:8}}>关闭</button>
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input placeholder={t("搜索编号/粉丝")} value={filter.q} onChange={e => setFilter(f => ({ ...f, q: e.target.value }))} style={si} />
        <select value={filter.category} onChange={e => setFilter(f => ({ ...f, category: e.target.value }))} style={si}>
          <option value="">全部类目</option>{CATEGORIES.map(c => <option key={c.th} value={c.th}>{isTh ? c.th : c.zh}</option>)}
        </select>
        <select value={filter.grade} onChange={e => setFilter(f => ({ ...f, grade: e.target.value }))} style={si}>
          <option value="">全部等级</option><option value="ungraded">{t("未达标")}</option>{["A+","B+","C+","A","B","C"].map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <button onClick={load} style={sb}>{t("搜索")}</button>
        <button onClick={startNew} style={sp}>{t("新增达人")}</button>
        <button onClick={autoGrade} style={sb}>{t("重新计算全部等级")}</button>
        {selected.size > 0 && (
          <div style={{display:"flex",gap:6,alignItems:"center",background:"#fef3c7",padding:"4px 12px",borderRadius:8}}>
            <span style={{fontSize:12,fontWeight:700}}>已选 {selected.size} 个</span>
            <select value={batchGrade} onChange={e=>setBatchGrade(e.target.value)} style={{padding:"4px 8px",border:"1px solid #dbe1ea",borderRadius:4,fontSize:12}}>
              <option value="">-- 等级 --</option>
              {["A+","B+","C+","A","B","C"].map(g=><option key={g} value={g}>{g}</option>)}
            </select>
            <button onClick={batchSetGrade} disabled={!batchGrade} style={{padding:"4px 10px",border:"none",borderRadius:4,background:batchGrade?"var(--xt-accent)":"#94a3b8",color:"#fff",cursor:batchGrade?"pointer":"not-allowed",fontSize:12}}>批量设等级</button>
            <button onClick={batchDelete} style={{padding:"4px 10px",border:"1px solid #fecaca",borderRadius:4,background:"#fff",color:"#b91c1c",cursor:"pointer",fontSize:12}}>批量删除</button>
            <button onClick={()=>setSelected(new Set())} style={{padding:"4px 10px",border:"1px solid #dbe1ea",borderRadius:4,background:"#fff",cursor:"pointer",fontSize:12}}>取消</button>
          </div>
        )}
      </div>
      {editing !== null && (
        <div style={{ background: "#fff", padding: 16, borderRadius: 12, marginBottom: 12, border: "1px solid #e2e8f0" }}>
          <h3>{editing?.id ? `${t("编辑")} #${editing.id}` : t("新增达人")}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
            <label>{t("达人编号")}*</label>{i("influencer_code")}
            <label>{t("来源")}*</label>{sel("source", ["contact_us","contact_them"])}
            <label>{t("粉丝")}</label>{i("followers")}
            <label>{t("类目")}*</label>{sel("category", CATEGORIES.map(c => c.th))}
            <label>{t("等级")}</label>{sel("grade", ["A+","B+","C+","A","B","C"])}
            <label style={{color:"#b91c1c"}}>{t("报价")} *</label><input type="number" value={String(form.quoted_price || "")} onChange={e => setForm(f => ({ ...f, quoted_price: e.target.value }))} style={si} placeholder="THB，大于0" />
            <label style={{color:"#b91c1c"}}>{t("合作条件")} *</label><textarea value={String(form.cooperation_conditions || "")} onChange={e => setForm(f => ({ ...f, cooperation_conditions: e.target.value }))} style={si} rows={2} placeholder="填写合作要求和条件说明" />
            <label>{t("GMV销售额")}</label>{i("gmv_sales")}
            <label>{t("每月挂车视频")}</label>{i("monthly_cart_videos")}
            <label>{t("销售件数")}</label>{i("units_sold")}
            <label>{t("可直播")}</label><input type="checkbox" checked={!!form.can_live} onChange={e => setForm(f => ({ ...f, can_live: e.target.checked }))} />
            <label>{t("直播销售额")}</label>{i("live_sales")}
            <label>{t("每周直播次数")}</label>{i("weekly_live_count")}
            <label>{t("平均直播时长")}</label>{i("avg_live_hours_per_week")}
            <label>{t("备注")}</label><textarea value={String(form.remark || "")} onChange={e => setForm(f => ({ ...f, remark: e.target.value }))} style={si} rows={2} />
            <label style={{color:"#b91c1c"}}>{t("联系方式")} *</label><textarea value={String(form.contact_info || "")} onChange={e => setForm(f => ({ ...f, contact_info: e.target.value }))} style={si} rows={2} />
            <label>{t("收款方式")}</label><textarea value={String(form.payment_info || "")} onChange={e => setForm(f => ({ ...f, payment_info: e.target.value }))} style={si} rows={2} />
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <button onClick={save} disabled={saving} style={sp}>{saving ? t("保存中...") : t("保存")}</button>
            <button onClick={() => setEditing(null)} style={sb}>{t("取消")}</button>
          </div>
        </div>
      )}
      {loading ? <p style={{color:"#64748b",textAlign:"center",padding:40}}>加载中...</p> : list.length===0 ? <p style={{color:"#64748b",textAlign:"center",padding:40}}>暂无达人资料</p> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", fontSize: 12 }}>
            <thead><tr style={{ background: "#f8fafc" }}>
                <th style={{padding:"6px 4px",width:30}}><input type="checkbox" checked={selected.size===list.length&&list.length>0} onChange={toggleAll} style={{width:14,height:14}} /></th>
                {["ID","编号","来源","粉丝","类目","等级","报价","合作条件","GMV","挂车","件数","直播","直播销售","类型","状态","操作"].map(h => <th key={h} style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #e2e8f0", fontWeight: 700, whiteSpace: "nowrap" }}>{t(h)}</th>)}
              </tr></thead>
            <tbody>
              {list.map((p: any) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{padding:"6px 4px"}}><input type="checkbox" checked={selected.has(p.id)} onChange={()=>toggleSelect(p.id)} style={{width:14,height:14}} /></td><td style={{ padding: "6px 8px", fontSize: 12 }}>{p.id}</td><td style={{ padding: "6px 8px", fontSize: 12 }}>{p.influencer_code}</td><td style={{ padding: "6px 8px", fontSize: 12 }}>{p.source==="contact_us"?t("我方联系"):t("达人联系")}</td><td style={{ padding: "6px 8px", fontSize: 12 }}>{p.followers||"-"}</td><td style={{ padding: "6px 8px", fontSize: 12 }}>{p.category}</td><td style={{ padding: "6px 8px", fontSize: 12 }}>{p.grade||t("未达标")}</td>
                  <td style={{ padding: "6px 8px", fontSize: 12, fontWeight: 700, color: "var(--xt-accent)" }}>{p.quoted_price ? `${p.quoted_price} THB` : "-"}</td>
                  <td style={{ padding: "6px 8px", fontSize: 12, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.cooperation_conditions||""}>{p.cooperation_conditions||"-"}</td>
                  <td style={{ padding: "6px 8px", fontSize: 12 }}>{p.gmv_sales||"-"}</td><td style={{ padding: "6px 8px", fontSize: 12 }}>{p.monthly_cart_videos||"-"}</td><td style={{ padding: "6px 8px", fontSize: 12 }}>{p.units_sold||"-"}</td><td style={{ padding: "6px 8px", fontSize: 12 }}>{p.can_live?t("是"):t("否")}</td><td style={{ padding: "6px 8px", fontSize: 12 }}>{p.live_sales||"-"}</td><td style={{ padding: "6px 8px", fontSize: 12 }}>{p.user_id ? <span style={{background:"#dbeafe",color:"#1d4ed8",padding:"1px 8px",borderRadius:999,fontSize:11,fontWeight:600}}>👤 自主</span> : <span style={{background:"#f1f5f9",color:"#64748b",padding:"1px 8px",borderRadius:999,fontSize:11,fontWeight:600}}>🛠 托管</span>}</td>
                  <td style={{ padding: "6px 8px", fontSize: 12 }}>{p.status}</td>
                  <td style={{ padding: "6px 8px", fontSize: 12 }}>
                    <button onClick={() => { setEditing(p); setForm({...p}); }} style={ssm}>{t("编辑")}</button>
                    <button onClick={() => del(p.id)} style={{ ...ssm, color: "#b91c1c", marginLeft: 4 }}>{t("删除")}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Pagination + Export */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12,flexWrap:"wrap",gap:8}}>
            <div style={{fontSize:12,color:"#64748b"}}>共 {total} 条，第 {page}/{Math.max(1,Math.ceil(total/pageSize))} 页</div>
            <div style={{display:"flex",gap:4}}>
              <button onClick={()=>setPage(1)} disabled={page<=1} style={pageBtn}>首页</button>
              <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1} style={pageBtn}>上一页</button>
              <button onClick={()=>setPage(p=>Math.min(Math.ceil(total/pageSize),p+1))} disabled={page>=Math.ceil(total/pageSize)} style={pageBtn}>下一页</button>
              <button onClick={()=>{const h=["ID","编号","来源","粉丝","类目","等级","GMV","挂车","件数","直播","直播销售","状态"];const rows=list.map((p:any)=>[p.id,p.influencer_code,p.source,p.followers||"",p.category,p.grade||"",p.gmv_sales||"",p.monthly_cart_videos||"",p.units_sold||"",p.can_live?"是":"否",p.quoted_price||"",(p.cooperation_conditions||"").replace(/,/g,"，"),p.live_sales||"",p.status].join(","));const csv="﻿"+h.join(",")+"\n"+rows.join("\n");const b=new Blob([csv],{type:"text/csv"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="profiles.csv";a.click();}} style={{...pageBtn,background:"#1d4ed8",color:"#fff",border:"none",fontWeight:700}}>导出CSV</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
const si: React.CSSProperties = { padding: "6px 8px", border: "1px solid #dbe1ea", borderRadius: 8, width: "100%", boxSizing: "border-box" };
const sb: React.CSSProperties = { padding: "6px 12px", border: "1px solid #dbe1ea", borderRadius: 8, background: "#fff", cursor: "pointer" };
const sp: React.CSSProperties = { padding: "6px 12px", border: "none", borderRadius: 8, background: "var(--xt-accent)", color: "#fff", cursor: "pointer" };
const ssm: React.CSSProperties = { padding: "4px 8px", border: "1px solid #dbe1ea", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 11 };
const pageBtn: React.CSSProperties = { padding: "4px 10px", border: "1px solid #dbe1ea", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 12 };
