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
import CollabPoolPage from "./client/CollabPoolPage";
import CollabMyAppliesPage from "./client/CollabMyAppliesPage";
import MatchingCenterPage from "./client/MatchingCenterPage";
import MatchingOrdersPage from "./client/MatchingOrdersPage";
import MemberCenterPage from "./client/MemberCenterPage";
import ClientModelsPage from "./client/ModelsPage";
import ShowcaseInfluencersPage from "./admin/ShowcaseInfluencersPage";
import ShowcaseContentCreatorsPage from "./admin/ShowcaseContentCreatorsPage";
import ClientShowcaseInfluencersPage from "./client/ClientShowcaseInfluencersPage";
import ClientShowcaseContentCreatorsPage from "./client/ClientShowcaseContentCreatorsPage";
import InfluencerLayout from "./InfluencerLayout";
/**
 * 鎬ц兘浼樺寲锛堜粎鐢熶骇鐜锛夛細杈句汉绔矾鐢辨噿鍔犺浇锛屽噺灏忕櫥褰曞悗棣栧睆 JS 浣撶Н銆?
 * - 浠呭奖鍝嶅姞杞芥椂鏈猴紝涓嶆敼鍙樹换浣曚笟鍔￠€昏緫涓庨〉闈㈠竷灞€銆?
 */
import ClientOrdersHallPageDev from "./influencer/ClientOrdersHallPage";
import InfluencerPointsPageDev from "./influencer/PointsPage";
import WithdrawPageDev from "./influencer/WithdrawPage";
import PaymentProfilePage from "./influencer/PaymentProfilePage";
import TaskHallPage from "./influencer/TaskHallPage";
import InfluencerPermissionPage from "./influencer/InfluencerPermissionPage";
import CollabDemandsPage from "./influencer/CollabDemandsPage";
import MerchantMembersPage from "./admin/MerchantMembersPage";
import InfluencerPermissionsPage from "./admin/InfluencerPermissionsPage";
import ProtectedRoute from "./ProtectedRoute";
import App from "./App";
import { LanguageProvider } from "./i18n";
import OperationLogsPage from "./OperationLogsPage";
import { runStorageSelfHealMigration } from "./utils/storageMigration";

const ClientOrdersHallPage = import.meta.env.PROD
  ? lazy(() => import("./influencer/ClientOrdersHallPage"))
  : ClientOrdersHallPageDev;
const InfluencerPointsPage = import.meta.env.PROD ? lazy(() => import("./influencer/PointsPage")) : InfluencerPointsPageDev;
const WithdrawPage = import.meta.env.PROD ? lazy(() => import("./influencer/WithdrawPage")) : WithdrawPageDev;

runStorageSelfHealMigration();

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
            <Route path="showcase-influencers" element={<ShowcaseInfluencersPage />} />
            <Route path="showcase-content-creators" element={<ShowcaseContentCreatorsPage />} />
            <Route path="market-orders" element={<MarketOrdersPage />} />
            <Route path="orders" element={<AdminOrdersPage />} />
            <Route path="skus" element={<AdminSkusPage />} />
            <Route path="op-logs" element={<OperationLogsPage />} />
            <Route path="merchant-members" element={<MerchantMembersPage />} />
            <Route path="influencer-permissions" element={<InfluencerPermissionsPage />} />
          </Route>
          <Route path="/employee" element={<ProtectedRoute roles={["employee"]}><EmployeeLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/employee/orders" replace />} />
            <Route path="orders" element={<AdminOrdersPage />} />
            <Route path="models" element={<ModelsPage />} />
            <Route path="showcase-influencers" element={<ShowcaseInfluencersPage />} />
            <Route path="showcase-content-creators" element={<ShowcaseContentCreatorsPage />} />
            <Route path="market-orders" element={<MarketOrdersPage />} />
            <Route path="skus" element={<AdminSkusPage />} />
            <Route path="points" element={<PointsPage />} />
            <Route path="op-logs" element={<OperationLogsPage />} />
            <Route path="merchant-members" element={<MerchantMembersPage />} />
            <Route path="influencer-permissions" element={<InfluencerPermissionsPage />} />
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
            <Route path="matching-center" element={<MatchingCenterPage />} />
            <Route path="collab-pool" element={<CollabPoolPage />} />
            <Route path="collab-my-applies" element={<CollabMyAppliesPage />} />
            <Route path="op-logs" element={<OperationLogsPage />} />
            <Route path="merchant-members" element={<MerchantMembersPage />} />
          </Route>
          <Route path="/influencer" element={<ProtectedRoute roles={["influencer"]}><InfluencerLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/influencer/client-orders" replace />} />
            <Route path="client-orders" element={<Suspense fallback={<p>加载中…</p>}><ClientOrdersHallPage /></Suspense>} />
            <Route path="points" element={<Suspense fallback={<p>加载中…</p>}><InfluencerPointsPage /></Suspense>} />
            <Route path="withdraw" element={<Suspense fallback={<p>加载中…</p>}><WithdrawPage /></Suspense>} />
            <Route path="task-hall" element={<TaskHallPage />} />
            <Route path="payment-profile" element={<PaymentProfilePage />} />
            <Route path="permission" element={<InfluencerPermissionPage />} />
            <Route path="demands" element={<CollabDemandsPage />} />
            <Route path="op-logs" element={<OperationLogsPage />} />
            <Route path="merchant-members" element={<MerchantMembersPage />} />
          </Route>
          <Route path="/translate" element={<App />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>
);




