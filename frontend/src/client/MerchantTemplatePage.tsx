import React from "react";
import { Link } from "react-router-dom";
import { MerchantInfoForm } from "../components/MerchantInfoForm";

/**
 * 商家信息模板页面
 * 对应需求：把商家信息模块，放到撮合业务组里面
 */
const MerchantTemplatePage: React.FC = () => {
  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>商家信息模板</h2>
          <p style={{ color: "#64748b", marginTop: 8 }}>
            请完善您的商家基本信息。完善后，发布撮合订单时将自动引用此模板数据。
          </p>
        </div>
        <Link 
          to="/client/matching-center" 
          style={{ 
            textDecoration: "none", 
            color: "#fff", 
            background: "var(--xt-accent)", 
            padding: "8px 16px", 
            borderRadius: 8, 
            fontWeight: 600,
            fontSize: 14
          }}
        >
          前往撮合中心发布订单
        </Link>
      </div>
      
      <div style={{ maxWidth: 800, background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }}>
        <MerchantInfoForm />
        <div style={{ marginTop: 20, textAlign: "right" }}>
          <p style={{ fontSize: 13, color: "#94a3b8" }}>
            * 信息已实时保存至本地缓存，发布订单时将自动提交。
          </p>
        </div>
      </div>
    </div>
  );
};

export default MerchantTemplatePage;
