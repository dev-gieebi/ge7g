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
  // L'application Web est réservée aux rôles internes et aux chauffeurs
  // (espace livraisons). CLIENT n'y a pas accès.
  if (!isWebRole(user.role)) return <Navigate to="/403" replace />;
  return <Outlet />;
}

/**
 * `strict` désactive le passe-droit SUPERADMIN : pour les espaces
 * personnels (ex. les livraisons du chauffeur connecté).
 */
export function RequireRole({ roles, strict = false }: { roles: Role[]; strict?: boolean }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const allowed = strict ? roles.includes(user.role) : hasRole(user, ...roles);
  if (!allowed) return <Navigate to="/403" replace />;
  return <Outlet />;
}

export function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return <Navigate to={user ? homeFor(user.role) : "/login"} replace />;
}
