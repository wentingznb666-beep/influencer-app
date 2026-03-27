import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import Login from "./Login";
import AdminLayout from "./AdminLayout";
import EmployeeLayout from "./EmployeeLayout";
import InfluencersPage from "./admin/InfluencersPage";
import PointsPage from "./admin/PointsPage";
import SettlementPage from "./admin/SettlementPage";
import RiskPage from "./admin/RiskPage";
import WithdrawalsPage from "./admin/WithdrawalsPage";
import UsersPage from "./admin/UsersPage";
import MarketOrdersPage from "./admin/MarketOrdersPage";
import AdminOrdersPage from "./admin/OrdersPage";
import AdminSkusPage from "./admin/SkusPage";
import ProfitPage from "./admin/ProfitPage";
import ModelsPage from "./admin/ModelsPage";
import ClientLayout from "./ClientLayout";
import ClientMarketOrdersPage from "./client/ClientMarketOrdersPage";
import MarketOrderEditPage from "./client/MarketOrderEditPage";
import ClientSkusPage from "./client/SkusPage";
import ClientPointsPage from "./client/PointsPage";
import ClientModelsPage from "./client/ModelsPage";
import InfluencerLayout from "./InfluencerLayout";
/**
 * 性能优化（仅生产环境）：达人端路由懒加载，减小登录后首屏 JS 体积。
 * - 仅影响加载时机，不改变任何业务逻辑与页面布局。
 */
import ClientOrdersHallPageDev from "./influencer/ClientOrdersHallPage";
import InfluencerPointsPageDev from "./influencer/PointsPage";
import WithdrawPageDev from "./influencer/WithdrawPage";

const ClientOrdersHallPage = import.meta.env.PROD
  ? lazy(() => import("./influencer/ClientOrdersHallPage"))
  : ClientOrdersHallPageDev;
const InfluencerPointsPage = import.meta.env.PROD ? lazy(() => import("./influencer/PointsPage")) : InfluencerPointsPageDev;
const WithdrawPage = import.meta.env.PROD ? lazy(() => import("./influencer/WithdrawPage")) : WithdrawPageDev;
import ProtectedRoute from "./ProtectedRoute";
import App from "./App";
import { LanguageProvider } from "./i18n";
import OperationLogsPage from "./OperationLogsPage";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<ProtectedRoute roles={["admin"]}><AdminLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/admin/orders" replace />} />
            <Route path="influencers" element={<InfluencersPage />} />
            <Route path="points" element={<PointsPage />} />
            <Route path="settlement" element={<SettlementPage />} />
            <Route path="withdrawals" element={<WithdrawalsPage />} />
            <Route path="risk" element={<RiskPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="profit" element={<ProtectedRoute roles={["admin"]}><ProfitPage /></ProtectedRoute>} />
            <Route path="models" element={<ModelsPage />} />
            <Route path="market-orders" element={<MarketOrdersPage />} />
            <Route path="orders" element={<AdminOrdersPage />} />
            <Route path="skus" element={<AdminSkusPage />} />
            <Route path="op-logs" element={<OperationLogsPage />} />
          </Route>
          <Route path="/employee" element={<ProtectedRoute roles={["employee"]}><EmployeeLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/employee/orders" replace />} />
            <Route path="orders" element={<AdminOrdersPage />} />
            <Route path="models" element={<ModelsPage />} />
            <Route path="market-orders" element={<MarketOrdersPage />} />
            <Route path="skus" element={<AdminSkusPage />} />
            <Route path="points" element={<PointsPage />} />
            <Route path="op-logs" element={<OperationLogsPage />} />
          </Route>
          <Route path="/client" element={<ProtectedRoute roles={["client"]}><ClientLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/client/market-orders" replace />} />
            <Route path="requests" element={<Navigate to="/client/market-orders" replace />} />
            <Route path="requests/:id/edit" element={<Navigate to="/client/market-orders" replace />} />
            <Route path="orders" element={<Navigate to="/client/market-orders" replace />} />
            <Route path="models" element={<ClientModelsPage />} />
            <Route path="market-orders" element={<ClientMarketOrdersPage />} />
            <Route path="skus" element={<ClientSkusPage />} />
            <Route path="market-orders/:id/edit" element={<MarketOrderEditPage />} />
            <Route path="points" element={<ClientPointsPage />} />
            <Route path="op-logs" element={<OperationLogsPage />} />
          </Route>
          <Route path="/influencer" element={<ProtectedRoute roles={["influencer"]}><InfluencerLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/influencer/client-orders" replace />} />
            <Route path="client-orders" element={<Suspense fallback={<p>加载中…</p>}><ClientOrdersHallPage /></Suspense>} />
            <Route path="points" element={<Suspense fallback={<p>加载中…</p>}><InfluencerPointsPage /></Suspense>} />
            <Route path="withdraw" element={<Suspense fallback={<p>加载中…</p>}><WithdrawPage /></Suspense>} />
            <Route path="op-logs" element={<OperationLogsPage />} />
          </Route>
          <Route path="/translate" element={<App />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>
);
