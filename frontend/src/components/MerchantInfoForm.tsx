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

  return (
    <section style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, marginBottom: 14, background: "#f8fafc" }}>
      <h4 style={{ marginTop: 0, marginBottom: 16, color: "#334155", borderBottom: "1px solid #e2e8f0", paddingBottom: 8 }}>商家基本信息（必填模板）</h4>
      <div style={{ display: "grid", gap: 16 }}>
        
        {/* 商店名称 */}
        <div className="form-item">
          <label style={{ display: "block", marginBottom: 6, fontWeight: 500, fontSize: 14 }}>
            <span style={{ color: "#dc2626", marginRight: 4 }}>*</span>商店名称
          </label>
          <input
            style={{ 
              width: "100%", 
              padding: "8px 12px", 
              borderRadius: 6, 
              border: `1px solid ${errors.shop_name ? "#dc2626" : "#d1d5db"}`,
              boxSizing: "border-box",
              outline: "none",
              transition: "border-color 0.2s"
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
            style={{ 
              width: "100%", 
              padding: "8px 12px", 
              borderRadius: 6, 
              border: `1px solid ${errors.product_type ? "#dc2626" : "#d1d5db"}`,
              boxSizing: "border-box",
              outline: "none"
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
            style={{ 
              width: "100%", 
              padding: "8px 12px", 
              borderRadius: 6, 
              border: `1px solid ${errors.sales_summary ? "#dc2626" : "#d1d5db"}`,
              boxSizing: "border-box",
              outline: "none"
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
            style={{ 
              width: "100%", 
              padding: "8px 12px", 
              borderRadius: 6, 
              border: `1px solid ${errors.shop_link ? "#dc2626" : "#d1d5db"}`,
              boxSizing: "border-box",
              outline: "none"
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
            style={{ 
              width: "100%", 
              padding: "8px 12px", 
              borderRadius: 6, 
              border: `1px solid ${errors.shop_rating ? "#dc2626" : "#d1d5db"}`,
              boxSizing: "border-box",
              outline: "none"
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
            style={{ 
              width: "100%", 
              padding: "8px 12px", 
              borderRadius: 6, 
              border: `1px solid ${errors.user_reviews ? "#dc2626" : "#d1d5db"}`,
              boxSizing: "border-box",
              outline: "none",
              minHeight: 80,
              resize: "vertical"
            }}
            value={merchantTemplate.user_reviews}
            onChange={(e) => handleChange("user_reviews", e.target.value)}
            onBlur={() => handleBlur("user_reviews")}
            placeholder="请简述用户评价情况"
          />
          {errors.user_reviews && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>{errors.user_reviews}</div>}
        </div>

      </div>
    </section>
  );
};
