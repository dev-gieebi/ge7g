import type { Role, User } from "@/types";

export const ROLE_LABELS: Record<Role, string> = {
  LG_ADMIN: "Agent Logistique",
  CAISSIER: "Caissier",
  DG_ADMIN: "Direction",
  SUPERADMIN: "Super administrateur",
  CDG_ADMIN: "Contrôle de gestion",
};

export const can = (user: User | null, permission: string) =>
  !!user && (user.role === "LG_ADMIN" || user.role === "DG_ADMIN" || user.role === "CDG_ADMIN" || user.role === "SUPERADMIN" || user.permissions.includes(permission));

export const hasRole = (user: User | null, ...roles: Role[]) =>
  !!user && (user.role === "SUPERADMIN" || roles.includes(user.role));

export const canSeeCosts = (user: User | null) =>
  hasRole(user, "LG_ADMIN", "DG_ADMIN", "CDG_ADMIN") || hasRole(user, "SUPERADMIN") || can(user, "products.view_cost");

/** Rôles autorisés sur l'application Web (plateforme interne G7 Energy). */
export const WEB_ROLES: Role[] = ["LG_ADMIN", "CAISSIER", "DG_ADMIN", "SUPERADMIN", "CDG_ADMIN"];

export const isWebRole = (role: Role) => WEB_ROLES.includes(role);

export const homeFor = (role: Role): string => {
  switch (role) {
    case "CAISSIER":
      return "/caisse";
    case "LG_ADMIN":
    case "DG_ADMIN":
    case "SUPERADMIN":
    case "CDG_ADMIN":
      return "/dashboard";
    default:
      // CLIENT : application mobile uniquement
      return "/403";
  }
};
