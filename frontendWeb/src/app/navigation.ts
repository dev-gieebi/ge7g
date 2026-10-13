import { ShoppingCart, Package, Settings, Warehouse, LayoutDashboard, FileSignature, BarChart3, Receipt, type LucideIcon } from "lucide-react";
import type { Role } from "@/types";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  roles: Role[];
  /** Préfixes de routes qui gardent l'entrée active (pages accessibles via onglets). */
  paths?: string[];
  /** Si vrai, seule la correspondance exacte de `to` active l'entrée. */
  end?: boolean;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

const ADMIN_DIR: Role[] = ["LG_ADMIN", "DG_ADMIN"];

/** Pilotage + Commercial + Gestion : CDG_ADMIN a accès à tout ce périmètre. */
const ADMINS: Role[] = [...ADMIN_DIR, "CDG_ADMIN"];

/** Rapports de suivi : Direction et CDG_ADMIN (LG_ADMIN n'y a pas accès). */
const REPORTS: Role[] = ["DG_ADMIN", "CDG_ADMIN"];

/**
 * Menu principal Web — plateforme interne G7 Energy.
 * Chaque entrée mène à une page hub ; les sous-pages sont accessibles
 * via les onglets (ModuleTabs) en haut de chaque page.
 * Les rôles CLIENT et CHAUFFEUR n'ont aucun accès Web (application mobile).
 */
export const NAVIGATION: NavGroup[] = [
  {
    title: "Pilotage",
    items: [
      { label: "Tableau de bord", to: "/dashboard", icon: LayoutDashboard, roles: ADMINS },
      { label: "Rapports", to: "/rapports", icon: BarChart3, roles: REPORTS },
      /*{ label: "Notifications", to: "/notifications", icon: Bell, roles: ADMIN_DIR },
    */],
  },
  {
    title: "Commercial",
    items: [
      { label: "Caisse", to: "/caisse", icon: ShoppingCart, roles: ["LG_ADMIN", "CAISSIER"], end: true },
      { label: "Devis", to: "/devis", icon: FileSignature, roles: ADMINS, paths: ["/devis"] },
      { label: "Ventes", to: "/caisse/ventes", icon: Receipt, roles: [...ADMINS, "CAISSIER"], paths: ["/caisse/ventes"] },
    ],
  },
  {
    title: "Gestion",
    items: [
      // { label: "Commercial", to: "/clients", icon: Users, roles: ADMIN_DIR, paths: ["/clients", "/commandes", "/factures"] },
      { label: "Catalogue", to: "/produits", icon: Package, roles: ADMINS, paths: ["/produits", "/categories", "/unites", "/prix"] },
      { label: "Approvisionnement", to: "/stock", icon: Warehouse, roles: ADMINS, paths: ["/stock", "/fournisseurs", "/achats"] },
    ],
  },
 /* {
    title: "Logistique",
    items: [
      {
        label: "Logistique",
        to: "/logistique",
        icon: Truck,
        roles: ADMIN_DIR,
        paths: ["/logistique", "/preparation", "/chauffeurs", "/vehicules", "/missions", "/livraisons", "/livraisons/nouvelle"],
      },
    ],
  },*/
  {
    title: "Système",
    items: [{ label: "Paramètres", to: "/parametres", icon: Settings, roles: ["SUPERADMIN"], paths: ["/parametres", "/audit"] }],
  },
];

export const navigationFor = (role: Role): NavGroup[] =>
  role === "SUPERADMIN"
    ? NAVIGATION
    : NAVIGATION.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) })).filter(
        (g) => g.items.length > 0,
      );
