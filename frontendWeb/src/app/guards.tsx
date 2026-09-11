import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { hasRole, homeFor, isWebRole } from "@/lib/rbac";
import type { Role } from "@/types";
import { Loading } from "@/components/ui";

export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading label="Vérification de la session…" />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  // L'application Web est réservée aux rôles internes (ADMIN, CAISSIER, DIRECTION).
  // CLIENT et CHAUFFEUR utilisent exclusivement l'application mobile.
  if (!isWebRole(user.role)) return <Navigate to="/403" replace />;
  return <Outlet />;
}

export function RequireRole({ roles }: { roles: Role[] }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!hasRole(user, ...roles)) return <Navigate to="/403" replace />;
  return <Outlet />;
}

export function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return <Navigate to={user ? homeFor(user.role) : "/login"} replace />;
}
