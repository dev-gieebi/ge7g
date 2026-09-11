import { ShoppingCart, Package, Settings, Warehouse, LayoutDashboard, type LucideIcon } from "lucide-react";
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

const ADMIN_DIR: Role[] = ["ADMIN", "DIRECTION"];

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
      { label: "Tableau de bord", to: "/dashboard", icon: LayoutDashboard, roles: ADMIN_DIR },
      /*{ label: "Rapports", to: "/rapports", icon: BarChart3, roles: ADMIN_DIR },
      { label: "Notifications", to: "/notifications", icon: Bell, roles: ADMIN_DIR },
    */],
  },
  {
    title: "Gestion",
    items: [
      // { label: "Commercial", to: "/clients", icon: Users, roles: ADMIN_DIR, paths: ["/clients", "/commandes", "/factures"] },
      { label: "Catalogue", to: "/produits", icon: Package, roles: ADMIN_DIR, paths: ["/produits", "/categories", "/unites", "/prix"] },
      { label: "Approvisionnement", to: "/stock", icon: Warehouse, roles: ADMIN_DIR, paths: ["/stock", "/fournisseurs", "/achats"] },
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
    title: "Caisse",
    items: [
      { label: "Caisse", to: "/caisse", icon: ShoppingCart, roles: ["ADMIN", "CAISSIER"], paths: ["/caisse", "/caisse/ventes"] },
    ],
  },
  {
    title: "Système",
    items: [{ label: "Paramètres", to: "/parametres", icon: Settings, roles: ADMIN_DIR, paths: ["/parametres", "/audit"] }],
  },
];

export const navigationFor = (role: Role): NavGroup[] =>
  role === "SUPERADMIN"
    ? NAVIGATION
    : NAVIGATION.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) })).filter(
        (g) => g.items.length > 0,
      );
