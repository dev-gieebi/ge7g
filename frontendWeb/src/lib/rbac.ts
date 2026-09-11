import type { Role, User } from "@/types";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrateur",
  CAISSIER: "Caissier",
  DIRECTION: "Direction",
  SUPERADMIN: "Super administrateur",
};

export const can = (user: User | null, permission: string) =>
  !!user && (user.role === "ADMIN" || user.role === "DIRECTION" || user.role === "SUPERADMIN" || user.permissions.includes(permission));

export const hasRole = (user: User | null, ...roles: Role[]) =>
  !!user && (user.role === "SUPERADMIN" || roles.includes(user.role));

export const canSeeCosts = (user: User | null) =>
  hasRole(user, "ADMIN", "DIRECTION") || hasRole(user, "SUPERADMIN") || can(user, "products.view_cost");

/** Rôles autorisés sur l'application Web (plateforme interne G7 Energy). */
export const WEB_ROLES: Role[] = ["ADMIN", "CAISSIER", "DIRECTION", "SUPERADMIN"];

export const isWebRole = (role: Role) => WEB_ROLES.includes(role);

export const homeFor = (role: Role): string => {
  switch (role) {
    case "CAISSIER":
      return "/caisse";
    case "ADMIN":
    case "DIRECTION":
    case "SUPERADMIN":
      return "/dashboard";
    default:
      // CLIENT : application mobile uniquement
      return "/403";
  }
};
