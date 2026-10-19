import { ShoppingCart, ShoppingBag, Package, Settings, Warehouse, LayoutDashboard, FileSignature, BarChart3, Receipt, Truck, type LucideIcon } from "lucide-react";
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
 * Menu principal Web — plateforme interne G7 Energy, montée sous /admin.
 * La boutique publique occupe la racine du site.
 */
export const NAVIGATION: NavGroup[] = [
  {
    title: "Pilotage",
    items: [
      { label: "Tableau de bord", to: "/admin/dashboard", icon: LayoutDashboard, roles: ADMINS },
      { label: "Rapports", to: "/admin/rapports", icon: BarChart3, roles: REPORTS },
    ],
  },
  {
    title: "Commercial",
    items: [
      { label: "Caisse", to: "/admin/caisse", icon: ShoppingCart, roles: ["LG_ADMIN", "CAISSIER"], end: true },
      { label: "Commandes en ligne", to: "/admin/commandes", icon: ShoppingBag, roles: ADMINS, paths: ["/admin/commandes"] },
      { label: "Devis", to: "/admin/devis", icon: FileSignature, roles: ADMINS, paths: ["/admin/devis"] },
      { label: "Ventes", to: "/admin/caisse/ventes", icon: Receipt, roles: [...ADMINS, "CAISSIER"], paths: ["/admin/caisse/ventes"] },
    ],
  },
  {
    title: "Gestion",
    items: [
      { label: "Catalogue", to: "/admin/produits", icon: Package, roles: ADMINS, paths: ["/admin/produits", "/admin/categories", "/admin/unites", "/admin/prix"] },
      { label: "Approvisionnement", to: "/admin/stock", icon: Warehouse, roles: ADMINS, paths: ["/admin/stock", "/admin/fournisseurs", "/admin/achats"] },
    ],
  },
  {
    title: "Logistique",
    items: [
      {
        label: "Logistique",
        to: "/admin/logistique",
        icon: Truck,
        roles: ADMIN_DIR,
        paths: ["/admin/logistique", "/admin/preparation", "/admin/chauffeurs", "/admin/vehicules", "/admin/missions", "/admin/livraisons"],
      },
    ],
  },
  {
    title: "Livraisons",
    items: [
      { label: "Mes livraisons", to: "/admin/mes-livraisons", icon: Truck, roles: ["CHAUFFEUR"], paths: ["/admin/mes-livraisons"] },
    ],
  },
  {
    title: "Système",
    items: [{ label: "Paramètres", to: "/admin/parametres", icon: Settings, roles: ["SUPERADMIN"], paths: ["/admin/parametres", "/admin/audit"] }],
  },
];

/**
 * Entrées visibles pour un rôle. SUPERADMIN voit tout le périmètre admin
 * sauf les espaces personnels réservés à un autre rôle (ex. « Mes
 * livraisons », qui n'a de sens que pour le chauffeur connecté).
 */
const visibleFor = (item: NavItem, role: Role): boolean =>
  role === "SUPERADMIN" ? !item.roles.every((r) => r === "CHAUFFEUR") : item.roles.includes(role);

export const navigationFor = (role: Role): NavGroup[] =>
  NAVIGATION.map((g) => ({ ...g, items: g.items.filter((i) => visibleFor(i, role)) })).filter(
    (g) => g.items.length > 0,
  );
