import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import Login from "./Login";
import AdminLayout from "./AdminLayout";
import MaterialsPage from "./admin/MaterialsPage";
import TasksPage from "./admin/TasksPage";
import InfluencersPage from "./admin/InfluencersPage";
import SubmissionsPage from "./admin/SubmissionsPage";
import PointsPage from "./admin/PointsPage";
import SettlementPage from "./admin/SettlementPage";
import RiskPage from "./admin/RiskPage";
import WithdrawalsPage from "./admin/WithdrawalsPage";
import UsersPage from "./admin/UsersPage";
import ClientLayout from "./ClientLayout";
import RequestsPage from "./client/RequestsPage";
import OrdersPage from "./client/OrdersPage";
import ClientMarketOrdersPage from "./client/ClientMarketOrdersPage";
import WorksPage from "./client/WorksPage";
import ClientPointsPage from "./client/PointsPage";
import InfluencerLayout from "./InfluencerLayout";
import TaskHallPage from "./influencer/TaskHallPage";
import MyTasksPage from "./influencer/MyTasksPage";
import InfluencerPointsPage from "./influencer/PointsPage";
import WithdrawPage from "./influencer/WithdrawPage";
import ClientOrdersHallPage from "./influencer/ClientOrdersHallPage";
import ProtectedRoute from "./ProtectedRoute";
import App from "./App";
import { LanguageProvider } from "./i18n";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<ProtectedRoute roles={["admin", "employee"]}><AdminLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/admin/materials" replace />} />
            <Route path="materials" element={<MaterialsPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="influencers" element={<InfluencersPage />} />
            <Route path="submissions" element={<SubmissionsPage />} />
            <Route path="points" element={<PointsPage />} />
            <Route path="settlement" element={<SettlementPage />} />
            <Route path="withdrawals" element={<WithdrawalsPage />} />
            <Route path="risk" element={<RiskPage />} />
            <Route path="users" element={<UsersPage />} />
          </Route>
          <Route path="/client" element={<ProtectedRoute roles={["client"]}><ClientLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/client/requests" replace />} />
            <Route path="requests" element={<RequestsPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="market-orders" element={<ClientMarketOrdersPage />} />
            <Route path="works" element={<WorksPage />} />
            <Route path="points" element={<ClientPointsPage />} />
          </Route>
          <Route path="/influencer" element={<ProtectedRoute roles={["influencer"]}><InfluencerLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/influencer/tasks" replace />} />
            <Route path="tasks" element={<TaskHallPage />} />
            <Route path="client-orders" element={<ClientOrdersHallPage />} />
            <Route path="my-tasks" element={<MyTasksPage />} />
            <Route path="points" element={<InfluencerPointsPage />} />
            <Route path="withdraw" element={<WithdrawPage />} />
          </Route>
          <Route path="/translate" element={<App />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>
);
