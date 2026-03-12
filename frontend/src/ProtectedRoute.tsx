import { Navigate, useLocation } from "react-router-dom";
import { getAccessToken, getStoredUser, type RoleName } from "./authApi";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** 仅允许这些角色访问，不传则仅要求已登录 */
  roles?: RoleName[];
}

/**
 * 鉴权保护：未登录跳转登录页（带 from），角色不符跳转对应该角色的门户。
 */
export default function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const location = useLocation();
  const token = getAccessToken();
  const user = getStoredUser();

  if (!token || !user) {
    return <Navigate to={`/login?from=${encodeURIComponent(location.pathname)}`} state={{ from: location }} replace />;
  }

  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    const rolePath = user.role === "admin" ? "/admin" : user.role === "influencer" ? "/influencer" : "/client";
    return <Navigate to={rolePath} replace />;
  }

  return <>{children}</>;
}
