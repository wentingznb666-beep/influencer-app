import { lazy, StrictMode, Suspense, Component, type ReactNode } from "react";

/** 错误边界：捕获子组件渲染错误，避免整个应用白屏。 */
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 12 }}>
          <h2 style={{ color: "#b91c1c" }}>页面加载异常</h2>
          <p style={{ color: "#64748b", fontSize: 14 }}>{this.state.error?.message || "未知错误"}</p>
          <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", fontWeight: 700 }}>
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Suspense 加载占位：避免懒加载期间显示白屏。 */
function PageLoading() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: 8 }}>
      <div style={{ width: 32, height: 32, border: "3px solid #e2e8f0", borderTopColor: "var(--xt-accent, #f97316)", borderRadius: "50%", animation: "xt-spin 0.7s linear infinite" }} />
      <p style={{ color: "#64748b", fontSize: 13 }}>加载中…</p>
      <style>{"@keyframes xt-spin { to { transform: rotate(360deg); } }"}</style>
    </div>
  );
}
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import Login from "./Login";
import Register from "./Register";
import AdminLayout from "./AdminLayout";
import EmployeeLayout from "./EmployeeLayout";
import ClientLayout from "./ClientLayout";
import InfluencerLayout from "./InfluencerLayout";
import ProtectedRoute from "./ProtectedRoute";
import { I18nextProvider } from "react-i18next";
import { appI18n } from "./i18n/i18nApp";
import { LanguageProvider } from "./i18n";
import { runStorageSelfHealMigration } from "./utils/storageMigration";
import { AppStoreProvider } from "./stores/AppStore";

const App = lazy(() => import("./App"));
const OperationLogsPage = lazy(() => import("./OperationLogsPage"));
const InfluencersPage = lazy(() => import("./admin/InfluencersPage"));
const PointsPage = lazy(() => import("./admin/PointsPage"));
const SettlementPage = lazy(() => import("./admin/SettlementPage"));
const RiskPage = lazy(() => import("./admin/RiskPage"));
const WithdrawalsPage = lazy(() => import("./admin/WithdrawalsPage"));
const UsersPage = lazy(() => import("./admin/UsersPage"));
const MarketOrdersPage = lazy(() => import("./admin/MarketOrdersPage"));
const AdminSkusPage = lazy(() => import("./admin/SkusPage"));
const ProfitPage = lazy(() => import("./admin/ProfitPage"));
const ModelsPage = lazy(() => import("./admin/ModelsPage"));
const ShowcaseInfluencersPage = lazy(() => import("./admin/ShowcaseInfluencersPage"));
const ShowcaseContentCreatorsPage = lazy(() => import("./admin/ShowcaseContentCreatorsPage"));
const MerchantMembersPage = lazy(() => import("./admin/MerchantMembersPage"));
const InfluencerPermissionsPage = lazy(() => import("./admin/InfluencerPermissionsPage"));
const CooperationTypesPage = lazy(() => import("./admin/CooperationTypesPage"));
const CooperationOrdersPage = lazy(() => import("./admin/CooperationOrdersPage"));
const InfluencerDetailPage = lazy(() => import("./admin/InfluencerDetailPage"));
const ClientMarketOrdersPage = lazy(() => import("./client/ClientMarketOrdersPage"));
const MarketOrderEditPage = lazy(() => import("./client/MarketOrderEditPage"));
const ClientSkusPage = lazy(() => import("./client/SkusPage"));
const ClientPointsPage = lazy(() => import("./client/PointsPage"));
const CollabPoolPage = lazy(() => import("./client/CollabPoolPage"));
const CollabMyAppliesPage = lazy(() => import("./client/CollabMyAppliesPage"));
const MatchingCenterPage = lazy(() => import("./client/MatchingCenterPage"));
const MatchingOrdersPage = lazy(() => import("./client/MatchingOrdersPage"));
const MemberCenterPage = lazy(() => import("./client/MemberCenterPage"));
const MerchantTemplatePage = lazy(() => import("./client/MerchantTemplatePage"));
const ClientModelsPage = lazy(() => import("./client/ModelsPage"));
const ClientShowcaseInfluencersPage = lazy(() => import("./client/ClientShowcaseInfluencersPage"));
const ClientShowcaseContentCreatorsPage = lazy(() => import("./client/ClientShowcaseContentCreatorsPage"));
const PaymentProfilePage = lazy(() => import("./influencer/PaymentProfilePage"));
const InfluencerProfilePage = lazy(() => import("./influencer/InfluencerProfilePage"));
const InfluencerDashboard = lazy(() => import("./influencer/InfluencerDashboard"));
const TaskHallPage = lazy(() => import("./influencer/TaskHallPage"));
const InfluencerPermissionPage = lazy(() => import("./influencer/InfluencerPermissionPage"));
const CollabDemandsPage = lazy(() => import("./influencer/CollabDemandsPage"));
const InfluencerMyDemandsPage = lazy(() => import("./influencer/InfluencerMyDemandsPage"));
const ClientOrdersHallPage = lazy(() => import("./influencer/ClientOrdersHallPage"));
// 垂直达人建联模块
const AdminVCProfilesPage = lazy(() => import("./admin/AdminVCProfilesPage"));
const AdminVCConnectionsPage = lazy(() => import("./admin/AdminVCConnectionsPage"));
const AdminVCOrdersPage = lazy(() => import("./admin/AdminVCOrdersPage"));
const VerticalConnectionsDashboard = lazy(() => import("./admin/VerticalConnectionsDashboard"));
const GradeConfigPage = lazy(() => import("./admin/GradeConfigPage"));
const ClientVCPage = lazy(() => import("./client/ClientVCPage"));
const ClientVCInfluencerList = lazy(() => import("./client/ClientVCInfluencerList"));
const ClientVCInviteForm = lazy(() => import("./client/ClientVCInviteForm"));
const ClientVCMyConnections = lazy(() => import("./client/ClientVCMyConnections"));
const ClientVCOrderDetail = lazy(() => import("./client/ClientVCOrderDetail"));
const ClientVCCreateOrder = lazy(() => import("./client/ClientVCCreateOrder"));
const InfluencerVCPage = lazy(() => import("./influencer/InfluencerVCPage"));
const InfluencerVCProfile = lazy(() => import("./influencer/InfluencerVCProfile"));
const InfluencerVCOrders = lazy(() => import("./influencer/InfluencerVCOrders"));
const InfluencerVCOrderDetail = lazy(() => import("./influencer/InfluencerVCOrderDetail"));
const InfluencerVCPayment = lazy(() => import("./influencer/InfluencerVCPayment"));

