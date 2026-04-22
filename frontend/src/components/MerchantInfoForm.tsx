import React, { useState } from "react";
import { useAppStore } from "../stores/AppStore";

/**
 * 商家信息必填独立表单组件
 * 对应需求：
 * 1. 拆分原有表单，独立封装
 * 3. 固定必填字段并加红色*标识
 * 4. 模拟 Element Plus 校验提示
 */
export const MerchantInfoForm: React.FC = () => {
  const { merchantTemplate, setMerchantTemplate } = useAppStore();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success">("idle");
  const [isEditing, setIsEditing] = useState(false);

  // 初始检查：如果信息不完整，默认开启编辑模式
  React.useEffect(() => {
    const hasEmpty = Object.values(merchantTemplate).some(v => !v.trim());
    if (hasEmpty) {
      setIsEditing(true);
    }
  }, []);

  const handleChange = (field: keyof typeof merchantTemplate, value: string) => {
    setMerchantTemplate((prev) => ({ ...prev, [field]: value }));
    // 实时清除错误提示
    if (errors[field] && value.trim()) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleBlur = (field: keyof typeof merchantTemplate) => {
    if (!merchantTemplate[field].trim()) {
      setErrors((prev) => ({ ...prev, [field]: "该项为必填项" }));
    }
  };

  const handleSave = () => {
    const newErrors: Record<string, string> = {};
    Object.entries(merchantTemplate).forEach(([key, value]) => {
      if (!value.trim()) {
        newErrors[key] = "该项为必填项";
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsEditing(true); // 报错时强制进入编辑模式
      return;
    }

    setSaveStatus("saving");
    // 强制同步到 localStorage，确保其他页面能立即读取最新值
    localStorage.setItem("app:merchantTemplate", JSON.stringify(merchantTemplate));
    
    setTimeout(() => {
      setSaveStatus("success");
      setIsEditing(false); // 保存成功后退出编辑模式
      setTimeout(() => setSaveStatus("idle"), 2000);
    }, 400);
  };

  const toggleEdit = () => {
    setIsEditing(!isEditing);
    if (!isEditing) {
      setSaveStatus("idle");
    }
  };

  return (
    <section style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, marginBottom: 14, background: "#f8fafc" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid #e2e8f0", paddingBottom: 8 }}>
        <h4 style={{ margin: 0, color: "#334155" }}>商家基本信息（必填模板）</h4>
        <button 
          type="button" 
          onClick={toggleEdit}
          style={{ 
            fontSize: 13, 
            padding: "4px 12px", 
            borderRadius: 6, 
            border: "1px solid var(--xt-accent)", 
            color: "var(--xt-accent)", 
            background: isEditing ? "#eff6ff" : "transparent",
            cursor: "pointer",
            fontWeight: 500
          }}
        >
          {isEditing ? "取消编辑" : "编辑信息"}
        </button>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        
        {/* 商店名称 */}
        <div className="form-item">
          <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
            <span style={{ color: "#dc2626", marginRight: 4 }}>*</span>商店名称
          </label>
          <input
            disabled={!isEditing}
            style={{ 
              width: "100%", 
              padding: "8px 12px", 
              borderRadius: 6, 
              border: `1px solid ${errors.shop_name ? "#dc2626" : "#d1d5db"}`,
              boxSizing: "border-box",
              outline: "none",
              background: isEditing ? "#fff" : "#f1f5f9",
              color: isEditing ? "#000" : "#64748b",
              transition: "all 0.2s"
            }}
            value={merchantTemplate.shop_name}
            onChange={(e) => handleChange("shop_name", e.target.value)}
            onBlur={() => handleBlur("shop_name")}
            placeholder="请输入商店名称"
          />
          {errors.shop_name && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>{errors.shop_name}</div>}
        </div>

        {/* 销售产品类型 */}
        <div className="form-item">
          <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
            <span style={{ color: "#dc2626", marginRight: 4 }}>*</span>销售产品类型
          </label>
          <input
            disabled={!isEditing}
            style={{ 
              width: "100%", 
              padding: "8px 12px", 
              borderRadius: 6, 
              border: `1px solid ${errors.product_type ? "#dc2626" : "#d1d5db"}`,
              boxSizing: "border-box",
              outline: "none",
              background: isEditing ? "#fff" : "#f1f5f9",
              color: isEditing ? "#000" : "#64748b"
            }}
            value={merchantTemplate.product_type}
            onChange={(e) => handleChange("product_type", e.target.value)}
            onBlur={() => handleBlur("product_type")}
            placeholder="例如：美妆护肤、服饰配件"
          />
          {errors.product_type && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>{errors.product_type}</div>}
        </div>

        {/* 销售额情况 */}
        <div className="form-item">
          <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
            <span style={{ color: "#dc2626", marginRight: 4 }}>*</span>销售额情况
          </label>
          <input
            disabled={!isEditing}
            style={{ 
              width: "100%", 
              padding: "8px 12px", 
              borderRadius: 6, 
              border: `1px solid ${errors.sales_summary ? "#dc2626" : "#d1d5db"}`,
              boxSizing: "border-box",
              outline: "none",
              background: isEditing ? "#fff" : "#f1f5f9",
              color: isEditing ? "#000" : "#64748b"
            }}
            value={merchantTemplate.sales_summary}
            onChange={(e) => handleChange("sales_summary", e.target.value)}
            onBlur={() => handleBlur("sales_summary")}
            placeholder="例如：月均 100w+ 泰铢"
          />
          {errors.sales_summary && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>{errors.sales_summary}</div>}
        </div>

        {/* 店铺链接 */}
        <div className="form-item">
          <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
            <span style={{ color: "#dc2626", marginRight: 4 }}>*</span>店铺链接
          </label>
          <input
            disabled={!isEditing}
            style={{ 
              width: "100%", 
              padding: "8px 12px", 
              borderRadius: 6, 
              border: `1px solid ${errors.shop_link ? "#dc2626" : "#d1d5db"}`,
              boxSizing: "border-box",
              outline: "none",
              background: isEditing ? "#fff" : "#f1f5f9",
              color: isEditing ? "#000" : "#64748b"
            }}
            type="url"
            value={merchantTemplate.shop_link}
            onChange={(e) => handleChange("shop_link", e.target.value)}
            onBlur={() => handleBlur("shop_link")}
            placeholder="https://..."
          />
          {errors.shop_link && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>{errors.shop_link}</div>}
        </div>

        {/* 店铺评分 */}
        <div className="form-item">
          <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
            <span style={{ color: "#dc2626", marginRight: 4 }}>*</span>店铺评分
          </label>
          <input
            disabled={!isEditing}
            style={{ 
              width: "100%", 
              padding: "8px 12px", 
              borderRadius: 6, 
              border: `1px solid ${errors.shop_rating ? "#dc2626" : "#d1d5db"}`,
              boxSizing: "border-box",
              outline: "none",
              background: isEditing ? "#fff" : "#f1f5f9",
              color: isEditing ? "#000" : "#64748b"
            }}
            value={merchantTemplate.shop_rating}
            onChange={(e) => handleChange("shop_rating", e.target.value)}
            onBlur={() => handleBlur("shop_rating")}
            placeholder="例如：4.8/5.0"
          />
          {errors.shop_rating && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>{errors.shop_rating}</div>}
        </div>

        {/* 用户评价 */}
        <div className="form-item">
          <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
            <span style={{ color: "#dc2626", marginRight: 4 }}>*</span>用户评价
          </label>
          <textarea
            disabled={!isEditing}
            style={{ 
              width: "100%", 
              padding: "8px 12px", 
              borderRadius: 6, 
              border: `1px solid ${errors.user_reviews ? "#dc2626" : "#d1d5db"}`,
              boxSizing: "border-box",
              outline: "none",
              minHeight: 80,
              resize: "vertical",
              background: isEditing ? "#fff" : "#f1f5f9",
              color: isEditing ? "#000" : "#64748b"
            }}
            value={merchantTemplate.user_reviews}
            onChange={(e) => handleChange("user_reviews", e.target.value)}
            onBlur={() => handleBlur("user_reviews")}
            placeholder="请简述用户评价情况"
          />
          {errors.user_reviews && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>{errors.user_reviews}</div>}
        </div>

        {/* 保存按钮 */}
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            style={{
              padding: "10px 24px",
              background: "var(--xt-accent)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontWeight: 600,
              cursor: saveStatus === "saving" ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              opacity: saveStatus === "saving" ? 0.7 : 1
            }}
          >
            {saveStatus === "idle" && "保存商家信息"}
            {saveStatus === "saving" && "保存中..."}
            {saveStatus === "success" && "保存成功"}
          </button>
          {saveStatus === "success" && (
            <span style={{ color: "#10b981", fontSize: 14, fontWeight: 500 }}>
              ✨ 信息已保存并同步，可以去发布订单了
            </span>
          )}
          {!isEditing && saveStatus === "idle" && (
            <span style={{ color: "#64748b", fontSize: 13 }}>
              当前为查看模式，如需修改请点击右上角“编辑信息”
            </span>
          )}
        </div>

      </div>
    </section>
  );
};
