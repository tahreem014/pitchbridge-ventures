import { useAuth } from "@/hooks/useAuth";
import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";

export const RequireAuth = ({ children, roles }: { children: ReactNode; roles?: string[] }) => {
  const { user, role, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && role && !roles.includes(role)) return <Navigate to="/app" replace />;
  return <>{children}</>;
};