runStorageSelfHealMigration();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppStoreProvider>
      <BrowserRouter>
        <I18nextProvider i18n={appI18n}>
          <LanguageProvider>
            <Suspense fallback={<PageLoading />}>
            <ErrorBoundary>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
          <Route path="/admin" element={<ProtectedRoute roles={["admin"]}><AdminLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/admin/market-orders" replace />} />
            <Route path="influencers" element={<InfluencersPage />} />
            <Route path="influencers/:id" element={<InfluencerDetailPage />} />
            <Route path="points" element={<PointsPage />} />
            <Route path="settlement" element={<SettlementPage />} />
            <Route path="withdrawals" element={<WithdrawalsPage />} />
            <Route path="risk" element={<RiskPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="profit" element={<ProtectedRoute roles={["admin"]}><ProfitPage /></ProtectedRoute>} />
            <Route path="models" element={<ModelsPage />} />
            <Route path="showcase-influencers" element={<ShowcaseInfluencersPage />} />
            <Route path="showcase-content-creators" element={<ShowcaseContentCreatorsPage />} />
            <Route path="market-orders" element={<MarketOrdersPage />} />
            <Route path="skus" element={<AdminSkusPage />} />
            <Route path="op-logs" element={<OperationLogsPage />} />
            <Route path="merchant-members" element={<MerchantMembersPage />} />
            <Route path="influencer-permissions" element={<InfluencerPermissionsPage />} />
            <Route path="cooperation-types" element={<CooperationTypesPage />} />
            <Route path="cooperation-orders" element={<CooperationOrdersPage />} />
            <Route path="graded-video-hall" element={<ClientOrdersHallPage />} />
            <Route path="vertical-connections" element={<VerticalConnectionsDashboard />} />
            <Route path="vertical-connections/profiles" element={<AdminVCProfilesPage />} />
            <Route path="vertical-connections/records" element={<AdminVCConnectionsPage />} />
            <Route path="vertical-connections/orders" element={<AdminVCOrdersPage />} />
            <Route path="vertical-connections/grade-config" element={<GradeConfigPage />} />
          </Route>
          <Route path="/employee" element={<ProtectedRoute roles={["employee"]}><EmployeeLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/employee/market-orders" replace />} />
            <Route path="influencers" element={<InfluencersPage />} />
            <Route path="influencers/:id" element={<InfluencerDetailPage />} />
            <Route path="models" element={<ModelsPage />} />
            <Route path="showcase-influencers" element={<ShowcaseInfluencersPage />} />
            <Route path="showcase-content-creators" element={<ShowcaseContentCreatorsPage />} />
            <Route path="market-orders" element={<MarketOrdersPage />} />
            <Route path="skus" element={<AdminSkusPage />} />
            <Route path="points" element={<PointsPage />} />
            <Route path="op-logs" element={<OperationLogsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="merchant-members" element={<MerchantMembersPage />} />
            <Route path="influencer-permissions" element={<InfluencerPermissionsPage />} />
            <Route path="cooperation-types" element={<CooperationTypesPage readOnly />} />
            <Route path="cooperation-orders" element={<CooperationOrdersPage />} />
            <Route path="graded-video-hall" element={<ClientOrdersHallPage />} />
            <Route path="vertical-connections" element={<VerticalConnectionsDashboard />} />
            <Route path="vertical-connections/profiles" element={<AdminVCProfilesPage />} />
            <Route path="vertical-connections/records" element={<AdminVCConnectionsPage />} />
            <Route path="vertical-connections/orders" element={<AdminVCOrdersPage />} />
            <Route path="vertical-connections/grade-config" element={<GradeConfigPage />} />
          </Route>
          <Route path="/client" element={<ProtectedRoute roles={["client"]}><ClientLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/client/market-orders" replace />} />
            <Route path="requests" element={<Navigate to="/client/market-orders" replace />} />
            <Route path="requests/:id/edit" element={<Navigate to="/client/market-orders" replace />} />
            <Route path="orders" element={<Navigate to="/client/market-orders" replace />} />
            <Route path="models" element={<ClientModelsPage />} />
            <Route path="showcase-influencers" element={<ClientShowcaseInfluencersPage />} />
            <Route path="showcase-content-creators" element={<ClientShowcaseContentCreatorsPage />} />
            <Route path="market-orders" element={<ClientMarketOrdersPage />} />
            <Route path="matching-orders" element={<MatchingOrdersPage />} />
            <Route path="skus" element={<ClientSkusPage />} />
            <Route path="market-orders/:id/edit" element={<MarketOrderEditPage />} />
            <Route path="points" element={<ClientPointsPage />} />
            <Route path="member-center" element={<MemberCenterPage />} />
            <Route path="merchant-template" element={<MerchantTemplatePage />} />
            <Route path="matching-center" element={<MatchingCenterPage />} />
            <Route path="collab-pool" element={<CollabPoolPage />} />
            <Route path="collab-my-applies" element={<CollabMyAppliesPage />} />
            <Route path="op-logs" element={<OperationLogsPage />} />
            <Route path="merchant-members" element={<MerchantMembersPage />} />
            <Route path="vertical-connections" element={<Navigate to="/client/vertical-connections/market" replace />} />
            <Route path="vertical-connections/market" element={<ClientVCPage />} />
            <Route path="vertical-connections/market/category/:id" element={<ClientVCInfluencerList />} />
            <Route path="vertical-connections/market/invite/:id" element={<ClientVCInviteForm />} />
            <Route path="vertical-connections/my" element={<ClientVCMyConnections />} />
            <Route path="vertical-connections/my/create-order/:connectionId" element={<ClientVCCreateOrder />} />
            <Route path="vertical-connections/my/orders" element={<ClientConnectionOrdersPage />} />
            <Route path="vertical-connections/my/orders/batch" element={<ClientVCBatchOrders />} />
            <Route path="vertical-connections/my/orders/:id" element={<ClientVCOrderDetail />} />
          </Route>
          <Route path="/influencer" element={<ProtectedRoute roles={["influencer"]}><InfluencerLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/influencer/dashboard" replace />} />
            <Route path="dashboard" element={<InfluencerDashboard />} />
            <Route path="task-hall" element={<TaskHallPage />} />
            <Route path="client-orders" element={<ClientOrdersHallPage />} />
            <Route path="payment-profile" element={<PaymentProfilePage />} />
            <Route path="profile" element={<InfluencerProfilePage />} />
            <Route path="permission" element={<InfluencerPermissionPage />} />
            <Route path="demands" element={<CollabDemandsPage />} />
            <Route path="my-demands" element={<InfluencerMyDemandsPage />} />
            <Route path="op-logs" element={<OperationLogsPage />} />
            <Route path="merchant-members" element={<MerchantMembersPage />} />
            <Route path="vertical-connections" element={<Navigate to="/influencer/vertical-connections/profile" replace />} />
            <Route path="vertical-connections/profile" element={<InfluencerVCProfile />} />
            <Route path="vertical-connections/invitations" element={<InfluencerVCPage />} />
            <Route path="vertical-connections/orders" element={<InfluencerVCOrders />} />
            <Route path="vertical-connections/orders/:id" element={<InfluencerVCOrderDetail />} />
            <Route path="vertical-connections/payment" element={<InfluencerVCPayment />} />
          </Route>
          <Route path="/translate" element={<App />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
            </ErrorBoundary>
            </Suspense>
          </LanguageProvider>
        </I18nextProvider>
      </BrowserRouter>
    </AppStoreProvider>
  </StrictMode>
);


