import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";

import LoginView from "@/views/LoginView.vue";
import DashboardLayout from "@/layouts/DashboardLayout.vue";
import CooperationTypesView from "@/views/CooperationTypesView.vue";
import EmployeeWorkbenchView from "@/views/EmployeeWorkbenchView.vue";
import ClientMerchantTemplateView from "@/views/ClientMerchantTemplateView.vue";
import ClientCreateVideoOrderView from "@/views/ClientCreateVideoOrderView.vue";
import ClientOrdersView from "@/views/ClientOrdersView.vue";

type Role = "admin" | "employee" | "client" | "influencer";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", component: LoginView },
    {
      path: "/admin",
      component: DashboardLayout,
      meta: { roles: ["admin"] satisfies Role[] },
      children: [
        { path: "", redirect: "/admin/video-orders" },
        { path: "cooperation-types", component: CooperationTypesView },
        { path: "video-orders", component: EmployeeWorkbenchView },
      ],
    },
    {
      path: "/employee",
      component: DashboardLayout,
      meta: { roles: ["employee"] satisfies Role[] },
      children: [
        { path: "", redirect: "/employee/video-orders" },
        { path: "cooperation-types", component: CooperationTypesView },
        { path: "video-orders", component: EmployeeWorkbenchView },
      ],
    },
    {
      path: "/client",
      component: DashboardLayout,
      meta: { roles: ["client"] satisfies Role[] },
      children: [
        { path: "", redirect: "/client/video-orders" },
        { path: "merchant-template", component: ClientMerchantTemplateView },
        { path: "video-orders/create", component: ClientCreateVideoOrderView },
        { path: "video-orders", component: ClientOrdersView },
      ],
    },
    {
      path: "/",
      redirect: () => {
        const auth = useAuthStore();
        const role = auth.user?.role;
        if (role === "admin") return "/admin";
        if (role === "employee") return "/employee";
        if (role === "client") return "/client";
        if (role === "influencer") return "/login";
        return "/login";
      },
    },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.ready) auth.initFromStorage();
  if (to.path === "/login") return true;
  if (!auth.user) await auth.ensureMe();
  if (!auth.user) return { path: "/login" };

  const roles = (to.meta?.roles as Role[] | undefined) || undefined;
  if (roles && !roles.includes(auth.user.role)) {
    if (auth.user.role === "admin") return { path: "/admin" };
    if (auth.user.role === "employee") return { path: "/employee" };
    if (auth.user.role === "client") return { path: "/client" };
    return { path: "/login" };
  }
  return true;
});

