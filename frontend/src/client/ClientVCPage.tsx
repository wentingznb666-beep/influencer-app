import { useNavigate } from "react-router-dom";
const CATEGORIES = [{'th': 'ความงาม', 'zh': '美妆类'}, {'th': 'รีวิวทั่วไป', 'zh': '测评类'}, {'th': 'ไลฟ์สไตล์', 'zh': '生活类'}, {'th': 'แฟชั่น', 'zh': '时尚类'}, {'th': 'อาหาร', 'zh': '美食类'}, {'th': 'อิเล็กเทอร์นิกส์', 'zh': '3C 类'}, {'th': 'ของใช้ทั่วไป', 'zh': '日用品类'}, {'th': 'แม่และเด็ก', 'zh': '母婴'}, {'th': 'อาหารเสริม', 'zh': '健康保健品'}, {'th': 'สายสุขภาพ', 'zh': '健康'}, {'th': 'เฟอร์นิเจอร์', 'zh': '家具类'}, {'th': 'กีฬาและกิจกรรมกลางแจ้ง', 'zh': '运动户外类'}, {'th': 'มอเตอร์และยานยนต์', 'zh': '汽摩'}, {'th': 'กางเกงยีนส์', 'zh': '牛仔裤'}, {'th': 'กระเป๋า', 'zh': '包包'}, {'th': 'เสื้อผ้า', 'zh': '衣服'}, {'th': 'ชุดนอน', 'zh': '睡衣'}, {'th': 'กางเกงใน', 'zh': '内衣'}, {'th': 'เครื่องใช้ไฟฟ้า', 'zh': '家电'}, {'th': 'พัดลมพกพา', 'zh': '便携风扇'}, {'th': 'Power Bank', 'zh': '电宝'}, {'th': 'แคมป์ปิ้ง', 'zh': '露营'}, {'th': 'กระเป๋าสตาง', 'zh': '钱包'}, {'th': 'รองเท้า', 'zh': '鞋子'}, {'th': 'สินค้าสาวอวบ', 'zh': '微胖女生'}, {'th': 'กางเกงผู้ชาย', 'zh': '男士裤子'}, {'th': 'อุปกรณ์เสริมมือถือ', 'zh': '手机配件'}, {'th': 'หูฟัง', 'zh': '耳机'}, {'th': 'ลำโพง', 'zh': '音箱'}, {'th': 'วัสดุตกแต่ง/ปรับปรุงบ้าน', 'zh': '家装建材'}, {'th': 'การเกษตร', 'zh': '农业品类'}, {'th': 'ชุดว่ายน้ำ', 'zh': '泳衣'}];
export default function ClientVCPage() {
  const nav = useNavigate();
  return (
    <div>
      <h2 style={{ marginTop: 0 }}>垂直达人建联</h2>
      <p style={{ color: "#64748b", fontSize: 14 }}>选择类目浏览有等级的达人并发起建联</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={()=>nav("/client/vertical-connections/my")} style={{ padding: "8px 16px", border: "1px solid var(--xt-accent)", borderRadius: 8, background: "#fff", color: "var(--xt-accent)", cursor: "pointer", fontWeight: 600 }}>我的建联列表</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
        {CATEGORIES.map(c => (
          <div key={c.th} onClick={()=>nav(`/client/vertical-connections/market/category/${encodeURIComponent(c.th)}`)} style={{ background: "#fff", borderRadius: 12, padding: 16, cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", transition: "0.2s" }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--xt-primary)" }}>{c.zh}</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{c.th}</div>
          </div>
        ))}
      </div>
    </div>
  );
}