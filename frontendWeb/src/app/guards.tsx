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
  // Le back-office est réservé aux rôles internes et aux chauffeurs
  // (espace livraisons). CLIENT est renvoyé vers son espace boutique.
  if (user.role === "CLIENT") return <Navigate to={homeFor(user.role)} replace />;
  if (!isWebRole(user.role)) return <Navigate to="/403" replace />;
  return <Outlet />;
}

/**
 * Suivi par numéro + téléphone : réservé aux commandes sans compte. Un
 * client connecté suit toutes ses commandes depuis sa liste.
 */
export function SansCompteClient() {
  const { user } = useAuth();
  if (user?.role === "CLIENT") return <Navigate to="/mon-compte/commandes" replace />;
  return <Outlet />;
}

/** Espace client (/mon-compte/*) : réservé aux comptes CLIENT connectés. */
export function RequireClient() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading label="Vérification de la session…" />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user.role !== "CLIENT") return <Navigate to={homeFor(user.role)} replace />;
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
