import { compactPx } from "../responsive";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../stores/AppStore";
import { saveClientMerchantInfoTemplate } from "../clientApi";

/**
 * 商家信息必填独立表单组件
 * 对应需求：
 * 1. 拆分原有表单，独立封装
 * 3. 固定必填字段并加红色*标识
 * 4. 模拟 Element Plus 校验提示
 */
export const MerchantInfoForm: React.FC = () => {
  const { t } = useTranslation();
  const { merchantTemplate, setMerchantTemplate } = useAppStore();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success">("idle");
  const [isEditing, setIsEditing] = useState(false);
  const [saveError, setSaveError] = useState<string>("");

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

  /**
   * 保存商家模板：前端本地持久化 + 后端模板接口双写，确保发布撮合前校验可通过。
   */
  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    Object.entries(merchantTemplate).forEach(([key, value]) => {
      if (!value.trim()) {
        newErrors[key] = "该项为必填项";
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setSaveError("请先完善所有必填项后再保存");
      setIsEditing(true); // 报错时强制进入编辑模式
      return;
    }

    setSaveError("");
    setSaveStatus("saving");
    try {
      await saveClientMerchantInfoTemplate({
        shop_name: merchantTemplate.shop_name.trim(),
        product_type: merchantTemplate.product_type.trim(),
        shop_link: merchantTemplate.shop_link.trim(),
      });

      // 强制同步到 localStorage，确保其他页面能立即读取最新值
      localStorage.setItem("app:merchantTemplate", JSON.stringify(merchantTemplate));
      setSaveStatus("success");
      setIsEditing(false); // 保存成功后退出编辑模式
      window.setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (e) {
      setSaveStatus("idle");
      setSaveError(e instanceof Error ? e.message : t("保存失败，请稍后重试"));
      setIsEditing(true);
    }
  };

  const toggleEdit = () => {
    setIsEditing(!isEditing);
    if (!isEditing) {
      setSaveStatus("idle");
    }
  };

  return (
    <section style={{ border: "1px solid #e2e8f0", borderRadius: compactPx(10), padding: compactPx(12), marginBottom: compactPx(14), background: "#f8fafc" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: compactPx(16), borderBottom: "1px solid #e2e8f0", paddingBottom: compactPx(8) }}>
        <h4 style={{ margin: 0, color: "#334155" }}>商家基本信息（必填模板）</h4>
        <button 
          type="button" 
          onClick={toggleEdit}
          style={{ 
            fontSize: compactPx(13), 
            padding: "4px 12px", 
            borderRadius: compactPx(6), 
            border: "1px solid var(--xt-accent)", 
            color: "var(--xt-accent)", 
            background: isEditing ? "#eff6ff" : "transparent",
            cursor: "pointer",
            fontWeight: 500
          }}
        >
          {isEditing ? t("取消编辑") : "编辑信息"}
        </button>
      </div>

      <div style={{ display: "grid", gap: compactPx(16) }}>
        
        {/* 商店名称 */}
        <div className="form-item">
          <label style={{ display: "block", marginBottom: compactPx(6), fontWeight: 500, fontSize: compactPx(14) }}>
            <span style={{ color: "#dc2626", marginRight: compactPx(4) }}>*</span>商店名称
          </label>
          <input
            disabled={!isEditing}
            style={{ 
              width: "100%", 
              padding: "8px 12px", 
              borderRadius: compactPx(6), 
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
          {errors.shop_name && <div style={{ color: "#dc2626", fontSize: compactPx(12), marginTop: compactPx(4) }}>{errors.shop_name}</div>}
        </div>

        {/* 销售产品类型 */}
        <div className="form-item">
          <label style={{ display: "block", marginBottom: compactPx(6), fontWeight: 500, fontSize: compactPx(14) }}>
            <span style={{ color: "#dc2626", marginRight: compactPx(4) }}>*</span>销售产品类型
          </label>
          <input
            disabled={!isEditing}
            style={{ 
              width: "100%", 
              padding: "8px 12px", 
              borderRadius: compactPx(6), 
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
          {errors.product_type && <div style={{ color: "#dc2626", fontSize: compactPx(12), marginTop: compactPx(4) }}>{errors.product_type}</div>}
        </div>

        {/* 销售额情况 */}
        <div className="form-item">
          <label style={{ display: "block", marginBottom: compactPx(6), fontWeight: 500, fontSize: compactPx(14) }}>
            <span style={{ color: "#dc2626", marginRight: compactPx(4) }}>*</span>销售额情况
          </label>
          <input
            disabled={!isEditing}
            style={{ 
              width: "100%", 
              padding: "8px 12px", 
              borderRadius: compactPx(6), 
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
          {errors.sales_summary && <div style={{ color: "#dc2626", fontSize: compactPx(12), marginTop: compactPx(4) }}>{errors.sales_summary}</div>}
        </div>

        {/* 店铺链接 */}
        <div className="form-item">
          <label style={{ display: "block", marginBottom: compactPx(6), fontWeight: 500, fontSize: compactPx(14) }}>
            <span style={{ color: "#dc2626", marginRight: compactPx(4) }}>*</span>店铺链接
          </label>
          <input
            disabled={!isEditing}
            style={{ 
              width: "100%", 
              padding: "8px 12px", 
              borderRadius: compactPx(6), 
              border: `1px solid ${errors.shop_link ? "#dc2626" : "#d1d5db"}`,
              boxSizing: "border-box",
              outline: "none",
              background: isEditing ? "#fff" : "#f1f5f9",
              color: isEditing ? "#000" : "#64748b"
            }}
            type="url"
            inputMode="url"
            value={merchantTemplate.shop_link}
            onChange={(e) => handleChange("shop_link", e.target.value)}
            onBlur={() => handleBlur("shop_link")}
            placeholder="https://..."
          />
          {errors.shop_link && <div style={{ color: "#dc2626", fontSize: compactPx(12), marginTop: compactPx(4) }}>{errors.shop_link}</div>}
        </div>

        {/* 保存按钮 */}
        <div style={{ marginTop: compactPx(8), display: "flex", alignItems: "center", gap: compactPx(12) }}>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saveStatus === "saving"}
            style={{
              padding: "10px 24px",
              background: "var(--xt-accent)",
              color: "#fff",
              border: "none",
              borderRadius: compactPx(8),
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
            <span style={{ color: "#10b981", fontSize: compactPx(14), fontWeight: 500 }}>
              ✨ 信息已保存并同步，可以去发布订单了
            </span>
          )}
          {!isEditing && saveStatus === "idle" && (
            <span style={{ color: "#64748b", fontSize: compactPx(13) }}>
              当前为查看模式，如需修改请点击右上角“编辑信息”
            </span>
          )}
          {saveError ? (
            <span style={{ color: "#dc2626", fontSize: compactPx(13) }}>
              {saveError}
            </span>
          ) : null}
        </div>

      </div>
    </section>
  );
};
