import { ShoppingCart, ShoppingBag, Package, Settings, Warehouse, LayoutDashboard, FileSignature, BarChart3, Receipt, type LucideIcon } from "lucide-react";
// [LOGISTIQUE] Remettre « Truck » dans l'import ci-dessus avec la section Logistique.
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

/** Pilotage : Direction, agent logistique et approvisionneur. */
const ADMINS: Role[] = [...ADMIN_DIR, "CDG_ADMIN"];

/** Commercial (commandes, proformas, ventes) : sans l'approvisionneur (CDG_ADMIN). */
const COMMERCIAL: Role[] = ADMIN_DIR;

/** Gestion (catalogue, approvisionnement) : sans l'agent logistique (LG_ADMIN). */
const GESTION: Role[] = ["DG_ADMIN", "CDG_ADMIN"];

/** Rapports (chiffres financiers) : Direction et Super admin uniquement. */
const REPORTS: Role[] = ["DG_ADMIN"];

/**
 * Menu principal Web, plateforme interne G7 Energy, montée sous /admin.
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
      { label: "Commandes en ligne", to: "/admin/commandes", icon: ShoppingBag, roles: COMMERCIAL, paths: ["/admin/commandes"] },
      { label: "Proforma", to: "/admin/devis", icon: FileSignature, roles: COMMERCIAL, paths: ["/admin/devis"] },
      { label: "Ventes", to: "/admin/caisse/ventes", icon: Receipt, roles: [...COMMERCIAL, "CAISSIER"], paths: ["/admin/caisse/ventes"] },
    ],
  },
  {
    title: "Gestion",
    items: [
      { label: "Catalogue", to: "/admin/produits", icon: Package, roles: GESTION, paths: ["/admin/produits", "/admin/categories", "/admin/unites", "/admin/prix"] },
      { label: "Approvisionnement", to: "/admin/stock", icon: Warehouse, roles: GESTION, paths: ["/admin/stock", "/admin/fournisseurs", "/admin/achats", "/admin/inventaires"] },
    ],
  },
  // [LOGISTIQUE] Section mise en pause : décommenter pour la réafficher.
  // {
  //   title: "Logistique",
  //   items: [
  //     {
  //       label: "Logistique",
  //       to: "/admin/logistique",
  //       icon: Truck,
  //       roles: ADMIN_DIR,
  //       paths: ["/admin/logistique", "/admin/preparation", "/admin/chauffeurs", "/admin/vehicules", "/admin/missions", "/admin/livraisons"],
  //     },
  //   ],
  // },
  // [CHAUFFEUR] Espace chauffeur en pause (voir CHAUFFEUR.md).
  // {
  //   title: "Livraisons",
  //   items: [
  //     { label: "Mes livraisons", to: "/admin/mes-livraisons", icon: Truck, roles: ["CHAUFFEUR"], paths: ["/admin/mes-livraisons"] },
  //   ],
  // },
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
