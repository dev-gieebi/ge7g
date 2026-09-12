import type { Role, User } from "@/types";

export const ROLE_LABELS: Record<Role, string> = {
  AG_LOGISTIQUE: "Agent Logistique",
  CAISSIER: "Caissier",
  DIRECTION: "Direction",
  SUPERADMIN: "Super administrateur",
};

export const can = (user: User | null, permission: string) =>
  !!user && (user.role === "AG_LOGISTIQUE" || user.role === "DIRECTION" || user.role === "SUPERADMIN" || user.permissions.includes(permission));

export const hasRole = (user: User | null, ...roles: Role[]) =>
  !!user && (user.role === "SUPERADMIN" || roles.includes(user.role));

export const canSeeCosts = (user: User | null) =>
  hasRole(user, "AG_LOGISTIQUE", "DIRECTION") || hasRole(user, "SUPERADMIN") || can(user, "products.view_cost");

/** Rôles autorisés sur l'application Web (plateforme interne G7 Energy). */
export const WEB_ROLES: Role[] = ["AG_LOGISTIQUE", "CAISSIER", "DIRECTION", "SUPERADMIN"];

export const isWebRole = (role: Role) => WEB_ROLES.includes(role);

export const homeFor = (role: Role): string => {
  switch (role) {
    case "CAISSIER":
      return "/caisse";
    case "AG_LOGISTIQUE":
    case "DIRECTION":
    case "SUPERADMIN":
      return "/dashboard";
    default:
      // CLIENT : application mobile uniquement
      return "/403";
  }
};
